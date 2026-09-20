const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Project root for the pnpm workspace. Docker builds (§6 of DEPLOYMENT.md)
  // need this set to the workspace root so nft file tracing can follow pnpm's
  // node_modules symlinks into Dashboard/node_modules/.pnpm.
  // Vercel builds MUST NOT: there the trace root has to stay inside the Vercel
  // Root Directory (apps/admin) — when it points outside it, the @vercel/next
  // builder cannot map the traced next-server files into the functions and the
  // build fails with:
  //   Cannot find module 'next/dist/compiled/next-server/server.runtime.prod.js'
  // (see DEPLOYMENT.md §9). DOCKER_BUILD=1 is set in apps/admin/Dockerfile.
  outputFileTracingRoot:
    process.env.DOCKER_BUILD === '1' ? path.join(__dirname, '../../') : __dirname,

  transpilePackages: ['@aamako/shared-types'],

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