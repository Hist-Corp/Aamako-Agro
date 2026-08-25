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
| Pricing tiers | STARTER / GROWTH / ENTERPRISE |
| Catalog | 3 products w/ variants + inventory + wholesale price lists (-10/-18/-25%) |

Optional local Postgres+Redis: `docker compose up -d`

## API surface (prefix `/api`)
| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `GET /auth/me` |
| Catalog | `GET /products`, `/products/:idOrSlug`, `/categories`; admin CRUD under `/admin/products` |
| Pricing | `GET /pricing/quote?variantId&quantity`, `POST /pricing/quote-cart` |
| Cart | `GET /cart`, `POST /cart/items`, `PATCH /cart/items` (header `X-Cart-Session` for guests) |
| Orders | `POST /orders` (requires `Idempotency-Key`; prices always recomputed server-side), `GET /orders/mine` |
| Wholesale | `POST /wholesale/inquiries` (rate-limited), `/wholesale/sample-kit`, `/wholesale/private-label-leads` |
| Admin | `/admin/orders`, `/admin/pricing-rules` (writes audited to `pricing_history` in-tx), `/admin/inventory`, `/admin/pricing-history`, `/admin/wholesale/*` |

Pricing rule priority: enterprise contract → volume-discount band → active promo → tier/base list price.

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
