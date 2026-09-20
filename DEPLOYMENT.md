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
4. Create the schema. This repo has **no `prisma/migrations` history** — the
   schema is kept in sync with `prisma db push`, so `migrate deploy` would be a
   silent no-op. Run against a **direct** port-5432 URL:

   ```bash
   npm --prefix Backend run db:push
   ```

   The Render service runs the same idempotent `prisma db push` on every deploy
   (see §2), so new tables such as `password_reset_tokens` are always created.
   Prisma DDL must hit the direct/session connection, not the pooler.
5. Seed once:

   ```bash
   npm --prefix Backend run seed
   ```
## 2 — Backend API (Render)

1. In the Render dashboard: **New + → Blueprint**, select this repo
   (uses `render.yaml`), or create a **Web Service** manually with root dir `Backend`:
   - Build: `npm ci --include=dev && npx prisma generate && npm run build`
   - Start: `npx prisma db push --skip-generate && npm run start`
   - Health check path: `/api`

   > **Why `--include=dev`?** Render injects the service env vars (including
   > `NODE_ENV=production`) at **build** time, and npm omits devDependencies
   > when `NODE_ENV=production` — which would remove `@nestjs/cli`,
   > `typescript` and `prisma` and break `nest build` entirely.
   >
   > **Why no `--accept-data-loss`?** It is a boolean flag, and the Prisma CLI
   > parser (`arg`) treats *any* value — including `--accept-data-loss=false` —
   > as `true`, which would authorise destructive drops on deploy. Omitting it
   > keeps the safe default (refuse a destructive push).
   >
   > `npm run build` runs `nest build` with `Backend/tsconfig.build.json`,
   > which pins `rootDir: src` so the entrypoint lands at `dist/main.js` —
   > exactly what `npm start` (`node dist/main.js`) expects.
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

> **Required project settings** (Settings → Build and Deployment): **Root
> Directory `Dashboard/apps/admin`**, **Framework Preset `Next.js`**, and the
> **Build / Output / Install command overrides all empty**. Leave **Include
> source files outside of the Root Directory in the Build Step** enabled — the
> dashboard imports `Dashboard/packages/shared-types` (`workspace:*`) and
> `next.config.js` sets `outputFileTracingRoot` to the pnpm workspace root, both
> of which live *outside* the Root Directory.
> `Dashboard/apps/admin/vercel.json` pins `"framework": "nextjs"`, the in-repo
> way of forcing the preset (the same lever `Frontend/vercel.json` uses with
> `null` to force **Other**). Pointing the Root Directory anywhere else
> (`Dashboard/`, the repo root) makes Vercel miss `next.config.js`, fall back to
> the **Other** preset and fail with `No Output Directory named "public" found`
> — or, once the preset *is* Next.js, with `No Next.js version detected`
> (`NEXT_NO_VERSION`): Vercel's Next builder resolves `next/package.json` from
> the Root Directory **after** install, and pnpm does not hoist `next` to
> `Dashboard/node_modules` (it lives in `apps/admin/node_modules`), so a build
> rooted at `Dashboard/` can never find it. Both are §9.

| Var | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://aamako-agro.onrender.com/api` |
| `NEXT_PUBLIC_WS_URL` | `wss://aamako-agro.onrender.com` |

- These are baked at **build time** by Next.js — update them in the Vercel
  project settings and redeploy when the Render URL changes.
- If you'd rather keep the dashboard same-origin, add a Vercel rewrite on the
  dashboard app mirroring `Frontend/vercel.json` and point
  `NEXT_PUBLIC_API_URL` at `/api`.

## 4 — Storefront (Vercel)

1. Import the repo **root directory `Frontend/`** as a static site
   (no build command, no framework preset — it is plain HTML/CSS/JS).

   > The **Framework Preset must be `Other`**, and Build / Output / Install
   > command overrides must stay empty. Vercel's zero-config detection upgrades a
   > project to a *Node backend* as soon as it sees a root-level `server.js`,
   > and then fails the build with `No entrypoint found in ".../Frontend"`.
   > Three independent guards keep this static:
   > (a) the dev server is `Frontend/dev-server.js` — a name that matches no
   > Vercel detector — so do **not** rename it back to `server.js`;
   > (b) `Frontend/.vercelignore` also hides `package.json`, so Vercel cannot
   > resolve a Node preset from the manifest at all (local `npm start` /tests
   > are unaffected — the file only changes what gets *uploaded*);
   > (c) `Frontend/vercel.json` pins `"framework": null`, Vercel's in-repo way of
   > selecting the **Other** preset, which overrides the Framework Preset stored
   > in the dashboard — so a project imported earlier as `Node.js` still
   > deploys as a plain static site.
   > Vercel cannot auto-detect any framework here, so it serves the folder as-is.
2. No environment variables are required. `Frontend/vercel.json`
   rewrites `/api/*` → the Render API so the storefront calls the API
   **same-origin** (no CORS, no exposed origin). The API base in `js/api.js` /
   `js/google-signin.js` automatically resolves to a relative `/api` when not on
   `localhost`, preserving the local dev path.
3. The rewrite destination is a **literal URL** (currently
   `https://aamako-agro.onrender.com/api/:path*`, matching the deployed
   `Aamako-Agro` Render service). Vercel does **not** support environment
   variable interpolation inside a static `vercel.json`, so if your Render
   service gets a different hostname, edit that one line and redeploy:

   ```json
   { "source": "/api/:path*", "destination": "https://<your-service>.onrender.com/api/:path*" }
   ```

   > Local development is unaffected: `Frontend/dev-server.js` reads its own
   > `BACKEND_URL` env var (default `http://localhost:3000`) and proxies
   > `/api/*` the same way.

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

> Two traps that were fixed (September 2026) — keep them fixed:
> 1. The dashboard runtime stage must copy `apps/admin/node_modules` in
>    addition to the workspace `node_modules`. pnpm's isolated linker keeps that
>    app's symlinks + `.bin` shims there; without it, `npx next` finds no local
>    binary and silently downloads `next@latest` (v16) from the registry at
>    container start — the container exits before serving anything, with only an
>    `npm warn exec ... next@16.3.5` line in the logs.
> 2. All images build on `node:24-alpine`. Node 20 is past upstream EOL and was
>    removed from Vercel on Oct 1 2026; the manifests pin `engines` 24.x to match.

## 7 — CI/CD (GitHub → Vercel / Render)

CI/CD is handled by the native Git integrations — **no extra GitHub Actions
workflow is needed and none is added** (a duplicate pipeline would rebuild the
same commits twice). The flow is:

```
push to main ──┬─→ Vercel Git integration ─→ build + deploy Frontend & Dashboard
               └─→ Render autoDeploy: true ─→ build + deploy Backend API
```

| Layer | Trigger | Config |
|---|---|---|
| Storefront | push to `main` | Vercel project (root `Frontend/`) + `Frontend/vercel.json` |
| Dashboard | push to `main` | Vercel project (root `Dashboard/apps/admin`) + `vercel.json` |
| Backend API | push to `main` | `render.yaml` (`autoDeploy: true`) |

- Secrets are added **only** in the Vercel / Render dashboards, never in Git.
- `render.yaml` declares every secret with `sync: false`, so Render prompts for
  the values on Blueprint creation and never stores them in the repo.
- Skip a single auto-deploy with `[skip render]` in the commit message.
- **Vercel "skip deployments" setting:** the storefront and the dashboard are two
  separate Vercel projects on one repo, so an ordinary push otherwise rebuilds
  both. Turn on **Settings → Build and Deployment → Root Directory → "Skip
  deployments when there are no changes to the root directory or its
  dependencies"** (already the default for projects created after Feb 2025). It
  is Turborepo-powered, so it follows internal workspace dependencies: a change
  to `Dashboard/packages/shared-types` still redeploys the dashboard.
  Do **not** swap it for the manual `git diff HEAD^ HEAD --quiet .` command from
  Vercel's Yarn-monorepo guide — that diffs only the Root Directory and would
  silently skip the dashboard whenever `packages/shared-types` changes.
  Because `NEXT_PUBLIC_*` values are baked at build time (§3), a skipped deploy
  also means an env-var change needs a manual **Redeploy**.

## 8 — Rollback

| Layer | How |
|---|---|
| Render API | Dashboard → service → **Rollback** → pick the previous deploy, or `render deploys create <service-id> --commit <sha>` |
| Vercel (Frontend / Dashboard) | Deployments → previous deployment → **Promote to Production** (instant rollback) |
| Database | `prisma db push` only adds/alters; it never drops data unless a destructive change is confirmed. Restore points: Supabase → Database → Backups |

## 9 — Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Render deploy fails at build with `nest: not found` / `Cannot find module 'typescript'` | devDependencies were omitted because `NODE_ENV=production`. Use the `--include=dev` build command from §2. |
| Render deploy succeeds but the service crashes with `Cannot find module '/opt/render/project/src/dist/main.js'` | The compiled entrypoint is not at `dist/main.js`. Ensure `Backend/tsconfig.build.json` exists and pins `rootDir: "src"` (§2). |
| Service exits immediately after `prisma db push` | `--accept-data-loss=false` is parsed as `true` by the Prisma CLI. Remove the flag (§2). |
| `P1001: Can't reach database server` | `DATABASE_URL` is not the pooled URL, or the Supabase password/IP allow-list is wrong. Use the Transaction pooler on port `6543` with `?pgbouncer=true` for runtime and the session/direct URL on `5432` for DDL. |
| `prepared statement "s0" already exists` | `?pgbouncer=true` is missing from the pooled `DATABASE_URL`. |
| `Error: No entrypoint found in "/vercel/path0/Frontend"` | The project was detected as a **Node backend**, not a static site: Vercel's zero-config detection treats a root-level `server.js` as a serverless entrypoint (resolved from `package.json#main`). The storefront's dev server is therefore named `Frontend/dev-server.js` (and `.vercelignore`d), and `Frontend/vercel.json` pins `"framework": null` (= Framework Preset **Other**). On a project imported before that fix, set Settings → Build and Development Settings → Framework Preset → **Other**, clear Build/Output/Install overrides, then redeploy. |
| `Error: No Output Directory named "public" found after the Build completed` (dashboard) | Vercel built the project with the **Other** preset, so it looked for a static `public/` output directory at the **Root Directory** — which only exists *inside* the Next.js app (`Dashboard/apps/admin/public`, 3 tracked files). The Root Directory is therefore wrong (set to `Dashboard/` or the repo root), which also made framework detection miss `next.config.js`. Fix: Settings → Build and Deployment → Root Directory = `Dashboard/apps/admin`, Framework Preset = **Next.js**, clear any Build/Output/Install overrides, keep **Include source files outside of the Root Directory in the Build Step** enabled, then redeploy (§3). `Dashboard/apps/admin/vercel.json` now pins `"framework": "nextjs"` so the preset cannot silently fall back to **Other** again. **Diagnostic:** the build log's `Running build command …` line names the Root Directory — `npm --prefix apps/admin run build` means it is `Dashboard`, and `npm --prefix Backend run build && npm --prefix Dashboard run build` means the repo root; neither can yield a Next.js deployment (Vercel's Next.js builder needs `.next` *at* the Root Directory). Also confirm the Root Directory's `vercel.json` has no `builds` array — a `builds` config overrides the framework preset and produces this same error even when the preset is set to Next.js. |
| `Warning: Could not identify Next.js version, ensure it is defined as a project dependency.` then `Error: No Next.js version detected. Make sure your package.json has "next" in either "dependencies" or "devDependencies". Also check your Root Directory setting matches the directory of your package.json file.` (`NEXT_NO_VERSION`) | **Progress, not a new problem** — the Framework Preset is now Next.js; the **Root Directory still isn't `Dashboard/apps/admin`**. Vercel's Next builder runs install and then resolves `next/package.json` *from the Root Directory*, and pnpm does **not** hoist `next` to the workspace root — it lives only in `Dashboard/apps/admin/node_modules` (`Dashboard/node_modules/next` does not exist). Both `Dashboard/package.json` and the repo-root `package.json` have no `next` dependency, so a build rooted at either can never resolve it. Fix: Settings → Build and Deployment → Root Directory = `Dashboard/apps/admin`, clear the Build/Output/Install overrides, then **Redeploy** (§3). Verify in the log: `Detected Next.js version: 15.5.25`. |
| `Warning: Detected "engines": { "node": ">=18" } in your `package.json` that will automatically upgrade when a new major Node.js Version is released` | The engines range is open-ended, so Vercel maps it to the *latest* supported major and silently bumps the runtime on the next major release. All five manifests pin **`"node": "24.x"`** (root, `Dashboard/`, `Dashboard/apps/admin/`, `Backend/`, `Frontend/`) — Vercel maps `24.x` to the latest 24.x. Note `24.x` currently maps to Vercel's **default** (24.x is the latest LTS), and Vercel deprecates Node 20 on Oct 1 2026, so do not pin 20. Render is aligned via `NODE_VERSION=24` in `render.yaml`, and the three Dockerfiles now build on `node:24-alpine` (Node 20 is already past upstream EOL, April 2026). |
| `Error: Cannot find module 'next/dist/compiled/next-server/server.runtime.prod.js'` (dashboard build) | `next.config.js` pointed Next's **output file tracing root** at the pnpm workspace root (`Dashboard/`) — correct for Docker, but on Vercel the trace root must stay **inside the Root Directory**: when it points outside it, the `@vercel/next` builder cannot map the traced `next-server` files into the functions. Fixed by making the trace root conditional — workspace root only when `DOCKER_BUILD=1` (set in `Dashboard/apps/admin/Dockerfile`), the app directory otherwise. Note this error only appears once the Root Directory is correct (the log reaches `next build`); a build that fails earlier is still the Root Directory / preset issue above. |
| Storefront `/api/*` returns 404 in production | The `vercel.json` rewrite destination no longer matches the real Render hostname — update the literal URL (§4). |
| CORS error in the browser console | `CORS_ORIGINS` is missing the exact origin (scheme + host, no trailing slash). Wildcards are rejected by design. |
| Password-reset email never arrives | Resend is still in test mode: it only delivers to the account owner's address until a domain is verified. Verify a domain at resend.com/domains and set `RESEND_FROM_EMAIL` to an address on it. Check the API logs for `ResendEmailProvider ... HTTP 403`. |
| `prisma generate` skipped on Render | `@prisma/client`'s postinstall needs the `prisma` CLI — covered by `--include=dev` (§2). The explicit `npx prisma generate` makes it deterministic. |

## 10 — Verification performed

Run locally against the production build (`NODE_ENV=production npm start` =
`node dist/main.js`, Supabase Postgres, Resend email):

| Check | Result |
|---|---|
| `nest build` from a clean tree emits `dist/main.js` (no `dist/src/`) | ✅ 90 modules |
| Production server boots (`NODE_ENV=production npm start`) | ✅ `provider=resend`, no errors |
| `GET /api` health payload (Render `healthCheckPath`) | ✅ 200 |
| `GET /api/products` (DB read through Supabase pooler) | ✅ 200, rows returned |
| CORS: `Origin: http://localhost:8080` | ✅ `Access-Control-Allow-Origin: http://localhost:8080` |
| CORS: `Origin: https://evil.example.com` | ✅ no `Access-Control-Allow-Origin` (browser blocks it) |
| Preflight `OPTIONS /api/auth/login` (allowed origin) | ✅ 204 + allow headers |
| Helmet headers (`HSTS`, `nosniff`, `X-Frame-Options`, CSP, `Referrer-Policy`) | ✅ all present |
| Register → login → `GET /api/auth/me` (bcrypt + JWT + DB write) | ✅ 201/200/200 |
| `POST /api/auth/forgot-password` → token row persisted | ✅ 200, `tokenHash` 64 chars, unused |
| RBAC negative: `GET /api/admin/users` without token | ✅ 401 |
| Storefront dev proxy `:8080/api/products` | ✅ 200 (local dev preserved) |
| Storefront clean routes `/forgot-password`, `/reset-password`, `/signin` | ✅ 200 |
| Dashboard `next build` (Next.js 15.5.25) | ✅ 37/37 pages prerendered — so the Vercel `No Output Directory named "public"` failure is project configuration, never the code (§9) |

Not verifiable from this machine: the deployed Render/Vercel URLs (services are
not created yet). Run the §11 checklist once they exist.

## 11 — Post-deploy verification

- [ ] `curl https://aamako-agro.onrender.com/api` returns
      `{ name, status: 'ok', ... }`.
- [ ] Render logs show `[email] provider=resend` (or `provider=log`).
- [ ] Login flow works on the deployed storefront (same-origin `/api`).
- [ ] Forgot-password sends a real email and the link opens
      `https://<storefront>/reset-password?token=…`.
- [ ] Admin dashboard loads data (points at Render `NEXT_PUBLIC_API_URL`).
- [ ] Run `npm --prefix Backend run seed` once against production (if the
      initial admin account doesn't exist).
