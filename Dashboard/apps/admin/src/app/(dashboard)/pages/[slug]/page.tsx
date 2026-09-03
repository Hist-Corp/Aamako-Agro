'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/config/auth-context';
import { canAct } from '@/config/rbac';
import { apiClient, ApiError } from '@/lib/api-client';
import {
  getSitePage,
  storefrontUrl,
  type SitePage,
  type PageTemplateSection,
} from '@/config/pages';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  Check,
  ChevronLeft,
  ExternalLink,
  Eye,
  EyeOff,
  FolderOpen,
  LayoutTemplate,
  Pencil,
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
  const [isSaving, setIsSaving] = useState(false);
  const [pending, setPending] = useState<PendingRevision[]>([]);
  const [frameTick, setFrameTick] = useState(0);
  // Product Category template: which category page (collection.html?cat=…) the
  // live preview shows. Defaults to the first seeded category — there is no
  // separate "all products" page, so the preview always targets a real category.
  const [categorySlug, setCategorySlug] = useState('freeze-dried-fruits');
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  // Inline rename of a category page (display name only — slugs/links stay stable).
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

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

  const selectSection = (section: PageTemplateSection) => {
    setActiveKey(section.key);
    const loaded = items.find((i) => i.key === section.key);
    setForm(loaded ? toForm(loaded) : EMPTY_FORM);
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
      const section = page?.sections.find((s) => s.key === key);
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
    () => page?.sections.find((s) => s.key === activeKey) ?? null,
    [page, activeKey],
  );
  const isNew = activeKey != null && !foundItem;
  const activePending = useMemo(
    () => pending.filter((r) => r.contentItem.key === activeKey),
    [pending, activeKey],
  );

  const handleSave = async () => {
    if (!activeKey) return;
    if (!form.title.replace(/<[^>]*>/g, '').trim()) {
      addToast({ type: 'error', title: 'Title required', description: 'Give this section a title.' });
      return;
    }
    setIsSaving(true);
    try {
      const res = await apiClient.put<{ live?: boolean; message?: string }>(
        `/content/${encodeURIComponent(activeKey)}`,
        {
          title: form.title.trim(),
          shortDescription: form.shortDescription,
          longDescription: form.longDescription,
          body: form.body,
        },
      );
      addToast(
        res?.live
          ? {
              type: 'success',
              title: isNew ? 'Template section created & published' : 'Template section updated & published',
              description: activeKey,
            }
          : {
              type: 'success',
              title: 'Sent for approval',
              description: res?.message ?? 'A Manager must approve this change before it appears on the storefront.',
            },
      );
      const data = await apiClient.get<CmsItem[]>('/content/manage');
      setItems(data);
      try {
        const revs = await apiClient.get<PendingRevision[]>('/content/revisions');
        setPending(revs);
      } catch {
        /* best-effort */
      }
      // Refresh the live preview so approved/published changes are visible
      // immediately without the user having to hit "Reload preview".
      setFrameTick((t) => t + 1);
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Save failed',
        description: err instanceof ApiError ? err.message : 'Unexpected error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!activeKey) return;
    setIsSaving(true);
    try {
      await apiClient.post(`/content/${encodeURIComponent(activeKey)}/publish`);
      addToast({ type: 'success', title: 'Section published', description: activeKey });
      const data = await apiClient.get<CmsItem[]>('/content/manage');
      setItems(data);
      // Refresh the live preview so the newly published content shows up right away
      setFrameTick((t) => t + 1);
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

  return (
    <div className="flex flex-col">
      <PageHeader
        title={page.name}
        description={`Editing the "${page.name}" website page template — changes are previewed against the real page.`}
        breadcrumbs={[{ label: 'Content' }, { label: 'Pages', href: '/pages' }, { label: page.name }]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => setFrameTick((t) => t + 1)}
              title="Reload preview"
            >
              <RefreshCw className="h-4 w-4" /> Reload preview
            </Button>
            <a href={previewUrl} target="_blank" rel="noreferrer">
              <Button variant="secondary">
                <ExternalLink className="h-4 w-4" /> Open live
              </Button>
            </a>
            <Link href="/pages">
              <Button variant="ghost">
                <ChevronLeft className="h-4 w-4" /> Back
              </Button>
            </Link>
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
        </div>
      )}
<div className="grid flex-1 gap-4 items-start lg:grid-cols-2">
        {/* ── Left: editable template ── */}
        <div className="flex flex-col min-w-0">
          <Card className="mb-4 flex-shrink-0" padding="sm">
            <div className="mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-surface-500">
              Template sections
            </div>
            <div className="max-h-64 overflow-y-auto">
            <div className="flex flex-wrap gap-2">
              {page.sections.map((section, idx) => {
                const item = items.find((i) => i.key === section.key);
                const exists = !!item;
                const isHidden = item?.isVisible === false;
                const hasPending = pending.some((r) => r.contentItem.key === section.key);
                const isActive = section.key === activeKey;
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
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                      isActive
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-surface-200 bg-white text-surface-600 hover:bg-surface-50',
                    )}
                  >
                    <span
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        hasPending
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

                <RichTextEditor
                  variant="inline"
                  label="Section title *"
                  value={form.title}
                  onChange={(html) => setForm({ ...form, title: html })}
                  placeholder={`e.g. ${activeSection.label}`}
                  hint="Fonts, sizes, colors and emphasis supported — same controls as the descriptions."
                />
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

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button onClick={handleSave} isLoading={isSaving}>
                    <Save className="h-4 w-4" />
                    {isNew
                      ? isContentManager
                        ? 'Create & submit for approval'
                        : 'Create & publish section'
                      : isContentManager
                        ? 'Submit for approval'
                        : 'Save & publish section'}
                  </Button>
                  {foundItem && !foundItem.isPublished && (
                    <Button variant="secondary" onClick={handlePublish} isLoading={isSaving}>
                      <Globe className="h-4 w-4" /> Publish
                    </Button>
                  )}
                  {foundItem && (
                    <Button variant="ghost" onClick={handleToggleVisible} isLoading={isSaving}>
                      {foundItem.isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      {foundItem.isVisible ? 'Hide from page' : 'Show on page'}
                    </Button>
                  )}
                  {foundItem && (
                    <Button variant="danger" onClick={handleRemove} isLoading={isSaving}>
                      <Trash2 className="h-4 w-4" /> Remove
                    </Button>
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>
{/* ── Right: live website preview ── */}
        <Card className="flex flex-col lg:sticky lg:top-4 h-[75vh] lg:h-[calc(100vh-2rem)]" padding="none">
          <div className="flex items-center justify-between gap-2 border-b border-surface-200 px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <Globe className="h-4 w-4 flex-shrink-0 text-surface-400" />
              <span className="truncate text-xs text-surface-500">{previewUrl}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden text-2xs text-surface-400 sm:inline">
                Tip: click any section in the preview to edit it
              </span>
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