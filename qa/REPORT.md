# Aamako-Agro — End-to-End QA Report

**Run date:** 2026-09-11 · **Targets:** Storefront `http://localhost:8080` · Dashboard/CMS `http://localhost:3001` · API `http://localhost:3000/api`
**Harness:** `qa/runner.js` — 12 suites, 173 automated checks (Playwright + axe-core + HTTP probes). Re-runnable: `cd qa && node runner.js && node report.js`
**Scope notes:** Non-destructive only. Chromium (Chrome channel) used for browser checks — Firefox/WebKit not run in this pass. All mutating checks create `qa-*` records and clean up.

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

---

# DEFECTS BY AREA

## 1. FUNCTIONAL (front-end + API) — 41/41 pass ✅

No functional defects found. Verified:
- All storefront nav links/assets resolve (26 unique links crawled, zero 4xx/5xx).
- Pagination, search (`?search=`), category filtering, product detail & 404 handling, DTO whitelist (unknown fields → 400), standard error shape `{error:{code,message}}`.
- Auth: register / duplicate-register 409 / weak-password 400 / wrong-password 401 / refresh rotation (old token revoked) / logout revokes refresh / garbage bearer 401.
- **Checkout golden flow end-to-end:** browse → add to cart → qty update → checkout (Idempotency-Key enforced, replay returns same order — no duplicates) → order visible to buyer and staff. 14/14.
- CMS full lifecycle: create draft → not publicly visible → publish → reflects on public API → edit reflects → unpublish → hidden. Content moderation (CM submits → manager approves → published). 15/15.

---

## 2. RESPONSIVE & CROSS-BROWSER

No horizontal overflow on any page at 375/768/1024/1440px (16/16 pass). No header/content overlap on mobile. Remaining issue: tap-target sizes.

### [Medium] — Tap targets below 44×44px on mobile across all key pages
**Steps:** View any page at 375×667 and measure visible interactive elements.
**Expected:** Touch targets ≥44×44px (WCAG 2.5.8 / platform guidance).
**Actual:** Repeated offenders:
- `/index.html` — logo `41×36`, hamburger button `40×40`, link-arrows `129×22`/`146×22`, product-name link `293×21`
- `/collection.html` — logo `41×36`, hamburger `40×40`, two header links `36×18`/`85×18`, `omback-btn 92×42`
- `/cart.html` — logo `41×36`, hamburger `40×40`, three nav links ~42px high
- Dashboard `/login` — icon button `24×24`, a full-width button `295×36`
**Evidence:** `qa/artifacts/09-index-html-375.png`, `09-collection-html-375.png`, `09-cart-html-375.png`, `09-login-375.png`; full element lists in `qa/results/09-responsive.json`.

### [Low] — Cross-browser coverage limited to Chromium
Firefox/WebKit not executed in this pass (Playwright browser binaries not provisioned). Rendering diffs untested.

## 3. CONTENT & CMS — 15/15 pass ✅ (functional) — content gaps logged under Accessibility/Performance

All CMS journeys pass: product CRUD + publish/unpublish reflection on the storefront API, draft invisibility, content moderation queue (CM submits → manager approves → published), role gating (CONTENT_MANAGER cannot delete; STAFF_MANAGER cannot delete), full cleanup of `qa-*` test records.

---

## 4. PERFORMANCE

### [Critical] — Homepage image undeliverable: HTTP 200 with `Content-Length: 1110141`, then connection closed with 0 bytes after a ~7s stall
**Steps:**
```bash
curl -sS -D - 'http://localhost:3000/api/uploads/1788801982305-c81046c98a10.png'
# → 200 OK, Content-Length: 1110141, Content-Type: image/png
# → curl: (18) transfer closed with 1110141 bytes remaining to read (size_download=0, ~6.5-7.2s)
```
**Expected:** image bytes stream and render.
**Actual:** headers sent, body never arrives; browser renders a broken image and holds a stalled connection (~7s).
**Root cause (verified on disk):** `Backend/uploads/1788801982305-c81046c98a10.png` is a **dataless (evicted) APFS/iCloud file** — `stat` reports 1,110,141 bytes, but `du` = **0B allocated** and every read returns 0 bytes (`cat | wc -c` → 0). `express.static` (`Backend/src/main.ts:57`) trusts stat for headers, then the body read hits EOF → socket destroyed. A sibling 1.3MB PNG serves in 5.7ms — file-state-specific, not a code-path bug.
**Impact:** 2 visibly broken images on the homepage (hero tile + category card; CMS keys `home.hero.tile5`, `home.categories.card1`, also `page.shop.sbc.cat2.image` on shop) and the ~7s stall dominating the 7.9–8.5s homepage load.
**Evidence:** `qa/artifacts/ev-home-broken-image.png` (broken hero/category image visible).

### [High] — Homepage loads in 7.9–8.5s; 4.3 MB across ~50 requests
**Steps:** Load `http://localhost:8080/index.html` cold; watch network waterfall.
**Expected:** < 5s, < 3MB page weight.
**Actual:** 7,936–8,504ms to network-idle; 4,333 KB / ~50 requests. Heaviest: Unsplash `photo-1586528116311` fetched **twice** (424KB + 163KB), `logo-footer.png` 285KB, `photo-1607623814075` 222KB, `logo.png` 143KB. The stalled broken-image requests (defect above) account for the ~7s tail.
**Evidence:** `qa/results/10-performance.json` (WARN "Page weight: storefront index — 4333 KB across 47 requests").

### [Medium] — Images massively oversized for rendered slots (no srcset/variants)
**Steps:** Load `/index.html`, `/collection.html`, dashboard `/login`; compare `naturalWidth` vs rendered size.
**Expected:** no image >2× rendered size.
**Actual:** `logo.png` natural **2913px → rendered 50px** (143KB, both surfaces); `logo-mark.png` 1198px → 520/340px; `Freeze-Dried_Mango_...png` 1600px → 175px; `power fruits packaging.jpeg` 500 → 175.
**Evidence:** `qa/results/10-performance.json`; `qa/artifacts/07-admin-login.png`.

## 5. ACCESSIBILITY (WCAG 2.1 AA, axe-core)

Keyboard passes: 25/25 tab stops reach interactive elements; visible focus indicator on every stop. Pages scanned: index, collection, cart, signin (storefront), dashboard /login.

### [High] — collection.html: 5 product-card links have no accessible name (axe `link-name`, serious)
**Steps:** Run axe-core (WCAG 2.1 A/AA) on `http://localhost:8080/collection.html`.
**Expected:** every link exposes an accessible name.
**Actual:** 5 violations — card links rely on `<img alt>` for their name, but those images have `src=""` (no image in catalog/CMS) and fail → inline `onerror` sets `display:none`, removing the alt text from the accessibility tree:
```html
<a class="fp-img" href="product.html?slug=fd-mango"><span class="fp-badge"></span>
  <img src="" alt="Freeze-Dried Mango" onerror="this.style.display='none';" style="display:none;"></a>
```
Affected slugs: `dehydrated-apple`, `fd-mango`, `fd-strawberry`, `fd-mango-chunks`, `fd-apple-slices`.
**Evidence:** `qa/artifacts/08-axe-storefront-collection-html.png`; node targets `.fpcard:nth-child(8/10/11/12) > .fp-img`, `.fp-img[href="product.html?slug=fd-mango"]`.

### [Medium] — Dashboard login primary button fails contrast: 3.29:1 (axe `color-contrast`, serious)
**Steps:** open `http://localhost:3001/login`, run axe-core.
**Expected:** ≥4.5:1 for 14px normal text.
**Actual:** full-width green **Sign in** button (`#16a34a` bg / `#ffffff` text) measures **3.29:1**.
**Evidence:** `qa/artifacts/08-axe-dashboard-login.png`, `qa/artifacts/ev-dash-login.png`; failure summary: "insufficient color contrast of 3.29 (foreground #ffffff, background #16a34a, 14px normal)".

### [Medium] — Dashboard login logo images missing alt text
**Actual:** 2 × `logo-mark.png` rendered without `alt`. **Evidence:** `qa/results/10-performance.json` ("All images have alt text: dashboard login" FAIL).

---

## 6. SEO & META — 1/9 pass ❌

Unique `<title>` per page passes (6/6). Failing:

### [Medium] — No meta description on any storefront page
Pages: index, collection, cart, signin, journal, process. **Evidence:** `qa/results/12-seo.json`.

### [Medium] — No canonical on any page · No Open Graph (og:title/og:description) on any page · No og:image on homepage · twitter:card missing everywhere (WARN)

### [Medium] — robots.txt and sitemap.xml both 404 on storefront
**Steps:** `GET http://localhost:8080/robots.txt` → 404; `/sitemap.xml` → 404.

### [Medium] — No structured data (JSON-LD) on homepage
No `application/ld+json` (Product/Organization schema absent).

---

## 7. SECURITY (non-destructive) — 12/13 pass ✅ (1 FAIL, 1 WARN)

Verified ✅: no `X-Powered-By`; CSP, HSTS (`max-age=31536000; includeSubDomains`), nosniff, XFO present; CORS locked to allowed origins; **no API keys/secrets in 15 served JS bundles**; XSS payload not reflected unescaped on product/collection pages; IDOR clean (`/orders/mine` returns only caller's orders); login rate limiting active (429 observed); all 17 admin endpoints reject unauthenticated calls with 401.

### [High] — Retail customer can obtain dashboard-scoped JWT (surface separation broken)
**Steps:**
```bash
curl -X POST http://localhost:3000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"customer@aamako.agro","password":"Customer123!","scope":"dashboard"}'
```
**Expected:** 403 — customers must not authenticate to the CMS/dashboard surface (the reverse rule is correctly enforced: staff are blocked from storefront login with 403).
**Actual:** **HTTP 200** with dashboard `accessToken` (JWT payload `"role":"RETAIL_CUSTOMER"`) + refresh token; dashboard UI accepts the session (suite 07 reproduces via browser login, status 200).
**Impact:** inconsistent trust boundary; a customer-issued dashboard token is one bug away from staff data and confuses the role model.
**Evidence:** repro curl above; `qa/results/02-auth.json`, `qa/results/07-ui-dashboard.json`, `qa/artifacts/07-admin-login.png`.

### [Medium] — Dashboard /login is indexable (no noindex; dashboard robots.txt 404)
**Evidence:** `qa/results/11-security.json` ("robots.txt=404, no noindex meta").

### [Low] (WARN) — Stored input kept verbatim in DB
XSS probe product name stored raw in Postgres. Not exploitable today (React escapes on render; reflected-XSS probes clean) — defense-in-depth: document the encode-on-output contract or sanitize server-side.

## PRIORITIZED FIX LIST

| # | Sev | Fix |
|---|---|---|
| 1 | **Critical** | Restore evicted file `Backend/uploads/1788801982305-c81046c98a10.png` (materialize from iCloud / re-upload; referenced by CMS keys `home.hero.tile5`, `home.categories.card1`, `page.shop.sbc.cat2.image`). Hardening: uploads static handler should fail closed (verify streamability or 404) instead of sending `Content-Length` then aborting; route large PNGs through the existing ImageCompressionService → WebP. |
| 2 | **High** | Block `RETAIL_CUSTOMER`/`WHOLESALE_CUSTOMER` from `scope:"dashboard"` login (403); add a dashboard-side role guard as defense-in-depth. |
| 3 | **High** | Populate the 5 missing product images (`src=""` on collection/home cards) and make `.fp-img` links resilient — add `aria-label`/visible text so the accessible name never depends on a hidden `<img>`. |
| 4 | **High** | Homepage perf: dedupe the double-fetched Unsplash hero, right-size `logo.png` (2913px→~100px @2x) and `logo-footer.png` (285KB), `preconnect` to `images.unsplash.com`, lazy-load below-fold imagery; target <3MB. |
| 5 | **Medium** | Tap targets ≥44px: hamburger (40→44), logo hit area, header/mobile nav links, dashboard login icon button (24×24). |
| 6 | **Medium** | Contrast: darken dashboard login button (`#16a34a` → `green-700`/`#15803d`) to reach 4.5:1. |
| 7 | **Medium** | SEO pack: per-page meta description + canonical + OG (+twitter:card, og:image); ship storefront `robots.txt` + `sitemap.xml`. |
| 8 | **Medium** | Add `alt` to the 2 dashboard `logo-mark.png` images; add `noindex`/robots.txt to dashboard `/login`. |
| 9 | **Medium** | RBAC ordering: `POST /orders` returns 400 (body validation) instead of 403 for non-customer roles — evaluate the role gate before DTO validation. |
| 10 | **Low** | Cross-browser pass (Firefox/WebKit) once Playwright browsers are provisioned. Note: `@playwright/test` runner crashes on this machine's Node v25.2.1 (upstream `lib/mcp/test` circular-import bug); the JS harness `qa/runner.js` is the canonical runner, spec drafts live in `qa/tests/*.spec.ts` for Node ≤24. |

## REPRODUCIBILITY
- Harness: `qa/runner.js` (12 suites: `qa/suite-*.js`); per-suite results in `qa/results/*.json`; screenshots in `qa/artifacts/`.
- Re-run: `cd qa && node runner.js` → console summary; `node report.js` regenerates totals + the "Failed checks" appendix below.
- Playwright spec drafts mirroring the 7 areas: `qa/tests/*.spec.ts` + `playwright.config.ts` (require Node ≤24 — see fix list #10).

---

## APPENDIX — Auto-generated raw failed-check index (verbatim from `qa/results/*.json` via `report.js`)

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
- **Load time OK: storefront index** — 8504ms (>5s)
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
- **Page weight: storefront index** — 4333 KB across 47 requests (heavy >3MB)

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
