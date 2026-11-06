#!/usr/bin/env node
/**
 * e2e.mjs — browser QA for the built site (dist/). Exit code 1 on any failure.
 *   node tests/e2e.mjs        (expects a preview or development build in dist/)
 */
import { chromium, devices } from '../scripts/lib/playwright.mjs';
import { startServer } from '../scripts/serve.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const PORT = 4191;
const BASE = `http://127.0.0.1:${PORT}/`;
const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const PAGES = ['index.html', 'privacy.html', 'disclaimer.html', 'accessibility.html', 'dev/index.html'];
const IGNORE_CONSOLE = [/GL Driver Message/i, /GPU stall/i, /WebGL/i];

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail && !ok ? ` — ${detail}` : ''}`); };

const server = await startServer({ root: DIST, listenPort: PORT });
const browser = await chromium.launch();

function watch(page, { allow404 = [] } = {}) {
  const errors = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (IGNORE_CONSOLE.some((re) => re.test(t))) return;
    if (/404/.test(t) && allow404.length) return;
    errors.push(t);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));
  page.on('response', (r) => { if (r.status() >= 400 && !allow404.some((p) => r.url().endsWith(p))) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  return errors;
}

async function scrollThrough(page, step = 0.6) {
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  const vh = page.viewportSize().height;
  for (let y = 0; y <= total; y += Math.round(vh * step)) {
    await page.evaluate((v) => window.RumpfLaw ? window.RumpfLaw.scrollTo(v) : window.scrollTo(0, v), y);
    await page.waitForTimeout(140);
  }
  await page.evaluate(() => window.RumpfLaw ? window.RumpfLaw.scrollTo(1e7) : window.scrollTo(0, 1e7));
  await page.waitForTimeout(1600);
}

async function runAxe(page, { exclude = [], disable = [] } = {}) {
  await page.addScriptTag({ content: axeSource });
  return page.evaluate(async ({ exclude, disable }) => {
    const r = await window.axe.run({ exclude: exclude.map((s) => [s]) }, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] },
      rules: Object.fromEntries(disable.map((id) => [id, { enabled: false }])),
    });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, sample: v.nodes[0]?.target?.join(' ') }));
  }, { exclude, disable });
}

// ── 1. Every page: loads clean, SEO invariants, links resolve, axe (reduced motion = static audit)
console.log('\n[pages]');
for (const p of PAGES) {
  // bypassCSP only so the axe audit script can be injected; the CSP itself is asserted above/below.
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', bypassCSP: true });
  const page = await ctx.newPage();
  const errors = watch(page, { allow404: p.startsWith('dev/') ? ['previews.json'] : [] });
  await page.goto(BASE + p, { waitUntil: 'load' });
  await page.waitForTimeout(700);
  check(`${p}: no console/page/network errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
  const seo = await page.evaluate(() => ({
    title: document.title, desc: document.querySelector('meta[name=description]')?.content || '', h1: document.querySelectorAll('h1').length,
    lang: document.documentElement.lang, robots: document.querySelector('meta[name=robots]')?.content, csp: !!document.querySelector('meta[http-equiv=Content-Security-Policy]'),
    ids: [...document.querySelectorAll('[id]')].map((e) => e.id), anchors: [...document.querySelectorAll('a[href^="#"]')].map((a) => a.getAttribute('href').slice(1)).filter(Boolean),
    hrefs: [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')),
  }));
  check(`${p}: title + description`, seo.title.length > 10 && seo.desc.length > 40);
  check(`${p}: exactly one h1`, seo.h1 === 1, `found ${seo.h1}`);
  check(`${p}: lang + CSP meta`, seo.lang === 'en' && seo.csp);
  check(`${p}: non-production build is noindex`, /noindex/.test(seo.robots || ''));
  const dupes = seo.ids.filter((id, i) => seo.ids.indexOf(id) !== i);
  check(`${p}: unique ids`, dupes.length === 0, dupes.join(','));
  const missing = seo.anchors.filter((a) => !seo.ids.includes(decodeURIComponent(a)));
  check(`${p}: in-page anchors resolve`, missing.length === 0, missing.join(','));
  const broken = seo.hrefs.filter((h) => !/^(https?:|tel:|mailto:|#)/.test(h)).map((h) => h.split('#')[0]).filter(Boolean)
    .filter((h) => { const f = join(DIST, dirname(p), h); return !existsSync(f) && !existsSync(join(f, 'index.html')); });
  check(`${p}: internal links resolve`, broken.length === 0, broken.join(','));
  const v = await runAxe(page);
  const serious = v.filter((x) => ['serious', 'critical'].includes(x.impact));
  check(`${p}: axe — no serious/critical violations`, serious.length === 0, JSON.stringify(serious));
  if (v.length) console.log(`     axe minor/moderate: ${v.filter((x) => !serious.includes(x)).map((x) => `${x.id}(${x.n})`).join(', ') || 'none'}`);
  await ctx.close();
}

// ── 2. 404 page via missing path
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const res = await page.goto(BASE + 'missing/page', { waitUntil: 'load' });
  check('404: served for missing paths', res.status() === 404 && (await page.textContent('h1')).includes('couldn'));
  await ctx.close();
}

// ── 3. Motion: intro lock, full scroll-through, nothing left hidden, overflow
console.log('\n[motion — desktop]');
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = watch(page);
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(500);
  const locked = await page.evaluate(() => document.documentElement.classList.contains('is-locked'));
  await page.mouse.wheel(0, 800); await page.waitForTimeout(250);
  const yDuringIntro = await page.evaluate(() => window.scrollY);
  check('intro: scroll is locked during the intro', locked && yDuringIntro === 0, `locked=${locked} y=${yDuringIntro}`);
  await page.waitForTimeout(3600);
  const after = await page.evaluate(() => ({ locked: document.documentElement.classList.contains('is-locked'), intro: !!document.querySelector('[data-intro]'), ready: document.documentElement.classList.contains('motion-ready'), webgl: document.querySelector('[data-hero]').classList.contains('has-webgl') }));
  check('intro: unlocks and removes itself', !after.locked && !after.intro, JSON.stringify(after));
  check('motion: ready + WebGL tide field active', after.ready && after.webgl, JSON.stringify(after));
  check('hero: pinned (pin-spacer present)', await page.evaluate(() => !!document.querySelector('[data-hero]').closest('.pin-spacer')));
  check('practice: horizontal mode at 1440×900', await page.evaluate(() => document.getElementById('practice').classList.contains('practice--horizontal')));
  const fits = await page.evaluate(() => { const p = document.querySelector('[data-practice-pin]'); return p.scrollHeight <= window.innerHeight + 2; });
  check('practice: pinned panel fits the viewport', fits);
  await scrollThrough(page);
  const hidden = await page.evaluate(() => [...document.querySelectorAll('[data-reveal], [data-split-reveal], .practice-card__inner, [data-step], .chart__place > *, [data-chart-office]')]
    .filter((el) => { const cs = getComputedStyle(el); return cs.visibility === 'hidden' || Number(cs.opacity) < 0.98; })
    .map((el) => el.className.baseVal ?? el.className).slice(0, 8));
  check('motion: no content left hidden after full scroll-through', hidden.length === 0, JSON.stringify(hidden));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('layout: no horizontal overflow (1440)', overflow <= 0, `${overflow}px`);
  check('motion: no errors during scroll-through', errors.length === 0, errors.slice(0, 3).join(' | '));
  const vitals = await page.evaluate(() => window.__rlVitals);
  check('perf: LCP < 2.5s (local)', vitals && vitals.LCP > 0 && vitals.LCP < 2500, JSON.stringify(vitals));
  check('perf: CLS < 0.1', vitals && vitals.CLS < 0.1, JSON.stringify(vitals));
  const bytes = await page.evaluate(() => performance.getEntriesByType('resource').reduce((s, r) => s + (r.encodedBodySize || r.transferSize || 0), 0) + (performance.getEntriesByType('navigation')[0]?.encodedBodySize || 0));
  check('perf: page weight < 1.2 MB', bytes < 1.2e6, `${Math.round(bytes / 1024)} KB`);
  console.log(`     page weight: ${Math.round(bytes / 1024)} KB · LCP ${vitals?.LCP}ms · CLS ${vitals?.CLS?.toFixed?.(3)}`);
  // Second visit in the same session skips the intro.
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(400);
  check('intro: skipped on repeat visit in session', await page.evaluate(() => !document.querySelector('[data-intro]') && !document.documentElement.classList.contains('is-locked')));
  await ctx.close();
}

// ── 4. Deep link skips intro and lands on target
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '#contact', { waitUntil: 'load' });
  await page.waitForTimeout(2200);
  const r = await page.evaluate(() => ({ intro: !!document.querySelector('[data-intro]'), top: Math.round(document.getElementById('contact').getBoundingClientRect().top) }));
  check('deep link: no intro, lands on #contact', !r.intro && Math.abs(r.top) < 120, JSON.stringify(r));
  await ctx.close();
}

// ── 5. Reduced motion: static, nothing hidden, no pins
console.log('\n[reduced motion / no-JS]');
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => ({
    pins: document.querySelectorAll('.pin-spacer').length, intro: !!document.querySelector('[data-intro]'), locked: document.documentElement.classList.contains('is-locked'),
    hidden: [...document.querySelectorAll('[data-reveal], [data-split-reveal], [data-hero-title], .practice-card__inner')].filter((el) => getComputedStyle(el).visibility === 'hidden' || Number(getComputedStyle(el).opacity) < 0.98).length,
  }));
  check('reduced motion: no pins, no intro, no lock, nothing hidden', r.pins === 0 && !r.intro && !r.locked && r.hidden === 0, JSON.stringify(r));
  await ctx.close();
}
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'load' });
  const r = await page.evaluate(() => ({ title: getComputedStyle(document.querySelector('[data-hero-title]')).visibility, intro: getComputedStyle(document.querySelector('[data-intro]')).display, cards: getComputedStyle(document.querySelector('.practice-card__inner')).visibility }));
  check('no-JS: hero, cards visible; intro not shown', r.title === 'visible' && r.cards === 'visible' && r.intro === 'none', JSON.stringify(r));
  await ctx.close();
}

// ── 6. Keyboard, menu, form, mobile overflow
console.log('\n[interaction]');
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'load' });
  await page.keyboard.press('Tab');
  check('keyboard: first Tab focuses skip link', await page.evaluate(() => document.activeElement?.classList.contains('skip-link')));
  await page.keyboard.press('Enter'); await page.waitForTimeout(300);
  check('keyboard: skip link moves focus to <main>', await page.evaluate(() => document.activeElement?.id === 'main'));
  // Form validation
  await page.evaluate(() => document.getElementById('contact').scrollIntoView());
  await page.click('[data-inquiry-submit]');
  const inv = await page.evaluate(() => [...document.querySelectorAll('[aria-invalid=true]')].map((e) => e.name));
  check('form: empty submit flags required fields', ['name', 'phone', 'message', 'ack'].every((n) => inv.includes(n)), inv.join(','));
  check('form: focus moves to first invalid field', await page.evaluate(() => document.activeElement?.name === 'name'));
  await page.fill('#f-name', 'Test Person');
  await page.fill('#f-phone', '609-555-0100');
  await page.fill('#f-message', 'I have a question about a residential closing.');
  await page.check('#f-ack');
  await page.waitForTimeout(2600);
  await page.click('[data-inquiry-submit]');
  await page.waitForTimeout(1300);
  const status = await page.evaluate(() => ({ text: document.querySelector('[data-inquiry-status]').textContent, state: document.querySelector('[data-inquiry-status]').dataset.state }));
  check('form: valid submission succeeds (demo adapter)', status.state === 'success', JSON.stringify(status));
  await ctx.close();
}
for (const [label, opts] of [['mobile 390', { ...devices['iPhone 14'] }], ['tablet 768', { viewport: { width: 768, height: 1024 } }]]) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = watch(page);
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(4200);
  await scrollThrough(page, 0.8);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(`${label}: no horizontal overflow`, overflow <= 0, `${overflow}px`);
  const hidden = await page.evaluate(() => [...document.querySelectorAll('[data-reveal], [data-split-reveal], .practice-card__inner, [data-step]')].filter((el) => getComputedStyle(el).visibility === 'hidden' || Number(getComputedStyle(el).opacity) < 0.98).length);
  check(`${label}: nothing left hidden`, hidden === 0, `${hidden} hidden`);
  check(`${label}: no errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
  if (label.startsWith('mobile')) {
    await page.evaluate(() => window.RumpfLaw.scrollTo(0)); await page.waitForTimeout(800);
    await page.click('[data-menu-toggle]'); await page.waitForTimeout(900);
    const m = await page.evaluate(() => ({ open: !document.querySelector('[data-mobile-menu]').hidden, expanded: document.querySelector('[data-menu-toggle]').getAttribute('aria-expanded'), inert: document.getElementById('main').inert, focus: document.activeElement?.closest('[data-mobile-menu]') !== null }));
    check('mobile menu: opens, main inert, focus inside', m.open && m.expanded === 'true' && m.inert && m.focus, JSON.stringify(m));
    await page.keyboard.press('Escape'); await page.waitForTimeout(800);
    const c = await page.evaluate(() => ({ hidden: document.querySelector('[data-mobile-menu]').hidden, focus: document.activeElement?.hasAttribute('data-menu-toggle'), inert: document.getElementById('main').inert }));
    check('mobile menu: Escape closes and restores focus', c.hidden && c.focus && !c.inert, JSON.stringify(c));
  }
  await ctx.close();
}

await browser.close();
server.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed${failed.length ? ` — ${failed.length} FAILED` : ''}`);
process.exit(failed.length ? 1 : 0);
