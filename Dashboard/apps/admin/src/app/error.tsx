'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

/** Global error boundary (App Router error.tsx). Shown when an unexpected
 *  error bubbles up during render of any dashboard route. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Keep a console record for staff debugging without exposing internals.
    console.error('[dashboard error]', error);
  }, [error]);

  const handleRetry = () => {
    if (typeof reset === 'function') {
      reset();
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50 px-4">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-red-50 flex items-center justify-center">
          <AlertTriangle className="h-9 w-9 text-status-danger" />
        </div>
        <p className="text-2xs font-semibold uppercase tracking-widest text-status-danger mb-2">
          Something went wrong
        </p>
        <h1 className="text-3xl font-bold text-surface-900 mb-3">
          We hit an unexpected error
        </h1>
        <p className="text-surface-500 mb-8 leading-relaxed">
          The dashboard ran into a problem while loading this screen. Your data
          is safe — try reloading, and if it keeps happening please contact
          support.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={handleRetry}
            className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            Try again
          </button>
          <a
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-lg border border-surface-200 bg-white px-5 py-2.5 text-sm font-semibold text-surface-700 transition-colors hover:border-brand-500 hover:text-brand-600"
          >
            Back to Dashboard
          </a>
        </div>
        <p className="mt-6 text-2xs text-surface-400">
          Reference: {error.digest ?? error.message ?? 'unknown'}
        </p>
      </div>
    </div>
  );
}