#!/usr/bin/env node
/**
 * build.mjs — zero-dependency static build for the Rumpf Law, P.C. site.
 *
 *   src/**.html  ──(includes, {{vars}}, page front-matter)──▶  dist/
 *   src/assets   ──(copy)─────────────────────────────────────▶  dist/assets
 *   site.config.json ──▶ runtime config.js, JSON-LD, CSP, robots, sitemap, manifest
 *
 * Env:
 *   SITE_ENV   production | preview | development   (default: preview, or production on main in CI)
 *   SITE_URL   absolute base URL incl. trailing slash (enables canonical/sitemap/OG absolute URLs)
 *   OUT_DIR    output directory (default: dist)
 *   GIT_SHA / GIT_BRANCH  override git metadata (CI sets GITHUB_SHA / GITHUB_REF_NAME)
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative, sep, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const OUT = resolve(ROOT, process.env.OUT_DIR || 'dist');
const PARTIALS = join(SRC, 'partials');

const config = JSON.parse(readFileSync(join(ROOT, 'site.config.json'), 'utf8'));
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

// ───────────────────────────── build metadata ─────────────────────────────
const git = (cmd, fallback = '') => { try { return execSync(`git ${cmd}`, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return fallback; } };
const sha = process.env.GIT_SHA || process.env.GITHUB_SHA || git('rev-parse HEAD', 'local');
const branch = process.env.GIT_BRANCH || process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || git('rev-parse --abbrev-ref HEAD', 'local');
const env = process.env.SITE_ENV || (process.env.CI && branch === 'main' ? 'production' : 'preview');
if (!['production', 'preview', 'development'].includes(env)) throw new Error(`Unknown SITE_ENV "${env}"`);
const siteUrl = (process.env.SITE_URL || config.site.url || '').replace(/\/?$/, (m) => (process.env.SITE_URL || config.site.url) ? '/' : '');
const builtAt = new Date().toISOString();
const shortSha = sha.slice(0, 7);
const build = { env, version: pkg.version, sha, shortSha, branch, builtAt, v: `${pkg.version}-${shortSha}` };
const allowIndexing = env === 'production' && config.seo.allowIndexing === true && !!siteUrl;

// ───────────────────────────── runtime adapters ───────────────────────────
const resolveFormAdapter = () => {
  const f = config.forms.inquiry;
  if (f.adapter !== 'auto') return f.adapter;
  if (env !== 'production') return 'demo';
  return f.endpoint ? 'endpoint' : 'disabled';
};
const resolveTelemetryAdapter = () => {
  const t = config.telemetry;
  if (t.adapter !== 'auto') return t.adapter;
  if (env === 'development') return 'console';
  if (t.endpoint) return 'beacon';
  if (t.plausibleDomain) return 'plausible';
  return 'none';
};
const runtime = {
  build,
  firm: {
    name: config.firm.name,
    phone: config.firm.phone.display,
    phoneE164: config.firm.phone.e164,
  },
  forms: { inquiry: { adapter: resolveFormAdapter(), endpoint: config.forms.inquiry.endpoint || '' } },
  telemetry: {
    adapter: resolveTelemetryAdapter(),
    endpoint: config.telemetry.endpoint || '',
    plausibleDomain: config.telemetry.plausibleDomain || '',
    sampleRate: config.telemetry.sampleRate ?? 1,
    respectGPC: config.telemetry.respectGPC !== false,
    requiresConsent: !!config.telemetry.requiresConsent,
  },
};

// ───────────────────────────── helpers ────────────────────────────────────
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const sha256 = (s) => createHash('sha256').update(s).digest('base64');
const originOf = (u) => { try { return new URL(u).origin; } catch { return ''; } };

// Inline boot script (must run before first paint to avoid FOUC); hashed into the CSP.
const bootInline = readFileSync(join(PARTIALS, 'boot-inline.js'), 'utf8').trim();
const bootHash = `'sha256-${sha256(bootInline)}'`;

const connectSrc = new Set(["'self'"]);
for (const u of [runtime.forms.inquiry.endpoint, runtime.telemetry.endpoint]) { const o = originOf(u); if (o) connectSrc.add(o); }
if (runtime.telemetry.adapter === 'plausible') connectSrc.add('https://plausible.io');
const csp = [
  "default-src 'self'",
  `script-src 'self' ${bootHash}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  `connect-src ${[...connectSrc].join(' ')}`,
  "object-src 'none'",
  "base-uri 'self'",
  `form-action 'self'${originOf(runtime.forms.inquiry.endpoint) ? ' ' + originOf(runtime.forms.inquiry.endpoint) : ''}`,
  "frame-src 'none'",
  "worker-src 'self'",
  "manifest-src 'self'",
].join('; ');

// JSON-LD (LegalService + Attorneys). Only verified-or-flagged facts from site.config.json.
const f = config.firm;
const jsonld = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'LegalService',
      '@id': `${siteUrl || ''}#firm`,
      name: f.name,
      description: f.description,
      ...(siteUrl ? { url: siteUrl } : {}),
      telephone: f.phone.e164,
      faxNumber: f.fax.display,
      address: {
        '@type': 'PostalAddress',
        streetAddress: f.address.street,
        addressLocality: f.address.locality,
        addressRegion: f.address.region,
        postalCode: f.address.postalCode,
        addressCountry: f.address.country,
      },
      geo: { '@type': 'GeoCoordinates', latitude: f.geo.lat, longitude: f.geo.lng },
      openingHours: f.hours.schema,
      areaServed: config.serviceArea.map((n) => ({ '@type': 'Place', name: `${n}, NJ` })),
      knowsAbout: ['Real estate law', 'Wills and probate', 'Family law', 'Municipal court', 'Personal injury', "Workers' compensation", 'Bankruptcy'],
      employee: config.attorneys.map((a) => ({ '@id': `${siteUrl || ''}#${a.id}` })),
    },
    ...config.attorneys.map((a) => ({
      '@type': 'Person',
      '@id': `${siteUrl || ''}#${a.id}`,
      name: a.name,
      honorificSuffix: a.honorific,
      jobTitle: `${a.role}, ${f.name}`,
      worksFor: { '@id': `${siteUrl || ''}#firm` },
      ...(a.alumniOf.length ? { alumniOf: a.alumniOf.map((n) => ({ '@type': 'CollegeOrUniversity', name: n })) } : {}),
    })),
  ],
};

// ───────────────────────────── templating ─────────────────────────────────
const includeRe = /<!--\s*@include\s+([\w./-]+)\s*-->/g;
const pageRe = /^\s*<!--\s*@page\s+(\{[\s\S]*?\})\s*-->\s*/;

function resolveIncludes(html, depth = 0) {
  if (depth > 8) throw new Error('include depth exceeded');
  return html.replace(includeRe, (_, name) => {
    const file = join(PARTIALS, name.endsWith('.html') ? name : `${name}.html`);
    if (!existsSync(file)) throw new Error(`Missing partial: ${name}`);
    return resolveIncludes(readFileSync(file, 'utf8'), depth + 1);
  });
}

function render(html, ctx) {
  return html
    .replace(/\{\{\{\s*([\w.$]+)\s*\}\}\}/g, (_, k) => { const v = get(ctx, k); if (v === undefined) throw new Error(`Unknown raw var {{{${k}}}} in ${ctx.page.path}`); return String(v); })
    .replace(/\{\{\s*([\w.$]+)\s*\}\}/g, (_, k) => { const v = get(ctx, k); if (v === undefined) throw new Error(`Unknown var {{${k}}} in ${ctx.page.path}`); return esc(v); });
}

// ───────────────────────────── build ──────────────────────────────────────
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
cpSync(join(SRC, 'assets'), join(OUT, 'assets'), { recursive: true });

const pages = [];
for (const file of walk(SRC).filter((p) => p.endsWith('.html') && !p.startsWith(PARTIALS + sep) && !p.includes(`${sep}assets${sep}`))) {
  const rel = relative(SRC, file).split(sep).join('/');
  const depth = rel.split('/').length - 1;
  let raw = readFileSync(file, 'utf8');
  const m = raw.match(pageRe);
  const page = { path: rel, title: config.firm.name, description: config.firm.description, bodyClass: '', robots: '', sitemap: true, ...(m ? JSON.parse(m[1]) : {}) };
  if (m) raw = raw.slice(m[0].length);
  const isNoindexPage = page.robots === 'noindex';
  const robots = allowIndexing && !isNoindexPage ? 'index, follow' : 'noindex, nofollow';
  const canonical = siteUrl ? `${siteUrl}${rel === 'index.html' ? '' : rel.replace(/index\.html$/, '')}` : '';
  // Pages served at arbitrary depths (404) need absolute URLs when the base URL is known.
  const root = page.absolute && siteUrl ? siteUrl : '../'.repeat(depth);
  const ctx = {
    config, firm: config.firm, build, page, root,
    // Same-page anchors on the home page; absolute-to-home anchors elsewhere.
    nav: page.path === 'index.html' ? '' : `${root}index.html`,
    meta: {
      robots,
      canonicalTag: canonical ? `<link rel="canonical" href="${esc(canonical)}">` : '',
      ogUrlTag: canonical ? `<meta property="og:url" content="${esc(canonical)}">` : '',
      ogImage: `${siteUrl || root}assets/img/og-image.png`,
      csp,
      bootInline,
      jsonld: page.path === 'index.html' ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>` : '',
      envClass: `env-${env}`,
      previewBadge: env === 'production' ? '' : `<a class="build-pill" href="${root}dev/index.html" title="Build ${esc(build.v)} · ${esc(builtAt)}">${env === 'preview' ? 'Preview' : 'Dev'} · ${esc(branch)} · ${esc(shortSha)}</a>`,
      year: new Date().getUTCFullYear(),
    },
  };
  const html = render(resolveIncludes(raw), ctx);
  mkdirSync(dirname(join(OUT, rel)), { recursive: true });
  writeFileSync(join(OUT, rel), html);
  pages.push({ rel, page, robots });
}

// runtime config module
writeFileSync(join(OUT, 'assets/js/config.js'),
  `// Generated by scripts/build.mjs — do not edit.\nexport const config = Object.freeze(${JSON.stringify(runtime, null, 2)});\n`);

// robots + sitemap
const indexable = pages.filter((p) => p.robots.startsWith('index') && p.page.sitemap !== false && p.rel !== '404.html');
writeFileSync(join(OUT, 'robots.txt'), allowIndexing
  ? `User-agent: *\nAllow: /\nDisallow: /dev/\nSitemap: ${siteUrl}sitemap.xml\n`
  : `# ${env} build — not for indexing until the firm approves launch.\nUser-agent: *\nDisallow: /\n`);
if (allowIndexing) {
  writeFileSync(join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indexable.map((p) => `  <url><loc>${siteUrl}${p.rel === 'index.html' ? '' : p.rel}</loc><lastmod>${builtAt.slice(0, 10)}</lastmod></url>`).join('\n')}\n</urlset>\n`);
}

// web app manifest
writeFileSync(join(OUT, 'manifest.webmanifest'), JSON.stringify({
  name: config.firm.name, short_name: config.firm.shortName, start_url: './', display: 'browser',
  background_color: '#F6F2EA', theme_color: config.site.themeColor,
  icons: [
    { src: 'assets/img/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'assets/img/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: 'assets/img/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
  ],
}, null, 2));

// build metadata + dev track
writeFileSync(join(OUT, 'build.json'), JSON.stringify({ ...build, allowIndexing, siteUrl, pages: pages.map((p) => p.rel) }, null, 2));
if (existsSync(join(ROOT, 'docs/devtrack.json'))) {
  mkdirSync(join(OUT, 'dev'), { recursive: true });
  cpSync(join(ROOT, 'docs/devtrack.json'), join(OUT, 'dev/devtrack.json'));
}
writeFileSync(join(OUT, '.nojekyll'), '');
// Custom domain for GitHub Pages (production only — previews live under the Pages URL).
if (env === 'production' && existsSync(join(SRC, 'CNAME'))) cpSync(join(SRC, 'CNAME'), join(OUT, 'CNAME'));

console.log(`Built ${pages.length} pages → ${relative(ROOT, OUT)}/  [env=${env} branch=${branch} sha=${shortSha} indexing=${allowIndexing}]`);
console.log(`  form adapter: ${runtime.forms.inquiry.adapter} · telemetry adapter: ${runtime.telemetry.adapter}`);
