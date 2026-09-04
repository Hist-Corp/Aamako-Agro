'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/** Dashboard-section error boundary. Catches errors inside the app area
 *  (below the sidebar/header) so a failed widget or task shows a recoverable
 *  screen instead of a blank layout. */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[dashboard section error]', error);
  }, [error]);

  return (
    <div className="p-6">
      <div className="mx-auto max-w-xl rounded-xl border border-red-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
          <AlertTriangle className="h-6 w-6 text-status-danger" />
        </div>
        <h2 className="text-lg font-semibold text-surface-900 mb-1">
          This section hit a problem
        </h2>
        <p className="text-sm text-surface-500 mb-6 leading-relaxed">
          Something went wrong while loading or updating this screen. Your work
          hasn&apos;t been lost — try reloading the section.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            <RefreshCw className="h-4 w-4" />
            Reload section
          </button>
          <a
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-lg border border-surface-200 bg-white px-4 py-2 text-sm font-semibold text-surface-700 transition-colors hover:border-brand-500 hover:text-brand-600"
          >
            Go to Dashboard
          </a>
        </div>
        <p className="mt-5 text-xs text-surface-400">
          Reference: {error.digest ?? error.message ?? 'unknown'}
        </p>
      </div>
    </div>
  );
}