# Rumpf Law, P.C. — website

Marketing website for **Rumpf Law, P.C.**, attorneys at law in Little Egg Harbor Township (Tuckerton), New Jersey.
A static, dependency-light site with a GSAP scroll experience, deployed to GitHub Pages with per-branch previews.

> **Version 0.1.0** · session `session_01UqrwaZ1xZHCSYcMWD4jzB5` · branch `claude/dazzling-tesla-g6zqim`
> Preview: https://domusgpt.github.io/Rumpflaw/preview/claude-dazzling-tesla-g6zqim/ (after the one-time Pages setting — see `docs/DEPLOYMENT.md`)

⚠ **Before launch:** read `docs/CONTENT_REVIEW.md`. `www.rumpflaw.com` belongs to an *unrelated* Wisconsin firm — do not use that domain.

## Experience

1. **Scroll-locked intro** — the brass "R" porthole mark draws itself, the wordmark rises, the overlay lifts (≤3 s, any input fast-forwards, once per session).
2. **Pinned hero** — a live WebGL nautical-chart field (bathymetric contours of the bay); on scroll the headline lifts away and a **dawn disc** rises from the horizon to become the next section's paper.
3. **The firm** — word-by-word ink-in statement + three principles.
4. **Practice areas** — horizontal pinned gallery of six two-column "spreads" (vertical cards on mobile).
5. **Attorneys** — Brian E. Rumpf & Debra Rumpf, sourced credentials and public appointments.
6. **Approach** — four steps on a drawn progress line.
7. **Where we practice** — illustrative chart of southern Ocean County that draws itself.
8. **FAQ**, **Contact** (phone-first + validated inquiry form), legal footer.

## Stack

Plain HTML/CSS/ES modules · GSAP 3.15 (ScrollTrigger, SplitText) · Lenis 1.3 · WebGL2/1 shader ·
Fraunces + Inter (self-hosted) · zero-dependency Node build · Playwright + axe-core QA · optional Firebase
(Cloud Functions + Firestore) for form intake and privacy-first telemetry.

```
site.config.json        single source of truth (firm facts w/ provenance, adapters, SEO switch)
src/                    pages, partials, assets (css, js, fonts, vendor, img)
scripts/                build · vendor · serve · assets (favicons/OG) · deploy-pages
tests/unit/             node:test — schema, telemetry, build invariants, schema sync
tests/e2e.mjs           browser QA — a11y, motion integrity, forms, perf budget, keyboard
tests/visual.mjs        screenshots, contact sheet, optional video
integrations/firebase/  inquiry + collect functions, Firestore rules
docs/                   DEVLOG · devtrack.json · CONTENT_REVIEW · COMPLIANCE · DEPLOYMENT · visual-codex/
```

## Commands

```bash
npm ci
npm run dev            # build (development) + serve at http://127.0.0.1:4173
npm run build:preview  # preview build → dist/
npm test               # unit + e2e
npm run visual         # screenshots → .artifacts/visual/
```

## Middleware & telemetry

- **Inquiry pipeline:** shared validation schema (browser + Cloud Function) → honeypot + timing bot checks → session throttle → adapter (`demo` on previews · `endpoint` in production · `disabled` with call-us fallback when no endpoint).
- **Telemetry pipeline:** `track()` → enrich → PII scrub → sample → dedupe → consent gate → transport (`none` · `console` · `beacon` first-party · `plausible`). GPC/DNT disable it entirely. JS errors + Core Web Vitals captured. Off by default.

## Licensing

Proprietary — see `LICENSE`. Third-party components: `THIRD_PARTY_NOTICES.md`.

## Dev log

`docs/DEVLOG.md` (narrative, timestamped per turn) and `docs/devtrack.json` (structured; rendered at `/dev/` on every deployment).
