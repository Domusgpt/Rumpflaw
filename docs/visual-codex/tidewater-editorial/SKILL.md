---
name: tidewater-editorial
description: Reusable "Tidewater Editorial" visual + motion system for professional-services sites (law, finance, advisory, real estate) with a coastal or regional identity. Use when building an elegant, trustworthy marketing site with GSAP scroll choreography — pinned intro, dawn-disc section handoff, horizontal practice gallery, WebGL bathymetry hero. Includes tokens, type scale, motion recipes, accessibility guardrails and compliance hooks for attorney advertising.
---

# Tidewater Editorial — Visual Codex entry

First shipped on: **Rumpf Law, P.C.** (Tuckerton, NJ) · `domusgpt/Rumpflaw` · v0.1.0 · 2026-11-06.
Source of truth for the implementation: `src/assets/css/site.css`, `src/assets/js/motion.js`, `src/assets/js/tide-field.js`.

## 1. Idea

**Nautical chart meets editorial print.** Deep "bay at night" ink, dune-sand paper, brass instrument
accents. Headlines in a high-contrast optical-size serif; body in a neutral grotesk. Motion is slow,
weighted and tidal — never bouncy. The signature moment: a **dawn disc** rises from the hero's horizon
line and becomes the paper of the next section.

Use it when a client is *rooted in a place* (coast, river, valley) and sells *trust and calm*.
Swap the place-specific pieces (coordinates, chart, towns) — keep the system.

## 2. Tokens

| Token | Value | Use / contrast |
|---|---|---|
| `--ink-950` | `#09131C` | intro, footer |
| `--ink-900` | `#0E1C28` | hero, dark bands — text-on-ink `#EDE7DC` = 14.0:1 |
| `--ink-800` / `-700` | `#152A3A` / `#1F3A4F` | depth, portrait plates |
| `--sand-50` | `#F6F2EA` | paper — text `#14222E` = 14.5:1 |
| `--sand-100` / `-200` | `#EEE7DA` / `#E1D6C3` | alternate paper, cards, rules |
| `--brass-300` | `#DCC59E` | accents on ink (10.3:1) |
| `--brass-400` | `#C5A574` | buttons/lines on ink (7.4:1) |
| `--brass-700` | `#7D5F33` | **small text on paper** (≥4.9:1) — never use `brass-500/600` for text on paper |
| `--tide-500` / `--marsh-500` | `#4E7385` / `#7A8763` | chart water labels, secondary plates |

Run the contrast script (see `docs/DEVLOG.md`) whenever you re-tint.

## 3. Type

- **Display:** Fraunces variable (`opsz` 9–144, `wght`), self-hosted woff2 (latin, ~67 KB + italic 81 KB).
  Hero `opsz 144`, `wght 280–300`, tracking `-0.035em`, line-height `0.93`. Italic brass for the emotional half of the headline.
- **Body/UI:** Inter variable (`wght`, ~48 KB). 17–19 px fluid body, 1.6 line-height.
- **Eyebrows:** Inter 560, 0.16em tracking, uppercase, preceded by a 2.25rem hairline.
- Fluid scale: `--step--2 … --step-hero` (`clamp()`), hero ≈ `clamp(3.2rem, 1rem + 9.2vw, 10rem)`.
- Metric-adjusted local fallbacks (`size-adjust`) to keep CLS ≈ 0 during font swap.

## 4. Layout rhythm

Ink hero → paper statement → sand practice → paper people → **ink** process → paper place →
sand FAQ → **ink** contact → ink-950 footer. Sections `padding-block: clamp(5.5rem, 11vw, 10.5rem)`.
Container `min(100% − 2·gutter, 1320px)`; radius 3–6 px (restrained); hairline rules `rgba(20,34,46,.12)`.

## 5. Motion recipes (GSAP 3.13+ — all plugins free; Lenis smooth wheel)

| Recipe | Spec |
|---|---|
| **Scroll-locked intro** | Overlay with line-art mark drawn via `pathLength=1` + `stroke-dashoffset 1→0` (1.15 s, stagger .085), wordmark rises from mask, hairline `scaleX`, overlay exits `clip-path: inset(0 0 100% 0)` (1.05 s `expo.inOut`). Lock = `html.is-locked{overflow:hidden}` + `lenis.stop()`. Any wheel/touch/key/pointer → `timeScale(4.5)`. Once per session (`sessionStorage`), skipped on deep links. Never longer than ~3 s. |
| **Dawn-disc handoff** | Pin hero `+=150vh`, `scrub .9`. Content lifts (`y −14vh`, fade), WebGL zoom 1→1.9, horizon collapses to a point, then `clip-path: circle(var(--r) at 50% calc(100% − 88px))` grows to `hypot(w/2, h)+80`; brass ring follows `--r` and fades at 0.78. |
| **Word ink-in** | `SplitText` words, opacity .16→1, `scrub .6`, `top 82%` → `bottom 50%`. |
| **Line mask reveals** | `SplitText` lines + `mask:'lines'`, `yPercent 112→0`, 1.15 s `expo.out`, stagger .1; `autoSplit` with a `revealed` guard so resizes don't replay. |
| **Horizontal gallery** | Pin + `x: -(scrollWidth − clientWidth)`, `scrub .7`, cards fade/rise via `containerAnimation`. Only when ≥1024×720 **and** a runtime fit-check passes; cards become two-column "spreads". Keyboard `focusin` scrolls the pinned track to the focused card. |
| **Portrait plates** | `clip-path: inset(10% 12% … round 6px) → inset(0)` scrubbed + monogram parallax ±16%. |
| **Drawn process line** | div `scaleX` (desktop) / `scaleY` (mobile) scrubbed; steps reveal once. |
| **Chart draw** | `getTotalLength()` dash draw for coastlines; animate **children** of positioned `<g>`s — never `y` on the `<g>` itself (overwrites its translate). |

**Pinning:** `pinType: 'transform'` when Lenis drives scrolling (no layout shift, same-frame), `'fixed'` on touch-only.
Call `lenis.resize()` on every `ScrollTrigger` refresh (pin spacers change the scroll limit).

## 6. WebGL "Tide Field" (bathymetry contours)

Domain-warped fbm → `fract(h·24)` contour lines anti-aliased with `fwidth`, every 5th an index line,
tide→brass tint, dawn glow at the horizon, 1.6% grain. WebGL2 → WebGL1+derivatives → CSS
`repeating-radial-gradient` fallback. DPR ≤ 1.5 (≤1 on small/coarse), 30 fps idle cap, paused
off-screen / hidden tab, single static frame under reduced motion, context-loss recovery.

## 7. Guardrails (non-negotiable)

- Content is visible without JS, with reduced motion, and if boot fails (4 s failsafe adds `motion-failed`).
- Hidden-before-reveal styles apply **only** under `.motion-ok:not(.motion-failed)`.
- Don't animate `visibility` on things you're about to focus (use `opacity`).
- Validate forms on `input`, not `blur` — collapsing errors under the pointer cause missed clicks.
- CSP: no `unsafe-inline` scripts; the boot script is hashed at build time.
- Test: no element left hidden after a full scroll-through; CLS < 0.1 with pins; deep links land on target.

## 8. Compliance hooks (attorney sites)

Attorney-advertising footer; no "specialist/expert" wording; no testimonials/results without
disclaimers; public-office mentions framed as biography (no implied influence); bankruptcy pages carry
the 11 U.S.C. § 528 debt-relief-agency statement; "responsible attorney" line; contact-form
no-relationship acknowledgement. See `docs/COMPLIANCE.md`.

## 9. Suggested additions to the agent's Visual Codex skill

1. Add this entry as `visual-codex/tidewater-editorial`.
2. Add a generic **"scroll-locked intro"** recipe (section 5, row 1) — reusable across brands.
3. Add the **motion QA checklist** (section 7) to every motion-heavy build's test plan.
