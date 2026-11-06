#!/usr/bin/env node
/**
 * vendor.mjs — copies pinned third-party runtime files from node_modules into
 * src/assets/vendor and src/assets/fonts so the deployed site has ZERO external
 * runtime requests (no CDNs, no Google Fonts). Run after `npm install` whenever
 * a pinned version in package.json changes. Output is committed to the repo.
 */
import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nm = join(root, 'node_modules');
const out = join(root, 'src', 'assets');

const pkg = (name) => JSON.parse(readFileSync(join(nm, name, 'package.json'), 'utf8'));
const copy = (from, to) => {
  const src = join(nm, from);
  if (!existsSync(src)) throw new Error(`vendor: missing ${src} — run npm install`);
  mkdirSync(dirname(join(out, to)), { recursive: true });
  cpSync(src, join(out, to));
  console.log(`  ✓ ${from} → assets/${to}`);
};

console.log('Vendoring runtime dependencies…');

// GSAP (Standard "No Charge" License — https://gsap.com/standard-license)
const gsapV = pkg('gsap').version;
for (const f of ['gsap.min.js', 'ScrollTrigger.min.js', 'SplitText.min.js']) {
  copy(`gsap/dist/${f}`, `vendor/gsap/${f}`);
}
writeFileSync(join(out, 'vendor/gsap/LICENSE.txt'),
  `GSAP ${gsapV} — © GreenSock, Inc. (a Webflow company).\n` +
  `Distributed under the GSAP Standard "No Charge" License: https://gsap.com/standard-license\n` +
  `Free for commercial use, including all plugins (SplitText, ScrollTrigger). See THIRD_PARTY_NOTICES.md.\n`);

// Lenis smooth scroll (MIT)
const lenisV = pkg('lenis').version;
copy('lenis/dist/lenis.min.js', 'vendor/lenis/lenis.min.js');
copy('lenis/dist/lenis.css', 'vendor/lenis/lenis.css');
if (existsSync(join(nm, 'lenis/LICENSE'))) copy('lenis/LICENSE', 'vendor/lenis/LICENSE.txt');

// Fonts (SIL Open Font License 1.1) — latin subsets only, variable axes.
copy('@fontsource-variable/fraunces/files/fraunces-latin-opsz-normal.woff2', 'fonts/fraunces-opsz-normal.woff2');
copy('@fontsource-variable/fraunces/files/fraunces-latin-opsz-italic.woff2', 'fonts/fraunces-opsz-italic.woff2');
copy('@fontsource-variable/fraunces/LICENSE', 'fonts/LICENSE-Fraunces-OFL.txt');
copy('@fontsource-variable/inter/files/inter-latin-wght-normal.woff2', 'fonts/inter-wght-normal.woff2');
copy('@fontsource-variable/inter/LICENSE', 'fonts/LICENSE-Inter-OFL.txt');

writeFileSync(join(out, 'vendor/VERSIONS.json'), JSON.stringify({
  gsap: gsapV,
  lenis: lenisV,
  fraunces: pkg('@fontsource-variable/fraunces').version,
  inter: pkg('@fontsource-variable/inter').version,
  vendoredAt: new Date().toISOString()
}, null, 2) + '\n');

console.log(`Done. gsap@${gsapV}, lenis@${lenisV}`);
