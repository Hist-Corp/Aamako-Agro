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