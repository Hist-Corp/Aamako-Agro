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
   - Media URLs validated as secure `https://`; no server-side file storage
     (`file upload` item is N/A — uploads are handled by frontends/hosts).

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