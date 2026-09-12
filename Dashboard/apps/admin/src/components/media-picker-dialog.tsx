'use client';
// ─── Media Picker Dialog ──────────────────────────────────────────────
// Reusable "choose from the media library" picker used by the product-template
// editor (product image, gallery rows, related-card images). Loads the admin
// media feed (/admin/media), shows IMAGE assets, and offers a live search +
// category filter over a responsive thumbnail grid (2 → 4 columns). Picking a
// tile resolves to the stored `url` — the exact value the device-upload path
// saves — so both entry points fill template fields identically.

import React, { useEffect, useMemo, useState } from 'react';
import { Search, ImagePlus, FolderOpen, ExternalLink, Check } from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api-client';
import { useToast } from '@/components/ui/toast';
import { Dialog } from '@/components/ui/dialog';
import { assetUrl } from '@/lib/asset-url';

interface MediaItem {
  id: string;
  name: string;
  type: 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  url: string;
  altText: string | null;
  category: string;
  size: string | null;
  dimensions: string | null;
  isPublished: boolean;
}

interface MediaPickerDialogProps {
  open: boolean;
  onClose: () => void;
  /** Resolves with the picked image URL (as stored in the library). */
  onSelect: (url: string) => void;
  /** Optional context shown in the dialog subtitle. */
  context?: string;
}

export function MediaPickerDialog({ open, onClose, onSelect, context }: MediaPickerDialogProps) {
  const { addToast } = useToast();
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setItems(null); // reset on every open so the grid reflects the latest library
    setQuery('');
    setCategory('All');
    apiClient
      .get<MediaItem[]>('/admin/media')
      .then((data) => {
        if (alive) setItems(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!alive) return;
        setItems([]);
        addToast({
          type: 'error',
          title: 'Media library unavailable',
          description: err instanceof ApiError ? err.message : 'Please try again.',
        });
      });
    return () => {
      alive = false;
    };
  }, [open, addToast]);

  const images = useMemo(() => (items ?? []).filter((m) => m.type === 'IMAGE'), [items]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    images.forEach((m) => set.add(m.category || 'General'));
    return ['All', ...Array.from(set).sort()];
  }, [images]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return images.filter((m) => {
      if (category !== 'All' && (m.category || 'General') !== category) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        (m.altText ?? '').toLowerCase().includes(q) ||
        (m.category ?? '').toLowerCase().includes(q)
      );
    });
  }, [images, query, category]);

  const meta = (m: MediaItem) =>
    [m.category || 'General', m.dimensions, m.size].filter(Boolean).join(' · ');

  const gridCls =
    'grid max-h-[46vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 md:grid-cols-4';

  return (
    <Dialog open={open} onClose={onClose} title="Choose from media library" maxWidth="lg">
      {/* Library summary header */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-surface-500">
          {context ? `${context} — ` : ''}Pick an image from the media page feed. It fills the field with the
          stored URL.
        </p>
        <a
          href="/media"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-lg border border-surface-200 px-2 py-1 text-2xs font-medium text-surface-500 transition-colors hover:border-brand-400 hover:text-brand-600"
        >
          <ExternalLink className="h-3 w-3" />
          Open media page
        </a>
      </div>

      {/* Search */}
      <div className="relative mb-2">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, alt text or category…"
          className="h-9 w-full rounded-lg border border-surface-200 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {/* Category filter chips */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={
              'rounded-full border px-2.5 py-1 text-2xs font-medium transition-colors ' +
              (category === c
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-surface-200 bg-white text-surface-600 hover:border-brand-300 hover:text-brand-600')
            }
          >
            {c}
          </button>
        ))}
      </div>

      {items === null ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-surface-100" />
          ))}
        </div>
      ) : images.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-surface-300 py-10 text-center">
          <ImagePlus className="h-8 w-8 text-surface-300" />
          <p className="text-sm font-medium text-surface-600">Nothing in the library yet</p>
          <p className="max-w-[34ch] text-xs text-surface-400">
            Upload images from the media page, then pick them here for any product section.
          </p>
          <a
            href="/media"
            className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-700"
          >
            <ImagePlus className="h-3.5 w-3.5" />
            Go to media page
          </a>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-surface-300 py-10 text-center">
          <Search className="h-7 w-7 text-surface-300" />
          <p className="text-sm font-medium text-surface-600">No images match</p>
          <button type="button" onClick={() => { setQuery(''); setCategory('All'); }} className="text-2xs font-medium text-brand-600 hover:underline">
            Clear search & filters
          </button>
        </div>
      ) : (
        <>
          <p className="mb-2 text-2xs font-medium uppercase tracking-wide text-surface-400">
            {filtered.length} image{filtered.length === 1 ? '' : 's'}
          </p>
          <div role="listbox" aria-label="Media library images" className={gridCls}>
            {filtered.map((m) => (
              <button
                key={m.id}
                type="button"
                role="option"
                aria-label={`Use ${m.name}`}
                onClick={() => {
                  onSelect(m.url);
                  onClose();
                }}
                className="group overflow-hidden rounded-xl border border-surface-200 bg-white text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-md hover:shadow-brand-500/10 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={assetUrl(m.url)}
                    alt={m.altText || m.name}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.opacity = '0.2';
                    }}
                  />
                  {!m.isPublished && (
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-2xs font-semibold text-amber-700">
                      Draft
                    </span>
                  )}
                  <span className="absolute inset-0 flex items-center justify-center bg-brand-600/0 opacity-0 transition-opacity group-hover:bg-brand-600/30 group-hover:opacity-100">
                    <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-2xs font-semibold text-brand-700 shadow">
                      <Check className="h-3 w-3" />
                      Use image
                    </span>
                  </span>
                </div>
                <div className="border-t border-surface-100 p-2">
                  <p className="truncate text-2xs font-medium text-surface-700">{m.name}</p>
                  <p className="truncate text-2xs text-surface-400">{meta(m) || 'Image'}</p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </Dialog>
  );
}
