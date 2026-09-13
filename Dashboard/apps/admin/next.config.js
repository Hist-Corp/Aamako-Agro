const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Project root for the pnpm workspace. Webpack and production builds
  // need this set to the workspace root so pnpm's node_modules symlinks
  // (which point outside apps/admin into Dashboard/node_modules/.pnpm)
  // are within the allowed filesystem.
  outputFileTracingRoot: path.join(__dirname, '../../'),

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