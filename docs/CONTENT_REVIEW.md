# Content review — facts, sources, and items the firm must confirm

Prepared 2026-11-06 (session `session_01UqrwaZ1xZHCSYcMWD4jzB5`, branch `claude/dazzling-tesla-g6zqim`, v0.1.0).
Every factual statement on the site traces to a row below. **Nothing should go live until each ⚠ item is confirmed by the firm.**

## ⚠ Read first

1. **Domain:** `www.rumpflaw.com` currently serves a *different, unrelated* firm — **Rumpf Law Office, S.C., Cambridge, Wisconsin**.
   Do **not** point this site at that domain. Confirm which domain Rumpf Law, P.C. (NJ) owns or wants.
2. **Firm name:** Official 2025–2026 municipal records use **"Rumpf Law, P.C."** Wikipedia lists "Rumpf, Rumpf and Reid";
   directories list "Brian E. Rumpf, P.C." / "Law Office of Brian Rumpf PC" / "Brian E. Rumpf d/b/a Rumpf Law".
   The site uses *Rumpf Law, P.C.* (single value in `site.config.json → firm.name`). Confirm the current legal name, and whether a "Reid" attorney is with the firm.

## Verified (official or primary sources)

| Fact on site | Source |
|---|---|
| Firm name "Rumpf Law, P.C." · 11 Leifried Lane, Tuckerton, NJ 08087 | Little Egg Harbor Twp. 2026 Professional Services Notice (reorganization meeting, Jan 1, 2026) — leht.com |
| Debra Rumpf — Municipal Public Defender, Little Egg Harbor Twp. | Same notice; leht.com Municipal Court page |
| Debra Rumpf — Zoning Board Attorney, Little Egg Harbor Twp. | leht.com Zoning Board page ("Debra Rumpf, Rumpf Law") |
| Debra Rumpf — Zoning Board of Adjustment attorney, Ocean Twp. (2025) | Township of Ocean (Waretown) ZBA agendas, Mar/May/Jun 2025 |
| Brian E. Rumpf — Public Defender, Stafford Twp. | Ocean County Government Directory (Stafford Twp. listing); Stafford Twp. 2025 reorganization agenda |
| Brian: B.A. Politics, Catholic University of America (1986); J.D., Washington and Lee (1989) | Wikipedia: *Brian E. Rumpf* |
| Brian: LEHT Township Committee 1997–2005; Mayor 2000–2003; NJ General Assembly, 9th District, since 2003 | Wikipedia; NJ Assembly Republicans biography |
| Brian and Debra are law partners in Tuckerton | NJ Assembly Republicans biography; Wikipedia |

## ⚠ Needs firm confirmation

| Item | Current value | Source / note |
|---|---|---|
| Main phone | (609) 294-2227 | FindLaw (updated 2024-02-18) + directories — not on an official record |
| Fax | (609) 294-3354 | FindLaw only |
| Office hours | Mon–Fri, 9:00 a.m.–4:00 p.m. | Business listing (Birdeye/Google) |
| Email | *not shown* | No public firm email found — form uses Firebase intake instead |
| Practice areas (6 cards) | Real estate; wills/estates/probate; family; municipal court; PI & workers' comp; bankruptcy | Martindale/Avvo category listings for Brian and Debra — confirm scope and any areas to drop/add |
| Attorney titles | "Partner" for both | P.C. — "Shareholder"/"Principal" may be more accurate |
| Brian: "more than three decades" in practice | J.D. 1989 | Confirm NJ admission year |
| Debra: education, admission year, bio details | *omitted* | Not found publicly — please supply |
| Brian's legislative service on a law-firm site | Listed as biography under "Public service" | Ethics/optics review — see COMPLIANCE.md |
| Ocean Twp. ZBA role still current in 2026? | Shown as "(2025)" | 2025 agendas only |
| "Richard Kitrick" | *not shown* | Appears on FindLaw firm listing — confirm whether affiliated |
| Courts statement ("…to the Ocean County Courthouse in Toms River") | Area section | Confirm the firm is comfortable with this phrasing |
| Service statements ("returns your call", "fees in writing") | Firm pillars, Approach steps, FAQ | Aspirational copy — firm must be able to stand behind each |
| Headshots | Monogram plates (BR / DR) | Supply professional portraits (4:5, ≥1200×1500) |
| Responsible attorney for site content | Brian E. Rumpf, Esq. | Firm to designate |

## Copy facts checked for New Jersey accuracy

- Residential contracts prepared by licensees have a **three-business-day attorney-review period** (NJ).
- Wills are probated before the **County Surrogate** (here, Ocean County).
- NJ **inheritance tax** remains (estate tax repealed 2018) — "filings & waivers" phrasing.
- Municipal court consequences: MVC **points**, **surcharges**, suspension.
- Contingent fees are governed by **NJ Court Rule 1:21-7**; written fee terms (RPC 1.5(b)).
