import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = mkdtempSync(join(tmpdir(), 'rl-build-'));
const SITE_URL = 'https://example.github.io/Rumpflaw/';
const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
let htmlFiles = [];

before(() => {
  execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: ROOT, env: { ...process.env, SITE_ENV: 'production', SITE_URL, OUT_DIR: OUT, GIT_SHA: 'abcdef1234567', GIT_BRANCH: 'main' }, stdio: 'pipe' });
  htmlFiles = walk(OUT).filter((f) => f.endsWith('.html'));
});

test('builds all pages', () => {
  const rel = htmlFiles.map((f) => f.slice(OUT.length + 1)).sort();
  assert.deepEqual(rel, ['404.html', 'accessibility.html', 'dev/index.html', 'disclaimer.html', 'index.html', 'privacy.html']);
});

test('no unresolved template tokens or includes', () => {
  for (const f of htmlFiles) {
    const html = readFileSync(f, 'utf8');
    // Template syntax specifically ({{ var }} / {{{ var }}} / include + page directives) —
    // minified JS and JSON-LD legitimately contain bare "}}".
    assert.ok(!/\{\{\{?\s*[\w.$]+\s*\}?\}\}|<!--\s*@(include|page)/.test(html), `unresolved token in ${f}`);
  }
});

test('CSP hash matches the inline boot script exactly', () => {
  const html = readFileSync(join(OUT, 'index.html'), 'utf8');
  const inline = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const hash = createHash('sha256').update(inline).digest('base64');
  const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1].replace(/&#39;/g, "'");
  assert.ok(csp.includes(`'sha256-${hash}'`), 'inline script hash missing from CSP');
  assert.ok(!/unsafe-inline/.test(csp.split(';').find((d) => d.trim().startsWith('script-src'))), 'script-src must not allow unsafe-inline');
});

test('indexing stays off until the firm approves (allowIndexing=false)', () => {
  const html = readFileSync(join(OUT, 'index.html'), 'utf8');
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  assert.match(readFileSync(join(OUT, 'robots.txt'), 'utf8'), /Disallow: \//);
});

test('canonical + absolute OG image when SITE_URL is set', () => {
  const html = readFileSync(join(OUT, 'index.html'), 'utf8');
  assert.ok(html.includes(`<link rel="canonical" href="${SITE_URL}">`));
  assert.ok(html.includes(`content="${SITE_URL}assets/img/og-image.png"`));
});

test('404 page uses absolute asset URLs (served at any depth)', () => {
  const html = readFileSync(join(OUT, '404.html'), 'utf8');
  assert.ok(html.includes(`href="${SITE_URL}assets/css/site.css`));
});

test('JSON-LD describes a LegalService with NJ address and both attorneys', () => {
  const html = readFileSync(join(OUT, 'index.html'), 'utf8');
  const data = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  const firm = data['@graph'].find((n) => n['@type'] === 'LegalService');
  assert.equal(firm.address.addressRegion, 'NJ');
  assert.equal(firm.address.postalCode, '08087');
  assert.equal(data['@graph'].filter((n) => n['@type'] === 'Person').length, 2);
});

test('production build hides the preview badge; runtime config is generated', () => {
  const html = readFileSync(join(OUT, 'index.html'), 'utf8');
  assert.ok(!html.includes('build-pill'));
  const cfg = readFileSync(join(OUT, 'assets/js/config.js'), 'utf8');
  assert.match(cfg, /"env": "production"/);
  assert.match(cfg, /"adapter": "disabled"/, 'production form must not silently drop messages without an endpoint');
});

test('bankruptcy debt-relief-agency notice (11 U.S.C. § 528) is present', () => {
  const html = readFileSync(join(OUT, 'index.html'), 'utf8');
  assert.ok((html.match(/debt relief agency\. We help people file for bankruptcy relief under the Bankruptcy Code/gi) || []).length >= 2);
});
