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
  // can call the backend via /api/* with no CORS. When the client uses this
  // same-origin base (no absolute NEXT_PUBLIC_API_URL) in local dev, this
  // forwards to the NestJS dev server on port 3000. On Vercel, set the
  // BACKEND_URL env var to point at the deployed API.
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:3000';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;