/**
 * dev.js — renders the deployment index (previews.json, written by the Pages workflow)
 * and the structured dev track (devtrack.json, copied from docs/ at build time).
 * All text is inserted with textContent — never innerHTML — since JSON is data.
 */
const $ = (s) => document.querySelector(s);
const el = (tag, props = {}, ...kids) => { const n = Object.assign(document.createElement(tag), props); n.append(...kids.filter(Boolean)); return n; };

function siteBase() {
  const p = location.pathname;
  const i = p.indexOf('/preview/');
  return i >= 0 ? p.slice(0, i + 1) : p.replace(/dev\/(index\.html)?$/, '');
}

async function getJSON(url) {
  const res = await fetch(url, { cache: 'no-store', credentials: 'omit' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function renderPreviews() {
  const list = $('[data-previews]');
  if (!list) return;
  try {
    const data = await getJSON(`${siteBase()}previews.json`);
    list.replaceChildren(...[...(data.production ? [{ ...data.production, label: 'Production (main)' }] : []), ...(data.previews || [])].map((p) => el('li', { className: 'dev__preview' },
      el('a', { href: `${siteBase()}${p.path}`, textContent: p.label || p.branch }),
      el('span', { className: 'dev__preview-meta', textContent: ` · ${String(p.sha || '').slice(0, 7)} · ${p.updated ? new Date(p.updated).toLocaleString() : ''}` }),
    )));
    if (!list.children.length) list.replaceChildren(el('li', { textContent: 'No deployments recorded yet.' }));
  } catch {
    list.replaceChildren(el('li', { textContent: 'No deployment index found (local build, or Pages not yet deployed).' }));
  }
}

async function renderLog() {
  const list = $('[data-devlog]');
  if (!list) return;
  try {
    const data = await getJSON('./devtrack.json');
    list.replaceChildren(...(data.entries || []).slice().reverse().map((e) => el('li', { className: 'dev__entry' },
      el('p', { className: 'dev__entry-meta', textContent: `${e.timestamp} · v${e.version} · ${e.branch}` }),
      el('h3', { className: 'dev__entry-title', textContent: e.title }),
      el('p', { textContent: e.summary }),
      e.changes?.length ? el('ul', {}, ...e.changes.map((c) => el('li', { textContent: c }))) : null,
      e.verification?.length ? el('p', { className: 'dev__entry-verify', textContent: `Verified: ${e.verification.join(' · ')}` }) : null,
    )));
  } catch {
    list.replaceChildren(el('li', { textContent: 'Dev track unavailable.' }));
  }
}

renderPreviews();
renderLog();
