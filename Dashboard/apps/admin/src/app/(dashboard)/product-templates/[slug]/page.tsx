'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/config/auth-context';
import { canAct } from '@/config/rbac';
import { apiClient, ApiError } from '@/lib/api-client';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import {
  Globe,
  ExternalLink,
  Lock,
  CheckCircle,
  HardDriveUpload,
  FolderOpen,
  Loader2,
  Sparkles,
  RotateCcw,
  Monitor,
  Tablet,
  Smartphone,
  Plus,
  Trash2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { MediaPickerDialog } from '@/components/media-picker-dialog';
import { PRODUCT_TEMPLATE_SECTIONS, productFieldKey, ALL_PRODUCT_FIELD_KEYS, getProductFieldDefaults } from '@/config/product-templates';
import { assetUrl } from '@/lib/asset-url';

interface CmsItem {
  id: string;
  key: string;
  title: string;
  body: string;
  isPublished: boolean;
}

const STOREFRONT_URL =
  process.env.NEXT_PUBLIC_STOREFRONT_URL ?? 'http://localhost:8080';

const FIELD_PLACEHOLDERS: Record<string, string> = {
  name: 'e.g. Freeze-Dried Mango',
  slug: 'e.g. fd-mango',
  badge: 'e.g. Best seller',
  price: 'e.g. 450',
  'pack': 'e.g. 50g pouch',
  availability: 'e.g. In stock',
  'shelf-life': 'e.g. 18 months, unopened',
  description: 'One-line summary...',
};

export default function ProductTemplateEditorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
    const { user } = useAuth();
  const router = useRouter();
  const { addToast } = useToast();
  const [resolvedSlug, setResolvedSlug] = useState<string | null>(null);
  const [items, setItems] = useState<Record<string, CmsItem>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeSection, setActiveSection] = useState(0);
  // Dragged width of the storefront preview (null = default one-third share).
  const [previewW, setPreviewW] = useState<number | null>(null);

  const slug = resolvedSlug || 'new';

  const allowed = !!user && canAct(user.role, 'product-templates:view');
  const canEdit = !!user && canAct(user.role, 'product-templates:edit');
  const canPublish =
    !!user &&
    (canAct(user.role, 'product-templates:publish') ||
      canAct(user.role, 'products:publish') ||
      canAct(user.role, 'content:publish'));

  const prefix = `product-template.${slug}.`;

  // Storefront-derived prefill: when a field has never been saved, the editor
  // shows the copy the live product page renders for this process category
  // (Freeze-Dried / Dehydrated / Powders) so the user sees WHAT to fill WHERE.
  const processCategory = (items['process-category']?.title ?? '').trim() || null;
  const defaults = getProductFieldDefaults(processCategory);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.get<CmsItem[]>('/content/manage');
      const map: Record<string, CmsItem> = {};
      for (const item of data) {
        if (item.key.startsWith(prefix)) {
          const field = item.key.slice(prefix.length);
          if (Object.keys(map).includes(field)) {
            map[field] = item;
          } else {
            map[field] = item;
          }
        }
      }
      setItems(map);
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Could not load product template',
        description: err instanceof ApiError ? err.message : 'Unexpected error',
      });
    } finally {
      setIsLoading(false);
    }
  }, [slug, addToast]);

    useEffect(() => {
    const init = async () => {
      const resolved = await params;
      setResolvedSlug(resolved?.slug ?? null);
    };
    init();
  }, [params]);

  useEffect(() => {
    if (!user) return;
    if (!allowed) {
      router.replace('/dashboard');
      return;
    }
    if (slug) void load();
  }, [user, allowed, slug, load, router]);

    const updateItem = (field: string, updates: Partial<CmsItem>) => {
    const key = productFieldKey(slug, field);
    setItems((prev) => ({
      ...prev,
      [field]: {
        id: prev[field]?.id || '',
        key,
        title: updates.title ?? prev[field]?.title ?? '',
        body: updates.body ?? prev[field]?.body ?? '',
        isPublished: updates.isPublished ?? prev[field]?.isPublished ?? false,
      },
    }));
  };

  // Live-preview bridge: after a save/publish the preview iframe would wait up
  // to its 10s poll before showing the change. Telling it to refresh (via a
  // postMessage that js/content.js listens for and answers with refresh())
  // makes dashboard edits appear in the preview immediately, in place — no
  // iframe reload, no scroll reset.
  //
  // DEBOUNCED: firing on every keystroke makes the iframe re-render on every
  // letter, which reads as a flicker in the preview panel. We batch rapid calls
  // (trailing-edge debounce) so the preview only updates after the user pauses
  // for 600ms — typing stays smooth, and the preview settles when they do.
  const previewTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshPreview = useCallback(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => {
      try {
        const ifr = document.querySelector<HTMLIFrameElement>('iframe[title="Storefront preview"]');
        ifr?.contentWindow?.postMessage(
          { source: 'aamako-cms-bridge', type: 'content-updated' },
          '*',
        );
      } catch (_) {
        /* a messaging failure must never break the editing workflow */
      }
      previewTimer.current = null;
    }, 600);
  }, []);

  const handleSaveField = async (field: string, value: string, isTitle: boolean = true) => {
    // NOTE: this function fires on every keystroke. It must NOT touch any
    // component state (no setIsSaving, no addToast) — doing so re-renders the
    // entire tree on every letter, which reads as a flicker in the input the
    // user is typing in and in the header buttons. Auto-save is completely
    // silent: no state change, no toast, no re-render. The only state change
    // in the whole save path is the local `updateItem` below, which is a
    // targeted map update that React batches with the keystroke — invisible.
    const existing = items[field];
    const key = productFieldKey(slug, field);
    try {
      const nextTitle = isTitle
        ? value
        : existing?.title?.trim() || field;
      const nextBody = isTitle ? existing?.body ?? '' : value;
      await apiClient.put(`/content/${encodeURIComponent(key)}`, {
        title: nextTitle,
        body: nextBody,
      });
      updateItem(field, isTitle ? { title: value } : { body: value });
      refreshPreview();
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Save failed',
        description: err instanceof ApiError ? err.message : 'Unexpected error',
      });
    }
    // No finally block that touches component state — auto-save never triggers
    // a re-render. Only handlePublish (the explicit user action) toggles
    // isSaving to give the Publish button its "Saving..." affordance.
  };

  const handlePublish = async () => {
    // Validate required fields before publishing — most importantly the
    // product image, which can come from either an https URL or a device upload.
    const missing: string[] = [];
    for (const section of PRODUCT_TEMPLATE_SECTIONS) {
      for (const field of section.fields) {
        if (!field.required) continue;
        const existing = items[field.key];
        const value = (existing?.title || existing?.body || '').trim();
        if (!value) missing.push(field.label);
        if (field.key === 'image-url' && value && !/^https?:\/\/.+/i.test(value)) {
          addToast({
            type: 'error',
            title: 'Invalid product image',
            description: 'The product image must be an https:// URL (paste a link or upload from your device).',
          });
          return;
        }
      }
    }
    if (missing.length > 0) {
      addToast({
        type: 'error',
        title: 'Required fields missing',
        description: `Please fill in: ${missing.join(', ')}. For the product image, paste a URL or upload one from your device.`,
      });
      setActiveSection(0);
      return;
    }
    setIsSaving(true);
    try {
      // Publish editable fields AND companion "<field>__hidden" visibility
      // flags (same items map; without publishing them the storefront would
      // never learn a section was hidden).
      const publishKeys = [...ALL_PRODUCT_FIELD_KEYS, ...Object.keys(items).filter((k) => k.endsWith('__hidden'))];
      for (const field of publishKeys) {
        const key = productFieldKey(slug, field);
        if (items[field]) {
          // Values were already written by handleSaveField (PUT /content/:key).
          // The publish step flips isPublished → the public live-content feed
          // (/api/content) includes the item → the storefront poller & preview
          // pick it up. Backend route is POST /content/:key/publish (the
          // previous PUT /content/publish had no matching route — it 404'd and
          // nothing ever reached the storefront).
          await apiClient.post(`/content/${encodeURIComponent(key)}/publish`);
        }
      }
      // Bump the preview iframe now — it normally polls every 10s, but after
      // this explicit publish we want the storefront to reflect edits instantly.
      refreshPreview();
      addToast({
        type: 'success',
        title: 'Published',
        description: 'Product template published successfully.',
      });
      await load();
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Publish failed',
        description: err instanceof ApiError ? err.message : 'Unexpected error',
      });
    } finally {
      setIsSaving(false);
    }
  };

    if (!user || !allowed) return null;

return (
  <div>
    <PageHeader
      title={slug === 'new' ? 'Add product' : `Product: ${slug}`}
      description="Edit any section of this product template — including the 5-image gallery. Changes save directly and show in the live storefront preview."
      actions={
        <div className="flex flex-nowrap items-center gap-2 overflow-x-auto">
          {canPublish && (
            <Button size="sm" variant={isSaving ? 'secondary' : 'primary'} onClick={handlePublish} disabled={isSaving} className="whitespace-nowrap">
              <CheckCircle className="h-4 w-4" />
              {isSaving ? 'Saving...' : 'Publish to storefront'}
            </Button>
          )}
          <a href={`${STOREFRONT_URL}/product.html?slug=${slug}`} target="_blank" rel="noreferrer" className="whitespace-nowrap">
            <Button size="sm" variant="secondary">
              <ExternalLink className="h-4 w-4" /> View live product page
            </Button>
          </a>
        </div>
      }
      breadcrumbs={[
        { label: 'Content', href: '/pages' },
        { label: 'Product Templates', href: '/product-templates' },
        { label: slug === 'new' ? 'Add product' : `Edit: ${slug}` },
      ]}
    />

    <div className="mb-4 flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-700">
      <Lock className="h-4 w-4 flex-shrink-0" />
      <span>
        <span className="font-medium">Restricted:</span> Only Managers, Content Managers, Admins
        and Super Admins can edit product templates.
      </span>
    </div>

    {/* Editing column (flex-1) + live storefront preview (flex-none). The
        preview's mouse-draggable handle grows it and the editing column
        shrinks in the same flex row — check the template at any width. */}
    <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
      <div className="min-w-0 flex-1 space-y-6 xl:max-h-[calc(100vh-170px)] xl:min-w-[300px] xl:overflow-y-auto xl:pr-3">
        {PRODUCT_TEMPLATE_SECTIONS.map((section) => (
          <Card key={section.label} className="p-5 mb-4">
            <h3 className="text-md font-semibold text-surface-800 mb-1">{section.label}</h3>
            <p className="text-2xs text-surface-500 mb-4">{section.description}</p>
            {section.fields.map((field) => (
              <FieldBlock key={field.key} field={field} items={items} onSave={handleSaveField}>
                {renderField(field, items, slug, handleSaveField, defaults)}
              </FieldBlock>
            ))}
          </Card>
        ))}
        <div className="text-center">
          <a href="/product-templates" className="text-sm text-brand-600">← Back to all products</a>
        </div>
      </div>

      {/* Live storefront preview — sticky so it never moves while the editing column scrolls.
          Mouse-draggable handle: drag leftwards to widen the preview; the editing column
          shrinks (flex-1) in the same row, so the template can be checked at any width. */}
      <div
        className="w-full xl:w-[34%] xl:flex-none xl:sticky xl:top-[96px] xl:self-start"
        style={previewW !== null ? { width: previewW } : undefined}
      >
        {/* ?template=1 forces the storefront to render from the CMS template
            fields (product-template.<slug>.*) instead of the DB catalog product,
            so the live preview reflects exactly what the editor is editing. */}
        <ResizablePreview src={`${STOREFRONT_URL}/product.html?template=1&slug=${slug}`} onWidthChange={setPreviewW} />
      </div>
    </div>
  </div>
  );
}

/** Live storefront preview with a mouse-draggable handle on its left edge
 *  (the divider between the editor and the preview). Drag leftwards to
 *  widen between 320px and 1600px — the editing column shrinks (flex-1,
 *  min 300px) as the preview grows, so both share one flex row and never
 *  overlay or clip on any screen size. The resolved width is reported to
 *  the page via onWidthChange so the preview column itself resizes. */
function ResizablePreview({
  src,
  onWidthChange,
}: {
  src: string;
  onWidthChange?: (w: number | null) => void;
}) {
  const MIN = 320;
  const MAX = 1600;
  // Editing column never shrinks below this while the preview is dragged wider.
  const MIN_EDIT = 300;
  // null = default one-third share (xl:w-[34%] on the preview column); the
  // editing column keeps the remaining two-thirds until the user drags.
  const [customWidth, setCustomWidth] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const drag = React.useRef<{ startX: number; startW: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  // Track the flex row's width so the dragged preview can be capped —
  // the editing column shrinks as the preview grows, but never below
  // MIN_EDIT, so both stay usable on any screen size.
  const [containerW, setContainerW] = React.useState(0);
  React.useEffect(() => {
    // wrapRef → component root → preview column → the shared flex row.
    const el = wrapRef.current?.parentElement?.parentElement?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(() => setContainerW(el.clientWidth));
    ro.observe(el);
    setContainerW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Global pointer listeners while dragging the handle. Moving the mouse
  // leftwards widens the preview; the editing column shrinks to fit (flex-1).
  React.useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      if (!drag.current) return;
      const w = drag.current.startW + (drag.current.startX - e.clientX);
      setCustomWidth(Math.round(w));
    };
    const onUp = () => {
      drag.current = null;
      setDragging(false);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [dragging]);

  // Cap: between MIN and (container minus the editing column's minimum).
  const cap = containerW ? Math.max(MIN, Math.min(MAX, containerW - MIN_EDIT)) : MAX;
  const width = customWidth !== null ? Math.min(cap, Math.max(MIN, customWidth)) : null;

  // Report the resolved width so the page can size the preview column itself
  // (flex-none) and let the editing column shrink in the same flex row.
  // Below the xl breakpoint the page stacks vertically, so a dragged pixel
  // width would be wrong there — only report it on wide screens.
  React.useEffect(() => {
    const wide = typeof window !== 'undefined' && window.innerWidth >= 1280;
    onWidthChange?.(wide ? width : null);
  }, [width, onWidthChange]);

  return (
    <div>
      <Card className="p-3 mb-3">
        <div className="flex justify-between items-center mb-1">
          <h3 className="text-sm font-medium text-surface-700">Live storefront preview</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="text-surface-400 hover:text-surface-600"
              title="Reload preview"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <a href={src} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5 text-surface-400" />
            </a>
          </div>
        </div>
        <p className="text-2xs text-surface-400">
          Drag the handle leftwards — the preview widens and the editing column shrinks to fit.
        </p>
      </Card>
      <div ref={wrapRef} className="relative">
        <div
          className="border border-surface-200 rounded-lg overflow-hidden bg-white"
          style={dragging ? { boxShadow: '0 0 0 2px rgba(124,58,237,.4)' } : undefined}
        >
          <iframe
            key={`${reloadKey}-${src}`}
            src={src}
            title="Storefront preview"
            className="w-full border-0 bg-white"
            style={{ height: 600 }}
          />
        </div>
        {/* Mouse-draggable divider — grab the handle on the preview's left edge
            and drag leftwards to widen the preview; the editing column shrinks
            (flex-1, min 300px) to share the same flex row. */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Drag leftwards to widen the preview — the editing column shrinks to fit"
          onPointerDown={(e) => {
            e.preventDefault();
            // Start from the currently resolved width; if the user hasn't
            // dragged yet, use the default one-third share of the flex row.
            const startW = width ?? Math.round((containerW || 1200) * 0.34);
            drag.current = { startX: e.clientX, startW };
            setDragging(true);
          }}
          className="absolute top-0 left-[-7px] h-full w-[14px] cursor-ew-resize flex items-center justify-center"
          style={{ touchAction: 'none' }}
        >
          <span
            className="h-[56px] w-[5px] rounded-full bg-surface-300 transition-colors"
            style={dragging ? { background: '#7c3aed' } : undefined}
          />
        </div>
        <p className="text-2xs text-surface-400 mt-2 flex items-center gap-2">
          {width !== null ? (
            <span className="font-mono">{width}px</span>
          ) : (
            <span>Default share — drag the handle to widen</span>
          )}
          {customWidth !== null && (
            <button
              type="button"
              onClick={() => setCustomWidth(null)}
              className="ml-auto text-2xs text-surface-400 hover:text-surface-600 underline"
              title="Reset to default share"
            >
              Reset
            </button>
          )}
        </p>
      </div>
    </div>
  );
}

/** Upgrade plain multi-paragraph copy to paragraph HTML so the rich-text
 *  toolbar can style it (first edit wraps; HTML saved values pass through). */
function plainToHtml(p: string): string {
  return p
    .split(/\n{2,}/)
    .map((b) => '<p>' + b.replace(/\n/g, '<br>') + '</p>')
    .join('');
}

function renderField(
  field: any,
  items: Record<string, CmsItem>,
  slug: string,
  onSave: (field: string, value: string, isTitle: boolean) => void,
  defaults: Record<string, string> = {},
) {
  return (
    <FieldBlock field={field} items={items} onSave={onSave}>
      {renderFieldInner(field, items, slug, onSave, defaults)}
    </FieldBlock>
  );
}

/** Hide/unhide wrapper drawn around every template field. The eye icon in
 *  the top-right corner persists the decision to the storefront (as a
 *  companion "<field>__hidden" content item) so the user decides per
 *  section whether customers see it. Hidden fields fade + show a badge;
 *  the icon alone communicates state, and the row stays fully editable. */
function FieldBlock({
  field,
  items,
  onSave,
  children,
}: {
  field: any;
  items: Record<string, CmsItem>;
  onSave: (field: string, value: string, isTitle: boolean) => void;
  children: React.ReactNode;
}) {
  const hiddenKey = field.key + '__hidden';
  const isHidden = (items[hiddenKey]?.title ?? '').trim() === 'hidden';
  const toggleHidden = () => onSave(hiddenKey, isHidden ? '' : 'hidden', true);
  return (
    <div
      className={
        'relative rounded-lg transition-opacity ' +
        (isHidden ? 'border border-dashed border-surface-300 bg-surface-50 opacity-60' : '')
      }
    >
      <button
        type="button"
        onClick={toggleHidden}
        title={isHidden ? 'Show this content on the storefront' : 'Hide this content on the storefront'}
        aria-label={isHidden ? 'Show content on the storefront' : 'Hide content on the storefront'}
        aria-pressed={isHidden}
        className={
          'absolute right-1 top-1 z-10 flex h-7 w-7 items-center justify-center rounded-md border transition-colors ' +
          (isHidden
            ? 'border-surface-300 bg-white text-surface-400 hover:text-surface-700'
            : 'border-transparent bg-white/80 text-surface-300 hover:text-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/40')
        }
      >
        {isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
      {isHidden && (
        <span className="absolute right-10 top-1.5 z-10 inline-flex items-center gap-1 rounded-full bg-surface-200 px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide text-surface-500">
          <EyeOff className="h-3 w-3" /> Hidden on storefront
        </span>
      )}
      {children}
    </div>
  );
}

function renderFieldInner(
  field: any,
  items: Record<string, CmsItem>,
  slug: string,
  onSave: (field: string, value: string, isTitle: boolean) => void,
  defaults: Record<string, string> = {},
) {
  const existing = items[field.key];
  const fieldKey = productFieldKey(slug, field.key);
  const prefill = defaults[field.key] ?? '';
  // Badge shown when the input is displaying suggested storefront copy that
  // has not been saved yet (publishing keeps it; leaving it leaves the field empty).
  const prefillBadge = () =>
    !existing && prefill ? (
      <p className="mt-1 inline-flex items-center gap-1 text-2xs font-medium text-brand-600">
        <Sparkles className="h-3 w-3" /> Prefilled from the storefront page — publish to keep it.
      </p>
    ) : null;

  if (field.type === 'related-cards') {
    const value = (existing?.body && existing.body !== '' ? existing.body : existing?.title) ?? prefill;
    return (
      <RelatedCardsEditor
        field={field}
        fieldKey={fieldKey}
        value={value}
        hasExisting={!!existing}
        prefill={prefill}
        onSave={onSave}
      />
    );
  }

  if (field.type === 'list-check' || field.type === 'nutrition-rows' || field.type === 'faq-pairs' || field.type === 'howto-blocks') {
    const value = (existing?.body && existing.body !== '' ? existing.body : existing?.title) ?? prefill;
    if (field.type === 'list-check') {
      return (
        <CheckListEditor
          field={field}
          fieldKey={fieldKey}
          value={value}
          hasExisting={!!existing}
          prefill={prefill}
          onSave={onSave}
        />
      );
    }
    if (field.type === 'nutrition-rows') {
      return (
        <NutritionRowsEditor
          field={field}
          fieldKey={fieldKey}
          value={value}
          hasExisting={!!existing}
          prefill={prefill}
          onSave={onSave}
        />
      );
    }
    if (field.type === 'faq-pairs') {
      return (
        <FaqPairsEditor
          field={field}
          fieldKey={fieldKey}
          value={value}
          hasExisting={!!existing}
          prefill={prefill}
          onSave={onSave}
        />
      );
    }
    return (
      <HowtoBlocksEditor
        field={field}
        fieldKey={fieldKey}
        value={value}
        hasExisting={!!existing}
        prefill={prefill}
        onSave={onSave}
      />
    );
  }

  if (field.type === 'image') {
    return (
      <ImageField
        key={field.key}
        field={field}
        value={(existing?.title ?? '').trim()}
        fieldKey={fieldKey}
        onSave={onSave}
      />
    );
  }

  if (field.type === 'gallery') {
    const raw = (existing?.body ?? existing?.title ?? prefill).trim();
    const urls = raw ? raw.split('\n').map((u: string) => u.trim()).filter(Boolean) : [];
    return (
      <GalleryEditor
        key={field.key}
        field={field}
        fieldKey={fieldKey}
        urls={urls}
        hasExisting={!!existing}
        onSave={onSave}
      />
    );
  }

  if (field.type === 'textarea' || field.type === 'richtext') {
    const raw = (existing?.body && existing.body !== '' ? existing.body : existing?.title) ?? prefill;
    // Plain saved copy (or plain prefill) is upgraded to paragraph HTML once
    // so the formatting toolbar can style it; existing HTML passes through.
    const html = raw && !/<[a-z][^>]*>/i.test(raw) ? plainToHtml(raw) : raw;
    return (
      <div key={field.key} className="mb-4">
        <label className="block text-xs font-medium text-surface-600 mb-1">{field.label}</label>
        <RichTextEditor
          value={html}
          onChange={(h) => onSave(field.key, h, false)}
          placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
          hint={field.description}
        />
        {prefillBadge()}
        <p className="text-2xs text-surface-400 mt-1">Key: <code>{fieldKey}</code></p>
      </div>
    );
  }

  if (field.type === 'number' || field.type === 'url' || field.type === 'select' || field.type === 'text') {
    return (
      <div key={field.key} className="mb-4">
        <label className="block text-xs font-medium text-surface-600 mb-1">{field.label}</label>
        {field.type === 'select' ? (
          <select
            className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={existing?.title ?? ''}
            onChange={(e) => onSave(field.key, e.target.value, true)}
          >
            <option value="">Select</option>
            {field.options?.map((opt: any) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        ) : (
          <input
            type={field.type}
            className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder={field.placeholder}
            value={existing?.title ?? prefill}
            onChange={(e) => onSave(field.key, e.target.value, true)}
          />
        )}
        {field.key === 'process-category' && (existing?.title ?? '').trim() && (
          <a
            href={`${STOREFRONT_URL}/collection.html?cat=${encodeURIComponent((existing?.title ?? '').trim())}`}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-2xs font-medium text-brand-600 hover:text-brand-700"
          >
            <ExternalLink className="h-3 w-3" /> View the {field.options?.find((o: any) => o.value === existing?.title)?.label ?? existing?.title} category page
          </a>
        )}
        <p className="text-2xs text-surface-400 mt-1">{field.description}</p>
        {field.type !== 'select' && prefillBadge()}
        <p className="text-2xs text-surface-400 mt-1">Key: <code>{fieldKey}</code></p>
      </div>
    );
  }

  return null;
}

/** Product image field: paste an https:// URL OR upload an image straight
 *  from the device. Either one fills the same required image-url field. */
/* ---------- gallery editor (up to 8 images, add button) ---------- */

const MAX_GALLERY_IMAGES = 8;

function GalleryEditor({
  field,
  fieldKey,
  urls,
  hasExisting,
  onSave,
}: {
  field: any;
  fieldKey: string;
  urls: string[];
  hasExisting: boolean;
  onSave: (field: string, value: string, isTitle: boolean) => void;
}) {
  const { addToast } = useToast();
  const [rows, setRows] = useState<string[]>(() => (urls.length ? [...urls] : ['']));
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [pickerIdx, setPickerIdx] = useState<number | null>(null);
  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

  const commit = (next: string[]) => {
    onSave(field.key, next.map((u) => u.trim()).filter(Boolean).join('\n'), false);
  };

  const setRow = (idx: number, value: string) => {
    const next = [...rows];
    next[idx] = value;
    setRows(next);
    commit(next);
  };

  const addRow = () => {
    if (rows.length >= MAX_GALLERY_IMAGES) return;
    const next = [...rows, ''];
    setRows(next);
    commit(next);
  };

  const removeRow = (idx: number) => {
    const next = rows.filter((_, i) => i !== idx);
    if (!next.length) next.push('');
    setRows(next);
    commit(next);
  };

  const handleFile = async (idx: number, file: File) => {
    if (!file.type.startsWith('image/')) {
      addToast({ type: 'error', title: 'Invalid file', description: 'Please choose an image file.' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      addToast({ type: 'error', title: 'Too large', description: 'Maximum image size is 5 MB.' });
      return;
    }
    setUploadingIdx(idx);
    try {
      const res = await apiClient.upload<{ url: string }>('/admin/media/upload', file);
      setRow(idx, res.url);
      addToast({ type: 'success', title: 'Image uploaded', description: `Saved as gallery image ${idx + 1}.` });
    } catch (err) {
      addToast({ type: 'error', title: 'Upload failed', description: err instanceof ApiError ? err.message : 'Please try again.' });
    } finally {
      setUploadingIdx(null);
      const el = inputRefs.current[idx];
      if (el) el.value = '';
    }
  };

  return (
    <div className="mb-4">
      <label className="block text-xs font-medium text-surface-600 mb-1">
        {field.label} {field.required && <span className="text-red-500">*</span>}
      </label>
      <div className="space-y-3">
        {rows.map((url, idx) => (
          <div key={idx} className="flex flex-wrap items-start gap-3 rounded-lg border border-surface-200 p-3">
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={assetUrl(url)}
                alt={`Gallery ${idx + 1}`}
                className="h-20 w-20 flex-shrink-0 rounded-lg border border-surface-200 object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
              />
            ) : (
              <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-surface-300 text-2xs text-surface-400">
                Image {idx + 1}
              </div>
            )}
            <div className="min-w-[240px] flex-1 space-y-2">
              <input
                type="url"
                className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder={`https://… (image ${idx + 1})`}
                value={url}
                onChange={(e) => setRow(idx, e.target.value)}
              />
              <div className="flex flex-wrap items-center gap-2">
                <ImageSourceGroup
                  uploading={uploadingIdx === idx}
                  onUpload={() => inputRefs.current[idx]?.click()}
                  onMedia={() => setPickerIdx(idx)}
                  uploadLabel="From device"
                  mediaLabel="From media"
                />
                {rows.length > 1 && (
                  <Button variant="ghost" size="sm" onClick={() => removeRow(idx)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <input
                ref={(el) => { inputRefs.current[idx] = el; }}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(idx, f);
                }}
              />
            </div>
          </div>
        ))}
      </div>
      {rows.length < MAX_GALLERY_IMAGES && (
        <button
          type="button"
          onClick={addRow}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg border-2 border-dashed border-surface-300 px-4 py-2 text-sm font-medium text-surface-600 hover:border-brand-500 hover:text-brand-600 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add image ({rows.length}/{MAX_GALLERY_IMAGES})
        </button>
      )}
      <MediaPickerDialog
        open={pickerIdx !== null}
        onClose={() => setPickerIdx(null)}
        onSelect={(u) => {
          if (pickerIdx !== null) setRow(pickerIdx, u);
          setPickerIdx(null);
        }}
        context={`Gallery image ${(pickerIdx ?? 0) + 1}`}
      />
      <p className="text-2xs text-surface-400 mt-1">{field.description}</p>
      <p className="text-2xs text-surface-400 mt-1">Key: <code>{fieldKey}</code></p>
    </div>
  );
}

/** Image picker pair — a single visual control with two image-sourcing paths:
 *  upload from the user's device, or pick an existing image from the media
 *  library. Rendered as a split/segmented control: a white "device" segment +
 *  a brand-tinted "library" segment separated by a hairline divider, so the
 *  two options read as one cohesive "add image" action instead of two plain
 *  grey buttons. Collapses into a stacked pair on narrow columns/mobile and
 *  stays a compact side-by-side pair on wider rows. The uploading state shows
 *  an inline spinner on the device segment (same size — no layout jump). */
function ImageSourceGroup({
  uploading,
  onUpload,
  onMedia,
  uploadLabel = 'Insert from device',
  mediaLabel = 'Media library',
  className,
}: {
  uploading: boolean;
  onUpload: () => void;
  onMedia: () => void;
  uploadLabel?: string;
  mediaLabel?: string;
  className?: string;
}) {
  const segBase =
    'group inline-flex min-h-9 flex-1 items-center justify-center gap-2 px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 disabled:pointer-events-none disabled:opacity-60';
  return (
    <div
      className={
        'inline-flex max-w-full flex-col overflow-hidden rounded-xl border border-surface-200 bg-white shadow-sm sm:inline-flex sm:w-auto sm:flex-row sm:items-stretch ' +
        (className ?? '')
      }
    >
      <button
        type="button"
        onClick={onUpload}
        disabled={uploading}
        title={uploading ? 'Uploading image…' : 'Upload an image from your device'}
        aria-label={uploading ? 'Uploading image' : 'Upload an image from your device'}
        className={`${segBase} bg-white text-surface-700 hover:bg-brand-50 hover:text-brand-700 active:bg-brand-100 ${
          uploading ? 'text-brand-700' : ''
        }`}
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
        ) : (
          <HardDriveUpload className="h-4 w-4 text-brand-600 transition-transform group-hover:-translate-y-px" />
        )}
        {uploading ? 'Uploading…' : uploadLabel}
      </button>
      <button
        type="button"
        onClick={onMedia}
        title={mediaLabel}
        aria-label={mediaLabel}
        className={`${segBase} border-t border-surface-200 bg-surface-50/70 text-surface-700 hover:bg-brand-50 hover:text-brand-700 active:bg-brand-100 sm:border-l sm:border-t-0`}
      >
        <FolderOpen className="h-4 w-4 text-brand-600" />
        {mediaLabel}
      </button>
    </div>
  );
}

function ImageField({
  field,
  value,
  fieldKey,
  onSave,
}: {
  field: any;
  value: string;
  fieldKey: string;
  onSave: (field: string, value: string, isTitle: boolean) => void;
}) {
  const { addToast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError(null);
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file (JPG, PNG, WebP…).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image is too large — maximum size is 5 MB.');
      return;
    }
    setUploading(true);
    try {
      const res = await apiClient.upload<{ url: string }>('/admin/media/upload', file);
      onSave(field.key, res.url, true);
      addToast({ type: 'success', title: 'Image uploaded', description: 'Saved as the product image.' });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed — please try again.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="mb-4">
      <label className="block text-xs font-medium text-surface-600 mb-1">
        {field.label} {field.required && <span className="text-red-500">*</span>}
      </label>
      <div className="flex flex-wrap items-start gap-3">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={assetUrl(value)}
            alt="Product preview"
            className="h-24 w-24 flex-shrink-0 rounded-lg border border-surface-200 object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
          />
        ) : (
          <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-surface-300 text-2xs text-surface-400">
            No image
          </div>
        )}
        <div className="min-w-[240px] flex-1 space-y-2">
          <input
            type="url"
            className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder={field.placeholder}
            value={value}
            onChange={(e) => onSave(field.key, e.target.value, true)}
          />
          <div className="flex flex-col gap-2">
            <ImageSourceGroup
              uploading={uploading}
              onUpload={() => inputRef.current?.click()}
              onMedia={() => setPickerOpen(true)}
              uploadLabel="Insert from device"
              mediaLabel="Media library"
            />
            <span className="text-2xs text-surface-400">URL, device image or media library — one is required</span>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
          {error && <p className="text-xs font-medium text-red-600">{error}</p>}
        </div>
      </div>
      <MediaPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(u) => onSave(field.key, u, true)}
        context="Product image"
      />
      <p className="text-2xs text-surface-400 mt-1">{field.description}</p>
      <p className="text-2xs text-surface-400 mt-1">Key: <code>{fieldKey}</code></p>
    </div>
  );
}

/* ---------- structured editors ----------
   Each editor derives its rows directly from the field's serialized value and
   re-serializes on every change (the same controlled pattern as the plain
   inputs), so no local state can drift out of sync with the saved value.
   Formats match what the storefront product page parses. */

function fieldInputCls(extra?: string) {
  return `w-full rounded-lg border border-surface-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${extra ?? ''}`;
}

function StructuredShell({
  field,
  fieldKey,
  hasExisting,
  prefill,
  children,
}: {
  field: any;
  fieldKey: string;
  hasExisting: boolean;
  prefill: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <label className="block text-xs font-medium text-surface-600 mb-1">{field.label}</label>
      {children}
      <p className="text-2xs text-surface-400 mt-1">{field.description}</p>
      {!hasExisting && prefill ? (
        <p className="mt-1 inline-flex items-center gap-1 text-2xs font-medium text-brand-600">
          <Sparkles className="h-3 w-3" /> Prefilled from the storefront page — publish to keep it.
        </p>
      ) : null}
      <p className="text-2xs text-surface-400 mt-1">Key: <code>{fieldKey}</code></p>
    </div>
  );
}

function addRowButton(label: string, onClick: () => void) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 mt-1 rounded-lg border border-dashed border-surface-300 px-2 py-1 text-2xs font-medium text-surface-500 hover:border-brand-400 hover:text-brand-600"
    >
      <Plus className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function removeRowButton(onClick: () => void) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-lg text-surface-400 hover:bg-red-50 hover:text-red-600"
      title="Remove row"
      aria-label="Remove row"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}

/** Key highlights / Why choose — one row per bullet: tick (check) or untick
 *  (cross) + free text. Serialized as one line per row: "✓ text" / "✗ text". */
function parseCheckList(value: string): { checked: boolean; text: string }[] {
  return String(value || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = /^([✓✔✗xX])\s*/.exec(l);
      if (!m) return { checked: true, text: l };
      return {
        checked: m[1] !== '✗' && m[1].toLowerCase() !== 'x',
        text: l.slice(m[0].length).trim(),
      };
    });
}
function serializeCheckList(rows: { checked: boolean; text: string }[]): string {
  return rows.map((r) => `${r.checked ? '✓' : '✗'} ${r.text.trim()}`.trimEnd()).join('\n');
}

function CheckListEditor({
  field,
  fieldKey,
  value,
  hasExisting,
  prefill,
  onSave,
}: {
  field: any;
  fieldKey: string;
  value: string;
  hasExisting: boolean;
  prefill: string;
  onSave: (field: string, value: string, isTitle: boolean) => void;
}) {
  const rows = parseCheckList(value);
  const commit = (next: { checked: boolean; text: string }[]) => onSave(field.key, serializeCheckList(next), true);
  return (
    <StructuredShell field={field} fieldKey={fieldKey} hasExisting={hasExisting} prefill={prefill}>
      <div className="space-y-1.5 rounded-lg border border-surface-200 divide-y divide-surface-200">
        {rows.length === 0 && (
          <p className="text-2xs text-surface-400 py-2">No rows yet — add one below.</p>
        )}
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2 py-1.5 px-2">
            <input
              type="checkbox"
              checked={r.checked}
              title="Tick for a check (✓) on the page — untick for a cross (✗)"
              aria-label={`Row ${i + 1} mark`}
              onChange={(e) => {
                const next = rows.slice();
                next[i] = { ...next[i], checked: e.target.checked };
                commit(next);
              }}
              className="h-4 w-4 accent-brand-600"
            />
            <span className={`w-5 text-center font-mono flex-shrink-0 ${r.checked ? 'text-brand-600' : 'text-red-500'}`}>
              {r.checked ? '✓' : '✗'}
            </span>
            <input
              value={r.text}
              placeholder="Type the point..."
              onChange={(e) => {
                const next = rows.slice();
                next[i] = { ...next[i], text: e.target.value };
                commit(next);
              }}
              className={fieldInputCls()}
            />
            {removeRowButton(() => {
              const next = rows.slice();
              next.splice(i, 1);
              commit(next);
            })}
          </div>
        ))}
      </div>
      {addRowButton(field.type === 'list-check' && field.key === 'why' ? 'Add point' : 'Add highlight', () =>
        commit([...rows, { checked: true, text: '' }]),
      )}
    </StructuredShell>
  );
}

/** Nutrition — one nutrient per row (label + value) + an optional note shown
 *  under the table. Serialized as "Label: value" lines + "\n\nnote". */
function parseNutritionRows(value: string): { rows: { label: string; value: string }[]; note: string } {
  const blocks = String(value || '').split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const rows: { label: string; value: string }[] = [];
  let note = '';
  (blocks[0] ?? '').split('\n').forEach((l) => {
    const i = l.indexOf(':');
    if (i > 0) rows.push({ label: l.slice(0, i).trim(), value: l.slice(i + 1).trim() });
  });
  if (blocks.length > 1) note = blocks.slice(1).join('\n\n');
  if (blocks.length === 1 && blocks[0].split('\n').some((l) => l.indexOf(':') <= 0)) {
    note = blocks[0].split('\n').filter((l) => l.indexOf(':') <= 0).join('\n');
  }
  return { rows, note };
}
function serializeNutritionRows(rows: { label: string; value: string }[], note: string): string {
  const lines = rows.map((r) => `${r.label}: ${r.value}`);
  return lines.length ? lines.join('\n') + (note.trim() ? '\n\n' + note.trim() : '') : note.trim();
}

function NutritionRowsEditor({
  field,
  fieldKey,
  value,
  hasExisting,
  prefill,
  onSave,
}: {
  field: any;
  fieldKey: string;
  value: string;
  hasExisting: boolean;
  prefill: string;
  onSave: (field: string, value: string, isTitle: boolean) => void;
}) {
  const parsed = parseNutritionRows(value);
  const save = (rows: { label: string; value: string }[], note: string) => onSave(field.key, serializeNutritionRows(rows, note), true);
  return (
    <StructuredShell field={field} fieldKey={fieldKey} hasExisting={hasExisting} prefill={prefill}>
      <div className="space-y-1.5 rounded-lg border border-surface-200 divide-y divide-surface-200">
        {parsed.rows.length === 0 && (
          <p className="text-2xs text-surface-400 py-2">No nutrients yet — add one below.</p>
        )}
        {parsed.rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2 py-1.5 px-2">
            <input
              value={r.label}
              placeholder="Nutrient (e.g. Energy)"
              onChange={(e) => {
                const next = parsed.rows.slice();
                next[i] = { ...next[i], label: e.target.value };
                save(next, parsed.note);
              }}
              className={fieldInputCls('max-w-[220px]')}
            />
            <span className="text-surface-300">→</span>
            <input
              value={r.value}
              placeholder="Value (e.g. 347 kcal)"
              onChange={(e) => {
                const next = parsed.rows.slice();
                next[i] = { ...next[i], value: e.target.value };
                save(next, parsed.note);
              }}
              className={fieldInputCls()}
            />
            {removeRowButton(() => {
              const next = parsed.rows.slice();
              next.splice(i, 1);
              save(next, parsed.note);
            })}
          </div>
        ))}
      </div>
      {addRowButton('Add nutrient', () => save([...parsed.rows, { label: '', value: '' }], parsed.note))}
      <textarea
        value={parsed.note}
        rows={2}
        placeholder="Lab-status note shown under the table (optional)"
        onChange={(e) => save(parsed.rows, e.target.value)}
        className={fieldInputCls('mt-1')}
      />
    </StructuredShell>
  );
}

/** FAQ — one card per question, each with its own answer box. Serialized as
 *  "Q: …\nA: …" blocks separated by blank lines. */
function parseFaqPairs(value: string): { q: string; a: string }[] {
  return String(value || '')
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => {
      const lines = b.split('\n').map((l) => l.trim());
      let q = '';
      const a: string[] = [];
      lines.forEach((l) => {
        const qm = /^Q\s*[:.]?\s*/i.exec(l);
        const am = /^A\s*[:.]?\s*/i.exec(l);
        if (qm && !q) q = l.slice(qm[0].length).trim();
        else if (am) a.push(l.slice(am[0].length).trim());
        else if (!q) q = l;
        else a.push(l);
      });
      return { q, a: a.join('\n') };
    });
}
function serializeFaqPairs(rows: { q: string; a: string }[]): string {
  return rows.filter((r) => r.q.trim() || r.a.trim()).map((r) => `Q: ${r.q.trim()}\nA: ${r.a.trim()}`).join('\n\n');
}

function FaqPairsEditor({
  field,
  fieldKey,
  value,
  hasExisting,
  prefill,
  onSave,
}: {
  field: any;
  fieldKey: string;
  value: string;
  hasExisting: boolean;
  prefill: string;
  onSave: (field: string, value: string, isTitle: boolean) => void;
}) {
  const rows = parseFaqPairs(value);
  const save = (next: { q: string; a: string }[]) => onSave(field.key, serializeFaqPairs(next), true);
  return (
    <StructuredShell field={field} fieldKey={fieldKey} hasExisting={hasExisting} prefill={prefill}>
      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={i} className="rounded-lg border border-surface-200 p-2.5">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-brand-50 text-2xs font-bold text-brand-700">
                {i + 1}
              </span>
              <input
                value={r.q}
                placeholder={`Question ${i + 1}`}
                onChange={(e) => {
                  const next = rows.slice();
                  next[i] = { ...next[i], q: e.target.value };
                  save(next);
                }}
                className={fieldInputCls()}
              />
              {removeRowButton(() => {
                const next = rows.slice();
                next.splice(i, 1);
                save(next);
              })}
            </div>
            <textarea
              value={r.a}
              rows={2}
              placeholder="Answer"
              onChange={(e) => {
                const next = rows.slice();
                next[i] = { ...next[i], a: e.target.value };
                save(next);
              }}
              className={fieldInputCls()}
            />
          </div>
        ))}
        {rows.length === 0 && (
          <p className="text-2xs text-surface-400">No questions yet — add one below.</p>
        )}
        {addRowButton('Add question', () => save([...rows, { q: '', a: '' }]))}
      </div>
    </StructuredShell>
  );
}

/** How to use — three labelled boxes (Usage / Recipes / Storage) styled to
 *  match the storefront tab. Serialized as "Usage: …\n\nRecipes: …\n\nStorage: …". */
function parseHowtoBlocks(value: string): { usage: string; recipes: string; storage: string } {
  const out = { usage: '', recipes: '', storage: '' };
  String(value || '')
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean)
    .forEach((b) => {
      const m = /^([A-Za-z]+)\s*:\s*/i.exec(b);
      if (!m) return;
      const key = m[1].toLowerCase();
      if (key === 'usage' || key === 'recipes' || key === 'storage') out[key] = b.slice(m[0].length).trim();
    });
  return out;
}
function serializeHowtoBlocks(v: { usage: string; recipes: string; storage: string }): string {
  const blocks: string[] = [];
  if (v.usage.trim()) blocks.push(`Usage: ${v.usage.trim()}`);
  if (v.recipes.trim()) blocks.push(`Recipes: ${v.recipes.trim()}`);
  if (v.storage.trim()) blocks.push(`Storage: ${v.storage.trim()}`);
  return blocks.join('\n\n');
}

/** Related cards — up to 4 { title, link, image } triples serialized as
 *  "Card 1 title: ...\nCard 1 link: ...\nCard 1 image: ...". */
function parseRelatedCards(value: string): { title: string; link: string; image: string }[] {
  const cards = Array.from({ length: 4 }, () => ({ title: '', link: '', image: '' }));
  String(value || '')
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => b.trim())
    .filter(Boolean)
    .forEach((b) => {
      const m = /^Card\s*(\d+)\s*(title|link|image)\s*:\s*/i.exec(b);
      if (!m) return;
      const idx = parseInt(m[1], 10) - 1;
      if (idx < 0 || idx > 3) return;
      const val = b.slice(m[0].length).trim();
      const key = m[2].toLowerCase() as 'title' | 'link' | 'image';
      cards[idx][key] = val;
    });
  return cards;
}
function serializeRelatedCards(cards: { title: string; link: string; image: string }[]): string {
  const blocks: string[] = [];
  cards.forEach((c, i) => {
    if (c.title.trim() || c.link.trim() || c.image.trim()) {
      blocks.push(`Card ${i + 1} title: ${c.title.trim()}\nCard ${i + 1} link: ${c.link.trim()}\nCard ${i + 1} image: ${c.image.trim()}`);
    }
  });
  return blocks.join('\n\n');
}


function HowtoBlocksEditor({
  field,
  fieldKey,
  value,
  hasExisting,
  prefill,
  onSave,
}: {
  field: any;
  fieldKey: string;
  value: string;
  hasExisting: boolean;
  prefill: string;
  onSave: (field: string, value: string, isTitle: boolean) => void;
}) {
  const v = parseHowtoBlocks(value);
  const save = (next: { usage: string; recipes: string; storage: string }) => onSave(field.key, serializeHowtoBlocks(next), true);
  const block = (label: string, hint: string, value: string, onChange: (v: string) => void) => (
    <div className="rounded-lg border border-surface-200 p-2.5">
      <label className="block text-2xs font-semibold uppercase tracking-wide text-surface-500 mb-1">
        {label}
      </label>
      <textarea
        value={value}
        rows={3}
        placeholder={hint}
        onChange={(e) => onChange(e.target.value)}
        className={fieldInputCls()}
      />
    </div>
  );
  return (
    <StructuredShell field={field} fieldKey={fieldKey} hasExisting={hasExisting} prefill={prefill}>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-1">
        {block('Usage', 'How to eat / drink it (shown under “Usage”)', v.usage, (n) => save({ ...v, usage: n }))}
        {block('Recipes', 'Ideas and recipe notes (shown under “Recipes”)', v.recipes, (n) => save({ ...v, recipes: n }))}
        {block('Storage', 'How to store it (shown under “Storage”)', v.storage, (n) => save({ ...v, storage: n }))}
      </div>
    </StructuredShell>
  );
}
function RelatedCardsEditor({
  field,
  fieldKey,
  value,
  hasExisting,
  prefill,
  onSave,
}: {
  field: any;
  fieldKey: string;
  value: string;
  hasExisting: boolean;
  prefill: string;
  onSave: (field: string, value: string, isTitle: boolean) => void;
}) {
  const { addToast } = useToast();
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [pickerIdx, setPickerIdx] = useState<number | null>(null);
  const cardInputRefs = React.useRef<(HTMLInputElement | null)[]>([]);
  const cards = parseRelatedCards(value);
  const save = (next: { title: string; link: string; image: string }[]) =>
    onSave(field.key, serializeRelatedCards(next), true);

  // Device upload for a card image: fills the same serialized slot the URL
  // box writes ("Card N image: ..."), so no storefront format change.
  const handleCardFile = async (idx: number, file: File) => {
    if (!file.type.startsWith('image/')) {
      addToast({ type: 'error', title: 'Invalid file', description: 'Please choose an image file.' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      addToast({ type: 'error', title: 'Too large', description: 'Maximum image size is 5 MB.' });
      return;
    }
    setUploadingIdx(idx);
    try {
      const res = await apiClient.upload<{ url: string }>('/admin/media/upload', file);
      const next = cards.map((c, i) => (i === idx ? { ...c, image: res.url } : c));
      save(next);
      addToast({ type: 'success', title: 'Image uploaded', description: `Saved as card ${idx + 1} image.` });
    } catch (err) {
      addToast({ type: 'error', title: 'Upload failed', description: err instanceof ApiError ? err.message : 'Please try again.' });
    } finally {
      setUploadingIdx(null);
      const el = cardInputRefs.current[idx];
      if (el) el.value = '';
    }
  };

  const updateCard = (idx: number, key: 'title' | 'link' | 'image', val: string) => {
    const next = cards.map((c, i) => (i === idx ? { ...c, [key]: val } : c));
    save(next);
  };

  return (
    <StructuredShell field={field} fieldKey={fieldKey} hasExisting={hasExisting} prefill={prefill}>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {cards.map((card, idx) => (
          <div key={idx} className="rounded-lg border border-surface-200 p-2.5">
            <p className="text-2xs font-semibold uppercase tracking-wide text-surface-500 mb-2">
              Card {idx + 1}
            </p>
            <label className="block text-xs font-medium text-surface-600 mb-1">Title</label>
            <input
              type="text"
              value={card.title}
              placeholder="e.g. Freeze-Dried Strawberry"
              onChange={(e) => updateCard(idx, 'title', e.target.value)}
              className={fieldInputCls()}
            />
            <label className="block text-xs font-medium text-surface-600 mb-1 mt-2">Link</label>
            <input
              type="text"
              value={card.link}
              placeholder="/product.html?slug=fd-strawberry"
              onChange={(e) => updateCard(idx, 'link', e.target.value)}
              className={fieldInputCls()}
            />
            <label className="block text-xs font-medium text-surface-600 mb-1 mt-2">Image</label>
            <input
              type="text"
              value={card.image}
              placeholder="https://... (leave blank for no image)"
              onChange={(e) => updateCard(idx, 'image', e.target.value)}
              className={fieldInputCls()}
            />
            <div className="mt-2">
              <ImageSourceGroup
                uploading={uploadingIdx === idx}
                onUpload={() => cardInputRefs.current[idx]?.click()}
                onMedia={() => setPickerIdx(idx)}
                uploadLabel="From device"
                mediaLabel="From media"
                className="sm:w-full"
              />
              <input
                ref={(el) => { cardInputRefs.current[idx] = el; }}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleCardFile(idx, f);
                }}
              />
            </div>
            {card.image ? (
              <div className="mt-2 h-20 w-full overflow-hidden rounded-md bg-surface-100">
                <img src={assetUrl(card.image)} alt="" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </div>
            ) : (
              <div className="mt-2 flex h-20 w-full items-center justify-center rounded-md border border-dashed border-surface-300 text-2xs text-surface-400">
                Image placeholder
              </div>
            )}
          </div>
        ))}
      </div>
      <MediaPickerDialog
        open={pickerIdx !== null}
        onClose={() => setPickerIdx(null)}
        onSelect={(u) => {
          if (pickerIdx !== null) updateCard(pickerIdx, 'image', u);
          setPickerIdx(null);
        }}
        context={`Card ${(pickerIdx ?? 0) + 1} image`}
      />
    </StructuredShell>
  );
}
