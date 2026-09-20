'use client';

import React from 'react';
import { TriangleAlert } from 'lucide-react';
import { STOREFRONT_MISCONFIGURED_HINT } from '@/config/pages';
import { cn } from '@/lib/utils';

/**
 * Shown wherever the dashboard would normally link to — or frame — a live
 * storefront page but this build has no storefront origin configured.
 *
 * Without it the editor shows the browser's generic `ERR_CONNECTION_REFUSED`
 * for `http://localhost:8080/…`, which says nothing about the cause. Kept as a
 * single component so Content → Pages, Content → Product Templates and both
 * template editors explain the same fix the same way.
 */
export function LivePreviewNotice({
  className,
  compact = false,
}: {
  className?: string;
  /** Tighter variant for use inside the narrow preview panes. */
  compact?: boolean;
}) {
  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-800',
        compact ? 'px-3 py-2 text-xs' : 'px-3 py-2 text-sm',
        className
      )}
    >
      <TriangleAlert className={cn('flex-shrink-0', compact ? 'mt-0.5 h-3.5 w-3.5' : 'mt-0.5 h-4 w-4')} />
      <span>
        <span className="font-medium">Live preview unavailable.</span>{' '}
        {STOREFRONT_MISCONFIGURED_HINT}
      </span>
    </div>
  );
}
