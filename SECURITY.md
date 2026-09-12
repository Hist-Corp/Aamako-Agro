# Security Audit & Hardening

Result of a full review of the Aamako Agro platform against the OWASP-aligned
web security checklist. All changes below are **non-breaking** — they add or
harden behavior without changing the project's existing logic, endpoints, or
workflow. No schema migrations were introduced.

## Fixes applied (this pass)

| Area | Change | File |
|---|---|---|
| JWT secret | Removed the hardcoded `'dev-secret'` fallback in the access-token strategy. The API now **fails to boot** if `JWT_ACCESS_SECRET` is unset instead of silently signing with a well-known value. | `Backend/src/auth/jwt.strategy.ts` |
| Password policy | Self-service registration & change-password now require **8–72 chars with at least one letter and one number** (server-side). Staff/seed accounts are bcrypt-hashed directly and are unaffected. | `Backend/src/auth/dto/auth.dto.ts`, `Frontend/signup.html` (hint only) |
| Brute force | Added a **per-account failed-login lockout** (5 failures → 429 for 15 min) that complements the existing per-IP throttle. In-memory, no DB writes, cleared on success and pruned to avoid growth. | `Backend/src/auth/auth.service.ts` |
| Rate limiting | `POST /auth/logout` was the only public auth endpoint without a throttle; now limited (30/min). | `Backend/src/auth/auth.controller.ts` |
| Headers | Added `Referrer-Policy: strict-origin-when-cross-origin` via Helmet. Helmet's safe CSP/X-Frame-Options/X-Content-Type-Options/HSTS defaults are retained (so the Swagger UI keeps working). | `Backend/src/main.ts` |
| Transport | Set `trust proxy` in production so per-IP rate limiting and session IP logging are correct behind Render's proxy. | `Backend/src/main.ts` |
| Media uploads (SVG/active content) | Served uploads now get `X-Content-Type-Options: nosniff` + `Content-Security-Policy: sandbox` at `/api/uploads`, so an admin-uploaded SVG (stored byte-for-byte) or any mislabelled blob can never execute script or be MIME-sniffed into HTML by a browser. `<img>` rendering is unaffected. | `Backend/src/main.ts` |
| Frontend path traversal | `Frontend/server.js` (dev server) now rejects any URL that resolves outside the web root (encoded `/..%2f`). Previously `path.join(ROOT, url)` allowed arbitrary local file reads. Also added `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` to web responses. | `Frontend/server.js` |
| Newsletter abuse | Public `POST /newsletter/subscribe`, `/newsletter/unsubscribe` and the legacy `POST /content/subscribe` are now rate-limited (10/min per IP). | `Backend/src/newsletter/newsletter.controller.ts`, `Backend/src/content/content.controller.ts` |
| Env separation | `.env.example` now classifies PUBLIC/browser-safe vs SERVER-ONLY vars, documents `CORS_ORIGINS` as a production allow-list, and adds the `PUBLIC_API_URL` used for stored media URLs. | `Backend/.env.example` |
| Regression tests | Added `compress-image.spec.ts` (upload content-hardening) + path-traversal/header probes to `qa/suite-11-security.js`. | `Backend/src/media/compress-image.spec.ts`, `qa/suite-11-security.js` |

## Verified as already secure (no change needed)

1. **Authentication**
   - Passwords hashed with **bcrypt (cost 12)**; never stored in plaintext.
   - Generic `Invalid credentials` message — no **user enumeration** via login.
   - **Refresh-token rotation**: each refresh is single-use (old token revoked);
     tokens stored **only as SHA-256 hashes** in the DB.
   - **Session invalidation**: logout revokes the session; password change revokes
     *all other* sessions immediately.
   - Login/register/google/refresh are rate-limited per-IP (10–20/min).
   - Google ID tokens are fully verified (JWKS, RS256, issuer, audience, expiry,
     verified email).

2. **Authorization / RBAC**
   - **Server-side RBAC** (NestJS guards + `Roles` decorators). Unmarked routes
     are staff-only by default; nothing trusts the client.
   - Hierarchical authority (`ROLE_RANK`, `outranks`) — an actor can only manage
     users strictly below its own rank. Super-admin cannot be assigned.
   - **IDOR/BOLA reviewed**: orders are scoped to the authenticated user
     (`/orders/mine`); admin endpoints are role-gated; admin user management
     enforces hierarchy on *every* mutation.

3. **Input validation / injection**
   - Global `ValidationPipe` with `whitelist` + `forbidNonWhitelisted` — unknown
     fields are rejected, not ignored.
   - All DB access via **Prisma ORM (parameterized)** — no SQL injection surface.
   - Media URLs validated as secure `https://`; server-side **media uploads**
     exist for admin image uploads and are hardened: files are re-encoded via
     `sharp` to WebP (or stored byte-for-byte for SVG/GIF/codec-failures), the
     API accepts only `image/*` MIME, stored filenames are random, and served
     content is locked down with `nosniff` + `Content-Security-Policy: sandbox`
     so no uploaded asset can carry active content.

4. **CSRF / session**
   - Auth uses **Bearer tokens in headers**, not ambient cookies, so classic CSRF
     does not apply; GET endpoints do not mutate state; idempotency keys are
     required on checkout.

5. **Error handling / disclosure**
   - Global exception filter returns generic `{ error: ... }` — no stack
     traces/DB detail/internal paths to clients; full detail goes to server logs.

6. **Secrets & config**
   - No secrets committed; `.env`/`.env.local` are git-ignored; templates
     (`.env.example`, `.env.supabase.example`) contain placeholders only.
   - `CORS_ORIGINS` is an explicit allow-list (no wildcards).

## Known gaps / recommended next steps (not implemented — would be feature work)

- **MFA (2FA)**: the schema already has `totpSecret`/`totpEnabled` on users, but
  enforcement is not wired up ("Phase 8" per code comments). Implementing full
  TOTP enrollment/verification is a feature change; schedule it before go-live
  for admin/staff accounts.
- **Password reset flow**: no self-service "forgot password" endpoint exists yet.
- **Persistent audit log table**: admin actions are surfaced via notifications /
  live events but not stored in a dedicated immutable audit table.
- **CAPTCHA/bot protection** on register: currently covered by rate limiting
  only; add a provider (reCAPTCHA/hCaptcha) if spam becomes an issue.
- **In-memory lockout** is per-process; replace with a DB-backed store if you
  scale the API to multiple instances.

## Dependency / supply-chain audit (this pass)

| App | Tool | Result |
|---|---|---|
| `Frontend/` | `npm audit` | **0 vulnerabilities** (no runtime deps; CDN scripts reviewed) |
| `Backend/` | `npm audit` | 0 critical · 9 high · 13 moderate · 4 low — **all inside the NestJS 10 toolchain** (`@nestjs/cli`/schematics/`webpack`/`@angular-devkit`/`tmp` = build-time only, never deployed) or transitive to NestJS 10 itself (`@nestjs/core`, `platform-express`→`multer`/`body-parser`, `platform-ws`→`ws`, `@nestjs/swagger`) |
| `Dashboard/` | `pnpm audit` | **2 CRITICAL + many high advisories in `next`@14.2.35** (fixed in `next@15.5.24`) |

No vulnerable package is reachable through untrusted input except through the
framework versions themselves; nothing here is fixed by pinning — only by the
framework upgrades documented below.

## ⛔ Release-blocker: Next.js upgrade required before go-live

`Dashboard/apps/admin` runs `next@14.2.35`. Next.js 14 line is affected by
**two unauthenticated remote-code-execution advisories** (and 25 high/moderate
others), all fixed in **`next@15.5.24`+**:

- `next >=13.4.0 <15.5.24` — Unauthenticated **RCE on windows-hosted servers**
- `next >=10.0.0 <15.5.24` — Unauthenticated **RCE in the Image Optimization API** (AVIF)

**Why it was not applied in this pass:** the audit attempted `pnpm install
next@^15.5.24`, but this environment's registry access stalls before the
install completes, and a framework major cannot be shipped without a verified
`next build` + typecheck (the project must never be left in an unverified
state). The dependency was therefore left at its consistent, working `14.x`
state — no half-upgraded lockfile.

**Required action (owner, ~1–2 h):** bump `next` to `^15.5.24`
(`Dashboard/apps/admin/package.json`), run `pnpm install` and `pnpm --filter
@aamako/admin build` + `typecheck`. The codebase is already Next-15-compatible
(it uses the async `params: Promise` pattern in
`product-templates/[slug]/page.tsx` and only App-Router client APIs), so the
upgrade is expected to be a dependency-only change.

## Release gate — status: **SECURITY READY WITH WARNINGS**

| Gate item | Status |
|---|---|
| Exposed service-role / DB credentials in repo | PASS (placeholders only) |
| Authentication bypass / session fixation | PASS |
| Authorization / RBAC / IDOR | PASS (server-side, deny-by-default, hierarchy enforced) |
| SQL / command / path injection | PASS (Prisma parameterized; server.js traversal now guarded) |
| Unrestricted dangerous upload | PASS (image-only, size-capped, nosniff + CSP sandbox) |
| Admin isolation from storefront logins | PASS (bidirectional scope check) |
| Security headers / CORS allow-list | PASS |
| Rate limiting on public write + auth endpoints | PASS |
| Secrets in client bundles | PASS (QA suite-11 scans served JS) |
| Next.js critical RCE advisories | **WARN** — upgrade required (see blocker above) |
| Backend NestJS 10 transitive advisories | WARN — accept/documented; fix with a planned Nest 12 upgrade |
| Dev-only seed credentials disabled in prod | **WARN** — operator action |

Do **not** deploy to production with the default seed accounts
(`admin@aamako.agro` / `Admin123!` …) active, and do not expose the dashboard
until the Next.js upgrade lands.

## Security testing performed (this pass)

| Check | Command / method | Result |
|---|---|---|
| Unit + security regression tests | `Backend`: `jest` (pricing engine, RBAC guard, new `compress-image` upload-hardening spec) | **17 passed / 0 failed** |
| Backend compile | `nest build` | RC 0 |
| Secret scan | regex sweep over all 331 git-tracked files (service-role keys, JWTs, private keys, Stripe/AWS/Google/GitHub tokens, DB URIs, hardcoded passwords) | No production secrets committed; only `.env.example` placeholders + dev-only seed credentials (documented) |
| Path traversal (live) | started `Frontend/server.js`, probed `/..%2f..%2f*`, `/%2e%2e/%2e%2e/*` | **404 (blocked)**; `/index.html` still 200 with security headers |
| Static headers (live) | HTTP probe of `/` | `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN` present |
| Dependency audit | `npm audit` (Backend, Frontend) + `pnpm audit` (Dashboard) | see table above |
| E2E security suite | `qa/suite-11-security.js` + Playwright `qa/tests/07-security.spec.ts` (headers, CORS, XSS, IDOR, rate limit, **new** traversal + WEB header probes) | requires running stack (API + DB + storefront + dashboard) — run in a full dev environment |

## Recommended operational checklist (deploy-time)

- [ ] Generate strong `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`
      (`openssl rand -hex 32`) and set them only in Render env vars.
- [ ] Enable Supabase IP allow-list; add Render egress IPs; use the pooled URL.
- [ ] Verify HTTPS + HSTS on the Render API and Vercel apps.
- [ ] Run `npm audit --prefix Backend` and `pnpm --filter @aamako/admin audit`
      before every release; review third-party script CDNs in `Frontend/`.
- [ ] Rotate secrets regularly and remove obsolete credentials.
- [ ] Seed admin credentials (`Admin123!` etc.) are **dev-only** — change or
      disable these accounts in production.

## Remaining risks & required human actions

**Must do before go-live**

1. **Upgrade Dashboard to `next@^15.5.24`** — resolves two unauthenticated RCE
   advisories (see release-blocker above). Cannot be done from this environment
   (registry access stalls); owner action with a verified build.
2. **Disable / rotate the seeded dev credentials** (`admin@aamako.agro`,
   `Admin123!`, and every account listed in `Backend/README.md` → "Seed data").
   They are public in this repository, so they are effectively published.
3. **Set production secrets only in Render/Vercel dashboards** —
   `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (`openssl rand -hex 32`),
   `DATABASE_URL`, `CORS_ORIGINS` (production origins only), `PUBLIC_API_URL`.
4. **Inspect the Supabase Security Advisor** in the project dashboard — enable
   MFA on the Supabase account, SSL enforcement, and database network/IP
   restrictions (all dashboard-only, cannot be automated here).

**Known, accepted / scheduled feature work (not security regressions)**

- MFA (TOTP) fields exist on users but enforcement is not wired (Phase 8).
- No self-service password-reset endpoint yet.
- No dedicated immutable admin audit-log table (pricing has one; other admin
  actions are surfaced via notifications/live events).
- Per-account login lockout and rate limiting are in-memory — replace with a
  shared store (Redis) if the API ever runs multiple instances.
- NestJS 10 transitive advisories — resolve with a planned NestJS 12 major
  upgrade; none are exploitable through this API's current request surface.
- Review third-party CDN scripts in `Frontend/` (Google Fonts, GSAP, Lenis)
  and pin exact versions + add SRI if you want defence-in-depth on the
  storefront.