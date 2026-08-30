# Deploying Aamako Agro

This guide covers deploying the three pieces of the project **without changing
anything about the local development workflow** — all existing scripts
(`npm run dev`, `npm run setup`, `npm run db:setup`, …) keep working exactly as
before. The deployment files are purely additive.

> **Recommended stack (this repo's arrangement):** Frontend → **Vercel**,
> Admin dashboard → **Vercel**, Backend API → **Render**, Database →
> **Supabase** (Postgres). Docker files (see "Alternative") remain available if
> you prefer a single VPS.

## Components & target hosts

| Component | Location | Host | Env / Config |
|---|---|---|---|
| Backend API (NestJS + Prisma) | `Backend/` | Render | `render.yaml` + env vars |
| Admin Dashboard (Next.js) | `Dashboard/apps/admin` | Vercel | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL` |
| Storefront (static) | `Frontend/` | Vercel | `Frontend/vercel.json` + `BACKEND_URL` env |
| Database | — | Supabase | `Backend/.env.supabase.example` |

## 1 — Database (Supabase)

1. Create a project in Supabase (free tier is fine).
2. Project Settings → Database → connection string.
3. Copy `Backend/.env.supabase.example` → `Backend/.env` and set `DATABASE_URL`.
   **Use the pooled (Transaction, port 6543) URL with `?pgbouncer=true`** for the
   runtime `DATABASE_URL`.
4. Create the schema (run once from your machine against a **direct**
   port-5432 URL):

   ```bash
   npm --prefix Backend run db:push
   ```

   For managed deploys that create tables on start, use `npx prisma migrate
   deploy` (the Render service does this). Prisma DDL should hit the direct
   connection, not the pooler.
5. Seed once:

   ```bash
   npm --prefix Backend run seed
   ```
## 2 — Backend API (Render)

1. In the Render dashboard: **New + → Blueprint**, select this repo
   (uses `render.yaml`), or create a **Web Service** manually with root dir `Backend`:
   - Build: `npm ci && npm run build`
   - Start: `npx prisma migrate deploy && npm run start`
   - Health check path: `/api`
2. Add the env vars from `Backend/.env.example` (see `render.yaml` for the full
   list and which ones need random values):
   - `DATABASE_URL` (Supabase pooled URL)
   - `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` ← generate long random values
   - `JWT_ACCESS_EXPIRES=15m`, `JWT_REFRESH_EXPIRES_DAYS=30`
   - `GOOGLE_CLIENT_ID` (empty to disable Google sign-in)
   - `CORS_ORIGINS` = your Vercel app URLs (below)
3. Render serves HTTPS automatically. WebSockets (live events) work — Render
   supports WS on the same port. Connect the dashboard over `wss://`.

## 3 — Staff dashboard (Vercel)

Import `Dashboard/apps/admin` as a Next.js project in Vercel
(monorepo root setting: root directory `Dashboard/apps/admin`). Set env vars:

| Var | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://<your-render-api>.onrender.com/api` |
| `NEXT_PUBLIC_WS_URL` | `wss://<your-render-api>.onrender.com` |

- These are baked at **build time** by Next.js — update them in the Vercel
  project settings and redeploy when the Render URL changes.
- If you'd rather keep the dashboard same-origin, add a Vercel rewrite on the
  dashboard app mirroring `Frontend/vercel.json` and point
  `NEXT_PUBLIC_API_URL` at `/api`.

## 4 — Storefront (Vercel)

1. Import the repo **root directory `Frontend/`** as a static site.
2. Set one env var in Vercel (used by the rewrite proxy):

   | Var | Value |
   |---|---|
   | `BACKEND_URL` | `https://<your-render-api>.onrender.com` |

3. `Frontend/vercel.json` rewrites `/api/*` → `${BACKEND_URL}/api/*`, so the
   storefront calls the API **same-origin** (no CORS, no exposed origin). The
   API base in `js/api.js` / `js/google-signin.js` automatically resolves to a
   relative `/api` when not on `localhost`, preserving the local dev path.

## 5 — Security checklist

- [ ] `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` are **unique, long random**
      values (e.g. `openssl rand -hex 32`), never the `.env.example` defaults.
- [ ] Secrets live only in Vercel/Render dashboard env vars; `.env` /
      `.env.local` are git-ignored and never committed. `.env.supabase.example`
      stays a template with placeholders only.
- [ ] `CORS_ORIGINS` lists only your real storefront + dashboard origins (no
      wildcards — the API rejects them by design). With the Vercel proxy the
      apps are same-origin so CORS is not normally exercised.
- [ ] `GOOGLE_CLIENT_ID` matches the authorized JavaScript origin(s); empty
      disables Google sign-in (button shows a setup notice).
- [ ] Supabase: enable IP allow-list and add Render's egress IPs; use the
      pooled connection at runtime. Never expose the service-role key client-side.
- [ ] HTTPS everywhere: Vercel and Render both provide TLS by default.

## 6 — Alternative: Docker (single host / VPS)

If you prefer self-hosting, use the Docker setup instead:

```bash
# root .env (values mirror Backend/.env.example)
DATABASE_URL=postgresql://user:password@host:5432/aamako_agro
JWT_ACCESS_SECRET=<32+ random chars>
JWT_REFRESH_SECRET=<32+ random chars>
CORS_ORIGINS=https://shop.example.com,https://admin.example.com
NEXT_PUBLIC_API_URL=https://api.example.com/api

docker compose up -d --build
npm --prefix Backend run seed   # once
```

See `Backend/Dockerfile`, `Dashboard/apps/admin/Dockerfile`,
`Frontend/Dockerfile`, and `docker-compose.yml`.

## Post-deploy verification

- [ ] `curl https://<render-api>.onrender.com/api` returns
      `{ name, status: 'ok', ... }`.
- [ ] Login flow works on the deployed storefront (same-origin `/api`).
- [ ] Admin dashboard loads data (points at Render `NEXT_PUBLIC_API_URL`).
- [ ] Run `npm --prefix Backend run seed` once against production (if the
      initial admin account doesn't exist).
