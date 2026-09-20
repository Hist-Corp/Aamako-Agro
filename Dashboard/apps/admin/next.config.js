const path = require('path');

// Compiled runtime dependencies that must be forced into every serverless
// function trace — see `outputFileTracingIncludes` below for the full story.
// The glob points at the hoisted, real-directory copy of `next` in the
// workspace root (see Dashboard/.npmrc: node-linker=hoisted). It must stay
// inside `outputFileTracingRoot` (the workspace root) so Vercel can package it,
// and it must NOT go through a pnpm junction — symlinked directories make
// Vercel reject the deployment package outright.
const NEXT_COMPILED_GLOBS = [
  '../../node_modules/next/dist/compiled/**/*',
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Root of the pnpm workspace (Dashboard/), where the hoisted node_modules
  // lives — see Dashboard/.npmrc (`node-linker=hoisted`).
  //
  // The trace root has to contain every file the serverless functions need.
  // With the hoisted linker those are REAL directories at
  // Dashboard/node_modules — outside this app's Root Directory (apps/admin)
  // but inside the workspace, and Vercel's "Include source files outside of
  // the Root Directory in the Build Step" toggle (enabled on this project)
  // allows the builder to package them. Leaving the trace root at apps/admin
  // made the tracer drop those targets entirely, so the deployed functions
  // crashed at cold start with:
  //
  //   Cannot find module 'next/dist/compiled/source-map'
  //
  // and every dynamic route returned 500 while all static routes kept working
  // (static pages are pre-rendered at build time and never execute a function).
  // Docker uses the same hoisted layout, so one unconditional value is correct
  // for both targets. DOCKER_BUILD=1 is still set by apps/admin/Dockerfile but
  // no longer changes this behaviour.
  outputFileTracingRoot: path.join(__dirname, '../../'),

  transpilePackages: ['@aamako/shared-types'],

  // ─── Serverless-function packaging ──────────────────────────────────────
  // The dashboard is a pnpm workspace package, and Vercel packages its
  // serverless functions from Next's file traces. Three failure modes were
  // hit, all invisible on `next start` (which reads the real node_modules
  // tree rather than these traces):
  //
  // 1. Trace root inside the Root Directory (apps/admin) with pnpm's default
  //    isolated linker: the tracer followed pnpm's junctions and dropped every
  //    target outside apps/admin, so the packaged function was missing parts
  //    of the `next` package itself and died at cold start with
  //      Cannot find module 'next/dist/compiled/source-map'
  //    Vercel answered with its static 500 page, so ALL dynamic routes broke
  //    (/pages/[slug], /product-templates/[slug], /orders/[id]) while every
  //    pre-rendered static route kept working.
  // 2. `outputFileTracingIncludes` reaching outside the Root Directory
  //    (../../node_modules/.pnpm/…) failed the deployment with an internal
  //    Vercel error.
  // 3. Pointing the include through the pnpm junction instead produced a
  //    bundle containing symlinked directories, which Vercel rejects with
  //    "The framework produced an invalid deployment package for a Serverless
  //    Function … files in symlinked directories".
  //
  // The hoisted linker removes the symlinks entirely, so the real
  // `next/dist/compiled/**` files sit inside the workspace-root trace root.
  // The include below pins them into every function trace as a guarantee.
  outputFileTracingIncludes: {
    '/**': NEXT_COMPILED_GLOBS,
    '/**/*': NEXT_COMPILED_GLOBS,
  },

  // Storefront origin, additionally forwarded to the browser under a
  // NON-prefixed name.
  //
  // `NEXT_PUBLIC_*` variables are inlined into the client bundle straight from
  // the environment; a plain name only reaches client code when it is listed
  // here. Deployments that would rather not use a public prefix (Vercel shows a
  // "public framework prefix" hint on NEXT_PUBLIC_*) can therefore set
  // `STOREFRONT_URL` instead of `NEXT_PUBLIC_STOREFRONT_URL` and get exactly the
  // same result — src/config/pages.ts accepts either.
  //
  // The value is a public website address, not a secret — the browser has to
  // know it to open the "View live" links and frame the preview iframes — so
  // this is a naming preference, not a privacy guarantee.
  //
  // Read from *server* env only (like BACKEND_URL below): `next.config.js` runs
  // at build time on Vercel/Render, never in the browser.
  env: {
    STOREFRONT_URL: process.env.STOREFRONT_URL ?? '',
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },

  // Same-origin API proxy — mirrors Frontend/vercel.json so the dashboard
  // can call the backend via /api/* with no CORS. Server-side only
  // (rewrites are evaluated on Vercel's edge from next.config.js, so this
  // file must never read NEXT_PUBLIC_* — those are bundled to the browser):
  // on Vercel set BACKEND_URL to the Render host; `BACKEND_URL` is REQUIRED,
  // and the build fails fast if the deployment forgot it. Local dev needs
  // nothing: it falls back to the NestJS dev server on port 3000.
  async rewrites() {
    const backendUrl =
      process.env.BACKEND_URL ??
      (process.env.VERCEL ? undefined : 'http://localhost:3000');
    if (!backendUrl) {
      throw new Error(
        'Dashboard misconfigured: set BACKEND_URL to the backend origin ' +
          '(e.g. https://aamako-agro.onrender.com) so /api/* can be rewritten there.'
      );
    }
    let normalized = String(backendUrl).replace(/\/+$/, '');
    let parsed;
    try {
      parsed = new URL(normalized);
    } catch {
      parsed = null;
    }
    if (!parsed || (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')) {
      throw new Error(
        `Dashboard misconfigured: BACKEND_URL must be an absolute http(s) URL, got ${JSON.stringify(
          backendUrl
        )}.`
      );
    }
    normalized = parsed.origin + parsed.pathname.replace(/\/+$/, '');
    return [
      {
        source: '/api/:path*',
        destination: `${normalized}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;