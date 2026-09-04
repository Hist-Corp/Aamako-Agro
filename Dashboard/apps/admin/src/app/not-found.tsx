import Link from 'next/link';
import { Compass } from 'lucide-react';

export const metadata = {
  title: 'Page not found · Aamako Agro Admin',
};

/** Route-level 404 for the admin dashboard (App Router not-found boundary). */
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50 px-4">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-surface-100 flex items-center justify-center">
          <Compass className="h-9 w-9 text-surface-400" />
        </div>
        <p className="text-2xs font-semibold uppercase tracking-widest text-brand-600 mb-2">
          Error 404
        </p>
        <h1 className="text-3xl font-bold text-surface-900 mb-3">
          This page doesn&apos;t exist
        </h1>
        <p className="text-surface-500 mb-8 leading-relaxed">
          The link may be broken, or the page may have moved. Check the URL or
          head back to your dashboard.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-lg border border-surface-200 bg-white px-5 py-2.5 text-sm font-semibold text-surface-700 transition-colors hover:border-brand-500 hover:text-brand-600"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}