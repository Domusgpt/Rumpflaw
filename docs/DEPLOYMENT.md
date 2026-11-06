# Deployment

## GitHub Pages — main + every recent branch

`.github/workflows/pages.yml` runs on every push. It rebuilds:

| Source | URL |
|---|---|
| `main` (once it contains the site) | `https://domusgpt.github.io/Rumpflaw/` |
| any branch updated in the last 45 days (max 12) | `https://domusgpt.github.io/Rumpflaw/preview/<branch-slug>/` |
| deployment index | `https://domusgpt.github.io/Rumpflaw/previews.json` (rendered at `/dev/` on each build) |

This branch → **https://domusgpt.github.io/Rumpflaw/preview/claude-dazzling-tesla-g6zqim/**

Until `main` carries the site, the root shows a "website previews" index page.

### One-time setting (repo admin)

**Settings → Pages → Build and deployment → Source: _Deploy from a branch_ → `gh-pages` / `(root)` → Save.**
The `gh-pages` branch is created by the first workflow run. (Workflows can push the branch but can't change this setting.)

### How it works

`scripts/deploy-pages.mjs` checks out each branch in a temporary git worktree, runs **that branch's own**
`scripts/build.mjs` (`SITE_ENV=production` for main, `preview` otherwise, with the right `SITE_URL`), writes
`previews.json`, and the workflow force-pushes the result as a single commit to `gh-pages` (no history bloat;
deleted/stale branches disappear automatically).

## Going live (checklist)

1. Firm confirms every ⚠ item in `docs/CONTENT_REVIEW.md` and `docs/COMPLIANCE.md`.
2. Choose a **firm-owned domain** (⚠ `rumpflaw.com` belongs to an unrelated Wisconsin firm).
3. **Recommended:** host production on **Firebase Hosting** (`firebase.json` at the repo root adds HSTS, `frame-ancestors 'none'`, `nosniff`, Permissions-Policy and cache rules — GitHub Pages can't send headers). Set `site.url`, build with `SITE_ENV=production`, `firebase deploy --only hosting`, and connect the domain in the Firebase console. *(Alternative: GitHub Pages with `src/CNAME`, copied by the build, and DNS per GitHub's docs — without security headers.)*
4. Deploy Firebase (`integrations/firebase/README.md`) and set `forms.inquiry.endpoint` (+ optional telemetry endpoint).
5. Set `seo.allowIndexing: true`, merge to `main`.

## Local

```bash
npm ci
npm run dev                 # development build + http://127.0.0.1:4173
npm run build:preview       # preview build into dist/
npm test                    # unit + e2e (needs Playwright + Chromium)
npm run visual              # screenshots → .artifacts/visual/
node scripts/assets.mjs     # re-render favicons + OG image
npm run vendor              # re-copy pinned GSAP / Lenis / fonts after a version bump
```
