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
  ChevronLeft,
  ExternalLink,
  LayoutTemplate,
  RefreshCw,
  Save,
  FileText,
  Globe,
} from 'lucide-react';

interface CmsItem {
  id: string;
  key: string;
  title: string;
  shortDescription: string | null;
  longDescription: string | null;
  body: string;
  isPublished: boolean;
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

  const [items, setItems] = useState<CmsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [pending, setPending] = useState<PendingRevision[]>([]);
  const [frameTick, setFrameTick] = useState(0);

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

  const selectSection = (section: PageTemplateSection) => {
    setActiveKey(section.key);
    const loaded = items.find((i) => i.key === section.key);
    setForm(loaded ? toForm(loaded) : EMPTY_FORM);
  };

  // Click-to-select: the storefront preview page runs the CMS editor bridge
  // (js/content.js) which postMessages the content key of any [data-cms]
  // element the user clicks in the live preview. Select that section here so
  // EVERY section of the page is reachable — including ones far down the page
  // that are inconvenient to pick from the chip list.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const d = e.data as { source?: string; type?: string; key?: string } | null;
      if (!d || d.source !== 'aamako-cms-bridge' || d.type !== 'section-click') return;
      const key = String(d.key ?? '');
      const section = page?.sections.find((s) => s.key === key);
      if (section) selectSection(section);
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

  const previewUrl = page ? storefrontUrl(page) : '';

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
                const exists = items.some((i) => i.key === section.key);
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
                          : exists
                            ? 'bg-green-500'
                            : 'bg-surface-300',
                      )}
                    />
                    {section.label}
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