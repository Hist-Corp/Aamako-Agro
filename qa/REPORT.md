# Aamako-Agro QA Report
Generated: 2026-09-09T11:35:42.867Z

## Totals
| Status | Count |
|---|---|
| PASS | 148 |
| FAIL | 22 |
| WARN | 3 |
| ERROR | 0 |
| **Total checks** | **173** |

## Suite summary
| Suite | PASS | FAIL | WARN/ERROR |
|---|---|---|---|
| 01-api-functional | 14 | 0 | 0 |
| 02-auth | 13 | 1 | 0 |
| 03-rbac | 25 | 1 | 0 |
| 04-checkout | 14 | 0 | 0 |
| 05-cms | 15 | 0 | 0 |
| 06-ui-storefront | 13 | 0 | 0 |
| 07-ui-dashboard | 10 | 1 | 0 |
| 08-accessibility | 5 | 2 | 0 |
| 09-responsive | 17 | 4 | 0 |
| 10-performance | 9 | 5 | 1 |
| 11-security | 12 | 1 | 1 |
| 12-seo | 1 | 7 | 1 |

## Failed checks

### 02-auth
- **Customer account blocked from dashboard login (surface separation)** — status=200

### 03-rbac
- **RBAC: POST /orders (checkout) — customers must pass role gate** — violations → SUPER_ADMIN:400(expected 403) | STAFF_ADMIN:400(expected 403) | STAFF_MANAGER:400(expected 403) | STAFF_SUPPORT:400(expected 403)

### 07-ui-dashboard
- **Dashboard UI: customer login rejected at the door** — status=200 (server issues dashboard tokens to customers — see suite 02)

### 08-accessibility
- **A11y storefront /collection.html: no critical/serious WCAG 2.1 A/AA violations** — serious: link-name (5 nodes)
- **A11y dashboard /login: no critical/serious WCAG 2.1 A/AA violations** — serious: color-contrast (1 nodes)

### 09-responsive
- **Tap targets >=44px on mobile: /index.html** — <a logo 41x36> | <button hamburger 40x40> | <a link-arrow 129x22> | <a link-arrow 146x22> | <a link-arrow 129x22> | <a prod-name 293x21>
- **Tap targets >=44px on mobile: /collection.html** — <a logo 41x36> | <button hamburger 40x40> | <a  36x18> | <a  85x18> | <a omback-btn 92x42> | <a  153x35>
- **Tap targets >=44px on mobile: /cart.html** — <a logo 41x36> | <button hamburger 40x40> | <a  102x42> | <a  142x42> | <a  117x42> | <a is-active 60x42>
- **Tap targets >=44px on mobile: /login** — <button jsx-ee210f68dd737e54 absolute  24x24> | <button inline-flex items-center justi 295x36>

### 10-performance
- **Load time OK: storefront index** — 9465ms (>5s)
- **No images >2x rendered size: storefront index** — logo.png nat=2913 rendered=50 | Freeze-Dried_Mango_as_a_Natural_Flavor_cubes_and_b nat=1600 rendered=175 | power%20fruits%20packaging.jpeg nat=500 rendered=175 | 1788801999342-612581aa9a67.jpg nat=590 rendered=175
- **No images >2x rendered size: storefront collection** — logo.png nat=2913 rendered=50 | photo-1532336414038-cf19250c5757?w=800&q=80 nat=800 rendered=277 | photo-1532336414038-cf19250c5757?w=800&q=80 nat=800 rendered=277 | photo-1532336414038-cf19250c5757?w=800&q=80 nat=800 rendered=277
- **No images >2x rendered size: dashboard login** — logo-mark.png nat=1198 rendered=520 | logo-mark.png nat=1198 rendered=340 | logo.png nat=2913 rendered=96
- **All images have alt text: dashboard login** — logo-mark.png | logo-mark.png

### 11-security
- **Admin login not indexable (robots.txt or noindex)** — robots.txt=404, no noindex meta

### 12-seo
- **SEO: meta description present on all pages** — index.html, collection.html, cart.html, signin.html, journal.html, process.html
- **SEO: canonical tag present on all pages** — index.html, collection.html, cart.html, signin.html, journal.html, process.html
- **SEO: Open Graph (og:title/og:description) present** — index.html, collection.html, cart.html, signin.html, journal.html, process.html
- **Storefront robots.txt present (200)** — status=404
- **Storefront sitemap.xml present and well-formed** — status=404
- **Structured data (JSON-LD) on homepage** — no ld+json block found
- **og:image resolves (200)** — no og:image on homepage

## Warnings

### 10-performance
- **Page weight: storefront index** — 4079 KB across 45 requests (heavy >3MB)

### 11-security
- **Stored payload kept verbatim in DB** — name stored raw — safe only because React escapes on render

### 12-seo
- **SEO: twitter:card present on all pages** — missing on: index.html, collection.html, cart.html, signin.html, journal.html, process.html

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
- `qa/artifacts/12-index-journallinks-hidden.png`
- `qa/artifacts/12-journal-hidden.png`

## Notes on methodology
- Additive harness: lives in `qa/`, imports nothing from app source, makes no app-code changes.
- All mutating checks create `qa-*` records and clean up after themselves (products, content blocks, users).
- The storefront is served as static HTML, so SEO/a11y checks fetch and inspect the served pages directly.
