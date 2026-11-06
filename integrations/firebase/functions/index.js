/**
 * Rumpf Law, P.C. — website middleware on Firebase (Cloud Functions 2nd gen + Firestore).
 *
 *   POST /inquiry  — validated, rate-limited contact-form intake → Firestore `inquiries`
 *   POST /collect  — privacy-first telemetry: aggregate daily counters only → `stats/{day}`
 *
 * Privacy by design: no IP addresses are stored (only a salted, truncated hash used as a
 * short-lived rate-limit key with a TTL), telemetry is aggregated counts, and the optional
 * staff notification email contains no client details — staff read inquiries in the console.
 */
import { onRequest } from 'firebase-functions/v2/https';
import { setGlobalOptions, logger } from 'firebase-functions/v2';
import { defineString, defineSecret } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { createHash } from 'node:crypto';
import { validateInquiry } from './lib/inquiry-schema.js';

setGlobalOptions({ region: 'us-east4', maxInstances: 5 });
initializeApp();
const db = getFirestore();

const ALLOWED_ORIGINS = defineString('ALLOWED_ORIGINS', { default: 'https://domusgpt.github.io', description: 'Comma-separated origins allowed to call these endpoints' });
const NOTIFY_TO = defineString('NOTIFY_TO', { default: '', description: 'Optional comma-separated staff emails (requires the Trigger Email extension)' });
const IP_SALT = defineSecret('IP_SALT');
const RATE_LIMIT_PER_HOUR = 5;
const EVENTS = new Set(['page_view', 'section_view', 'cta_click', 'faq_toggle', 'inquiry_submit', 'intro_complete', 'nav_anchor', 'menu_open', 'web_vital', 'js_error']);

function cors(req, res) {
  const allowed = ALLOWED_ORIGINS.value().split(',').map((s) => s.trim()).filter(Boolean);
  const origin = req.get('origin') || '';
  const ok = allowed.includes(origin);
  if (ok) { res.set('Access-Control-Allow-Origin', origin); res.set('Vary', 'Origin'); }
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'content-type');
  res.set('Access-Control-Max-Age', '3600');
  return ok;
}

function parseBody(req) {
  if (req.body && typeof req.body === 'object' && Object.keys(req.body).length) return req.body;
  const raw = typeof req.body === 'string' ? req.body : req.rawBody?.toString('utf8') || '';
  try { return JSON.parse(raw || '{}'); } catch { return null; }
}

export const inquiry = onRequest({ secrets: [IP_SALT], timeoutSeconds: 15, memory: '256MiB' }, async (req, res) => {
  const originOk = cors(req, res);
  if (req.method === 'OPTIONS') return void res.status(originOk ? 204 : 403).end();
  if (!originOk) return void res.status(403).json({ ok: false, error: 'origin' });
  if (req.method !== 'POST') return void res.status(405).json({ ok: false, error: 'method' });

  const body = parseBody(req);
  if (!body) return void res.status(400).json({ ok: false, error: 'body' });
  const { ok, data, errors } = validateInquiry(body);
  if (!ok) return void res.status(422).json({ ok: false, error: 'invalid', fields: Object.keys(errors) });

  // Rate limit: salted hash of the client IP, bucketed per hour; documents expire via a
  // Firestore TTL policy on `expireAt` (configure once — see README).
  const key = createHash('sha256').update(`${req.ip}|${IP_SALT.value()}`).digest('hex').slice(0, 32);
  const bucket = db.collection('_ratelimits').doc(`${key}_${new Date().toISOString().slice(0, 13)}`);
  const allowed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(bucket);
    const n = (snap.exists ? snap.get('n') : 0) + 1;
    tx.set(bucket, { n, expireAt: new Date(Date.now() + 2 * 3600_000) });
    return n <= RATE_LIMIT_PER_HOUR;
  });
  if (!allowed) return void res.status(429).json({ ok: false, error: 'rate' });

  const ref = await db.collection('inquiries').add({
    ...data,
    page: String(body.page || '').slice(0, 200),
    siteVersion: String(body.v || '').slice(0, 40),
    status: 'new',
    createdAt: FieldValue.serverTimestamp(),
  });
  const to = NOTIFY_TO.value().split(',').map((s) => s.trim()).filter(Boolean);
  if (to.length) {
    await db.collection('mail').add({
      to,
      message: {
        subject: `New website inquiry (${data.matter})`,
        text: `A new inquiry was received through the website (matter type: ${data.matter}).\nReference: ${ref.id}\nReview it in the Firebase console. Client details are intentionally not included in this email.`,
      },
    });
  }
  logger.info('inquiry stored', { id: ref.id, matter: data.matter });
  res.status(200).json({ ok: true });
});

export const collect = onRequest({ timeoutSeconds: 10, memory: '128MiB', maxInstances: 3 }, async (req, res) => {
  const originOk = cors(req, res);
  if (req.method === 'OPTIONS') return void res.status(originOk ? 204 : 403).end();
  if (!originOk || req.method !== 'POST') return void res.status(204).end();
  const evt = parseBody(req);
  const name = String(evt?.name || '').replace(/[^a-z_]/g, '').slice(0, 40);
  if (!EVENTS.has(name)) return void res.status(204).end();
  const tag = (v) => String(v ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40) || 'na';
  const p = evt.props || {};
  const field = {
    section_view: `section_view__${tag(p.id)}`,
    cta_click: `cta_click__${tag(p.cta)}`,
    inquiry_submit: `inquiry_submit__${tag(p.status)}`,
    web_vital: `web_vital__${tag(p.name)}__${tag(p.rating)}`,
  }[name] || name;
  await db.doc(`stats/${new Date().toISOString().slice(0, 10)}`).set({ [field]: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  res.status(204).end();
});
