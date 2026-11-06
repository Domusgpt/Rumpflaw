# Compliance checklist — attorney advertising, accessibility, privacy

Not legal advice — a working checklist for the firm's review. Verify current rule text before launch.

## New Jersey Rules of Professional Conduct (advertising)

| Requirement | Where handled | Status |
|---|---|---|
| No false or misleading communications; claims substantiated (RPC 7.1) | All copy factual or flagged in `CONTENT_REVIEW.md`; no superlatives, rankings, ratings or comparisons | ✅ (firm to confirm flagged items) |
| No results, testimonials or endorsements without required disclaimers (RPC 7.1) | None used. Footer still states "Prior results do not guarantee a similar outcome." | ✅ |
| No "specialist/expert/certified" claims unless certified (RPC 7.4) | Copy says "practice focuses on / matters we handle"; Legal Notices state practice areas ≠ Supreme Court certification | ✅ |
| Name of at least one lawyer responsible for content (RPC 7.2) | Footer + Legal Notices: "Attorney responsible for this website's content" | ⚠ firm to designate |
| Firm name not misleading; P.C. designation (RPC 7.5; R. 1:21-1A) | "Rumpf Law, P.C." from official records | ⚠ confirm legal name |
| No implication of ability to improperly influence officials (RPC 8.4(e)) | Public roles shown as biography only; Legal Notices disclaim endorsement/influence; legislative title not used in hero, headings or calls to action | ⚠ firm review |
| Public defender roles vs. private municipal-court work | Municipal Court card is generic; no court-specific solicitation | ⚠ firm to confirm no conflict with appointed roles |
| "Attorney advertising" label | Footer + Legal Notices | ✅ (conservative) |

## Federal

- **11 U.S.C. § 528** (debt relief agency): "We are a debt relief agency. We help people file for bankruptcy relief under the Bankruptcy Code." — on the Bankruptcy card, in the footer, and in Legal Notices. ✅ (unit-tested)

## Client intake

- Form acknowledgement checkbox: no attorney-client relationship. ✅
- "Don't send confidential information" notice above the form and in the FAQ. ✅
- Production form never silently drops messages: with no endpoint configured it is disabled with a call-us notice (unit-tested). ✅
- Firebase intake: validation, rate limiting, no IP storage, staff email omits client details. ✅

## Accessibility (WCAG 2.2 AA target)

- axe-core: 0 violations (any severity) on all pages in the automated suite. ✅
- Reduced motion: no pins, intro, smoothing or hidden states. ✅ (e2e)
- Keyboard: skip link, visible focus, focus-trapped mobile menu with `inert` background, Esc to close, horizontal gallery follows focus. ✅ (e2e)
- No-JS / failed-boot: all content visible (4 s failsafe). ✅ (e2e)
- Contrast tokens checked; small brass text uses `--brass-700` (≥4.9:1). ✅

## Privacy

- No cookies; sessionStorage only (intro seen, duplicate-submit guard). ✅
- No third-party scripts or fonts (all self-hosted) — no visitor IPs leaked to CDNs. ✅
- Telemetry off by default (`adapter: none`); when enabled it's first-party and aggregate; GPC/DNT fully disable it; PII scrubbed. ✅ (unit-tested)
- Privacy Policy page (draft) describes the above. ⚠ firm review
- Staging builds: `noindex, nofollow` + `robots.txt Disallow: /` until `seo.allowIndexing` is set **and** a firm-owned domain is configured. ✅ (unit-tested)
