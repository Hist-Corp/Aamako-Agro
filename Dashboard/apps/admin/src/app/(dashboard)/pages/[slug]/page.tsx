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
import { Input } from '@/components/ui/input';
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
  const [frameTick, setFrameTick] = useState(0);

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

  const foundItem = useMemo(
    () => items.find((i) => i.key === activeKey) ?? null,
    [items, activeKey],
  );
  const activeSection = useMemo(
    () => page?.sections.find((s) => s.key === activeKey) ?? null,
    [page, activeKey],
  );
  const isNew = activeKey != null && !foundItem;

  const handleSave = async () => {
    if (!activeKey) return;
    if (!form.title.trim()) {
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
    <div className="flex h-full flex-col">
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
<div className="grid flex-1 gap-4 overflow-hidden min-h-0 lg:grid-cols-2">
        {/* ── Left: editable template ── */}
        <div className="flex flex-col min-h-0">
          <Card className="mb-4 flex-shrink-0" padding="sm">
            <div className="mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-surface-500">
              Template sections
            </div>
            <div className="flex flex-wrap gap-2">
              {page.sections.map((section) => {
                const exists = items.some((i) => i.key === section.key);
                const isActive = section.key === activeKey;
                return (
                  <button
                    key={section.key}
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
                        exists ? 'bg-green-500' : 'bg-surface-300',
                      )}
                    />
                    {section.label}
                  </button>
                );
              })}
            </div>
          </Card>
<Card className="flex-1 min-h-0 overflow-y-auto">
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

                <div className="rounded-lg border border-surface-200 bg-surface-50 px-3 py-2">
                  <p className="text-2xs font-mono text-surface-500">
                    Content key: <span className="text-surface-700">{activeKey}</span>
                  </p>
                </div>

                <Input
                  label="Section title *"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder={`e.g. ${activeSection.label}`}
                />
                <div>
                  <label className="text-sm font-medium text-surface-700">Short description</label>
                  <textarea
                    value={form.shortDescription}
                    onChange={(e) => setForm({ ...form, shortDescription: e.target.value })}
                    rows={2}
                    maxLength={500}
                    placeholder="One-line summary shown in the section…"
                    className="mt-1 w-full rounded-lg border border-surface-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 resize-none"
                  />
                </div>
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
                    {isNew ? 'Create & publish section' : 'Save & publish section'}
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
        <Card className="flex min-h-0 flex-col" padding="none">
          <div className="flex items-center justify-between gap-2 border-b border-surface-200 px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <Globe className="h-4 w-4 flex-shrink-0 text-surface-400" />
              <span className="truncate text-xs text-surface-500">{previewUrl}</span>
            </div>
            <Badge variant="info">Live preview</Badge>
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