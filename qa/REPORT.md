# Aamako-Agro QA Report
Generated: 2026-09-18T04:28:11.446Z

## Totals
| Status | Count |
|---|---|
| PASS | 178 |
| FAIL | 0 |
| WARN | 0 |
| ERROR | 0 |
| **Total checks** | **178** |

## Suite summary
| Suite | PASS | FAIL | WARN/ERROR |
|---|---|---|---|
| 01-api-functional | 14 | 0 | 0 |
| 02-auth | 14 | 0 | 0 |
| 03-rbac | 26 | 0 | 0 |
| 04-checkout | 14 | 0 | 0 |
| 05-cms | 15 | 0 | 0 |
| 06-ui-storefront | 13 | 0 | 0 |
| 07-ui-dashboard | 11 | 0 | 0 |
| 08-accessibility | 7 | 0 | 0 |
| 09-responsive | 21 | 0 | 0 |
| 10-performance | 15 | 0 | 0 |
| 11-security | 19 | 0 | 0 |
| 12-seo | 9 | 0 | 0 |

## Failed checks
_None — all checks passed._

## Warnings
_None._

## Artifacts
- `qa/artifacts/06-after-login.png`
- `qa/artifacts/06-signin-page.png`
- `qa/artifacts/07-admin-dashboard.png`
- `qa/artifacts/07-admin-login.png`
- `qa/artifacts/07-admin-products.png`
- `qa/artifacts/07-admin-support-role.png`
- `qa/artifacts/08-axe-dashboard-login.png`
- `qa/artifacts/08-axe-storefront-cart-html.png`
- `qa/artifacts/08-axe-storefront-collection-html.png`
- `qa/artifacts/08-axe-storefront-index-html.png`
- `qa/artifacts/08-axe-storefront-signin-html.png`
- `qa/artifacts/09-cart-html-1024.png`
- `qa/artifacts/09-cart-html-1440.png`
- `qa/artifacts/09-cart-html-375.png`
- `qa/artifacts/09-cart-html-768.png`
- `qa/artifacts/09-collection-html-1024.png`
- `qa/artifacts/09-collection-html-1440.png`
- `qa/artifacts/09-collection-html-375.png`
- `qa/artifacts/09-collection-html-768.png`
- `qa/artifacts/09-index-html-1024.png`
- `qa/artifacts/09-index-html-1440.png`
- `qa/artifacts/09-index-html-375.png`
- `qa/artifacts/09-index-html-768.png`
- `qa/artifacts/09-login-1024.png`
- `qa/artifacts/09-login-1440.png`
- `qa/artifacts/09-login-375.png`
- `qa/artifacts/09-login-768.png`
- `qa/artifacts/09-overlap-probe-375.png`

## Notes on methodology
- Additive harness: lives in `qa/`, imports nothing from app source, makes no app-code changes.
- All mutating checks create `qa-*` records and clean up after themselves (products, content blocks, users).
- The storefront is served as static HTML, so SEO/a11y checks fetch and inspect the served pages directly.
