/**
 * telemetry.js — privacy-first, consent-aware event pipeline (no third-party scripts).
 *
 *   track(name, props) → [middleware…] → consent gate → transport
 *
 * Middleware: enrich (build/env/page/viewport), scrubPII (emails/phones/long digit runs),
 * sample(rate), dedupe(ms). Transports: none | console | beacon (first-party endpoint) |
 * plausible (Events API, cookieless). Global Privacy Control / Do Not Track ⇒ fully off.
 * Never sends form contents. Also captures JS errors and Core Web Vitals (LCP, CLS, INP).
 */
const PII_PATTERNS = [
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]'],
  [/\+?\d[\d\s().-]{7,}\d/g, '[number]'],
];

export const middleware = {
  enrich: (build) => (evt) => ({
    ...evt,
    env: build.env,
    v: build.v,
    path: location.pathname,
    vw: bucket(window.innerWidth),
    ref: refDomain(),
  }),
  scrubPII: () => (evt) => {
    const props = {};
    for (const [k, v] of Object.entries(evt.props || {})) {
      props[k] = typeof v === 'string' ? PII_PATTERNS.reduce((s, [re, rep]) => s.replace(re, rep), v).slice(0, 200) : v;
    }
    return { ...evt, props };
  },
  sample: (rate) => (evt) => (rate >= 1 || Math.random() < rate ? evt : null),
  dedupe: (ms = 400) => {
    const last = new Map();
    return (evt) => {
      const key = evt.name + JSON.stringify(evt.props || {});
      const now = performance.now();
      if (now - (last.get(key) ?? -Infinity) < ms) return null;
      last.set(key, now);
      return evt;
    };
  },
};

function bucket(w) { return w < 600 ? 'sm' : w < 1024 ? 'md' : w < 1440 ? 'lg' : 'xl'; }
function refDomain() { try { const r = document.referrer && new URL(document.referrer); return r && r.host !== location.host ? r.host : ''; } catch { return ''; } }

function createTransport(cfg) {
  switch (cfg.adapter) {
    case 'console':
      return { send: (evt) => console.info('%c[telemetry]', 'color:#A9844E', evt.name, evt) };
    case 'beacon':
      if (!cfg.endpoint) return null;
      return {
        send: (evt) => {
          // text/plain is CORS-safelisted: no preflight (sendBeacon cannot preflight).
          const body = JSON.stringify(evt);
          if (navigator.sendBeacon && navigator.sendBeacon(cfg.endpoint, new Blob([body], { type: 'text/plain' }))) return;
          fetch(cfg.endpoint, { method: 'POST', body, keepalive: true, headers: { 'content-type': 'text/plain' }, credentials: 'omit' }).catch(() => {});
        },
      };
    case 'plausible':
      if (!cfg.plausibleDomain) return null;
      return {
        send: (evt) => {
          fetch('https://plausible.io/api/event', {
            method: 'POST', keepalive: true, credentials: 'omit',
            headers: { 'content-type': 'text/plain' },
            body: JSON.stringify({ n: evt.name === 'page_view' ? 'pageview' : evt.name, u: location.href, d: cfg.plausibleDomain, r: document.referrer || null, p: evt.props }),
          }).catch(() => {});
        },
      };
    default:
      return null;
  }
}

export function privacySignalOn() {
  return navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' || window.doNotTrack === '1';
}

export function createTelemetry(cfg, build) {
  const optedOut = cfg.respectGPC && privacySignalOn();
  const transport = optedOut ? null : createTransport(cfg);
  const chain = [];
  const queue = [];
  let consent = cfg.requiresConsent ? readConsent() : 'granted';

  const api = {
    enabled: !!transport,
    optedOut,
    use(fn) { chain.push(fn); return api; },
    track(name, props = {}) {
      if (!transport) return;
      let evt = { name, props, ts: Date.now() };
      for (const fn of chain) { evt = fn(evt); if (!evt) return; }
      if (consent !== 'granted') { if (queue.length < 50) queue.push(evt); return; }
      try { transport.send(evt); } catch { /* never break the page for telemetry */ }
    },
    setConsent(value) {
      consent = value;
      try { localStorage.setItem('rl:consent', value); } catch {}
      if (value === 'granted') while (queue.length) transport?.send(queue.shift());
      else queue.length = 0;
    },
    get consent() { return consent; },
  };

  api.use(middleware.enrich(build)).use(middleware.scrubPII()).use(middleware.sample(cfg.sampleRate ?? 1)).use(middleware.dedupe());
  return api;
}

function readConsent() { try { return localStorage.getItem('rl:consent') || 'pending'; } catch { return 'pending'; } }

/** Uncaught errors + unhandled rejections (message truncated, no stack contents with PII). */
export function installErrorCapture(t) {
  let count = 0;
  const report = (message, source) => { if (++count > 10) return; t.track('js_error', { message: String(message).slice(0, 160), source: String(source || '').split('/').pop().slice(0, 80) }); };
  window.addEventListener('error', (e) => report(e.message, e.filename));
  window.addEventListener('unhandledrejection', (e) => report(e.reason?.message || e.reason, 'promise'));
}

/** Minimal Core Web Vitals (LCP, CLS, INP-approx) via PerformanceObserver; flushed on hide. */
export function installWebVitals(t) {
  if (!('PerformanceObserver' in window)) return;
  const vitals = { LCP: 0, CLS: 0, INP: 0 };
  const observe = (type, cb, opts = {}) => { try { new PerformanceObserver((l) => l.getEntries().forEach(cb)).observe({ type, buffered: true, ...opts }); } catch {} };
  observe('largest-contentful-paint', (e) => { vitals.LCP = Math.round(e.startTime); });
  observe('layout-shift', (e) => { if (!e.hadRecentInput) vitals.CLS += e.value; });
  observe('event', (e) => { if (e.interactionId) vitals.INP = Math.max(vitals.INP, Math.round(e.duration)); }, { durationThreshold: 40 });
  let sent = false;
  const flush = () => {
    if (sent || document.visibilityState !== 'hidden') return;
    sent = true;
    const rate = (n, v) => ({ LCP: v <= 2500 ? 'good' : v <= 4000 ? 'ni' : 'poor', CLS: v <= 0.1 ? 'good' : v <= 0.25 ? 'ni' : 'poor', INP: v <= 200 ? 'good' : v <= 500 ? 'ni' : 'poor' }[n]);
    for (const [name, raw] of Object.entries(vitals)) {
      const value = name === 'CLS' ? Number(raw.toFixed(3)) : raw;
      if (value || name === 'CLS') t.track('web_vital', { name, value, rating: rate(name, value) });
    }
  };
  document.addEventListener('visibilitychange', flush);
  window.__rlVitals = vitals; // exposed for automated performance checks
}
