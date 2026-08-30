'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useAuth } from '@/config/auth-context';
import { relativeTime } from '@/lib/utils';
import { canAct } from '@/config/rbac';
import { apiClient, ApiError } from '@/lib/api-client';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Tabs } from '@/components/ui/tabs';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { useToast } from '@/components/ui/toast';
import { FileText, Globe, Pencil, Plus, RotateCcw, CheckCircle2, XCircle, Clock } from 'lucide-react';

/** A CMS page as returned by GET /content/manage (includes unpublished). */
interface CmsItem {
  id: string;
  key: string;
  title: string;
  shortDescription: string | null;
  longDescription: string | null;
  category: string | null;
  body: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

const TYPE_BY_PREFIX: Record<string, string> = {
  home: 'Homepage',
  product: 'Product',
  page: 'Page',
  banner: 'Banner',
  faq: 'FAQ',
  announcement: 'Announcement',
  journal: 'Journal',
};
const TYPE_OPTIONS = [
  { value: 'PAGE', label: 'Page' },
  { value: 'HOMEPAGE', label: 'Homepage' },
  { value: 'PRODUCT', label: 'Product' },
  { value: 'BANNER', label: 'Banner' },
  { value: 'FAQ', label: 'FAQ' },
  { value: 'ANNOUNCEMENT', label: 'Announcement' },
];
const PREFIX_BY_TYPE: Record<string, string> = {
  PAGE: 'page',
  HOMEPAGE: 'home',
  PRODUCT: 'product',
  BANNER: 'banner',
  FAQ: 'faq',
  ANNOUNCEMENT: 'announcement',
};

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '');
}
function typeFromKey(key: string): string {
  return TYPE_BY_PREFIX[key.split('.')[0]] ?? 'Page';
}

interface FormState {
  title: string;
  shortDescription: string;
  longDescription: string;
  body: string;
}
const EMPTY_FORM: FormState = { title: '', shortDescription: '', longDescription: '', body: '' };

/** Screen: Content Management â€” backed by the live content API.
 *  CONTENT_MANAGER has full rights here: edit every existing page, create
 *  new pages and publish directly (writes land live with an APPROVED
 *  ContentRevision snapshot kept as an audit trail). */
export default function ContentPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [items, setItems] = useState<CmsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const canEdit = !!user && canAct(user.role, 'content:edit');
  const canCreate = !!user && canAct(user.role, 'content:create');
  const canPublish = !!user && canAct(user.role, 'content:publish');

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.get<CmsItem[]>('/content/manage');
      setItems(data);
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Could not load content',
        description: err instanceof ApiError ? err.message : 'Unexpected error',
      });
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    void load();
  }, [load]);

  // â”€â”€ Moderation queue (pending revisions) â”€â”€
  interface PendingRevision {
    id: string;
    contentItemId: string;
    proposedTitle: string;
    proposedShortDescription: string | null;
    proposedBody: string;
    status: string;
    createdAt: string;
    contentItem: { key: string; title: string };
  }
  const [pending, setPending] = useState<PendingRevision[]>([]);
  const canApprove = !!user && canAct(user.role, 'content:approve');

  const loadPending = useCallback(async () => {
    if (!canApprove) return;
    try {
      const data = await apiClient.get<PendingRevision[]>('/content/revisions');
      setPending(data);
    } catch {
      /* queue is optional UI â€” ignore load errors */
    }
  }, [canApprove]);

  useEffect(() => {
    void loadPending();
  }, [loadPending]);

  const review = async (id: string, approve: boolean) => {
    try {
      await apiClient.post(`/content/revisions/${id}/${approve ? 'approve' : 'reject'}`, {});
      addToast({
        type: 'success',
        title: approve ? 'Approved & published' : 'Rejected',
        description: approve
          ? 'The change is now live on the storefront.'
          : 'The live site is unchanged.',
      });
      await Promise.all([load(), loadPending()]);
    } catch (err) {
      addToast({
        type: 'error',
        title: approve ? 'Approve failed' : 'Reject failed',
        description: err instanceof ApiError ? err.message : 'Unexpected error',
      });
    }
  };

  // â”€â”€ Edit dialog â”€â”€
  const [editTarget, setEditTarget] = useState<CmsItem | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const openEdit = (item: CmsItem) => {
    setEditTarget(item);
    setEditForm({
      title: item.title,
      shortDescription: item.shortDescription ?? '',
      longDescription: item.longDescription ?? '',
      body: item.body ?? '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    if (!editForm.title.trim()) {
      addToast({ type: 'error', title: 'Title required', description: 'Content title cannot be empty.' });
      return;
    }
    setIsSaving(true);
    try {
      const res = await apiClient.put<{ live?: boolean; message?: string }>(
        `/content/${encodeURIComponent(editTarget.key)}`,
        {
          title: editForm.title.trim(),
          shortDescription: editForm.shortDescription,
          longDescription: editForm.longDescription,
          body: editForm.body,
        },
      );
      addToast(
        res?.live
          ? { type: 'success', title: 'Content updated & published', description: editTarget.key }
          : { type: 'success', title: 'Sent for approval', description: res?.message ?? 'A Manager must approve this change before it appears on the storefront.' },
      );
      setEditTarget(null);
      await load();
      void loadPending();
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

  // â”€â”€ New page dialog â”€â”€
  const [newDialog, setNewDialog] = useState(false);
  const [newType, setNewType] = useState('PAGE');
  const [newTitle, setNewTitle] = useState('');
  const [newKey, setNewKey] = useState('');
  const [keyTouched, setKeyTouched] = useState(false);
  const [newForm, setNewForm] = useState<FormState>(EMPTY_FORM);

  // Auto-suggest the URL key from title + type until edited manually.
  useEffect(() => {
    if (!keyTouched) setNewKey(`${PREFIX_BY_TYPE[newType] ?? 'page'}.${slugify(newTitle)}`);
  }, [newTitle, newType, keyTouched]);

  const openNewDialog = () => {
    setNewType('PAGE');
    setNewTitle('');
    setNewKey('');
    setKeyTouched(false);
    setNewForm(EMPTY_FORM);
    setNewDialog(true);
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) {
      addToast({ type: 'error', title: 'Title required', description: 'Give the page a title.' });
      return;
    }
    const key = newKey.trim();
    if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(key)) {
      addToast({
        type: 'error',
        title: 'Invalid URL key',
        description: 'Use kebab-case segments separated by dots, e.g. "about.story".',
      });
      return;
    }
    setIsSaving(true);
    try {
      const res = await apiClient.post<{ live?: boolean; message?: string }>('/content', {
        key,
        title: newTitle.trim(),
        shortDescription: newForm.shortDescription,
        longDescription: newForm.longDescription,
        body: newForm.body,
      });
      addToast(
        res?.live
          ? { type: 'success', title: 'Page created & published', description: key }
          : { type: 'success', title: 'Page created â€” awaiting approval', description: res?.message ?? 'A Manager has been notified and must approve before it appears on the storefront.' },
      );
      setNewDialog(false);
      await load();
      void loadPending();
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Create failed',
        description: err instanceof ApiError ? err.message : 'Unexpected error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // â”€â”€ Publish / unpublish â”€â”€
  const [publishTarget, setPublishTarget] = useState<{ item: CmsItem; publish: boolean } | null>(null);

  const handleTogglePublish = async () => {
    if (!publishTarget) return;
    setIsSaving(true);
    try {
      await apiClient.post(
        `/content/${encodeURIComponent(publishTarget.item.key)}/${publishTarget.publish ? 'publish' : 'unpublish'}`,
      );
      addToast({
        type: 'success',
        title: publishTarget.publish ? 'Page published' : 'Page unpublished',
        description: publishTarget.item.key,
      });
      setPublishTarget(null);
      await load();
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Action failed',
        description: err instanceof ApiError ? err.message : 'Unexpected error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const filtered = useMemo(
    () =>
      items.filter((i) => {
        if (statusFilter === 'PUBLISHED' && !i.isPublished) return false;
        if (statusFilter === 'UNPUBLISHED' && i.isPublished) return false;
        if (typeFilter && typeFromKey(i.key) !== typeFilter) return false;
        return true;
      }),
    [items, statusFilter, typeFilter],
  );

  const typeOptions = useMemo(
    () => [{ value: '', label: 'All Types' }, ...Array.from(new Set(items.map((i) => typeFromKey(i.key)))).sort().map((t) => ({ value: t, label: t }))],
    [items],
  );

  const columns = useMemo<ColumnDef<CmsItem>[]>(
    () => [
      {
        accessorKey: 'title',
        header: 'Page',
        cell: ({ row }) => (
          <div className="max-w-md">
            <p className="font-medium text-surface-900">{row.original.title}</p>
            <p className="font-mono text-xs text-surface-500">{row.original.key}</p>
          </div>
        ),
      },
      {
        id: 'type',
        header: 'Type',
        cell: ({ row }) => <Badge variant="neutral">{typeFromKey(row.original.key)}</Badge>,
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={row.original.isPublished ? 'success' : 'neutral'} dot>
            {row.original.isPublished ? 'PUBLISHED' : 'UNPUBLISHED'}
          </Badge>
        ),
      },
      {
        accessorKey: 'updatedAt',
        header: 'Updated',
        cell: ({ row }) => <span className="text-xs text-surface-500">{relativeTime(row.original.updatedAt)}</span>,
      },
      {
        id: 'actions',
        header: '',
        size: 230,
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="flex items-center gap-1" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
              {canEdit && (
                <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
              )}
              {canPublish && (
                <Button variant="ghost" size="sm" onClick={() => setPublishTarget({ item, publish: !item.isPublished })}>
                  {item.isPublished ? (
                    <><RotateCcw className="h-3.5 w-3.5" /> Unpublish</>
                  ) : (
                    <><Globe className="h-3.5 w-3.5" /> Publish</>
                  )}
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canEdit, canPublish],
  );

  const publishedCount = items.filter((i) => i.isPublished).length;

  const summaryCard = 'bg-white rounded-lg border border-surface-200 p-5 cursor-pointer hover:bg-surface-50 transition-colors text-left';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content Management"
        description="Edit every page, write rich long-form descriptions and create new pages â€” your changes publish immediately."
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Content' }]}
        actions={
          canCreate ? (
            <Button onClick={openNewDialog}>
              <Plus className="h-4 w-4" /> New Page
            </Button>
          ) : undefined
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <button className={summaryCard} onClick={() => setStatusFilter('')}>
          <div className="flex items-center gap-3">
            <Badge variant="neutral">All</Badge>
            <span className="text-2xl font-bold text-surface-900">{items.length}</span>
          </div>
        </button>
        <button className={summaryCard} onClick={() => setStatusFilter('PUBLISHED')}>
          <div className="flex items-center gap-3">
            <Badge variant="success" dot>PUBLISHED</Badge>
            <span className="text-2xl font-bold text-surface-900">{publishedCount}</span>
          </div>
        </button>
        <button className={summaryCard} onClick={() => setStatusFilter('UNPUBLISHED')}>
          <div className="flex items-center gap-3">
            <Badge variant="warning" dot>UNPUBLISHED</Badge>
            <span className="text-2xl font-bold text-surface-900">{items.length - publishedCount}</span>
          </div>
        </button>
      </div>

      {/* Pending approvals â€” Manager/Admin/Super Admin review Content Manager proposals */}
      {canApprove && (
        <div className="rounded-lg border border-surface-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-surface-900">Pending approval</h2>
            <Badge variant="warning" dot>{pending.length}</Badge>
            <span className="text-xs text-surface-500">Changes by Content Managers go live only after you approve them.</span>
          </div>
          {pending.length === 0 ? (
            <p className="mt-3 text-sm text-surface-500">No changes waiting for approval.</p>
          ) : (
            <ul className="mt-3 divide-y divide-surface-100">
              {pending.map((rev) => (
                <li key={rev.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-surface-900">
                      {rev.proposedTitle} <span className="text-surface-400">({rev.contentItem.key})</span>
                    </p>
                    <p className="text-xs text-surface-500">
                      Proposed {relativeTime(rev.createdAt)} â€” appears on the storefront only after approval.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => review(rev.id, true)}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Approve &amp; Publish
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => review(rev.id, false)}>
                      <XCircle className="h-3.5 w-3.5" /> Reject
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select options={typeOptions} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-48" />
      </div>

      <Tabs
        tabs={[{ id: '', label: 'All' }, { id: 'PUBLISHED', label: 'Published' }, { id: 'UNPUBLISHED', label: 'Unpublished' }]}
        activeTab={statusFilter}
        onChange={setStatusFilter}
      />

      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        searchPlaceholder="Search pagesâ€¦"
        emptyState={
          <EmptyState
            icon={FileText}
            title="No pages found"
            description="Create your first page â€” it goes live on the website immediately."
          />
        }
      />

      {/* Publish / Unpublish dialog */}
      {publishTarget && (
        <Dialog
          open
          onClose={() => setPublishTarget(null)}
          title={publishTarget.publish ? 'Publish page?' : 'Unpublish page?'}
          description={
            publishTarget.publish
              ? 'This makes the page live on the website.'
              : 'This hides the page from the website. You can republish it any time.'
          }
          primaryAction={{
            label: publishTarget.publish ? 'Publish Now' : 'Unpublish',
            onClick: handleTogglePublish,
            isLoading: isSaving,
          }}
        >
          <div className="rounded-lg bg-surface-50 p-3 text-sm">
            <p><span className="font-medium">Title:</span> {publishTarget.item.title}</p>
            <p><span className="font-medium">Key:</span> <span className="font-mono">{publishTarget.item.key}</span></p>
          </div>
        </Dialog>
      )}

      {/* Edit page dialog */}
      {editTarget && (
        <Dialog
          open
          maxWidth="lg"
          onClose={() => setEditTarget(null)}
          title="Edit page"
          description="Changes are published to the website immediately when you save."
          primaryAction={{ label: 'Save & Publish', onClick: handleSaveEdit, isLoading: isSaving }}
        >
          <div className="space-y-4">
            <p className="font-mono text-xs text-surface-500">{editTarget.key}</p>
            <Input
              label="Title *"
              value={editForm.title}
              onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
            />
            <div>
              <label className="text-sm font-medium text-surface-700">Short description</label>
              <textarea
                value={editForm.shortDescription}
                onChange={(e) => setEditForm({ ...editForm, shortDescription: e.target.value })}
                rows={2}
                maxLength={500}
                placeholder="One-line summary shown in listings and cardsâ€¦"
                className="mt-1 w-full rounded-lg border border-surface-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 resize-none"
              />
            </div>
            <RichTextEditor
              label="Long description"
              value={editForm.longDescription}
              onChange={(html) => setEditForm({ ...editForm, longDescription: html })}
              placeholder="Full rich-text descriptionâ€¦"
              hint="Formatting supported: bold/italic, font family & size, headings, lists, alignment, links and image placement."
            />
            <RichTextEditor
              label="Custom section (body)"
              value={editForm.body}
              onChange={(html) => setEditForm({ ...editForm, body: html })}
              placeholder="Custom page section contentâ€¦"
              minHeight={200}
            />
          </div>
        </Dialog>
      )}

      {/* New page dialog */}
      {newDialog && (
        <Dialog
          open
          maxWidth="lg"
          onClose={() => setNewDialog(false)}
          title="New page"
          description="The page is created and published to the website immediately."
          primaryAction={{ label: 'Create & Publish', onClick: handleCreate, isLoading: isSaving }}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select
                label="Type"
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                options={TYPE_OPTIONS}
              />
              <Input
                label="URL key *"
                value={newKey}
                onChange={(e) => {
                  setKeyTouched(true);
                  setNewKey(e.target.value);
                }}
                placeholder="page.my-new-page"
                hint="Kebab-case segments separated by dots, e.g. about.story"
              />
            </div>
            <Input
              label="Title *"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Meet the Team"
            />
            <div>
              <label className="text-sm font-medium text-surface-700">Short description</label>
              <textarea
                value={newForm.shortDescription}
                onChange={(e) => setNewForm({ ...newForm, shortDescription: e.target.value })}
                rows={2}
                maxLength={500}
                placeholder="One-line summary shown in listings and cardsâ€¦"
                className="mt-1 w-full rounded-lg border border-surface-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 resize-none"
              />
            </div>
            <RichTextEditor
              label="Long description"
              value={newForm.longDescription}
              onChange={(html) => setNewForm({ ...newForm, longDescription: html })}
              placeholder="Full rich-text descriptionâ€¦"
              hint="Formatting supported: bold/italic, font family & size, headings, lists, alignment, links and image placement."
            />
            <RichTextEditor
              label="Custom section (body)"
              value={newForm.body}
              onChange={(html) => setNewForm({ ...newForm, body: html })}
              placeholder="Custom page section contentâ€¦"
              minHeight={200}
            />
          </div>
        </Dialog>
      )}
    </div>
  );
}
