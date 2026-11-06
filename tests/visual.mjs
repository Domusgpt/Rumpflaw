#!/usr/bin/env node
/**
 * visual.mjs — renders the built site (dist/) and captures review screenshots:
 *   • desktop 1440×900: intro, hero, pinned-hero keyframes, every section, footer
 *   • mobile (iPhone 14 emulation): hero + key sections
 *   • reduced-motion full page
 *   • a desktop scroll-through video (.webm) and a contact sheet PNG
 * Output: .artifacts/visual/ (gitignored).   Usage: node tests/visual.mjs [--video]
 */
import { chromium, devices } from '../scripts/lib/playwright.mjs';
import { startServer } from '../scripts/serve.mjs';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, '.artifacts/visual');
mkdirSync(OUT, { recursive: true });
const PORT = 4190;
const BASE = `http://127.0.0.1:${PORT}/`;
const wantVideo = process.argv.includes('--video');
const server = await startServer({ root: join(ROOT, 'dist'), listenPort: PORT });
const browser = await chromium.launch();
const shots = [];

async function settle(page, ms = 1300) { await page.waitForTimeout(ms); }
async function scrollToY(page, y) { await page.evaluate((v) => window.RumpfLaw.scrollTo(v), y); }
async function scrollToEl(page, sel, offset = 0) {
  const y = await page.evaluate(([s, o]) => { const el = document.querySelector(s); return el ? el.getBoundingClientRect().top + window.scrollY + o : 0; }, [sel, offset]);
  await scrollToY(page, y);
  return y;
}
async function shot(page, name, label) {
  const path = join(OUT, `${name}.png`);
  await page.screenshot({ path });
  shots.push({ name, label, path });
}

// ── Desktop ──────────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, ...(wantVideo ? { recordVideo: { dir: OUT, size: { width: 1440, height: 900 } } } : {}) });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(1100); await shot(page, 'd01-intro', 'Intro (scroll-locked)');
  await page.waitForTimeout(3300); await shot(page, 'd02-hero', 'Hero');
  const vh = 900;
  for (const [n, f, label] of [['d03-pin-lift', 0.28, 'Hero pin · headline lifts'], ['d04-pin-dawn', 0.52, 'Hero pin · dawn disc rises'], ['d05-pin-paper', 0.85, 'Hero pin · handoff to paper']]) {
    await scrollToY(page, Math.round(vh * 1.5 * f)); await settle(page, 1500); await shot(page, n, label);
  }
  await scrollToEl(page, '#firm', 120); await settle(page, 1600); await shot(page, 'd06-firm', 'The firm · word scrub');
  await scrollToEl(page, '.pillars', -300); await settle(page, 1500); await shot(page, 'd07-pillars', 'Pillars');
  const practiceStart = await scrollToEl(page, '#practice'); await settle(page, 1600); await shot(page, 'd08-practice-a', 'Practice · start');
  const dist = await page.evaluate(() => { const t = document.querySelector('[data-practice-track]'); return t.scrollWidth - document.documentElement.clientWidth; });
  await scrollToY(page, practiceStart + dist * 0.55); await settle(page, 1600); await shot(page, 'd09-practice-b', 'Practice · horizontal mid');
  await scrollToY(page, practiceStart + dist); await settle(page, 1600); await shot(page, 'd10-practice-c', 'Practice · end');
  await scrollToEl(page, '#attorneys', 0); await settle(page, 1600); await shot(page, 'd11-attorneys', 'Attorneys');
  await scrollToEl(page, '#brian-rumpf', -120); await settle(page, 1600); await shot(page, 'd12-brian', 'Brian E. Rumpf');
  await scrollToEl(page, '#debra-rumpf', -120); await settle(page, 1600); await shot(page, 'd13-debra', 'Debra Rumpf');
  await scrollToEl(page, '#approach', 0); await settle(page, 1300);
  await scrollToEl(page, '#approach', 260); await settle(page, 1700); await shot(page, 'd14-approach', 'Approach');
  await scrollToEl(page, '#area', 0); await settle(page, 2600); await shot(page, 'd15-area', 'Where we practice · chart');
  await scrollToEl(page, '#faq', 0); await settle(page, 1500);
  await page.click('.faq-item:nth-of-type(3) summary'); await settle(page, 900); await shot(page, 'd16-faq', 'FAQ');
  await scrollToEl(page, '#contact', 0); await settle(page, 1700); await shot(page, 'd17-contact', 'Contact');
  await page.click('[data-inquiry-submit]'); await settle(page, 500); await shot(page, 'd18-form-errors', 'Form validation');
  await scrollToY(page, 1e6); await settle(page, 1300); await shot(page, 'd19-footer', 'Footer');
  if (wantVideo) { await page.close(); await ctx.close(); } else await ctx.close();
}

// ── Mobile ───────────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ ...devices['iPhone 14'] });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(4400); await shot(page, 'm01-hero', 'Mobile · hero');
  const vh = page.viewportSize().height;
  await scrollToY(page, Math.round(vh * 1.5 * 0.55)); await settle(page, 1500); await shot(page, 'm02-dawn', 'Mobile · dawn');
  for (const [n, sel, label, off] of [['m03-firm', '#firm', 'Mobile · firm', 80], ['m04-practice', '#practice', 'Mobile · practice', 200], ['m05-attorney', '#brian-rumpf', 'Mobile · attorney', -40], ['m06-approach', '#approach', 'Mobile · approach', 120], ['m07-area', '.area__chart', 'Mobile · chart', -120], ['m08-contact', '#contact', 'Mobile · contact', 0]]) {
    await scrollToEl(page, sel, off); await settle(page, 1800); await shot(page, n, label);
  }
  // The header hides on scroll-down; a short scroll up reveals it (as a real user would).
  await page.evaluate(() => window.RumpfLaw.scrollTo(window.scrollY - 240)); await settle(page, 900);
  await page.click('[data-menu-toggle]'); await settle(page, 1100); await shot(page, 'm09-menu', 'Mobile · menu');
  await ctx.close();
}

// ── Reduced motion (full page) ─────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const path = join(OUT, 'r01-reduced-fullpage.png');
  await page.screenshot({ path, fullPage: true });
  shots.push({ name: 'r01-reduced-fullpage', label: 'Reduced motion · full page', path });
  await ctx.close();
}

// ── Contact sheet ────────────────────────────────────────────────────────
{
  const cards = shots.filter((s) => !s.name.startsWith('r01')).map((s) => {
    const b64 = readFileSync(s.path).toString('base64');
    return `<figure><img src="data:image/png;base64,${b64}"><figcaption>${s.label}</figcaption></figure>`;
  }).join('');
  const page = await browser.newPage({ viewport: { width: 2400, height: 1200 } });
  await page.setContent(`<style>body{margin:0;padding:40px;background:#0E1C28;font:16px system-ui;color:#EDE7DC}h1{font:300 34px Georgia;margin:0 0 24px}
  .g{display:grid;grid-template-columns:repeat(4,1fr);gap:22px;align-items:start}figure{margin:0}img{width:100%;display:block;border-radius:6px;border:1px solid rgba(237,231,220,.15)}
  figcaption{margin-top:8px;color:#A7B3BA;font-size:14px;letter-spacing:.04em}</style><h1>Rumpf Law, P.C. — visual review</h1><div class="g">${cards}</div>`);
  await page.screenshot({ path: join(OUT, 'contact-sheet.png'), fullPage: true });
  await page.close();
}

await browser.close();
server.close();
if (wantVideo) {
  const vid = readdirSync(OUT).filter((f) => f.endsWith('.webm'));
  console.log('video:', vid.join(', '));
}
writeFileSync(join(OUT, 'index.json'), JSON.stringify(shots.map(({ name, label }) => ({ name, label })), null, 2));
console.log(`Captured ${shots.length} screenshots → ${OUT}`);
