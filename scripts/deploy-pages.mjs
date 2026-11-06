#!/usr/bin/env node
/**
 * deploy-pages.mjs — assembles the GitHub Pages site for ALL recent branches.
 *
 *   main            → /                     (SITE_ENV=production; still noindex until approved)
 *   <other branch>  → /preview/<slug>/       (SITE_ENV=preview, always noindex)
 *   previews.json   → deployment index (read by /dev/ pages)
 *
 * Branches are built from their own commit using their own scripts/build.mjs; branches
 * without a build script but with a root index.html are published as-is. Run in CI after
 * `actions/checkout` with fetch-depth: 0. Output: ./_site (then pushed to gh-pages).
 *
 * Env: PREVIEW_MAX_AGE_DAYS (45), PREVIEW_MAX_COUNT (12), GITHUB_REPOSITORY, PAGES_BASE_URL
 */
import { execSync, execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, existsSync, writeFileSync, readFileSync, cpSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = process.cwd();
const SITE = resolve(ROOT, '_site');
const WT = resolve(ROOT, '.worktrees');
const MAX_AGE = Number(process.env.PREVIEW_MAX_AGE_DAYS || 45);
const MAX_COUNT = Number(process.env.PREVIEW_MAX_COUNT || 12);
const [owner = 'owner', repo = 'repo'] = (process.env.GITHUB_REPOSITORY || '').split('/');
const BASE = (process.env.PAGES_BASE_URL || `https://${owner.toLowerCase()}.github.io/${repo}/`).replace(/\/?$/, '/');

const sh = (cmd) => execSync(cmd, { cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'] }).toString().trim();
const slugify = (b) => b.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

rmSync(SITE, { recursive: true, force: true });
rmSync(WT, { recursive: true, force: true });
mkdirSync(SITE, { recursive: true });

const refs = sh(`git for-each-ref --sort=-committerdate --format='%(refname:short)|%(objectname)|%(committerdate:iso-strict)' refs/remotes/origin`)
  .split('\n').filter(Boolean).map((l) => { const [ref, sha, date] = l.split('|'); return { branch: ref.replace(/^origin\//, ''), sha, date }; })
  .filter((r) => !['HEAD', 'gh-pages', 'origin'].includes(r.branch));

const cutoff = Date.now() - MAX_AGE * 864e5;
const main = refs.find((r) => r.branch === 'main');
const previews = refs.filter((r) => r.branch !== 'main' && Date.parse(r.date) >= cutoff).slice(0, MAX_COUNT);

function buildRef({ branch, sha }, outDir, env, siteUrl) {
  const dir = join(WT, slugify(branch) || 'root');
  execFileSync('git', ['worktree', 'add', '--detach', dir, sha], { cwd: ROOT, stdio: 'ignore' });
  try {
    if (existsSync(join(dir, 'scripts/build.mjs'))) {
      execFileSync(process.execPath, ['scripts/build.mjs'], {
        cwd: dir, stdio: 'inherit',
        env: { ...process.env, SITE_ENV: env, SITE_URL: siteUrl, OUT_DIR: outDir, GIT_SHA: sha, GIT_BRANCH: branch, CI: 'true' },
      });
      return 'built';
    }
    if (existsSync(join(dir, 'index.html'))) {
      cpSync(dir, outDir, { recursive: true, filter: (src) => !src.includes(`${dir}/.git`) });
      return 'static';
    }
    return null;
  } catch (err) {
    console.error(`  ✗ ${branch}: build failed — ${err.message}`);
    return null;
  } finally {
    execFileSync('git', ['worktree', 'remove', '--force', dir], { cwd: ROOT, stdio: 'ignore' });
  }
}

const index = { generatedAt: new Date().toISOString(), base: BASE, production: null, previews: [] };

if (main) {
  const kind = buildRef(main, SITE, 'production', BASE);
  if (kind) { index.production = { branch: 'main', sha: main.sha, updated: main.date, path: '', kind }; console.log(`  ✓ main → / (${kind})`); }
  else console.log('  · main has no buildable site yet — publishing a deployments index at /');
}
for (const ref of previews) {
  const slug = slugify(ref.branch);
  const out = join(SITE, 'preview', slug);
  const kind = buildRef(ref, out, 'preview', `${BASE}preview/${slug}/`);
  if (kind) { index.previews.push({ branch: ref.branch, slug, sha: ref.sha, updated: ref.date, path: `preview/${slug}/`, kind }); console.log(`  ✓ ${ref.branch} → /preview/${slug}/ (${kind})`); }
}

writeFileSync(join(SITE, 'previews.json'), JSON.stringify(index, null, 2));
writeFileSync(join(SITE, '.nojekyll'), '');

if (!index.production) {
  // Root landing page: list deployments (noindex) until main carries the site.
  const items = index.previews.map((p) => `<li><a href="${esc(p.path)}">${esc(p.branch)}</a><span>${esc(p.sha.slice(0, 7))} · ${esc(new Date(p.updated).toUTCString())}</span></li>`).join('');
  writeFileSync(join(SITE, 'index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Deployments — Rumpf Law, P.C. website</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0E1C28;color:#EDE7DC;font:16px/1.6 system-ui,sans-serif}main{width:min(92vw,760px);padding:48px 0}
h1{font:300 clamp(2rem,5vw,3rem)/1.1 Georgia,serif;margin:0 0 .5rem}p{color:#A7B3BA}ul{list-style:none;padding:0;margin:2rem 0;border-top:1px solid #ffffff22}
li{display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;padding:1rem 0;border-bottom:1px solid #ffffff22}a{color:#DCC59E;font-weight:600}span{color:#A7B3BA;font-size:.9rem}</style></head>
<body><main><h1>Rumpf Law, P.C. — website previews</h1><p>Branch previews built by the Pages workflow. The production site will be served here once <code>main</code> contains it.</p><ul>${items || '<li>No previews yet.</li>'}</ul></main></body></html>`);
  writeFileSync(join(SITE, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  // 404 for unknown paths: point people to the index.
  writeFileSync(join(SITE, '404.html'), `<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>Not found</title><p style="font:16px system-ui;padding:2rem">Not found. <a href="${esc(BASE)}">See deployments</a>.</p>`);
}

rmSync(WT, { recursive: true, force: true });
sh('git worktree prune');
console.log(`Assembled ${index.previews.length} preview(s)${index.production ? ' + production' : ''} → _site/  (base ${BASE})`);
