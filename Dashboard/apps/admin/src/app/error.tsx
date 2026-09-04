'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50 p-6">
      <div className="max-w-md w-full bg-white rounded-2xl border border-surface-200 shadow-sm p-8 text-center">
        <div className="text-5xl mb-4">🛠️</div>
        <h1 className="text-xl font-semibold text-surface-900 mb-2">
          Something went wrong
        </h1>
        <p className="text-sm text-surface-500 mb-6">
          An unexpected error occurred while loading the dashboard. Please try again.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 transition-colors"
          >
            Try again
          </button>
          <a
            href="/dashboard"
            className="px-4 py-2 rounded-lg border border-surface-200 text-surface-700 font-medium hover:bg-surface-50 transition-colors"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}