# Aamako-Agro QA Harness

Additive, black-box QA automation for the Aamako-Agro platform. Lives entirely in `qa/`,
imports nothing from app source, and **makes no app-code changes**. All mutating checks
create `qa-*` records and clean up after themselves.

## Prerequisites

- Local dev stack running:
  - API → `http://localhost:3000/api`
  - Storefront → `http://localhost:8080`
  - Admin dashboard → `http://localhost:3001`
- Node 18+ (uses global `fetch`)
- Chrome (Playwright launches the system Chrome via `channel: 'chrome'`)
- Seeded accounts from the README "Default Credentials" section (see `config.js`)

## Install

```bash
cd qa
npm install
```

## Run

```bash
npm test                  # all 12 suites, sequential (~5–6 min)
node runner.js 03 07      # subset — zero-padded number or name fragment
npm run test:api          # suites 01–05 (API, auth, RBAC, checkout, CMS)
npm run test:ui           # suites 06–10 (browser-based)
npm run test:security     # suites 11–12
npm run report            # aggregate qa/results/*.json → qa/REPORT.md
```

Exit code is `0` only when every executed check passes — CI-safe. A filter that matches
no suite also exits `1`.

## Suites

| # | File | Covers |
|---|---|---|
| 01 | `suite-01-api-functional` | health, pagination, error shape, 404s, whitelist validation |
| 02 | `suite-02-auth` | register/login, refresh rotation, logout revocation, surface separation |
| 03 | `suite-03-rbac` | role × endpoint matrix, permission names, hierarchy enforcement |
| 04 | `suite-04-checkout` | cart → checkout → order visible to buyer + staff, idempotency replay |
| 05 | `suite-05-cms` | draft/publish visibility, review workflow, role-restricted deletes |
| 06 | `suite-06-ui-storefront` | page/link crawl, UI login journey, session persistence |
| 07 | `suite-07-ui-dashboard` | admin login, all pages render, per-role server enforcement |
| 08 | `suite-08-accessibility` | axe-core WCAG 2.1 A/AA (critical/serious), keyboard nav, focus visibility |
| 09 | `suite-09-responsive` | no horizontal overflow at 375/768/1024px, 44px tap targets |
| 10 | `suite-10-performance` | load time, page weight, slow requests, image sizing/alt |
| 11 | `suite-11-security` | headers, CORS, XSS reflection, IDOR scoping, login rate limiting |
| 12 | `suite-12-seo` | titles, meta, canonical, OG/Twitter, robots.txt, sitemap, JSON-LD |

## Outputs

- `results/<suite>.json` — one entry per check (tracked in git)
- `artifacts/*.png` — screenshots (gitignored)
- `REPORT.md` — generated summary with failure details

## Notes

- The API's login rate limiter counts rejected attempts too (10/min per IP).
  `lib.js` tracks every login the harness issues and `waitForLoginBudget()` sleeps
  until slots are free before a suite logs in, so suites do not fail on 429s that
  are not product bugs. Browser logins (Playwright, suites 06/07) cannot be
  intercepted, so those suites reserve a slot up front and call `recordLogin()`
  after the journey. `runner.js` additionally pauses 60s after suite 02
  (`COOLDOWN_AFTER`) — suite 03 immediately needs 8 role logins — so the pause
  happens between suites rather than mid-suite.
- Suites run sequentially with 5s gaps to stay inside the throttle window.
- Only one harness may run against the stack at a time: concurrent runs share the
  same per-IP throttle budget and report false 429 failures (a second run's suite 02
  can 429 on its very first login). `runner.js` takes `qa/.runner.lock` and refuses
  to start while another run holds it; a lock left by a killed run is detected by
  PID and reclaimed automatically.
- Current findings and their evidence live in `REPORT.md`; each failure lists the
  exact endpoint, page, or element that produced it.
