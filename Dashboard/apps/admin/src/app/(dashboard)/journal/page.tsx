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
import { Tabs } from '@/components/ui/tabs';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { useToast } from '@/components/ui/toast';
import { Globe, Newspaper, Pencil, Plus, RotateCcw } from 'lucide-react';

/** A journal article — a ContentItem whose key starts with "journal.". */
interface JournalPost {
  id: string;
  key: string;
  title: string;
  shortDescription: string | null;
  longDescription: string | null;
  category: string | null;
  isPublished: boolean;
  updatedAt: string;
}

const CATEGORIES = ['Farming', 'Products', 'Sustainability', 'Behind the Scenes', 'Recipes'];
const EMPTY_FORM = { title: '', category: 'Farming', shortDescription: '', longDescription: '' };
type FormState = typeof EMPTY_FORM;

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '');
}
function categoryOf(post: JournalPost): string {
  if (post.category) return post.category;
  const segment = post.key.split('.')[1];
  return segment ? segment.replace(/-/g, ' ') : 'General';
}

/** Screen: Journal / Blog — backed by the live content API (journal.* items).
 *  Articles carry BOTH a short description (excerpt) and a long description
 *  edited with the rich-text toolbar (fonts, formatting, image placement). */
export default function JournalPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [posts, setPosts] = useState<JournalPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const canEdit = !!user && canAct(user.role, 'journal:edit');
  const canPublish = !!user && canAct(user.role, 'journal:publish');

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.get<JournalPost[]>('/content/manage');
      setPosts(data.filter((p) => p.key.startsWith('journal.')));
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Could not load articles',
        description: err instanceof ApiError ? err.message : 'Unexpected error',
      });
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Edit dialog ──
  const [editTarget, setEditTarget] = useState<JournalPost | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const openEdit = (post: JournalPost) => {
    setEditTarget(post);
    setEditForm({
      title: post.title,
      category: categoryOf(post),
      shortDescription: post.shortDescription ?? '',
      longDescription: post.longDescription ?? '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    if (!editForm.title.trim()) {
      addToast({ type: 'error', title: 'Title required', description: 'Article title cannot be empty.' });
      return;
    }
    setIsSaving(true);
    try {
      // body mirrors the long description so article content stays consistent.
      await apiClient.put(`/content/${encodeURIComponent(editTarget.key)}`, {
        title: editForm.title.trim(),
        category: editForm.category,
        shortDescription: editForm.shortDescription,
        longDescription: editForm.longDescription,
        body: editForm.longDescription,
      });
      addToast({ type: 'success', title: 'Article updated & published', description: editTarget.key });
      setEditTarget(null);
      await load();
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

  // ── New article dialog ──
  const [newDialog, setNewDialog] = useState(false);
  const [newForm, setNewForm] = useState<FormState>(EMPTY_FORM);

  const handleCreate = async () => {
    if (!newForm.title.trim()) {
      addToast({ type: 'error', title: 'Title required', description: 'Give the article a title.' });
      return;
    }
    const key = `journal.${slugify(newForm.category)}.${slugify(newForm.title)}`;
    setIsSaving(true);
    try {
      await apiClient.post('/content', {
        key,
        title: newForm.title.trim(),
        category: newForm.category,
        shortDescription: newForm.shortDescription,
        longDescription: newForm.longDescription,
        body: newForm.longDescription,
      });
      addToast({ type: 'success', title: 'Article created & published', description: newForm.title.trim() });
      setNewDialog(false);
      setNewForm(EMPTY_FORM);
      await load();
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

  // ── Publish / unpublish ──
  const [publishTarget, setPublishTarget] = useState<{ post: JournalPost; publish: boolean } | null>(null);

  const handleTogglePublish = async () => {
    if (!publishTarget) return;
    setIsSaving(true);
    try {
      await apiClient.post(
        `/content/${encodeURIComponent(publishTarget.post.key)}/${publishTarget.publish ? 'publish' : 'unpublish'}`,
      );
      addToast({
        type: 'success',
        title: publishTarget.publish ? 'Article published' : 'Article unpublished',
        description: publishTarget.post.title,
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
      posts.filter((p) => {
        if (statusFilter === 'PUBLISHED' && !p.isPublished) return false;
        if (statusFilter === 'UNPUBLISHED' && p.isPublished) return false;
        return true;
      }),
    [posts, statusFilter],
  );

  const columns = useMemo<ColumnDef<JournalPost>[]>(
    () => [
      {
        accessorKey: 'title',
        header: 'Article',
        cell: ({ row }) => (
          <div className="max-w-md">
            <p className="font-medium text-surface-900">{row.original.title}</p>
            <p className="text-xs text-surface-500 line-clamp-1">{row.original.shortDescription ?? '—'}</p>
          </div>
        ),
      },
      {
        id: 'category',
        header: 'Category',
        cell: ({ row }) => <Badge variant="neutral">{categoryOf(row.original)}</Badge>,
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
          const post = row.original;
          return (
            <div className="flex items-center gap-1" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
              {canEdit && (
                <Button variant="ghost" size="sm" onClick={() => openEdit(post)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
              )}
              {canPublish && (
                <Button variant="ghost" size="sm" onClick={() => setPublishTarget({ post, publish: !post.isPublished })}>
                  {post.isPublished ? (
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Journal / Blog"
        description="Write articles with a short description and a rich long description — fonts, formatting and image placement supported."
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Journal' }]}
        actions={
          canEdit ? (
            <Button onClick={() => { setNewForm(EMPTY_FORM); setNewDialog(true); }}>
              <Plus className="h-4 w-4" /> New Article
            </Button>
          ) : undefined
        }
      />

      <Tabs
        tabs={[{ id: '', label: 'All' }, { id: 'PUBLISHED', label: 'Published' }, { id: 'UNPUBLISHED', label: 'Unpublished' }]}
        activeTab={statusFilter}
        onChange={setStatusFilter}
      />

      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        searchPlaceholder="Search articles…"
        emptyState={
          <EmptyState
            icon={Newspaper}
            title="No articles yet"
            description="Create your first blog article to share stories about AamaKo Agro."
          />
        }
      />

      {/* Publish / Unpublish dialog */}
      {publishTarget && (
        <Dialog
          open
          onClose={() => setPublishTarget(null)}
          title={publishTarget.publish ? 'Publish article?' : 'Unpublish article?'}
          description={
            publishTarget.publish
              ? 'This makes the article visible on the public website.'
              : 'This hides the article from the website. You can republish it any time.'
          }
          primaryAction={{
            label: publishTarget.publish ? 'Publish Now' : 'Unpublish',
            onClick: handleTogglePublish,
            isLoading: isSaving,
          }}
        >
          <div className="rounded-lg bg-surface-50 p-3 text-sm">
            <p><span className="font-medium">Title:</span> {publishTarget.post.title}</p>
            <p><span className="font-medium">Category:</span> {categoryOf(publishTarget.post)}</p>
          </div>
        </Dialog>
      )}

      {/* Edit article dialog */}
      {editTarget && (
        <Dialog
          open
          maxWidth="lg"
          onClose={() => setEditTarget(null)}
          title="Edit article"
          description="Changes are published to the website immediately when you save."
          primaryAction={{ label: 'Save & Publish', onClick: handleSaveEdit, isLoading: isSaving }}
        >
          <div className="space-y-4">
            <p className="font-mono text-xs text-surface-500">{editTarget.key}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="Title *"
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              />
              <Select
                label="Category"
                value={editForm.category}
                onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                options={CATEGORIES.map((c) => ({ value: c, label: c }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-surface-700">Short description</label>
              <textarea
                value={editForm.shortDescription}
                onChange={(e) => setEditForm({ ...editForm, shortDescription: e.target.value })}
                rows={2}
                maxLength={500}
                placeholder="Short teaser shown in listings…"
                className="mt-1 w-full rounded-lg border border-surface-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 resize-none"
              />
            </div>
            <RichTextEditor
              label="Long description"
              value={editForm.longDescription}
              onChange={(html) => setEditForm({ ...editForm, longDescription: html })}
              placeholder="The full article…"
              minHeight={220}
              hint="Formatting supported: bold/italic, font family & size, headings, lists, alignment, links and image placement."
            />
          </div>
        </Dialog>
      )}

      {/* New article dialog */}
      {newDialog && (
        <Dialog
          open
          maxWidth="lg"
          onClose={() => setNewDialog(false)}
          title="New article"
          description="The article is created and published to the website immediately."
          primaryAction={{ label: 'Create & Publish', onClick: handleCreate, isLoading: isSaving }}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="Title *"
                value={newForm.title}
                onChange={(e) => setNewForm({ ...newForm, title: e.target.value })}
                placeholder="e.g. Harvest Stories from the Terai"
              />
              <Select
                label="Category"
                value={newForm.category}
                onChange={(e) => setNewForm({ ...newForm, category: e.target.value })}
                options={CATEGORIES.map((c) => ({ value: c, label: c }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-surface-700">Short description</label>
              <textarea
                value={newForm.shortDescription}
                onChange={(e) => setNewForm({ ...newForm, shortDescription: e.target.value })}
                rows={2}
                maxLength={500}
                placeholder="Short teaser shown in listings…"
                className="mt-1 w-full rounded-lg border border-surface-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 resize-none"
              />
            </div>
            <RichTextEditor
              label="Long description"
              value={newForm.longDescription}
              onChange={(html) => setNewForm({ ...newForm, longDescription: html })}
              placeholder="The full article…"
              minHeight={220}
              hint="Formatting supported: bold/italic, font family & size, headings, lists, alignment, links and image placement."
            />
          </div>
        </Dialog>
      )}
    </div>
  );
}