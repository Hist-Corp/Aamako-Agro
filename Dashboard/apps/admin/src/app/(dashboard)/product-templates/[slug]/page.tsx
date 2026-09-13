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
  /** Last APPROVED body — present when the item has ever been published.
   *  The live storefront (GET /content) renders this, not the draft body. */
  publishedBody?: string;
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
  // Keys of compulsory fields that failed the publish check — rendered with a
  // red ring + inline "Required to publish" note so the editor notices WHERE
  // to fill without hunting for the toast.
  const [missingKeys, setMissingKeys] = useState<string[]>([]);
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
      // Merge the LIVE feed (what the storefront actually shows) with the
      // manage feed (drafts). The live feed only carries published items;
      // joining on key gives each draft its last published body so the
      // "Published theme" strip can compare draft line 1 vs live line 1.
      let liveByKey: Record<string, string> = {};
      try {
        const live = await apiClient.get<Array<{ key: string; body?: string }>>('/content');
        for (const it of live) {
          if (it.key.startsWith(prefix)) liveByKey[it.key.slice(prefix.length)] = it.body ?? '';
        }
      } catch (_) {
        /* live feed is best-effort — the editor works without it */
      }
      const map: Record<string, CmsItem> = {};
      for (const item of data) {
        if (item.key.startsWith(prefix)) {
          const field = item.key.slice(prefix.length);
          map[field] = { ...item, publishedBody: liveByKey[field] };
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
  // Mirror of the latest items so message handlers / debounced callbacks read
  // current values without being re-created on every keystroke.
  const itemsRef = React.useRef(items);
  itemsRef.current = items;

  /** Full draft-aware field map for the preview iframe: { field: {title, body} }. */
  const buildPreviewFields = useCallback(() => {
    const fields: Record<string, { title: string; body: string }> = {};
    for (const [field, item] of Object.entries(itemsRef.current)) {
      if (field.endsWith('__hidden')) continue;
      fields[field] = { title: item.title ?? '', body: item.body ?? '' };
    }
    return fields;
  }, []);

  const postToPreview = useCallback((message: Record<string, unknown>) => {
    try {
      const ifr = document.querySelector<HTMLIFrameElement>('iframe[title="Storefront preview"]');
      ifr?.contentWindow?.postMessage(
        { source: 'aamako-cms-bridge', ...message },
        '*',
      );
    } catch (_) {
      /* a messaging failure must never break the editing workflow */
    }
  }, []);

  // The preview iframe asks for the editor's current values on load (handshake
  // — answers the 'request-fields' message product.html sends in template
  // mode) so it renders the right product from first paint even when every
  // field is still an unpublished draft.
  React.useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const d = e.data as { source?: string; type?: string; slug?: string } | null;
      if (!d || d.source !== 'aamako-cms-bridge') return;
      if (d.type === 'request-fields' && (!d.slug || d.slug === slug)) {
        postToPreview({ type: 'template-fields', slug, fields: buildPreviewFields() });
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [slug, buildPreviewFields, postToPreview]);

  const refreshPreview = useCallback(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => {
      // Push the editor's live values (drafts included) AND nudge the CMS
      // layer — together the preview reflects every edited section instantly.
      postToPreview({ type: 'template-fields', slug, fields: buildPreviewFields() });
      postToPreview({ type: 'content-updated' });
      previewTimer.current = null;
    }, 600);
  }, [slug, buildPreviewFields, postToPreview]);

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
      // If a compulsory field this publish attempt flagged is now being filled,
      // clear its error ring inline — the editor sees the fix land instantly
      // without retrying Publish.
      const itemValue = (isTitle ? value : existing?.title) || (!isTitle ? value : existing?.body) || '';
      if (String(itemValue).trim()) {
        setMissingKeys((prev) => (prev.includes(field) ? prev.filter((k) => k !== field) : prev));
      }
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
    const missingKeyList: string[] = [];
    for (const section of PRODUCT_TEMPLATE_SECTIONS) {
      for (const field of section.fields) {
        if (!field.required) continue;
        const existing = items[field.key];
        const value = (existing?.title || existing?.body || '').trim();
        if (!value) {
          missing.push(field.label);
          missingKeyList.push(field.key);
        }
        if (field.key === 'image-url' && value && !/^https?:\/\/.+/i.test(value)) {
          addToast({
            type: 'error',
            title: 'Invalid product image',
            description: 'The product image must be an https:// URL (paste a link or upload from your device).',
          });
          setMissingKeys(['image-url']);
          return;
        }
      }
    }
    setMissingKeys(missingKeyList);
    if (missing.length > 0) {
      addToast({
        type: 'error',
        title: 'Required fields missing',
        description: `Please fill in: ${missing.join(', ')}. For the product image, paste a URL or upload one from your device.`,
      });
      setActiveSection(0);
      // Scroll to the first missing compulsory field so the editor notices
      // WHERE to fill immediately instead of hunting through sections.
      requestAnimationFrame(() => {
        document
          .querySelector(`[data-field-key="${missingKeyList[0]}"]`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
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
        const item = items[field];
        if (!item) continue;
        // AUTHORITATIVE WRITE: re-save the current editor value before
        // publishing. Auto-save (handleSaveField) fires per keystroke and can
        // silently fail (expired session, race with an upload's setRow, …) —
        // if Publish only flipped the isPublished flag, the previously stored
        // (stale) value would be republished and the storefront would show
        // old images/copy even though the editor showed the new ones. Writing
        // here guarantees the published item matches exactly what the editor
        // displayed when the user pressed Publish.
        await apiClient.put(`/content/${encodeURIComponent(key)}`, {
          title: item.title ?? '',
          body: item.body ?? '',
        });
        await apiClient.post(`/content/${encodeURIComponent(key)}/publish`);
      }
      // Bump the preview iframe now — it normally polls every 10s, but after
      // this explicit publish we want the storefront to reflect edits instantly.
      refreshPreview();

      // Sync the customer-facing catalog record so the real product page
      // (which renders from the DB via /api/products/:slug, not the CMS) shows
      // the published name, image and description too. Best-effort: a missing
      // catalog record must never block a template publish.
      try {
        const rawGallery = (items['gallery']?.body || items['gallery']?.title || '').trim();
        const galleryFirst = rawGallery ? rawGallery.split('\n').map((u) => u.trim()).filter(Boolean)[0] ?? '' : '';
        // The template's "Product images" (gallery) is the source of truth for
        // the product photo across pages — its first image leads. The legacy
        // image-url field is only a fallback.
        const imageUrl = (galleryFirst || items['image-url']?.title || items['image-url']?.body || '').trim();
        const pName = (items['name']?.title || items['name']?.body || '').trim();
        const descHtml = (items['description']?.body || items['description']?.title || '').trim();
        const product = await apiClient.get<{ id?: string }>(`/products/${encodeURIComponent(slug)}`);
        if (product?.id) {
          const patch: Record<string, string> = {};
          if (pName) patch.name = pName;
          if (imageUrl) patch.imageUrl = imageUrl;
          if (descHtml) patch.description = descHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          if (Object.keys(patch).length) await apiClient.patch(`/admin/products/${product.id}`, patch);
        }
      } catch (_) {
        /* catalog sync is optional — the CMS publish above already succeeded */
      }
      addToast({
        type: 'success',
        title: 'Published',
        description: 'Product template published successfully.',
      });
      setMissingKeys([]);
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
              <FieldBlock
                key={field.key}
                field={field}
                items={items}
                onSave={handleSaveField}
                missing={missingKeys.includes(field.key)}
              >
                {renderField(field, items, slug, handleSaveField, defaults, missingKeys.includes(field.key))}
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
  missing: boolean = false,
) {
  return (
    <FieldBlock field={field} items={items} onSave={onSave} missing={missing}>
      {renderFieldInner(field, items, slug, onSave, defaults, missing)}
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
  missing,
  children,
}: {
  field: any;
  items: Record<string, CmsItem>;
  onSave: (field: string, value: string, isTitle: boolean) => void;
  missing?: boolean;
  children: React.ReactNode;
}) {
  const hiddenKey = field.key + '__hidden';
  // The companion content item's title stores the visibility flag. The backend
  // DTO requires title to be non-empty (@MinLength(1)), so we can't use '' for
  // the "visible" state — '' would fail validation and the PUT would 400. We
  // use the explicit string 'visible' for the shown state and 'hidden' for the
  // hidden state, so both directions of the toggle always validate.
  const HIDDEN_MARKER = 'hidden';
  const VISIBLE_MARKER = 'visible';
  const isHidden = (items[hiddenKey]?.title ?? '').trim() === HIDDEN_MARKER;
  const toggleHidden = () =>
    onSave(hiddenKey, isHidden ? VISIBLE_MARKER : HIDDEN_MARKER, true);
  return (
    <div
      data-field-key={field.key}
      className={
        'relative rounded-lg transition-opacity ' +
        (isHidden ? 'border border-dashed border-surface-300 bg-surface-50 opacity-60 ' : '') +
        // Compulsory field flagged by the publish check — a red ring jumps out
        // in the long scroll so the editor spots WHAT to fill at a glance.
        (missing ? 'border-2 border-red-400 bg-red-50/40 p-2' : '')
      }
    >
      {missing && !isHidden && (
        <p className="mb-1 inline-flex items-center gap-1 text-2xs font-semibold text-red-600">
          * Required to publish — fill this field
        </p>
      )}
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

/** Red asterisk marker for compulsory fields — renders next to the label so the
 *  editor sees BEFORE publishing which fields must be filled. Used by every
 *  field renderer (plain inputs, rich text, structured editors, gallery,
 *  image) for a consistent compulsory cue across the template editor. */
function RequiredMark({ required }: { required?: boolean }) {
  if (!required) return null;
  return (
    <span className="ml-0.5 font-bold text-red-500" title="Compulsory — required to publish">
      *
    </span>
  );
}

function renderFieldInner(
  field: any,
  items: Record<string, CmsItem>,
  slug: string,
  onSave: (field: string, value: string, isTitle: boolean) => void,
  defaults: Record<string, string> = {},
  missing: boolean = false,
) {
  const existing = items[field.key];
  const fieldKey = productFieldKey(slug, field.key);
  const prefill = defaults[field.key] ?? '';
  // Provenance for device uploads from this field: files land in the media
  // library under the product's own list, not the generic "General" list.
  const mediaFields = templateMediaFields(slug, items, field.label);
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
        mediaFields={mediaFields}
        onSave={onSave}
        missing={missing}
      />
    );
  }

  if (field.type === 'cert-cards') {
    const value = (existing?.body && existing.body !== '' ? existing.body : existing?.title) ?? prefill;
    return (
      <CertCardsEditor
        field={field}
        fieldKey={fieldKey}
        value={value}
        items={items}
        hasExisting={!!existing}
        prefill={prefill}
        mediaFields={mediaFields}
        onSave={onSave}
        missing={missing}
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
          missing={missing}
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
          missing={missing}
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
          missing={missing}
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
        missing={missing}
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
        mediaFields={mediaFields}
        onSave={onSave}
        missing={missing}
      />
    );
  }

  if (field.type === 'gallery') {
    const raw = (existing?.body ?? existing?.title ?? prefill).trim();
    const urls = raw ? raw.split('\n').map((u: string) => u.trim()).filter(Boolean) : [];
    // Gallery line 1 as the storefront sees it: the published body wins over
    // the local draft, so the "Published theme" strip shows the LIVE image.
    const liveRaw = ((existing as any)?.publishedBody ?? existing?.body ?? '').trim();
    const liveFirst = liveRaw ? liveRaw.split('\n').map((u: string) => u.trim()).filter(Boolean)[0] ?? '' : '';
    return (
      <GalleryEditor
        key={field.key}
        field={field}
        fieldKey={fieldKey}
        urls={urls}
        hasExisting={!!existing}
        mediaFields={mediaFields}
        onSave={onSave}
        missing={missing}
        publishedThemeUrl={liveFirst || undefined}
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
        <label className="block text-xs font-medium text-surface-600 mb-1">{field.label}<RequiredMark required={field.required} /></label>
        <RichTextEditor
          value={html}
          onChange={(h) => onSave(field.key, h, false)}
          placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
          hint={field.description}
        />
        {missing && (
          <p className="mt-1 text-2xs font-semibold text-red-600">* Required to publish — fill this field</p>
        )}
        {prefillBadge()}
        <p className="text-2xs text-surface-400 mt-1">Key: <code>{fieldKey}</code></p>
      </div>
    );
  }

  if (field.type === 'number' || field.type === 'url' || field.type === 'select' || field.type === 'text') {
    const inputInvalidCls = missing ? ' !border-red-400 !ring-2 !ring-red-200' : '';
    return (
      <div key={field.key} className="mb-4">
        <label className="block text-xs font-medium text-surface-600 mb-1">{field.label}<RequiredMark required={field.required} /></label>
        {field.type === 'select' ? (
          <select
            className={"w-full rounded-lg border border-surface-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500" + inputInvalidCls}
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
            className={"w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" + inputInvalidCls}
            placeholder={field.placeholder}
            value={existing?.title ?? prefill}
            onChange={(e) => onSave(field.key, e.target.value, true)}
          />
        )}
        {missing && (
          <p className="mt-1 text-2xs font-semibold text-red-600">* Required to publish — fill this field</p>
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
  mediaFields,
  onSave,
  missing,
  publishedThemeUrl,
}: {
  field: any;
  fieldKey: string;
  urls: string[];
  hasExisting: boolean;
  mediaFields?: Record<string, string>;
  onSave: (field: string, value: string, isTitle: boolean) => void;
  missing?: boolean;
  /** Gallery line 1 as the storefront currently shows it (post-publish).
   *  Drives the "Published theme" strip so the row the dashboard shows
   *  BEFORE publish and the row customers see AFTER publish are the same. */
  publishedThemeUrl?: string;
}) {
  const { addToast } = useToast();
  const [rows, setRows] = useState<string[]>(() => (urls.length ? [...urls] : ['']));
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [pickerIdx, setPickerIdx] = useState<number | null>(null);
  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

  // Re-sync when the saved gallery changes underneath (publish, seed, another
  // tab): without this the editor keeps showing stale rows after Publish.
  const savedKey = urls.join('\n');
  const lastSynced = React.useRef(savedKey);
  React.useEffect(() => {
    if (lastSynced.current !== savedKey) {
      lastSynced.current = savedKey;
      setRows(urls.length ? [...urls] : ['']);
    }
  }, [savedKey, urls]);

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
      const res = await apiClient.upload<{ url: string }>('/admin/media/upload', file, {
        ...mediaFields,
        name: `${mediaFields?.name ?? field.label} — ${idx === 0 ? 'theme image' : `gallery ${idx + 1}`}`,
        sourceSection: `${mediaFields?.sourceSection ?? field.label} · ${idx === 0 ? 'theme image (cards)' : `gallery image ${idx + 1}`}`,
      });
      setRow(idx, res.url);
      addToast({
        type: 'success',
        title: 'Image uploaded',
        description: idx === 0
          ? 'Saved as the theme image — it will show on the product page and every product card after publish.'
          : `Saved as gallery image ${idx + 1}.`,
      });
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
        {field.label}<RequiredMark required={field.required} />
      </label>
      {/* Published theme strip — pinned above the editable rows so the theme
          image stays identifiable as row 1 even after publish / reload. Shows
          the LIVE line 1 the storefront (and every product card) renders, so
          "first row in the dashboard = image in the carts" always holds. */}
      {publishedThemeUrl && (
        <div className="mb-3 flex items-center gap-3 rounded-lg border-2 border-brand-300 bg-brand-50/60 p-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={assetUrl(publishedThemeUrl)}
            alt="Published theme image — shown on storefront + cards"
            className="h-14 w-14 flex-shrink-0 rounded-lg border border-brand-200 object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
          />
          <div className="min-w-0">
            <p className="text-2xs font-bold uppercase tracking-wide text-brand-700">
              ★ Published theme image
            </p>
            <p className="truncate font-mono text-2xs text-surface-500" title={publishedThemeUrl}>
              {publishedThemeUrl}
            </p>
            <p className="text-2xs text-surface-500">
              This is the image live on the storefront &amp; carts.{rows[0] && rows[0] !== publishedThemeUrl ? ' Draft row 1 differs — publish to update it.' : ' Draft row 1 matches.'}
            </p>
          </div>
        </div>
      )}
      <div className="space-y-3">
        {rows.map((url, idx) => (
          <div key={idx} className="flex flex-wrap items-start gap-3 rounded-lg border border-surface-200 p-3">
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={assetUrl(url)}
                alt={idx === 0 ? 'Theme image' : `Gallery image ${idx + 1}`}
                className="h-20 w-20 flex-shrink-0 rounded-lg border border-surface-200 object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
              />
            ) : (
              <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-surface-300 text-2xs text-surface-400">
                {idx === 0 ? 'Theme' : `Image ${idx + 1}`}
              </div>
            )}
            <div className="min-w-[240px] flex-1 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-brand-600">
                  {idx === 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-2 py-0.5 text-2xs font-bold uppercase tracking-wide text-white">
                      ★ Theme image — row 1
                    </span>
                  ) : (
                    `Gallery image ${idx + 1}`
                  )}
                </span>
                <span className="text-2xs text-surface-400">
                  {idx === 0
                    ? 'Product page hero + every product card (Shop, Collections, Related) + carts'
                    : 'Product page gallery thumbnail only'}
                </span>
              </div>
              <input
                type="url"
                className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder={idx === 0 ? 'https://… theme image URL' : `https://… (gallery image ${idx + 1})`}
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
      {missing && (
        <p className="mt-1 text-2xs font-semibold text-red-600">* Required to publish — add at least one image</p>
      )}
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
  mediaFields,
  onSave,
  missing,
}: {
  field: any;
  value: string;
  fieldKey: string;
  mediaFields?: Record<string, string>;
  onSave: (field: string, value: string, isTitle: boolean) => void;
  missing?: boolean;
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
      const res = await apiClient.upload<{ url: string }>('/admin/media/upload', file, {
        ...mediaFields,
        sourceSection: `${mediaFields?.sourceSection ?? field.label} · product image`,
      });
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
        {field.label}<RequiredMark required={field.required} />
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
      {missing && (
        <p className="mt-1 text-2xs font-semibold text-red-600">* Required to publish — add the product image</p>
      )}
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
  missing,
  children,
}: {
  field: any;
  fieldKey: string;
  hasExisting: boolean;
  prefill: string;
  missing?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <label className="block text-xs font-medium text-surface-600 mb-1">{field.label}<RequiredMark required={field.required} /></label>
      {children}
      {missing && (
        <p className="mt-1 text-2xs font-semibold text-red-600">* Required to publish — fill this field</p>
      )}
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
 *  (cross) + free text. Serialized as one line per row: "✓ text" / "✗ text".
 *
 *  WHITESPACE-SAFE: trailing spaces are digits of typing, not dirt. Pressing
 *  Space after a full stop ("…texture.|") must keep the space in the input
 *  immediately, so neither parse nor serialize trims the live text. Trailing
 *  whitespace is only dropped at publish/save boundaries (see handlePublish
 *  + content.controller.ts), never in this render→type→save loop. */
function parseCheckList(value: string): { checked: boolean; text: string }[] {
  return String(value || '')
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => {
      const m = /^([✓✔✗xX])\s*/.exec(l);
      if (!m) return { checked: true, text: l.replace(/^[\s\uFEFF]+/, '') };
      return {
        checked: m[1] !== '✗' && m[1].toLowerCase() !== 'x',
        text: l.slice(m[0].length),
      };
    });
}
function serializeCheckList(rows: { checked: boolean; text: string }[]): string {
  // Lossless round-trip: keep every space the user typed (incl. trailing
  // spaces mid-word like "texture. |"). The save path trims before publish,
  // so storage stays tidy without stealing the spacebar while typing.
  return rows.map((r) => `${r.checked ? '✓' : '✗'} ${r.text}`).join('\n');
}

/** Upload provenance for images added from the product-template editor:
 *  every device upload lands in the media library under the product's own
 *  list ("Freeze-Dried Fruits / <Product>") instead of the generic General
 *  list, with name/alt/page/section metadata so the media page shows where
 *  each photo is used. */
function templateMediaFields(
  slug: string,
  items: Record<string, CmsItem>,
  section: string,
  sub?: string,
): Record<string, string> {
  const process = (items['process-category']?.title ?? '').trim();
  const catLabel =
    process === 'dehydrated' ? 'Dehydrated' : process === 'powders' ? 'Powders' : 'Freeze-Dried Fruits';
  const rawName = (items['name']?.title ?? '').trim();
  const fallback = slug
    .replace(/^(fd|dh|pw)-/, '')
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  const productName = rawName && rawName.toLowerCase() !== 'name' ? rawName : fallback || slug;
  return {
    name: sub ? `${productName} — ${sub}` : productName,
    altText: `${productName} — ${section}`,
    category: `${catLabel} / ${productName}`,
    sourcePage: 'Product Detail',
    sourceSection: `${catLabel} · ${section}`,
  };
}

/** Certifications — one certificate per row: a name input plus an attached
 *  image picker per row. Names serialize to the "certifications" field
 *  (one per line); each row's image saves to its own "cert-image-N" item so
 *  the storefront card picks it up. Empty image = default icon on the page. */
function CertCardsEditor({
  field,
  fieldKey,
  value,
  items,
  hasExisting,
  prefill,
  mediaFields,
  onSave,
  missing,
}: {
  field: any;
  fieldKey: string;
  value: string;
  items: Record<string, CmsItem>;
  hasExisting: boolean;
  prefill: string;
  mediaFields?: Record<string, string>;
  onSave: (field: string, value: string, isTitle: boolean) => void;
  missing?: boolean;
}) {
  const names = String(value || '').split('\n');
  // Drop only the trailing BLANK lines (so empty tail rows collapse) — keep
  // every space the user typed inside a row.
  while (names.length && names[names.length - 1].trim() === '') names.pop();
    const commit = (next: string[]) => {
    // Lossless round-trip: keep every typed space; drop only blank trailing
    // rows. The save path trims before publish, never while typing.
    const lines = next.slice();
    while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
    // body-first (see CheckListEditor note) — the seed stores cert names in body
    onSave(field.key, lines.join('\n'), false);
  };
  return (
    <StructuredShell field={field} fieldKey={fieldKey} hasExisting={hasExisting} prefill={prefill} missing={missing}>
      <div className="space-y-2">
        {names.length === 0 && (
          <p className="text-2xs text-surface-400 py-2">No certificates yet — add one below.</p>
        )}
        {names.map((name, i) => (
          <div key={i} className="rounded-lg border border-surface-200 bg-white p-2.5">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-surface-100 font-mono text-2xs text-surface-500">
                {i + 1}
              </span>
              <input
                value={name}
                placeholder="Certificate name (e.g. DFTQC-compliant facility)"
                onChange={(e) => {
                  const next = names.slice();
                  next[i] = e.target.value;
                  commit(next);
                }}
                className={fieldInputCls()}
              />
              {removeRowButton(() => {
                const next = names.slice();
                next.splice(i, 1);
                commit(next);
                // Detach the row's image so lower images don't shift onto the wrong card.
                for (let n = i + 1; n <= next.length + 1; n++) onSave(`cert-image-${n}`, '', true);
              })}
            </div>
            <CertImagePicker
              index={i + 1}
              value={(items[`cert-image-${i + 1}`]?.title ?? '').trim()}
              mediaFields={mediaFields}
              onSave={onSave}
            />
          </div>
        ))}
      </div>
      {addRowButton('Add certificate', () => commit([...names, '']))}
    </StructuredShell>
  );
}

/** Compact image picker for one certificate card: thumbnail preview, URL
 *  input, device upload and media library. Saves to the "cert-image-N" item. */
function CertImagePicker({
  index,
  value,
  mediaFields,
  onSave,
}: {
  index: number;
  value: string;
  mediaFields?: Record<string, string>;
  onSave: (field: string, value: string, isTitle: boolean) => void;
}) {
  const { addToast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const key = `cert-image-${index}`;

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
      const res = await apiClient.upload<{ url: string }>('/admin/media/upload', file, {
        ...mediaFields,
        name: `${mediaFields?.name ?? 'Certificate'} — certificate ${index}`,
        sourceSection: `${mediaFields?.sourceSection ?? 'Certifications'} · certificate ${index} image`,
      });
      onSave(key, res.url, true);
      addToast({ type: 'success', title: 'Image uploaded', description: `Attached to certificate ${index}.` });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed — please try again.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="mt-2 flex items-start gap-2 pl-7">
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={assetUrl(value)}
          alt={`Certificate ${index}`}
          className="h-12 w-12 flex-shrink-0 rounded-full border border-surface-200 object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
        />
      ) : (
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border border-dashed border-surface-300 text-2xs text-surface-400">
          icon
        </div>
      )}
      <div className="min-w-0 flex-1 space-y-1.5">
        <input
          type="url"
          className="w-full rounded-lg border border-surface-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="Image URL (optional — e.g. a scan of the certificate)"
          value={value}
          onChange={(e) => onSave(key, e.target.value, true)}
        />
        <ImageSourceGroup
          uploading={uploading}
          onUpload={() => inputRef.current?.click()}
          onMedia={() => setPickerOpen(true)}
          uploadLabel="From device"
          mediaLabel="Media library"
        />
        {error && <p className="text-2xs font-medium text-red-600">{error}</p>}
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
      <MediaPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(u) => onSave(key, u, true)}
        context={`Certificate ${index} image`}
      />
    </div>
  );
}

function CheckListEditor({
  field,
  fieldKey,
  value,
  hasExisting,
  prefill,
  onSave,
  missing,
}: {
  field: any;
  fieldKey: string;
  value: string;
  hasExisting: boolean;
  prefill: string;
  onSave: (field: string, value: string, isTitle: boolean) => void;
  missing?: boolean;
}) {
  const rows = parseCheckList(value);
  // Write to BODY (isTitle=false): the editor and the storefront both read
  // body-first for structured fields (the seed stores highlights copy in
  // body). Saving into title made edits invisible — the input kept showing
  // the untouched body and looked "not editable".
    // Debounce so each keystroke doesn't trigger an API PUT + state update +
  // re-render; that re-render re-parsed the serialized value and the .trim()
  // in serializeCheckList snapped trailing/inter-word spaces out of the
  // controlled input. Writing after a pause keeps the typed space intact.
  const saveDebouncedRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const commit = (next: { checked: boolean; text: string }[]) => {
    if (saveDebouncedRef.current) clearTimeout(saveDebouncedRef.current);
    saveDebouncedRef.current = setTimeout(() => onSave(field.key, serializeCheckList(next), false), 300);
  };
  return (
    <StructuredShell field={field} fieldKey={fieldKey} hasExisting={hasExisting} prefill={prefill} missing={missing}>
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
  const blocks = String(value || '').split(/\n\s*\n/).filter((b) => b.trim() !== '');
  const rows: { label: string; value: string }[] = [];
  let note = '';
  (blocks[0] ?? '').split('\n').forEach((rawL) => {
    const l = rawL.replace(/^[\s\uFEFF]+/, '');
    const i = l.indexOf(':');
    if (i > 0) rows.push({ label: l.slice(0, i), value: l.slice(i + 1).replace(/^\s/, '') });
  });
  if (blocks.length > 1) note = blocks.slice(1).join('\n\n').replace(/^[\s\uFEFF]+/, '');
  if (blocks.length === 1 && blocks[0].split('\n').some((l) => l.indexOf(':') <= 0)) {
    note = blocks[0].split('\n').filter((l) => l.indexOf(':') <= 0).join('\n').replace(/^[\s\uFEFF]+/, '');
  }
  return { rows, note };
}
function serializeNutritionRows(rows: { label: string; value: string }[], note: string): string {
  // Lossless round-trip: keep every typed space (incl. trailing "…kcal |");
  // trim only for emptiness checks so blank rows still collapse.
  const lines = rows.filter((r) => r.label.trim() || r.value.trim()).map((r) => `${r.label.replace(/^\s+/, '')}: ${r.value.replace(/^\s/, '')}`);
  const keepNote = note.trim() ? note.replace(/^[\s\uFEFF]+/, '') : '';
  return lines.length ? lines.join('\n') + (keepNote ? '\n\n' + keepNote : '') : keepNote;
}

function NutritionRowsEditor({
  field,
  fieldKey,
  value,
  hasExisting,
  prefill,
  onSave,
  missing,
}: {
  field: any;
  fieldKey: string;
  value: string;
  hasExisting: boolean;
  prefill: string;
  onSave: (field: string, value: string, isTitle: boolean) => void;
  missing?: boolean;
}) {
  const parsed = parseNutritionRows(value);
    const saveDebouncedRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const save = (rows: { label: string; value: string }[], note: string) => {
    if (saveDebouncedRef.current) clearTimeout(saveDebouncedRef.current);
    saveDebouncedRef.current = setTimeout(() => onSave(field.key, serializeNutritionRows(rows, note), false), 300);
  };
  return (
    <StructuredShell field={field} fieldKey={fieldKey} hasExisting={hasExisting} prefill={prefill} missing={missing}>
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
    .filter((b) => b.trim() !== '')
    .map((b) => {
      // Whitespace-safe: never trim the live text — keep trailing spaces the
      // user typed (e.g. "…texture. |") so the spacebar works while typing.
      const lines = b.split('\n');
      let q = '';
      const a: string[] = [];
      lines.forEach((rawL, idx) => {
        const l = idx === 0 ? rawL.replace(/^[\s\uFEFF]+/, '') : rawL;
        const qm = /^Q\s*[:.]?\s*/i.exec(l);
        const am = /^A\s*[:.]?\s*/i.exec(l);
        if (qm && !q) q = l.slice(qm[0].length);
        else if (am) a.push(l.slice(am[0].length));
        else if (!q) q = l;
        else a.push(l);
      });
      return { q, a: a.join('\n') };
    });
}
function serializeFaqPairs(rows: { q: string; a: string }[]): string {
  // Lossless round-trip: keep every typed space; trim only for the
  // empty-row check so blank cards still collapse.
  return rows.filter((r) => r.q.trim() || r.a.trim()).map((r) => `Q: ${r.q.replace(/^\s+/, '')}\nA: ${r.a.replace(/^\s+/, '')}`).join('\n\n');
}

function FaqPairsEditor({
  field,
  fieldKey,
  value,
  hasExisting,
  prefill,
  onSave,
  missing,
}: {
  field: any;
  fieldKey: string;
  value: string;
  hasExisting: boolean;
  prefill: string;
  onSave: (field: string, value: string, isTitle: boolean) => void;
  missing?: boolean;
}) {
  const rows = parseFaqPairs(value);
    const saveDebouncedRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const save = (next: { q: string; a: string }[]) => {
    if (saveDebouncedRef.current) clearTimeout(saveDebouncedRef.current);
    saveDebouncedRef.current = setTimeout(() => onSave(field.key, serializeFaqPairs(next), false), 300);
  };
  return (
    <StructuredShell field={field} fieldKey={fieldKey} hasExisting={hasExisting} prefill={prefill} missing={missing}>
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
    .filter((b) => b.trim() !== '')
    .forEach((b) => {
      // Strip only leading blank lines; keep trailing spaces the user typed.
      const clean = b.replace(/^[\s\uFEFF]+/, '');
      const m = /^([A-Za-z]+)\s*:\s*/.exec(clean);
      if (!m) return;
      const key = m[1].toLowerCase();
      if (key === 'usage' || key === 'recipes' || key === 'storage') out[key] = clean.slice(m[0].length);
    });
  return out;
}
function serializeHowtoBlocks(v: { usage: string; recipes: string; storage: string }): string {
  // Lossless round-trip: keep every typed space (incl. "texture. |") so the
  // spacebar works mid-sentence. Trailing whitespace is trimmed at publish,
  // never while typing.
  const blocks: string[] = [];
  if (v.usage.trim()) blocks.push(`Usage: ${v.usage.replace(/^\s+/, '')}`);
  if (v.recipes.trim()) blocks.push(`Recipes: ${v.recipes.replace(/^\s+/, '')}`);
  if (v.storage.trim()) blocks.push(`Storage: ${v.storage.replace(/^\s+/, '')}`);
  return blocks.join('\n\n');
}

/** Related cards — up to 4 { title, link, image } triples serialized as
 *  "Card 1 title: ...\nCard 1 link: ...\nCard 1 image: ...". */
function parseRelatedCards(value: string): { title: string; link: string; image: string }[] {
  const cards = Array.from({ length: 4 }, () => ({ title: '', link: '', image: '' }));
  String(value || '')
    .split(/\n\s*\n/)
    .filter((b) => b.trim() !== '')
    .forEach((b) => {
      // Whitespace-safe: keep trailing spaces the user typed in card fields.
      const clean = b.replace(/^[\s\uFEFF]+/, '');
      const m = /^Card\s*(\d+)\s*(title|link|image)\s*:\s*/i.exec(clean);
      if (!m) return;
      const idx = parseInt(m[1], 10) - 1;
      if (idx < 0 || idx > 3) return;
      const val = clean.slice(m[0].length);
      const key = m[2].toLowerCase() as 'title' | 'link' | 'image';
      cards[idx][key] = val;
    });
  return cards;
}
function serializeRelatedCards(cards: { title: string; link: string; image: string }[]): string {
  const blocks: string[] = [];
  cards.forEach((c, i) => {
    if (c.title.trim() || c.link.trim() || c.image.trim()) {
      blocks.push(`Card ${i + 1} title: ${c.title.replace(/^\s+/, '')}\nCard ${i + 1} link: ${c.link.replace(/^\s+/, '')}\nCard ${i + 1} image: ${c.image.replace(/^\s+/, '')}`);
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
  missing,
}: {
  field: any;
  fieldKey: string;
  value: string;
  hasExisting: boolean;
  prefill: string;
  onSave: (field: string, value: string, isTitle: boolean) => void;
  missing?: boolean;
}) {
  const v = parseHowtoBlocks(value);
    const saveDebouncedRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const save = (next: { usage: string; recipes: string; storage: string }) => {
    if (saveDebouncedRef.current) clearTimeout(saveDebouncedRef.current);
    saveDebouncedRef.current = setTimeout(() => onSave(field.key, serializeHowtoBlocks(next), false), 300);
  };
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
    <StructuredShell field={field} fieldKey={fieldKey} hasExisting={hasExisting} prefill={prefill} missing={missing}>
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
  mediaFields,
  onSave,
  missing,
}: {
  field: any;
  fieldKey: string;
  value: string;
  hasExisting: boolean;
  prefill: string;
  mediaFields?: Record<string, string>;
  onSave: (field: string, value: string, isTitle: boolean) => void;
  missing?: boolean;
}) {
  const { addToast } = useToast();
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [pickerIdx, setPickerIdx] = useState<number | null>(null);
  const cardInputRefs = React.useRef<(HTMLInputElement | null)[]>([]);
  const cards = parseRelatedCards(value);
  const save = (next: { title: string; link: string; image: string }[]) =>
    onSave(field.key, serializeRelatedCards(next), false);

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
      const res = await apiClient.upload<{ url: string }>('/admin/media/upload', file, {
        ...mediaFields,
        name: `${mediaFields?.name ?? field.label} — related card ${idx + 1}`,
        sourceSection: `${mediaFields?.sourceSection ?? field.label} · related card ${idx + 1} image`,
      });
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
    <StructuredShell field={field} fieldKey={fieldKey} hasExisting={hasExisting} prefill={prefill} missing={missing}>
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
