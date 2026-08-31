/** @type {import('next').NextConfig} */
const nextConfig = {
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
