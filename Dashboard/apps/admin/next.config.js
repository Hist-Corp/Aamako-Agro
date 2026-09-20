/** @type {import('next').NextConfig} */
const nextConfig = {
  // NOTE on serverless-function packaging (DEPLOYMENT.md §9):
  // The dashboard must be a plain Next.js app whose dependencies live INSIDE
  // the Vercel Root Directory (Dashboard/apps/admin). Earlier it imported the
  // `@aamako/shared-types` pnpm workspace package, whose files lived outside
  // the Root Directory — every attempt to bridge that gap broke production:
  // trace root outside the Root Directory → internal Vercel error; forced
  // trace includes → either the same internal error or an "invalid deployment
  // package … files in symlinked directories" rejection. The shared types are
  // therefore vendored at src/shared-types (plain relative imports via
  // `@/shared-types`), and this config intentionally sets NO
  // outputFileTracingRoot / outputFileTracingIncludes — defaults keep the
  // trace inside the Root Directory so the @vercel/next builder can package
  // the functions it collects.

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