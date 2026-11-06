# Third-party notices

Runtime components are vendored (self-hosted) from pinned npm versions by `scripts/vendor.mjs`;
the deployed site makes no requests to third-party CDNs or font services.

| Component | Version | License | Shipped as |
|---|---|---|---|
| GSAP (core, ScrollTrigger, SplitText) — GreenSock / Webflow | 3.15.0 | GSAP Standard "No Charge" License — https://gsap.com/standard-license (free for commercial use, incl. all plugins) | `src/assets/vendor/gsap/*.min.js` (+ `LICENSE.txt`) |
| Lenis — darkroom.engineering | 1.3.27 | MIT | `src/assets/vendor/lenis/` (+ `LICENSE.txt`) |
| Fraunces (variable, opsz + wght) — Undercase Type | @fontsource-variable 5.3.0 | SIL Open Font License 1.1 | `src/assets/fonts/fraunces-*.woff2` (+ `LICENSE-Fraunces-OFL.txt`) |
| Inter (variable, wght) — Rasmus Andersson | @fontsource-variable 5.3.0 | SIL Open Font License 1.1 | `src/assets/fonts/inter-wght-normal.woff2` (+ `LICENSE-Inter-OFL.txt`) |

Development / CI only (not shipped):

| Component | Version | License |
|---|---|---|
| axe-core, @axe-core/playwright | 4.14.0 | MPL-2.0 |
| Playwright (CI install) | 1.63.0 | Apache-2.0 |
| firebase-functions / firebase-admin (optional middleware) | 7.4.0 / 14.5.0 | MIT / Apache-2.0 |

The GSAP Standard License prohibits use in no-code visual animation builders that compete with
Webflow; a firm website is a permitted use.
