'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/config/auth-context';
import { canAct } from '@/config/rbac';
import { apiClient, ApiError } from '@/lib/api-client';
import {
  collectionCategorySections,
  getSitePage,
  mediaCategoryForPage,
  storefrontUrl,
  type SitePage,
  type PageTemplateSection,
} from '@/config/pages';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** Compact byte formatter for upload-toast size reporting (e.g. "2.4 MB"). */
function formatBytesCompat(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  const kb = bytes / 1024;
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(kb))} KB`;
}
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  EyeOff,
  FolderOpen,
  ImagePlus,
  LayoutTemplate,
  Library,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  FileText,
  Globe,
  Trash2,
  X,
} from 'lucide-react';

interface CmsItem {
  id: string;
  key: string;
  title: string;
  shortDescription: string | null;
  longDescription: string | null;
  body: string;
  isPublished: boolean;
  isVisible: boolean;
  updatedAt: string;
}

interface PendingRevision {
  id: string;
  contentItemId: string;
  proposedTitle: string;
  status: string;
  createdAt: string;
  contentItem: { key: string; title: string };
}

/** One switchable category page on the Product Category template. */
interface CategoryOption {
  /** DB id — present for live API data; absent in the offline fallback (rename disabled). */
  id?: string;
  name: string;
  slug: string;
  products: number;
}

/** Fallback if the categories API is unreachable — the three seeded storefront categories. */
const FALLBACK_CATEGORIES: CategoryOption[] = [
  { name: 'Freeze-Dried Fruits & Vegetables', slug: 'freeze-dried-fruits', products: 0 },
  { name: 'Dehydrated Fruits & Vegetables', slug: 'dehydrated', products: 0 },
  { name: 'Milled Powders', slug: 'powders', products: 0 },
];

interface FormState {
  title: string;
  shortDescription: string;
  longDescription: string;
  body: string;
}
const EMPTY_FORM: FormState = { title: '', shortDescription: '', longDescription: '', body: '' };

/** True when two forms describe identical content (a draft equals its saved
 *  item). Used to decide which sections actually have unsaved changes. */
function formsEqual(a: FormState, b: FormState): boolean {
  return (
    a.title === b.title &&
    a.shortDescription === b.shortDescription &&
    a.longDescription === b.longDescription &&
    a.body === b.body
  );
}

function toForm(item: CmsItem): FormState {
  return {
    title: item.title ?? '',
    shortDescription: item.shortDescription ?? '',
    longDescription: item.longDescription ?? '',
    body: item.body ?? '',
  };
}
/** Edit a website page template with a LIVE preview of the real page.
 *  Left pane: pick a printable section and edit its fields. Right pane: the
 *  actual storefront page in an iframe so changes are seen in context. */
export default function PageEditor() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;
  const { user } = useAuth();
  const router = useRouter();
  const { addToast } = useToast();

  const page = useMemo<SitePage | undefined>(() => (slug ? getSitePage(slug) : undefined), [slug]);
  // The Product Category template previews the shared collection page — offer a
  // switcher between the individual category pages.
  const isCategoryTemplate = page?.slug === 'product-category';

  const [items, setItems] = useState<CmsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  /** Local draft store — one entry per section that has been touched since
   *  the last publish. Keeps edits alive while the user hops between sections
   *  so they can make ALL their changes first and publish everything at once
   *  with "Save & publish all" (or save a single section whenever they want). */
  const [drafts, setDrafts] = useState<Record<string, FormState>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [pending, setPending] = useState<PendingRevision[]>([]);
  const [frameTick, setFrameTick] = useState(0);
  /** Brief spin animation for the "Reload preview" control. */
  const [isRefreshing, setIsRefreshing] = useState(false);
  const reloadPreview = useCallback(() => {
    setFrameTick((t) => t + 1);
    setIsRefreshing(true);
    window.setTimeout(() => setIsRefreshing(false), 900);
  }, []);
  // Product Category template: which category page (collection.html?cat=…) the
  // live preview shows. Defaults to the first seeded category — there is no
  // separate "all products" page, so the preview always targets a real category.
  const [categorySlug, setCategorySlug] = useState('freeze-dried-fruits');
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  // Inline rename of a category page (display name only — slugs/links stay stable).
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  // "Add category page" — inline creation of a brand-new category. The company
  // can decide to add a new product category any time; the new page is born
  // with the SAME template and the editor switches to it so contents can be
  // replaced right away.
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatSlug, setNewCatSlug] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  // Content Managers always go through the moderation queue — their save
  // button submits for Manager approval rather than publishing directly.
  const isContentManager = user?.role === 'CONTENT_MANAGER';

  const allowed = !!user && canAct(user.role, 'pages:view');

  // Guard + initial load
  useEffect(() => {
    if (!user) return;
    if (!allowed) {
      router.replace('/dashboard');
      return;
    }
    if (!page) return;
    (async () => {
      setIsLoading(true);
      try {
        const data = await apiClient.get<CmsItem[]>('/content/manage');
        setItems(data);
        try {
          const revs = await apiClient.get<PendingRevision[]>('/content/revisions');
          setPending(revs);
        } catch {
          /* queue visibility is best-effort */
        }
        const firstKey = page.sections[0]?.key ?? null;
        setActiveKey(firstKey);
        if (firstKey) {
          const loaded = data.find((i) => i.key === firstKey);
          setForm(loaded ? toForm(loaded) : EMPTY_FORM);
        }
      } catch (err) {
        addToast({
          type: 'error',
          title: 'Could not load page template',
          description: err instanceof ApiError ? err.message : 'Unexpected error',
        });
      } finally {
        setIsLoading(false);
      }
    })();
  }, [user, allowed, router, page, addToast]);

  // Auto-capture the active section's buffered form into the draft store on
  // every edit — this is what lets the user make changes, hop to the next
  // section and keep going without saving each section first. Idempotent:
  // identical drafts are left untouched so the dirty computation stays lean.
  useEffect(() => {
    if (!activeKey) return;
    setDrafts((prev) => {
      const current = prev[activeKey];
      if (current && formsEqual(current, form)) return prev;
      return { ...prev, [activeKey]: form };
    });
  }, [activeKey, form]);

  // Product Category template: load the storefront categories (with product
  // counts) so the preview can be switched between the category pages.
  useEffect(() => {
    if (!isCategoryTemplate) return;
    let cancelled = false;
    apiClient
      .get<Array<{ id: string; name: string; slug: string; _count?: { products?: number } }>>('/categories')
      .then((data) => {
        if (cancelled) return;
        setCategories(
          (data ?? []).map((c) => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
            products: c._count?.products ?? 0,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setCategories(FALLBACK_CATEGORIES);
      });
    return () => {
      cancelled = true;
    };
  }, [isCategoryTemplate]);

  /** Map the raw categories API payload to the chip/option shape. */
  const mapCategories = (
    data: Array<{ id: string; name: string; slug: string; _count?: { products?: number } }>,
  ): CategoryOption[] =>
    (data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      products: c._count?.products ?? 0,
    }));

  // Product Category template: extend the shared template with per-category
  // sections for the category currently selected in the preview. The template
  // itself never changes — every category (including brand-new pages added
  // below) just gets its own heading/intro edition, so contents are replaced
  // per category while the layout stays identical.
  const allSections = useMemo<PageTemplateSection[]>(() => {
    if (!page) return [];
    if (!isCategoryTemplate || !categorySlug) return page.sections;
    const catSections = collectionCategorySections(categorySlug);
    const footerIdx = page.sections.findIndex((s) => s.group === 'Footer (global)');
    if (footerIdx === -1) return [...page.sections, ...catSections];
    return [
      ...page.sections.slice(0, footerIdx),
      ...catSections,
      ...page.sections.slice(footerIdx),
    ];
  }, [page, isCategoryTemplate, categorySlug]);

  const selectSection = (section: PageTemplateSection) => {
    // Mid-upload / mid-save switches would mis-associate in-flight changes —
    // wait for the operation to finish before moving on.
    if (isSaving || isUploadingImage) return;
    // Snapshot the current buffer before leaving, then load the next section
    // preferring its DRAFT (unsaved edits) over the last-saved item.
    if (activeKey) setDrafts((prev) => ({ ...prev, [activeKey]: form }));
    setActiveKey(section.key);
    const loaded = items.find((i) => i.key === section.key);
    setForm(drafts[section.key] ?? (loaded ? toForm(loaded) : EMPTY_FORM));
  };

  // Click-to-select: the storefront preview page runs the CMS editor bridge
  // (js/content.js) which postMessages the content key of any [data-cms]
  // element the user clicks in the live preview. Select that section here so
  // EVERY section of the page is reachable — including ones far down the page
  // that are inconvenient to pick from the chip list. Keys that exist on the
  // page but aren't part of the template yet still open as generic sections,
  // so every tagged element in the preview is selectable and editable.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const d = e.data as { source?: string; type?: string; key?: string } | null;
      if (!d || d.source !== 'aamako-cms-bridge') return;
      if (d.type === 'untagged-click') {
        addToast({
          type: 'info',
          title: 'Not an editable section',
          description:
            'That part of the page is static (navigation, buttons, images). Click a highlighted section instead — text content is outlined on hover.',
        });
        return;
      }
      if (d.type !== 'section-click') return;
      const key = String(d.key ?? '');
      if (!key) return;
      const section = allSections.find((s) => s.key === key);
      if (section) {
        selectSection(section);
        return;
      }
      // Generic fallback: the key exists in the live preview but has no
      // template entry — still make it selectable and editable.
      const friendly = key
        .split('.')
        .pop()!
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
      selectSection({ key, label: friendly, description: `Custom content section (${key}).` });
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, items]);

  const foundItem = useMemo(
    () => items.find((i) => i.key === activeKey) ?? null,
    [items, activeKey],
  );
  const activeSection = useMemo(
    () => allSections.find((s) => s.key === activeKey) ?? null,
    [allSections, activeKey],
  );
  const isNew = activeKey != null && !foundItem;
  const activePending = useMemo(
    () => pending.filter((r) => r.contentItem.key === activeKey),
    [pending, activeKey],
  );

  /** Sections whose draft differs from the saved item (or brand-new sections
   *  that actually have content) — i.e. everything "Save & publish all" will
   *  commit. Not-touched sections never appear here. */
  const dirtyKeys = useMemo(() => {
    if (Object.keys(drafts).length === 0) return [] as string[];
    const out: string[] = [];
    for (const [key, draft] of Object.entries(drafts)) {
      const item = items.find((i) => i.key === key);
      if (!item) {
        // Brand-new section — only counts once it has real content.
        if (
          draft.title.trim() ||
          draft.shortDescription.trim() ||
          draft.longDescription.trim() ||
          draft.body.trim()
        ) {
          out.push(key);
        }
        continue;
      }
      if (!formsEqual(toForm(item), draft)) out.push(key);
    }
    return out;
  }, [drafts, items]);
  const dirtyKeySet = useMemo(() => new Set(dirtyKeys), [dirtyKeys]);
  const dirtyCount = dirtyKeys.length;

  // Save the active section AND publish it in one step, then commit any
  // pending page-hide/unhide the user toggled. Single source of truth for "make
  // my edits live": Hide/Unhide is just an intent, Save & publish acts on it.
  const handleSaveAndPublish = async () => {
    if (!activeKey) return;
    // Image sections carry their value (an image URL) in `body` — the title is
    // optional and defaults to the section label so records stay readable.
    const isImageSection = activeSection?.kind === 'image';
    const effectiveTitle =
      isImageSection && !form.title.replace(/<[^>]*>/g, '').trim()
        ? activeSection?.label ?? 'Image'
        : form.title;
    if (!effectiveTitle.replace(/<[^>]*>/g, '').trim()) {
      addToast({ type: 'error', title: 'Title required', description: 'Give this section a title.' });
      return;
    }
    setIsSaving(true);
    try {
      const res = await apiClient.put<{ live?: boolean; message?: string }>(
        `/content/${encodeURIComponent(activeKey)}`,
        {
          title: effectiveTitle.trim(),
          shortDescription: form.shortDescription,
          longDescription: form.longDescription,
          body: form.body,
        },
      );
      await apiClient.post(`/content/${encodeURIComponent(activeKey)}/publish`);
      addToast({
        type: 'success',
        title: isNew ? 'Template section created & published' : 'Template section saved & published',
        description: activeKey,
      });
      const data = await apiClient.get<CmsItem[]>('/content/manage');
      setItems(data);
      // This section is now committed — drop its draft so the "edited" badge
      // and the publish-all count stay accurate.
      if (activeKey) setDrafts((prev) => {
        const next = { ...prev };
        delete next[activeKey];
        return next;
      });
      try {
        const revs = await apiClient.get<PendingRevision[]>('/content/revisions');
        setPending(revs);
      } catch {
        /* best-effort */
      }
      await commitPendingVisibility();
      setFrameTick((t) => t + 1);
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Save & publish failed',
        description: err instanceof ApiError ? err.message : 'Unexpected error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Batch publish: publish every section with unsaved edits in one pass.
  // Managers/Admins go live immediately; Content Managers submit all of them
  // for approval at once (one button press instead of one per section). The
  // existing single-section flow stays available for quick edits.
  const saveOrder = useMemo(() => {
    const order: string[] = [];
    for (const s of allSections) if (dirtyKeySet.has(s.key)) order.push(s.key);
    for (const k of dirtyKeys) if (!order.includes(k)) order.push(k);
    return order;
  }, [allSections, dirtyKeySet, dirtyKeys]);

  const handleSaveAllDrafts = async () => {
    if (isSaving) return;
    const keys = saveOrder;
    if (keys.length === 0 && pendingHidden === null) return;

    setIsSaving(true);
    const published: string[] = [];
    const failed: Array<{ key: string; reason?: string }> = [];
    try {
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const draft = drafts[key];
        if (!draft) continue;
        const section = allSections.find((s) => s.key === key);
        const isImageSection = section?.kind === 'image';
        const effectiveTitle =
          isImageSection && !draft.title.replace(/<[^>]*>/g, '').trim()
            ? section?.label ?? 'Image'
            : draft.title;
        if (!effectiveTitle.replace(/<[^>]*>/g, '').trim()) {
          failed.push({ key, reason: 'title required' });
          continue;
        }
        try {
          await apiClient.put(`/content/${encodeURIComponent(key)}`, {
            title: effectiveTitle.trim(),
            shortDescription: draft.shortDescription,
            longDescription: draft.longDescription,
            body: draft.body,
          });
          await apiClient.post(`/content/${encodeURIComponent(key)}/publish`);
          published.push(key);
        } catch (err) {
          failed.push({ key, reason: err instanceof ApiError ? err.message : 'unknown error' });
        }
      }

      if (pendingHidden !== null && pendingHidden !== pageIsHidden) {
        try {
          await commitPendingVisibility();
        } catch {
          /* individual visibility failures surface in the summary toast below */
        }
      }

      const data = await apiClient.get<CmsItem[]>('/content/manage');
      setItems(data);
      setDrafts((prev) => {
        let next = prev;
        for (const k of published) {
          if (!next[k]) continue;
          if (next === prev) next = { ...prev };
          delete next[k];
        }
        return next;
      });
      try {
        const revs = await apiClient.get<PendingRevision[]>('/content/revisions');
        setPending(revs);
      } catch {
        /* best-effort */
      }
      setFrameTick((t) => t + 1);

      const savedCount = published.length;
      if (failed.length === 0) {
        addToast({
          type: 'success',
          title:
            savedCount === 0
              ? 'Page visibility updated'
              : isContentManager
                ? `${savedCount} section${savedCount === 1 ? '' : 's'} submitted for approval`
                : `${savedCount} section${savedCount === 1 ? '' : 's'} saved & published`,
          description:
            savedCount === 0
              ? 'No section content changed — your page hide/show setting was applied.'
              : isContentManager
                ? 'All your changes are in the review queue — they appear on the storefront once a Manager approves them.'
                : 'All changes are now live on the storefront.',
        });
      } else {
        addToast({
          type: 'warning',
          title: `${savedCount} saved · ${failed.length} failed`,
          description: failed.map((f) => `${f.key}${f.reason ? ` (${f.reason})` : ''}`).join(' · '),
        });
      }
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Save & publish all failed',
        description: err instanceof ApiError ? err.message : 'Unexpected error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  /** Keep the current section's edits as a draft and move to the next one —
   *  nothing is saved to the site yet; "Save & publish all" commits everything
   *  when the user is done. */
  const handleKeepAndNext = () => {
    if (isSaving || isUploadingImage || !activeKey) return;
    const idx = allSections.findIndex((s) => s.key === activeKey);
    const next = allSections[(idx + 1) % allSections.length];
    if (next && next.key !== activeKey) selectSection(next);
  };

  /** Drop every unsaved edit for this page (confirm first). Nothing touches
   *  the site — sections keep whatever was last published. */
  const handleDiscardDrafts = () => {
    if (dirtyCount === 0) return;
    const ok = window.confirm(
      'Discard all unsaved section changes for this page?\n\n' +
        'Sections already on the site stay exactly as they are — only your unpublished edits will be thrown away.',
    );
    if (!ok) return;
    setDrafts({});
    if (activeKey) {
      const loaded = items.find((i) => i.key === activeKey);
      setForm(loaded ? toForm(loaded) : EMPTY_FORM);
    }
    addToast({ type: 'info', title: 'Unsaved changes discarded', description: 'The page keeps its last published state.' });
  };

  // ── Image sections: upload from the local device or pick from the media
  // library. The chosen URL is stored in the section body and published with
  // the standard save flow; fresh uploads are registered in the media library
  // tagged with the page and section they came from.
  interface MediaSummary {
    id: string;
    name: string;
    url: string;
    category: string;
    isPublished: boolean;
    createdAt: string;
  }
  const isImageSection = activeSection?.kind === 'image';
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [libraryImages, setLibraryImages] = useState<MediaSummary[]>([]);
  const [libraryQuery, setLibraryQuery] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  /** The image URL this section currently points at (stored raw in `body`). */
  const currentImageUrl = useMemo(() => {
    const m = form.body.match(/<img[^>]*src=["']([^"']+)["']/i);
    return (m?.[1] ?? form.body).trim();
  }, [form.body]);

  const loadLibraryImages = useCallback(async () => {
    try {
      const data = await apiClient.get<MediaSummary[]>('/admin/media?type=IMAGE');
      setLibraryImages(data);
    } catch {
      addToast({ type: 'error', title: 'Could not load media library', description: 'Try again in a moment.' });
    }
  }, [addToast]);

  useEffect(() => {
    if (pickerOpen) void loadLibraryImages();
  }, [pickerOpen, loadLibraryImages]);

  const uploadImageFile = useCallback(
    async (file: File) => {
      if (!activeSection) return;
      if (!file.type.startsWith('image/')) {
        addToast({ type: 'error', title: 'Images only', description: `${file.name} is not an image file.` });
        return;
      }
      if (file.size > 25 * 1024 * 1024) {
        addToast({ type: 'error', title: 'Image too large', description: `${file.name} is larger than 25 MB.` });
        return;
      }
      setIsUploadingImage(true);
      try {
        const res = await apiClient.upload<{
          url: string;
          name?: string;
          size: number;
          originalSize?: number;
          optimized?: boolean;
          dimensions?: string;
        }>('/admin/media/upload', file);
        const kb = res.size / 1024;
        const sizeLabel = kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(kb))} KB`;
        // File the image under this page's media category so the library stays
        // organized by website page (Home, Shop, Product Category, …) and the
        // storefront can pull matching images into its empty image slots.
        const mediaCategory = mediaCategoryForPage(page?.slug);
        await apiClient.post('/admin/media', {
          name: file.name,
          url: res.url,
          category: mediaCategory,
          altText: activeSection.label,
          size: sizeLabel,
          sourcePage: page?.name ?? page?.slug ?? '',
          sourceSection: activeSection.label,
        });
        setForm((f) => ({ ...f, body: res.url }));
        const optimizedNote =
          res.optimized && res.originalSize && res.originalSize > res.size
            ? ` · auto-optimized ${formatBytesCompat(res.originalSize)} → ${formatBytesCompat(res.size)} (${Math.round(((res.originalSize - res.size) / res.originalSize) * 100)}% smaller, same look)`
            : '';
        addToast({
          type: 'success',
          title: 'Image uploaded to media library',
          description: `${file.name} · filed under “${mediaCategory}” — ${activeSection.label}${optimizedNote}. It's kept as a draft — press “Save & publish section” now or “Save & publish all” when you're done with the page.`,
        });
      } catch (err) {
        addToast({
          type: 'error',
          title: 'Upload failed',
          description: err instanceof ApiError ? err.message : 'Unexpected error',
        });
      } finally {
        setIsUploadingImage(false);
      }
    },
    [activeSection, page, addToast],
  );

  // Hide/show a section on the storefront without deleting it. The layout
  // reflows (the page stays responsive) and the section can be restored anytime.
  const handleToggleVisible = async () => {
    if (!activeKey || !foundItem) return;
    const nextVisible = !foundItem.isVisible;
    setIsSaving(true);
    try {
      await apiClient.patch(`/content/${encodeURIComponent(activeKey)}`, {
        isVisible: nextVisible,
      });
      addToast({
        type: 'success',
        title: nextVisible ? 'Section is visible again' : 'Section hidden from the page',
        description: nextVisible
          ? `${activeKey} is back on the storefront.`
          : `${activeKey} no longer renders on the storefront — the layout reflows to fill the gap. Restore it anytime from here.`,
      });
      const data = await apiClient.get<CmsItem[]>('/content/manage');
      setItems(data);
      setFrameTick((t) => t + 1);
    } catch (err) {
      addToast({
        type: 'error',
        title: nextVisible ? 'Could not show section' : 'Could not hide section',
        description: err instanceof ApiError ? err.message : 'Unexpected error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Remove the section entirely — the storefront falls back to the page's
  // built-in default copy and the item (with its revision history) is deleted.
  /** Rename a category page. Only the display name changes — the slug (and
   *  therefore every collection.html?cat=… link, footer link and product
   *  assignment) stays stable, so nothing else needs updating. */
  const handleRenameCategory = async (id: string) => {
    const name = renameValue.trim();
    if (name.length < 2) {
      addToast({
        type: 'error',
        title: 'Name too short',
        description: 'Category names need at least 2 characters.',
      });
      return;
    }
    setIsRenaming(true);
    try {
      await apiClient.patch(`/admin/categories/${id}`, { name });
      addToast({
        type: 'success',
        title: 'Category renamed',
        description: `Now shown as “${name}” on the storefront.`,
      });
      setRenamingId(null);
      // Refresh chips + reload the live preview so the new name shows immediately.
      const cats = await apiClient.get<
        Array<{ id: string; name: string; slug: string; _count?: { products?: number } }>
      >('/categories');
      setCategories(
        (cats ?? []).map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          products: c._count?.products ?? 0,
        })),
      );
      setFrameTick((t) => t + 1);
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Rename failed',
        description: err instanceof ApiError ? err.message : 'Unexpected error',
      });
    } finally {
      setIsRenaming(false);
    }
  };

  /** Create a brand-new product category page. The template (collection.html)
   *  stays exactly the same — the new page is born with the same sections and
   *  the editor immediately switches the preview to it, so the user can
   *  replace its heading/intro (and product images via Dashboard → Products)
   *  without touching any code. */
  const handleAddCategory = async () => {
    const name = newCatName.trim();
    if (name.length < 2) {
      addToast({
        type: 'error',
        title: 'Name too short',
        description: 'Category names need at least 2 characters.',
      });
      return;
    }
    setIsCreatingCategory(true);
    try {
      const slug = newCatSlug.trim();
      const created = await apiClient.post<{ id: string; name: string; slug: string }>(
        '/admin/categories',
        { name, ...(slug ? { slug } : {}) },
      );
      const cats = await apiClient.get<
        Array<{ id: string; name: string; slug: string; _count?: { products?: number } }>
      >('/categories');
      setCategories(mapCategories(cats));
      setIsAddingCategory(false);
      setNewCatName('');
      setNewCatSlug('');
      // Show the new page in the live preview right away.
      setCategorySlug(created.slug);
      setFrameTick((t) => t + 1);
      addToast({
        type: 'success',
        title: 'Category page created',
        description: `“${created.name}” now has its own page (collection.html?cat=${created.slug}) with the same template. Edit the “Category page (${created.slug})” sections below to replace its contents, then assign products in Dashboard → Products.`,
      });
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Could not create category page',
        description: err instanceof ApiError ? err.message : 'Unexpected error',
      });
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const handleRemove = async () => {
    if (!activeKey || !foundItem) return;
    const ok = window.confirm(
      `Remove "${activeSection?.label ?? activeKey}" from this template?\n\n` +
        'The section disappears from the page and the storefront falls back to its default copy. This cannot be undone.',
    );
    if (!ok) return;
    setIsSaving(true);
    try {
      await apiClient.delete(`/content/${encodeURIComponent(activeKey)}`);
      addToast({
        type: 'success',
        title: 'Section removed',
        description: `${activeKey} was removed. The page falls back to its built-in copy.`,
      });
      const data = await apiClient.get<CmsItem[]>('/content/manage');
      setItems(data);
      setActiveKey(null);
      setForm(EMPTY_FORM);
      // A removed section can't hold a draft anymore.
      if (activeKey) setDrafts((prev) => {
        const next = { ...prev };
        delete next[activeKey];
        return next;
      });
      setFrameTick((t) => t + 1);
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Remove failed',
        description: err instanceof ApiError ? err.message : 'Unexpected error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const previewUrl = page
    ? isCategoryTemplate && categorySlug
      ? `${storefrontUrl(page)}?cat=${encodeURIComponent(categorySlug)}`
      : storefrontUrl(page)
    : '';

  if (!user) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-56 rounded" />
        <Skeleton className="h-[480px] w-full rounded-xl" />
      </div>
    );
  }

  if (!allowed) return null;

  if (!page) {
    return (
      <EmptyState
        icon={LayoutTemplate}
        title="Page not found"
        description="This page template does not exist in the catalog."
        action={{ label: 'Back to Pages', onClick: () => router.push('/pages') }}
      />
    );
  }

  // Page-level hide/unhide. Hide/Unhide ONLY toggle a PENDING local flag — no
  // backend call, no storefront effect yet. The change is actually committed (the
  // site.page.<slug> visibility is patched and the section published) when the
  // user clicks Save or Publish. This keeps those two buttons the single source
  // of truth for "make my edits live": Hide is just an intent, Save/Publish acts.
  const pageVisibilityKey = `site.page.${page.slug}`;
  const pageIsHidden = useMemo(() => {
    // Committed state: does a published visibility flag exist saying "hidden"?
    const item = items.find((i) => i.key === pageVisibilityKey);
    return item ? item.isVisible === false : false;
  }, [items, pageVisibilityKey]);
  const [pendingHidden, setPendingHidden] = useState<boolean | null>(null);
  const willBeHidden = pendingHidden !== null ? pendingHidden : pageIsHidden;
  // Reset the pending flag whenever the committed state changes (e.g. after a
  // Save/Publish commits the change and refetches items).
  useEffect(() => {
    setPendingHidden(null);
  }, [pageIsHidden]);

  const togglePageHidden = () =>
    setPendingHidden((prev) => {
      const current = prev !== null ? prev : pageIsHidden;
      return !current;
    });

  // Commit any pending hide/unhide alongside a section save or publish. Called at
  // the end of handleSave/handlePublish once the section operation succeeded.
  const commitPendingVisibility = useCallback(async () => {
    if (pendingHidden === null || pendingHidden === pageIsHidden) return;
    await apiClient.patch(`/content/${encodeURIComponent(pageVisibilityKey)}`, {
      isVisible: !pendingHidden,
    });
    await apiClient.post(`/content/${encodeURIComponent(pageVisibilityKey)}/publish`);
  }, [pendingHidden, pageIsHidden, pageVisibilityKey]);

  return (
    <div className="flex flex-col">
      <PageHeader
        title={page.name}
        description={`Editing the "${page.name}" website page template — changes are previewed against the real page. Edit any sections (keep your changes as you go), then "Save & publish all" once when you're done.`}
        breadcrumbs={[{ label: 'Content' }, { label: 'Pages', href: '/pages' }, { label: page.name }]}
        actions={
          <div className="flex flex-wrap items-center gap-2 justify-end">
              <Link href="/pages">
                <Button variant="ghost" title="Back to the pages list">
                  <ChevronLeft className="h-4 w-4" /> Back
                </Button>
              </Link>
              {/* Preview actions — grouped segmented control so the two preview
                  affordances read as one unit, with a spinning reload icon as
                  feedback while the iframe remounts. */}
              <div
                className="inline-flex items-center overflow-hidden rounded-lg border border-surface-200 bg-white shadow-sm"
                role="group"
                aria-label="Preview actions"
              >
                <button
                  type="button"
                  onClick={reloadPreview}
                  title="Reload the live preview (picks up your latest published changes)"
                  className="inline-flex h-9 items-center gap-2 px-3 text-sm font-medium text-surface-700 transition-colors hover:bg-brand-50 hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                >
                  <RefreshCw className={cn('h-4 w-4 text-brand-600', isRefreshing && 'animate-spin')} />
                  <span className="hidden xl:inline">Reload preview</span>
                  <span className="xl:hidden">Reload</span>
                </button>
                <span aria-hidden className="h-5 w-px bg-surface-200" />
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  title="Open the live storefront page in a new tab"
                  className="inline-flex h-9 items-center gap-2 px-3 text-sm font-medium text-surface-700 transition-colors hover:bg-brand-50 hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                >
                  <ExternalLink className="h-4 w-4 text-brand-600" />
                  <span className="hidden xl:inline">Open live</span>
                  <span className="xl:hidden">Live</span>
                </a>
              </div>
              <span aria-hidden className="hidden h-6 w-px bg-surface-200 sm:block" />
              {dirtyCount > 0 && (
                <Button
                  variant="ghost"
                  onClick={handleDiscardDrafts}
                  disabled={isSaving}
                  title="Discard all unsaved section changes for this page"
                >
                  <X className="h-4 w-4" /> Discard
                </Button>
              )}
              {dirtyCount > 0 && (
                <span className="rounded-full border border-brand-300 bg-brand-50 px-2 py-0.5 text-2xs font-semibold text-brand-700">
                  {dirtyCount} pending
                </span>
              )}
              {/* Primary publish action + page visibility toggle — two separate
                  buttons that always sit side by side in the same row. */}
              <Button
                variant="primary"
                onClick={handleSaveAllDrafts}
                disabled={isSaving || (dirtyCount === 0 && pendingHidden === null)}
                title={
                  dirtyCount > 0
                    ? `${isContentManager ? 'Submit all' : 'Save & publish all'} ${dirtyCount} section${dirtyCount === 1 ? '' : 's'} with pending edits${pendingHidden !== null ? ' · also applies page hide/show' : ''}`
                    : pendingHidden !== null
                      ? 'No section edits — apply the pending page hide/show only'
                      : 'No pending section edits on this page'
                }
              >
                <Save className="h-4 w-4" />
                {dirtyCount > 0
                  ? isContentManager
                    ? `Submit all (${dirtyCount})`
                    : `Save & publish all (${dirtyCount})`
                  : 'Save & publish'}
              </Button>
              <Button
                variant={willBeHidden ? 'danger' : 'primary'}
                onClick={togglePageHidden}
                disabled={isSaving}
                title={
                  willBeHidden
                    ? 'Page is hidden — click Save & publish to bring it back'
                    : 'Hide this page on the storefront (apply via Save & publish)'
                }
              >
                {willBeHidden ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                {willBeHidden ? 'Unhide page' : 'Hide page'}
              </Button>
          </div>
        }
      />
      {/* Product Category template: switch between the category pages that the
          live preview shows. Buttons live here (below the page header) so they
          are easy to find — each one previews that category's real page. */}
      {isCategoryTemplate && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-surface-500">
            Category page:
          </span>
          {(categories.length ? categories : FALLBACK_CATEGORIES).map((opt) => {
            const active = categorySlug === opt.slug;
            // Inline rename mode: input + confirm/cancel instead of the chip.
            if (renamingId != null && renamingId === opt.id) {
              return (
                <span
                  key={opt.slug}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-brand-400 bg-white px-2 py-1.5 shadow-sm"
                >
                  <FolderOpen className="h-4 w-4 flex-shrink-0 text-brand-600" />
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (opt.id) void handleRenameCategory(opt.id);
                      }
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                    placeholder="Category name"
                    aria-label="Category name"
                    className="h-7 w-52 rounded-md border border-surface-200 px-2 text-sm text-surface-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/40"
                  />
                  <button
                    type="button"
                    title="Save name"
                    disabled={isRenaming || renameValue.trim().length < 2}
                    onClick={() => opt.id && void handleRenameCategory(opt.id)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title="Cancel"
                    onClick={() => setRenamingId(null)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-surface-500 hover:bg-surface-100 hover:text-surface-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </span>
              );
            }
            return (
              <span key={opt.slug} className="relative inline-flex">
                <button
                  type="button"
                  title={`Preview collection.html?cat=${opt.slug}`}
                  onClick={() => {
                    if (categorySlug === opt.slug) return;
                    setCategorySlug(opt.slug);
                    setFrameTick((t) => t + 1); // remount iframe → fresh page load
                  }}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium shadow-sm transition-colors',
                    active
                      ? 'border-brand-600 bg-brand-600 text-white hover:bg-brand-700'
                      : 'border-surface-200 bg-white text-surface-700 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700',
                  )}
                >
                  <FolderOpen className="h-4 w-4 flex-shrink-0" />
                  <span>{opt.name}</span>
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-2xs font-semibold',
                      active ? 'bg-white/20 text-white' : 'bg-surface-100 text-surface-500',
                    )}
                  >
                    {opt.products} {opt.products === 1 ? 'product' : 'products'}
                  </span>
                </button>
                {opt.id && (
                  <button
                    type="button"
                    title={`Rename “${opt.name}”`}
                    aria-label={`Rename ${opt.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenamingId(opt.id!);
                      setRenameValue(opt.name);
                    }}
                    className="absolute -right-1.5 -top-1.5 z-10 inline-flex h-5 w-5 items-center justify-center rounded-full border border-surface-200 bg-white text-surface-400 shadow-sm hover:border-brand-400 hover:text-brand-600"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                )}
              </span>
            );
          })}

          {/* Add a brand-new category page — same template, fresh contents.
              The company can add a new product category any time; the new
              page is created with the identical template and the user just
              replaces its contents (and product images via Dashboard →
              Products). */}
          {isAddingCategory ? (
            <span className="inline-flex flex-wrap items-center gap-1.5 rounded-lg border border-brand-400 bg-white px-2 py-1.5 shadow-sm">
              <FolderOpen className="h-4 w-4 flex-shrink-0 text-brand-600" />
              <input
                autoFocus
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (newCatName.trim().length >= 2) void handleAddCategory();
                  }
                  if (e.key === 'Escape') setIsAddingCategory(false);
                }}
                placeholder="Category name (e.g. Trail Mixes)"
                aria-label="New category name"
                className="h-7 w-48 rounded-md border border-surface-200 px-2 text-sm text-surface-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/40"
              />
              <input
                value={newCatSlug}
                onChange={(e) => setNewCatSlug(e.target.value.toLowerCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (newCatName.trim().length >= 2) void handleAddCategory();
                  }
                  if (e.key === 'Escape') setIsAddingCategory(false);
                }}
                placeholder="url-slug (optional)"
                aria-label="New category URL slug"
                title="Optional URL slug (collection.html?cat=…). Generated from the name when left empty."
                className="h-7 w-36 rounded-md border border-surface-200 px-2 font-mono text-xs text-surface-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/40"
              />
              <button
                type="button"
                title="Create category page"
                disabled={isCreatingCategory || newCatName.trim().length < 2}
                onClick={() => void handleAddCategory()}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                type="button"
                title="Cancel"
                onClick={() => setIsAddingCategory(false)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-surface-500 hover:bg-surface-100 hover:text-surface-700"
              >
                <X className="h-4 w-4" />
              </button>
            </span>
          ) : (
            <Button
              variant="secondary"
              title="Add a new category page — the template stays the same, you just replace the contents"
              onClick={() => setIsAddingCategory(true)}
            >
              <Plus className="h-4 w-4 flex-shrink-0" />
              <span>Add category page</span>
            </Button>
          )}
          <span className="basis-full text-2xs text-surface-400">
            Adding a category creates a new page with the same template — pick it above, replace its
            heading/intro in “Template sections”, then assign products (with images) in Dashboard →
            Products.
          </span>
        </div>
      )}
<div className="grid flex-1 gap-4 items-start lg:grid-cols-2">
        {/* ── Left: editable template ── */}
        <div className="flex flex-col min-w-0">
          {dirtyCount > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-brand-300 bg-brand-50 px-3 py-2 text-xs text-brand-700">
              <Pencil className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="flex-1">
                <span className="font-semibold">{dirtyCount} section{dirtyCount === 1 ? '' : 's'} with edits kept as
                  drafts</span>{' '}
                — they stay here while you move around the page. Review them, then publish everything at once.
              </span>
              <Button variant="primary" size="sm" onClick={handleSaveAllDrafts} isLoading={isSaving}>
                <Save className="h-3.5 w-3.5" />
                {isContentManager
                  ? `Submit all for approval (${dirtyCount})`
                  : `Save & publish all (${dirtyCount})`}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleDiscardDrafts} disabled={isSaving}>
                <X className="h-3.5 w-3.5" /> Discard
              </Button>
            </div>
          )}
          <Card className="mb-4 flex-shrink-0" padding="sm">
            <div className="mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-surface-500">
              Template sections
            </div>
            <div className="max-h-64 overflow-y-auto">
            <div className="flex flex-wrap gap-2">
              {allSections.map((section, idx) => {
                const item = items.find((i) => i.key === section.key);
                const exists = !!item;
                const isHidden = item?.isVisible === false;
                const hasPending = pending.some((r) => r.contentItem.key === section.key);
                const isActive = section.key === activeKey;
                const isDirty = dirtyKeySet.has(section.key);
                const showGroup = !!section.group && page.sections[idx - 1]?.group !== section.group;
                return (
                  <React.Fragment key={section.key}>
                    {showGroup && (
                      <div className="mt-1 w-full border-t border-surface-100 pt-2 text-2xs font-semibold uppercase tracking-wider text-surface-400 first:border-0 first:pt-0">
                        {section.group}
                      </div>
                    )}
                    <button
                    onClick={() => selectSection(section)}
                    title={isDirty ? `${section.label} — has unsaved changes (publish with “Save & publish all”)` : section.description}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                      isDirty
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : isActive
                          ? 'border-brand-500 bg-white text-brand-700'
                          : 'border-surface-200 bg-white text-surface-600 hover:bg-surface-50',
                    )}
                  >
                    <span
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        isDirty
                          ? 'bg-brand-600'
                          : hasPending
                            ? 'bg-amber-500'
                            : isHidden
                              ? 'bg-surface-400'
                              : exists
                                ? 'bg-green-500'
                                : 'bg-surface-300',
                      )}
                    />
                    {section.label}
                    {isHidden && <EyeOff className="h-3 w-3 text-surface-400" />}
                    {hasPending && (
                      <span className="rounded bg-amber-100 px-1 text-2xs font-semibold text-amber-700">
                        pending
                      </span>
                    )}
                    {isDirty && (
                      <span className="rounded bg-brand-100 px-1 text-2xs font-semibold text-brand-700">
                        edited
                      </span>
                    )}
                  </button>
                  </React.Fragment>
                );
              })}
            </div>
            </div>
          </Card>
          <Card>
            {isLoading ? (
              <div className="space-y-3 p-5">
                <Skeleton className="h-5 w-40 rounded" />
                <Skeleton className="h-10 w-full rounded" />
                <Skeleton className="h-32 w-full rounded" />
              </div>
            ) : !activeSection ? (
              <div className="p-5">
                <EmptyState
                  icon={FileText}
                  title="Select a section"
                  description="Pick one of the template sections above to start editing it."
                />
              </div>
            ) : (
              <div className="space-y-4 p-5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-surface-900">{activeSection.label}</h3>
                    <p className="mt-0.5 text-xs text-surface-500">{activeSection.description}</p>
                  </div>
                  {isNew ? (
                    <Badge variant="warning" dot>Not published yet</Badge>
                  ) : (
                    <Badge variant={foundItem?.isPublished ? 'success' : 'warning'} dot>
                      {foundItem?.isPublished ? 'Live' : 'Unpublished'}
                    </Badge>
                  )}
                  {foundItem?.isVisible === false && (
                    <Badge variant="info" dot>Hidden from page</Badge>
                  )}
                </div>

                {activePending.length > 0 && (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    <span className="font-medium">
                      {activePending.length} change{activePending.length > 1 ? 's' : ''} awaiting
                      Manager approval.
                    </span>
                    The live site keeps showing the previously approved version until a Manager
                    approves
                    {user?.role === 'CONTENT_MANAGER' ? (
                      <> — you will be notified of the decision.</>
                    ) : (
                      <>
                        {' '}
                        — review it in{' '}
                        <Link href="/content" className="underline font-semibold">
                          Content review queue
                        </Link>
                        .
                      </>
                    )}
                  </div>
                )}

                <div className="rounded-lg border border-surface-200 bg-surface-50 px-3 py-2">
                  <p className="text-2xs font-mono text-surface-500">
                    Content key: <span className="text-surface-700">{activeKey}</span>
                  </p>
                </div>

                {isImageSection && (
                  <div className="space-y-3">
                    {/* Current image preview */}
                    <div className="rounded-lg border border-surface-200 bg-white p-3">
                      <p className="mb-2 text-2xs font-mono uppercase tracking-wide text-surface-400">Current image</p>
                      {currentImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={currentImageUrl} alt={activeSection.label} className="h-40 w-full rounded-md object-cover" />
                      ) : (
                        <div className="flex h-40 items-center justify-center rounded-md bg-surface-100 text-xs text-surface-400">
                          No image set yet
                        </div>
                      )}
                      {currentImageUrl && (
                        <p className="mt-2 truncate text-2xs text-surface-400">{currentImageUrl}</p>
                      )}
                    </div>

                    {/* Dropzone: drag & drop, browse local files, or pick from library */}
                    <div
                      className={cn(
                        'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors',
                        dragOver ? 'border-brand-500 bg-brand-50' : 'border-surface-300 bg-surface-50',
                      )}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                      }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOver(false);
                        const f = e.dataTransfer.files?.[0];
                        if (f) void uploadImageFile(f);
                      }}
                    >
                      <ImagePlus className="h-5 w-5 text-surface-400" />
                      <p className="text-xs text-surface-600">
                        Drag &amp; drop an image here, or choose one
                      </p>
                      <div className="flex flex-wrap justify-center gap-2">
                        <Button size="sm" variant="ghost" disabled={isUploadingImage} onClick={() => fileInputRef.current?.click()}>
                          <ImagePlus className="h-3.5 w-3.5" /> Browse files
                        </Button>
                        <Button size="sm" variant="ghost" disabled={isUploadingImage} onClick={() => setPickerOpen(true)}>
                          <Library className="h-3.5 w-3.5" /> Media library
                        </Button>
                      </div>
                      {isUploadingImage && <p className="text-2xs text-brand-600">Uploading…</p>}
                      <p className="text-2xs text-surface-400">
                        Images only · up to 25 MB · saved to Media with this page &amp; section tagged
                      </p>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void uploadImageFile(f);
                        e.target.value = '';
                      }}
                    />
                  </div>
                )}

                <RichTextEditor
                  variant="inline"
                  label="Section title *"
                  value={form.title}
                  onChange={(html) => setForm({ ...form, title: html })}
                  placeholder={`e.g. ${activeSection.label}`}
                  hint="Fonts, sizes, colors and emphasis supported — same controls as the descriptions."
                />
                {!isImageSection && (
                  <>
                    <RichTextEditor
                      variant="inline"
                      label="Short description"
                      value={form.shortDescription}
                      onChange={(html) => setForm({ ...form, shortDescription: html })}
                      placeholder="One-line summary shown in the section…"
                      minHeight={64}
                    />
                    <RichTextEditor
                      label="Long description"
                      value={form.longDescription}
                      onChange={(html) => setForm({ ...form, longDescription: html })}
                      placeholder="Full rich-text description…"
                      hint="Formatting supported: bold/italic, headings, lists, alignment, links and images."
                    />
                    <RichTextEditor
                      label="Custom section (body)"
                      value={form.body}
                      onChange={(html) => setForm({ ...form, body: html })}
                      placeholder="Extra custom section content…"
                      minHeight={140}
                    />
                  </>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button onClick={handleSaveAndPublish} isLoading={isSaving} title="Save & publish ONLY this section (other pending edits are untouched)">
                    <Save className="h-4 w-4" />
                    {isNew
                      ? isContentManager
                        ? 'Create & submit for approval'
                        : 'Create & publish section'
                      : isContentManager
                        ? 'Submit for approval'
                        : 'Save & publish section'}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleKeepAndNext}
                    disabled={isSaving || isUploadingImage}
                    title="Keep your edits here as a draft and move to the next section — publish everything together later with “Save & publish all”"
                  >
                    <ChevronRight className="h-4 w-4" /> Keep &amp; next section
                  </Button>
                  {/* Hide / Remove are ALWAYS rendered (disabled until the section
                      exists) so they never "go missing" for new sections — the
                      tooltip explains to publish first. */}
                  <Button
                    variant="ghost"
                    onClick={handleToggleVisible}
                    isLoading={isSaving}
                    disabled={!foundItem || isSaving}
                    title={
                      foundItem
                        ? foundItem.isVisible
                          ? 'Hide this section from the storefront (layout reflows to fill the gap)'
                          : 'Show this hidden section on the storefront again'
                        : 'Publish this section first — hiding applies to published sections'
                    }
                  >
                    {foundItem && !foundItem.isVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    {foundItem && !foundItem.isVisible ? 'Show on page' : 'Hide from page'}
                  </Button>
                  <Button
                    variant="danger"
                    onClick={handleRemove}
                    isLoading={isSaving}
                    disabled={!foundItem || isSaving}
                    title={
                      foundItem
                        ? 'Remove this section from the template (storefront falls back to its built-in copy)'
                        : 'Publish this section first — nothing to remove yet'
                    }
                  >
                    <Trash2 className="h-4 w-4" /> Remove section
                  </Button>
                </div>

                {isImageSection && (
                  <Dialog
                    open={pickerOpen}
                    onClose={() => setPickerOpen(false)}
                    title="Choose from media library"
                    description="Pick an existing image to use in this section. Fresh uploads land here too, tagged with this page and section."
                    maxWidth="lg"
                  >
                    <div className="space-y-3">
                      <input
                        value={libraryQuery}
                        onChange={(e) => setLibraryQuery(e.target.value)}
                        placeholder="Search by name…"
                        className="w-full rounded-md border border-surface-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
                      />
                      <div className="grid max-h-[50vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-4">
                        {libraryImages
                          .filter((m) => m.name.toLowerCase().includes(libraryQuery.trim().toLowerCase()))
                          .map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              title={`${m.name} — ${m.category}`}
                              onClick={() => {
                                setForm((f) => ({ ...f, body: m.url }));
                                setPickerOpen(false);
                              }}
                              className="group relative overflow-hidden rounded-md border border-surface-200 transition-shadow hover:shadow-md"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={m.url} alt={m.name} className="h-20 w-full object-cover" />
                              <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 py-0.5 text-2xs text-white">
                                {m.name}
                              </span>
                              <span className="absolute left-1 top-1 rounded bg-black/60 px-1 py-0.5 text-2xs font-medium text-white">
                                {m.category}
                              </span>
                            </button>
                          ))}
                        {libraryImages.length === 0 && (
                          <p className="col-span-full py-6 text-center text-xs text-surface-400">
                            No images in the library yet — upload one above.
                          </p>
                        )}
                      </div>
                    </div>
                  </Dialog>
                )}
              </div>
            )}
          </Card>
        </div>
{/* ── Right: live website preview ── */}
        <Card className="flex flex-col lg:sticky lg:top-4 h-[75vh] lg:h-[calc(100vh-2rem)]" padding="none">
          <div className="flex items-center justify-between gap-2 border-b border-surface-200 bg-surface-50/60 px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-brand-100">
                <Globe className="h-3.5 w-3.5 text-brand-700" />
              </span>
              <span className="truncate font-mono text-2xs text-surface-500">{previewUrl}</span>
            </div>
            <div className="flex flex-shrink-0 items-center gap-1.5">
              <span className="hidden text-2xs text-surface-400 md:inline">
                Click any section in the preview to edit it
              </span>
              <button
                type="button"
                onClick={reloadPreview}
                title="Reload the live preview"
                aria-label="Reload the live preview"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-surface-500 transition-colors hover:bg-brand-50 hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
              </button>
              <a
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
                title="Open the live page in a new tab"
                aria-label="Open the live page in a new tab"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-surface-500 transition-colors hover:bg-brand-50 hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <Badge variant="info">Live preview</Badge>
            </div>
          </div>
          <div className="relative flex-1 min-h-0">
            <iframe
              key={frameTick}
              src={previewUrl}
              title={`${page.name} — live preview`}
              className="h-full w-full border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          </div>
        </Card>
      </div>
    </div>
  );
}