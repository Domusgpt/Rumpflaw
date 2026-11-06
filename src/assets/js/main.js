/**
 * main.js — boot. Every module is isolated: one failing feature never blanks the page.
 */
import { config } from './config.js';
import { createTelemetry, installErrorCapture, installWebVitals } from './telemetry.js';
import { initNav } from './nav.js';
import { initFaq } from './faq.js';
import { initForms } from './forms.js';
import { initMotion } from './motion.js';
import { scroller } from './scroll.js';

const html = document.documentElement;
const telemetry = createTelemetry(config.telemetry, config.build);
installErrorCapture(telemetry);
installWebVitals(telemetry);
telemetry.track('page_view', { title: document.title.slice(0, 80) });

const safe = (name, fn) => {
  try { return fn(); } catch (err) {
    console.error(`[rumpflaw] ${name} failed`, err);
    telemetry.track('js_error', { message: `${name}: ${err?.message || err}`.slice(0, 160), source: 'init' });
    return undefined;
  }
};

safe('nav', () => initNav({ telemetry }));
safe('faq', () => initFaq({ telemetry }));
safe('forms', () => initForms({ config, telemetry }));

// Delegated CTA tracking (calls, directions, anchors) — no PII.
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-track]');
  if (el) telemetry.track(el.dataset.track, { cta: el.dataset.cta || '' });
}, { capture: true });

// Section impressions (once each).
safe('section-views', () => {
  if (!('IntersectionObserver' in window)) return;
  const seen = new Set();
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const id = e.target.dataset.section;
      if (e.isIntersecting && !seen.has(id)) { seen.add(id); telemetry.track('section_view', { id }); io.unobserve(e.target); }
    }
  }, { threshold: 0.35 });
  document.querySelectorAll('[data-section]').forEach((s) => io.observe(s));
});

initMotion({ telemetry })
  .catch((err) => {
    console.error('[rumpflaw] motion failed', err);
    html.classList.add('motion-failed');
    document.querySelector('[data-intro]')?.remove();
    scroller.unlock('intro');
    html.classList.remove('is-locked');
    telemetry.track('js_error', { message: `motion: ${err?.message || err}`.slice(0, 160), source: 'motion' });
  });

// Minimal, read-only debug handle for QA and automated visual tests (no PII).
window.RumpfLaw = Object.freeze({
  version: config.build.v,
  env: config.build.env,
  telemetry: { adapter: config.telemetry.adapter, enabled: telemetry.enabled, optedOut: telemetry.optedOut },
  scrollTo: (y) => scroller.scrollTo(y, { immediate: true }),
});
