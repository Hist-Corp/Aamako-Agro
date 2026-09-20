# ── Admin Dashboard (Next.js) production image ────────────────────────
# Build from the Dashboard directory (pnpm workspace — shared-types needed):
#   docker build -f apps/admin/Dockerfile -t aamako-admin .

FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/shared-types ./packages/shared-types
COPY apps/admin/package.json ./apps/admin/package.json
RUN pnpm install --frozen-lockfile

COPY apps/admin ./apps/admin
# Point the dashboard at the API (baked at build time by Next.js)
ARG NEXT_PUBLIC_API_URL=/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
# Public storefront origin for the live-preview links/iframes (also baked at
# build time). Defaults to the compose `web` service; without it the editors
# show a "Live preview unavailable" notice instead of framing a page.
ARG NEXT_PUBLIC_STOREFRONT_URL=http://localhost:8080
ENV NEXT_PUBLIC_STOREFRONT_URL=$NEXT_PUBLIC_STOREFRONT_URL
# Non-prefixed alias for the same value (next.config.js forwards it to the
# browser). Set either one; NEXT_PUBLIC_STOREFRONT_URL wins when both are set.
ARG STOREFRONT_URL=
ENV STOREFRONT_URL=$STOREFRONT_URL
# Keep Next's output file tracing rooted at the pnpm workspace root (see
# next.config.js — only Docker builds should trace from outside apps/admin).
ENV DOCKER_BUILD=1
RUN pnpm --filter @aamako/admin build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
# pnpm's isolated linker keeps each app's symlinks + .bin shims in the app's
# own node_modules dir. Without copying it, `npx next` finds no local binary
# and downloads next@latest (v16) from the registry instead of running the
# built Next 15 app - the container exits before serving anything.
COPY --from=build /app/apps/admin/node_modules ./apps/admin/node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/admin/.next ./apps/admin/.next
COPY --from=build /app/apps/admin/package.json ./apps/admin/package.json
COPY --from=build /app/apps/admin/next.config.js ./apps/admin/next.config.js

EXPOSE 3001
WORKDIR /app/apps/admin
CMD ["npx", "next", "start", "--port", "3001"]