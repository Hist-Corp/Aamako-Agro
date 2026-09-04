export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50 p-6">
      <div className="max-w-md w-full bg-white rounded-2xl border border-surface-200 shadow-sm p-8 text-center">
        <div className="text-5xl mb-4">🧭</div>
        <h1 className="text-xl font-semibold text-surface-900 mb-2">
          Page not found
        </h1>
        <p className="text-sm text-surface-500 mb-6">
          The page you are looking for does not exist or has been moved.
        </p>
        <a
          href="/dashboard"
          className="inline-flex px-4 py-2 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 transition-colors"
        >
          Go to Dashboard
        </a>
      </div>
    </div>
  );
}