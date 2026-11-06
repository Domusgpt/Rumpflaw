# Dev log — Rumpf Law, P.C. website

Format: one entry per working turn, newest first. Each entry records session, branch, version,
what changed, how it was verified, and what's open. Structured mirror: `docs/devtrack.json` (rendered at `/dev/`).

---

## 2026-11-06T15:50Z · v0.1.0 "Tidewater" · initial build

- **Session:** `session_01UqrwaZ1xZHCSYcMWD4jzB5`
- **Branch:** `claude/dazzling-tesla-g6zqim` (from `main` @ `121461e`, which held only `Test.txt`)
- **PR lineage:** none — no pull requests existed in `domusgpt/rumpflaw` at session start.

### Context & decisions

- **Correct client:** The request linked `www.rumpflaw.com`, which serves **Rumpf Law Office, S.C. (Cambridge, Wisconsin)**.
  The user confirmed the project is the **New Jersey** firm. Official 2025–2026 Ocean County municipal records identify it as
  **Rumpf Law, P.C., 11 Leifried Lane, Tuckerton, NJ 08087** (Brian E. Rumpf and Debra Rumpf). Wisconsin research was discarded;
  no Wisconsin content or branding is used. Domain conflict flagged in `CONTENT_REVIEW.md`.
- **Research sources:** LEHT 2026 professional-services notice (official PDF), leht.com Zoning Board + Municipal Court pages,
  Ocean County Government Directory, Ocean Twp. ZBA agendas (2025), Wikipedia, NJ Assembly Republicans bio, FindLaw/Martindale/Avvo
  listings. Directory-only facts (phone, fax, hours, practice scope) are flagged ⚠.
- **Design system:** "Tidewater Editorial" — ink/sand/brass, Fraunces (opsz 144) + Inter, nautical-chart motif tied to Great Bay /
  Barnegat Bay. Written up as a reusable Visual Codex entry: `docs/visual-codex/tidewater-editorial/SKILL.md`.
  (No visual-codex skill was installed in this environment; the only synced design skill, `vib34d-website-builder`, is a holographic
  4D engine — wrong register for a law firm, so not used.)
- **Stack:** no framework; vendored GSAP 3.15.0 (3.15.1 was 2 days old — skipped), Lenis 1.3.27, self-hosted fonts; zero-dep Node build.

### Changes

- Site: `index` (intro → pinned dawn-disc hero with WebGL bathymetry → firm → horizontal practice spreads → attorneys → approach →
  service-area chart → FAQ → contact/form → legal footer), `privacy`, `disclaimer` (legal notices), `accessibility`, `404`, `dev/` (dev track).
- Build: includes/partials, escaped templating, per-page front-matter, env-aware robots/noindex, CSP with hashed inline boot script,
  JSON-LD (LegalService + 2 Person), sitemap (only when indexing allowed), manifest, `build.json`, preview badge.
- Middleware: inquiry pipeline (shared isomorphic schema, honeypot/timing, throttle, demo/endpoint/disabled adapters);
  telemetry pipeline (enrich → PII scrub → sample → dedupe → consent → transport; GPC/DNT off; web vitals; error capture).
- Firebase: `inquiry` + `collect` Cloud Functions (2nd gen), deny-all Firestore rules, rate-limit keys with TTL, no IP storage.
- CI/CD: `pages.yml` (main → `/`, recent branches → `/preview/<slug>/`, `previews.json`, single-commit `gh-pages`), `ci.yml` (unit, e2e, visual artifacts).
- Brand assets rendered from code: favicon set + 1200×630 OG image.
- Docs: README, LICENSE, THIRD_PARTY_NOTICES, CONTENT_REVIEW, COMPLIANCE, DEPLOYMENT, Visual Codex entry, this log.

### Red-team findings fixed this turn

| # | Finding | Fix |
|---|---|---|
| 1 | Hero eyebrow wrapped into two cramped columns (text runs became flex items) | wrapped in a single span; tighter tracking on mobile |
| 2 | Practice cards overflowed the pinned viewport at 900 px (worse at 768) | two-column "spread" cards; horizontal mode only ≥1024×720 **and** a runtime fit check |
| 3 | Chart towns collapsed to the top edge — GSAP `y` overwrote each `<g>`'s translate | animate the children, not the positioned groups |
| 4 | Office label clipped at the chart's left edge | simplified label |
| 5 | Debra's reversed row put her portrait in the wide column; "APPOINTMENTS" collided with its value | mirrored grid columns; wider label column |
| 6 | Header flickered when FAQ toggles refreshed ScrollTrigger | ignore header updates while `ScrollTrigger.isRefreshing` |
| 7 | Phone error pushed the email input down | `align-content/align-items: start` in form grid |
| 8 | **CLS 1.57** from `position: fixed` pin toggles | `pinType: 'transform'` when Lenis drives scroll (fixed on touch-only) → **CLS 0.000** |
| 9 | Deep link `#contact` landed ~2,700 px short — Lenis clamped to a stale scroll limit after pin spacers grew the page | `lenis.resize()` on every ScrollTrigger refresh; re-resolve hash after pins |
| 10 | Consent checkbox click "missed" — errors collapsing on blur moved it under the pointer | clear errors on `input`, never on `blur` |
| 11 | Mobile menu: first link not focusable (GSAP `autoAlpha` = `visibility:hidden`) | animate `opacity` only |
| 12 | Copy accuracy: NJ attorney review is three **business** days | corrected |
| 13 | Telemetry beacon used `application/json` (needs preflight; `sendBeacon` can't) | `text/plain` (CORS-safelisted) |

### Verification

- `node --test 'tests/unit/*.test.mjs'` → **23/23 pass** (schema, PII scrub, build invariants incl. CSP hash, noindex, JSON-LD, § 528 notice, schema sync).
- `node tests/e2e.mjs` → **75/75 pass**: 5 pages clean (console/network), SEO invariants, links/anchors, **axe-core 0 violations**, 404,
  intro lock + unlock, WebGL active, pins present, practice panel fits, **nothing left hidden after full scroll-through**, no overflow
  (1440/768/390), **LCP ≈ 0.1 s local, CLS 0.000, page weight ≈ 480 KB**, repeat-visit intro skip, deep link, reduced motion, no-JS,
  keyboard skip link, form validation + demo submit, mobile menu focus trap/Esc.
- `node tests/visual.mjs` → 29 screenshots + contact sheet reviewed (desktop 1440×900, iPhone 14, reduced-motion full page).

### Deployment & CI (after push, 2026-11-06T15:55Z)

- Pushed `8bc787f` → `origin/claude/dazzling-tesla-g6zqim`.
- **Pages workflow run #1 — ✅ success** (`gh-pages` published: deployments index at `/` + this branch at
  `/preview/claude-dazzling-tesla-g6zqim/`). The site answers **404 until the repo's Pages source is set to `gh-pages`**
  (one-time admin setting; workflows cannot change it).
- **CI run #1 — ✅ success** on a GitHub-hosted runner (2 m 38 s): install ✅ · build ✅ · unit ✅ · **e2e ✅** · visual capture ✅ · screenshot artifact (`visual-review`) ✅.
- 31-second smooth-wheel scroll-through video recorded for review (local artifact, not committed).

### Post-push hardening

- Moved `firebase.json` to the repo root and added a **Firebase Hosting** target for production with a full security-header set
  (HSTS, `frame-ancestors 'none'`, `X-Frame-Options`, `nosniff`, Referrer-Policy, Permissions-Policy, COOP) and cache rules that
  respect un-fingerprinted ES-module imports. GitHub Pages stays the preview channel (it cannot send headers).
- Verified the **production** build in a browser: form disabled with a call-us notice (no silent drops), no preview badge,
  `noindex` until launch, telemetry off, zero errors.

### Open items

- Firm confirmation of every ⚠ item in `CONTENT_REVIEW.md` (phone, hours, practice scope, titles, Debra's bio/education, headshots, responsible attorney, legislative-service mention).
- Repo admin: enable Pages (Source → `gh-pages`) once — see `DEPLOYMENT.md`.
- Choose a firm-owned domain; deploy Firebase; set `seo.allowIndexing` only at launch.
