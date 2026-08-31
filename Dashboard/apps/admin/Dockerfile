# ── Admin Dashboard (Next.js) production image ────────────────────────
# Build from the Dashboard directory (pnpm workspace — shared-types needed):
#   docker build -f apps/admin/Dockerfile -t aamako-admin .

FROM node:20-alpine AS build
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
RUN pnpm --filter @aamako/admin build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/admin/.next ./apps/admin/.next
COPY --from=build /app/apps/admin/package.json ./apps/admin/package.json
COPY --from=build /app/apps/admin/next.config.js ./apps/admin/next.config.js

EXPOSE 3001
WORKDIR /app/apps/admin
CMD ["npx", "next", "start", "--port", "3001"]