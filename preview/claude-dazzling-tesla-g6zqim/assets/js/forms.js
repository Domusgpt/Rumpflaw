/**
 * forms.js — inquiry form pipeline:
 *   collect → validate (shared schema) → bot heuristics → throttle → transport → UI + telemetry
 * Transports (config.forms.inquiry.adapter): demo | endpoint | disabled.
 * Telemetry never includes form contents — only status, matter type and field names.
 */
import { validateInquiry, looksAutomated } from './lib/inquiry-schema.js';

const $ = (s, r = document) => r.querySelector(s);
const FIELDS = ['name', 'phone', 'email', 'message', 'ack'];
const THROTTLE_MS = 60_000;

export function initForms({ config, telemetry }) {
  const form = $('[data-inquiry]');
  if (!form) return;
  const { adapter, endpoint } = config.forms.inquiry;
  const status = $('[data-inquiry-status]', form);
  const modeNote = $('[data-inquiry-mode]', form);
  const submit = $('[data-inquiry-submit]', form);
  const renderedAt = performance.now();
  const phone = config.firm.phone;
  const phoneE164 = config.firm.phoneE164;

  if (adapter === 'demo') {
    modeNote.hidden = false;
    modeNote.textContent = 'Preview build: messages are validated but not sent. Online inquiries will be connected before launch — please call the office in the meantime.';
  } else if (adapter === 'disabled' || (adapter === 'endpoint' && !endpoint)) {
    modeNote.hidden = false;
    modeNote.textContent = '';
    modeNote.append('Online messages are not available yet. Please call ');
    const a = Object.assign(document.createElement('a'), { href: `tel:${phoneE164}`, textContent: phone });
    modeNote.append(a, '.');
    [...form.elements].forEach((el) => { el.disabled = true; });
    return;
  }

  const setStatus = (text, state = '') => { status.textContent = text; status.dataset.state = state; };

  function showErrors(errors) {
    for (const name of FIELDS) {
      const input = form.elements[name];
      const slot = $(`[data-error-for="${name}"]`, form);
      const msg = errors[name] || '';
      if (slot) slot.textContent = msg;
      if (input) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    }
  }

  // After a failed submit, clear each error as soon as the user fixes it — on input, not
  // on blur — so messages never collapse between mousedown and mouseup (missed clicks).
  const revalidate = (e) => {
    const name = e.target?.name;
    if (!FIELDS.includes(name) || !form.dataset.submitted) return;
    const { errors } = validateInquiry(collect());
    const related = name === 'phone' || name === 'email' ? ['phone', 'email'] : [name];
    for (const f of related) {
      if (errors[f]) continue; // never add new errors while typing; only clear fixed ones
      const slot = $(`[data-error-for="${f}"]`, form);
      if (slot) slot.textContent = '';
      form.elements[f]?.setAttribute('aria-invalid', 'false');
    }
  };
  form.addEventListener('input', revalidate);
  form.addEventListener('change', revalidate);

  function collect() {
    const raw = Object.fromEntries(new FormData(form).entries());
    raw.ack = form.elements.ack.checked;
    return raw;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    form.dataset.submitted = '1';
    const raw = collect();
    const { ok, data, errors } = validateInquiry(raw);
    showErrors(errors);
    if (!ok) {
      setStatus('Please review the highlighted fields.', 'error');
      const first = FIELDS.find((f) => errors[f]);
      form.elements[first]?.focus();
      telemetry.track('inquiry_submit', { status: 'invalid', fields: Object.keys(errors).join(',') });
      return;
    }
    const bot = looksAutomated({ honeypot: raw.company, elapsedMs: performance.now() - renderedAt });
    if (bot) {
      success();
      telemetry.track('inquiry_submit', { status: 'filtered', reason: bot });
      return;
    }
    if (throttled()) {
      setStatus('Thanks — we already received a message from you a moment ago. Please call if it’s urgent.', 'error');
      return;
    }
    form.classList.add('is-sending');
    submit.disabled = true;
    setStatus('Sending…');
    try {
      if (adapter === 'demo') await new Promise((r) => setTimeout(r, 900));
      else await post(endpoint, { ...data, page: location.pathname, v: config.build.v });
      markSent();
      success();
      telemetry.track('inquiry_submit', { status: 'ok', matter: data.matter, adapter });
    } catch (err) {
      setStatus(`Sorry — your message couldn’t be sent. Please call ${phone}.`, 'error');
      telemetry.track('inquiry_submit', { status: 'error', adapter, reason: String(err?.message || err).slice(0, 60) });
    } finally {
      form.classList.remove('is-sending');
      submit.disabled = false;
    }
  });

  function success() {
    form.reset();
    delete form.dataset.submitted;
    showErrors({});
    setStatus(adapter === 'demo'
      ? 'Preview: your message passed validation. (Not sent — this is a preview build.)'
      : 'Thank you — your message has been sent. We’ll be in touch during office hours.', 'success');
  }
}

async function post(url, body) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 12_000);
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), credentials: 'omit', signal: ctl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json().catch(() => ({}));
    if (json.ok === false) throw new Error(json.error || 'rejected');
  } finally {
    clearTimeout(timer);
  }
}

function throttled() {
  try { return Date.now() - Number(sessionStorage.getItem('rl:lastInquiry') || 0) < THROTTLE_MS; } catch { return false; }
}
function markSent() {
  try { sessionStorage.setItem('rl:lastInquiry', String(Date.now())); } catch {}
}
