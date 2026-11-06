#!/usr/bin/env node
/**
 * assets.mjs — renders brand raster assets from code with Playwright (pre-installed):
 *   favicon-32.png, apple-touch-icon.png (180), icon-192.png, icon-512.png, og-image.png (1200×630)
 * Run: node scripts/assets.mjs   (outputs into src/assets/img/, committed)
 */
import { chromium } from './lib/playwright.mjs';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const img = join(root, 'src/assets/img');
// Fonts are inlined as data URIs: Chromium blocks file:// font loads from setContent pages.
const font = (f) => `data:font/woff2;base64,${readFileSync(join(root, 'src/assets/fonts', f)).toString('base64')}`;
const favicon = readFileSync(join(img, 'favicon.svg'), 'utf8');
const config = JSON.parse(readFileSync(join(root, 'site.config.json'), 'utf8'));

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

for (const [name, size] of [['favicon-32.png', 32], ['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{width:${size}px;height:${size}px;display:block}</style>${favicon}`);
  await page.screenshot({ path: join(img, name), omitBackground: true });
  console.log(`  ✓ ${name}`);
}

const mark = `<svg viewBox="0 0 100 100" width="132" height="132" fill="none" stroke="#C5A574"><circle cx="50" cy="50" r="46" stroke-width="1.6"/><path d="M37 27V73M31.5 27H51C58.6 27 63.2 31.7 63.2 38.6S58.6 50.2 51 50.2H37M47.6 50.2L63.5 73M31.5 73H42.5M58.5 73H68.5" stroke-width="2.2" stroke-linecap="square"/><path d="M27 84C32 81.4 37 81.4 42 84S52 86.6 57 84 67 81.4 73 84" stroke-width="1.4" stroke-linecap="round"/></svg>`;
await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(`<!doctype html><html><head><style>
@font-face{font-family:F;src:url(${font('fraunces-opsz-normal.woff2')}) format('woff2');font-weight:100 900}
@font-face{font-family:F;font-style:italic;src:url(${font('fraunces-opsz-italic.woff2')}) format('woff2');font-weight:100 900}
@font-face{font-family:I;src:url(${font('inter-wght-normal.woff2')}) format('woff2');font-weight:100 900}
html,body{margin:0;width:1200px;height:630px;overflow:hidden}
body{position:relative;font-family:I;color:#EDE7DC;background:
 radial-gradient(90% 70% at 50% 108%,rgba(197,165,116,.28),transparent 60%),
 repeating-radial-gradient(ellipse 150% 95% at 78% 125%,transparent 0 30px,rgba(197,165,116,.10) 30px 31px),
 linear-gradient(180deg,#09131C,#0E1C28 55%,#152A3A)}
.wrap{position:absolute;inset:0;padding:72px 84px;display:flex;flex-direction:column;justify-content:space-between}
.top{display:flex;align-items:center;gap:26px}
.word{font-family:F;font-variation-settings:'opsz' 144;font-weight:330;font-size:58px;letter-spacing:-.02em;line-height:1}
.word span{opacity:.65;font-size:.7em}
h1{margin:0;font-family:F;font-variation-settings:'opsz' 144;font-weight:290;font-size:104px;line-height:.95;letter-spacing:-.035em;color:#F6F2EA}
h1 em{color:#DCC59E}
.foot{display:flex;justify-content:space-between;align-items:center;font-size:19px;letter-spacing:.16em;text-transform:uppercase;color:#A7B3BA}
.line{position:absolute;left:0;right:0;bottom:150px;height:1px;background:linear-gradient(90deg,transparent 3%,rgba(197,165,116,.8) 25%,rgba(197,165,116,.8) 75%,transparent 97%)}
</style></head><body><div class="line"></div><div class="wrap">
<div class="top">${mark}<div class="word">Rumpf Law<span>, P.C.</span></div></div>
<h1>Clear counsel,<br><em>close to home.</em></h1>
<div class="foot"><span>Attorneys at Law · ${config.firm.address.municipality}, NJ</span><span>${config.firm.phone.display}</span></div>
</div></body></html>`);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: join(img, 'og-image.png') });
console.log('  ✓ og-image.png');
await browser.close();
