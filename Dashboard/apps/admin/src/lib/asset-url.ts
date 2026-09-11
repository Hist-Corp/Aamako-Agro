// ─── Asset URL resolver ────────────────────────────────────────────────
// The dashboard renders previews of images that live outside this app:
//   • `/images/…`            → static assets of the public storefront
//   • `/api/uploads/…`       → files served by the backend API
//   • everything absolute    → already usable as-is
// Without this, a storefront-relative URL like "/images/freeze-dried-mango-
// bowl.webp" resolves against the dashboard origin (port 3001) and 404s.
import { STOREFRONT_URL } from '@/config/pages';
import { API_BASE } from '@/lib/api-client';

export function assetUrl(url?: string | null): string {
  const u = (url ?? '').trim();
  if (!u) return '';
  // Absolute, protocol-relative or inline data/blob URLs pass through.
  if (/^(https?:)?\/\//i.test(u) || /^(data|blob):/i.test(u)) return u;
  if (u.startsWith('/api/')) {
    // Same-origin API_BASE relies on next.config.js rewrites — keep as-is.
    if (API_BASE.startsWith('/')) return u;
    try {
      return new URL(API_BASE).origin + u;
    } catch {
      return u;
    }
  }
  // Anything else is a storefront static asset (/images/…).
  const base = STOREFRONT_URL.replace(/\/+$/, '');
  return `${base}${u.startsWith('/') ? u : `/${u}`}`;
}