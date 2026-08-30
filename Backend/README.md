# Aamako Agro Backend

NestJS 10 + TypeScript REST API serving both frontends:
- `../Frontend` — static HTML/CSS/JS storefront (retail + wholesale)
- `../Dashboard` — React/Vite admin dashboard

## Stack
- NestJS 10, TypeScript, Prisma ORM → **PostgreSQL (Supabase-ready)**
- JWT auth: 15-min access tokens + rotating refresh tokens (hashed in `sessions`)
- RBAC role guards (`@Roles(...)`) enforced globally; unmarked routes are staff-only
- class-validator DTOs (rejects unknown fields), global error shape `{ error: { code, message, details } }`
- Swagger at `/api/docs`
- WebSocket live feed at `/api/admin/live` (new orders / status updates)

## Setup

1. Install deps:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and paste your **Supabase connection string**:
   ```env
   DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres"
   ```
   (Supabase → Project Settings → Database → Connection string → URI.
   Use port `6543` + pooler for serverless, `5432` direct for migrations.)
3. Push schema & seed:
   ```bash
   npm run db:push        # or: npx prisma migrate dev --name init
   npm run seed           # creates staff admin + tiers + demo catalog
   ```
4. Run:
   ```bash
   npm run start:dev      # http://localhost:3000/api/docs
   ```

### Seed data
| What | Value |
|---|---|
| Staff admin | `admin@aamako.agro` / `Admin123!` |
| Staff roles | `admin2@aamako.agro` / `Admin123!` · `manager@aamako.agro` / `Manager123!` · `sales@aamako.agro` / `Sales123!` · `content@aamako.agro` / `Content123!` · `inventory@aamako.agro` / `Inventory123!` · `support@aamako.agro` / `Support123!` |
| Storefront retail customer | `customer@aamako.agro` / `Customer123!` (RETAIL_CUSTOMER) |
| Storefront wholesale customer | `wholesale@aamako.agro` / `Wholesale123!` (WHOLESALE_CUSTOMER, active GROWTH account) |
| Pricing tiers | STARTER / GROWTH / ENTERPRISE |
| Catalog | 3 products w/ variants + inventory + wholesale price lists (-10/-18/-25%) |

Optional local Postgres+Redis: `docker compose up -d`

## API surface (prefix `/api`)
| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `/auth/login`, `/auth/google`, `/auth/refresh`, `/auth/logout`, `GET /auth/me` |
| Catalog | `GET /products`, `/products/:idOrSlug`, `/categories`; admin CRUD under `/admin/products` |
| Pricing | `GET /pricing/quote?variantId&quantity`, `POST /pricing/quote-cart` |
| Cart | `GET /cart`, `POST /cart/items`, `PATCH /cart/items` (header `X-Cart-Session` for guests) |
| Orders | `POST /orders` (requires `Idempotency-Key`; prices always recomputed server-side), `GET /orders/mine` |
| Wholesale | `POST /wholesale/inquiries` (rate-limited), `/wholesale/sample-kit`, `/wholesale/private-label-leads` |
| Admin | `/admin/orders`, `/admin/pricing-rules` (writes audited to `pricing_history` in-tx), `/admin/inventory`, `/admin/pricing-history`, `/admin/wholesale/*` |

Pricing rule priority: enterprise contract → volume-discount band → active promo → tier/base list price.

## Google Sign-In (storefront "Continue with Google")

Google sign-up uses the same `users` table as password registration: on first
sign-in with Google the backend creates a `RETAIL_CUSTOMER` account, so the
new buyer appears in **Dashboard → People → Customers** immediately (same as a
manual storefront signup).

1. Create an **OAuth 2.0 Web client** at
   https://console.cloud.google.com/apis/credentials.
2. Add the storefront origin to **Authorized JavaScript origins**
   (e.g. `http://localhost:8080`).
3. Set the client ID in the backend environment (single source of truth —
   the storefront auto-discovers it via `GET /api/auth/google-client-id`):
   ```env
   GOOGLE_CLIENT_ID="<your-client-id>.apps.googleusercontent.com"
   ```
   Then restart the API (`npm run dev`). No per-browser localStorage setup is
   required anymore.
4. (Optional manual override) The storefront still honours a client ID set in
   the browser, which takes precedence over the backend value:
   ```js
   localStorage['aamako_google_client_id'] = '<your-client-id>.apps.googleusercontent.com'
   ```
   The storefront (`Frontend/js/google-signin.js`) swaps the decorative
   "Continue with Google" button for a real Google-issued button and exchanges
   the ID token with `POST /api/auth/google`.

If `GOOGLE_CLIENT_ID` is unset, `/auth/google` returns `503` and the storefront
button shows a setup notice instead of silently failing. ID tokens are verified
against Google's public JWKS (signature, issuer, audience, expiry, verified
email).

## Frontend wiring
- Storefront loads `Frontend/js/api.js` (`window.AamakoAPI`); signin/signup/cart pages call the API.
- Dashboard has `src/lib/api.ts` typed client + `/api` Vite proxy to `localhost:3000`.

## Tests
```bash
npm test    # pricing engine priority logic + RBAC guard suite
```

## Known placeholders
- MFA/TOTP fields exist but enforcement is not yet implemented
- Redis/BullMQ not required to run; swap `LiveEventsService` for Redis pub/sub when scaling out
