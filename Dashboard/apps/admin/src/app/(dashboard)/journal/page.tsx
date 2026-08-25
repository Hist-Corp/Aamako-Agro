'use client';

import React, { useState, useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useAuth } from '@/config/auth-context';
import { formatDateTime, relativeTime } from '@/lib/utils';
import { canAct } from '@/config/rbac';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs } from '@/components/ui/tabs';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { Newspaper, Plus, Edit, Eye, Send, CheckCircle2 } from 'lucide-react';

type JournalStatus = 'DRAFT' | 'REVIEW' | 'PUBLISHED';

interface JournalPost {
  id: string;
  title: string;
  excerpt: string;
  category: string;
  status: JournalStatus;
  author: string;
  views: number;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

const MOCK_POSTS: JournalPost[] = [
  { id: 'JRN-001', title: 'The Art of Traditional Rice Farming in Nepal', excerpt: 'Exploring the centuries-old techniques that make Nepali basmati rice some of the finest in the world...', category: 'Farming', status: 'PUBLISHED', author: 'Hari Editor', views: 1245, createdAt: new Date(Date.now() - 864000000).toISOString(), updatedAt: new Date(Date.now() - 432000000).toISOString(), publishedAt: new Date(Date.now() - 432000000).toISOString() },
  { id: 'JRN-002', title: 'Cold-Pressed Mustard Oil: Benefits & Uses', excerpt: 'Why cold-pressed mustard oil is superior for cooking and its health benefits...', category: 'Products', status: 'PUBLISHED', author: 'Hari Editor', views: 892, createdAt: new Date(Date.now() - 604800000).toISOString(), updatedAt: new Date(Date.now() - 259200000).toISOString(), publishedAt: new Date(Date.now() - 259200000).toISOString() },
  { id: 'JRN-003', title: 'Sustainable Agriculture Practices', excerpt: 'How AamaKo Agro is committed to sustainable farming and eco-friendly practices...', category: 'Sustainability', status: 'DRAFT', author: 'Hari Editor', views: 0, createdAt: new Date(Date.now() - 172800000).toISOString(), updatedAt: new Date(Date.now() - 3600000).toISOString() },
  { id: 'JRN-004', title: 'Spice Guide: Turmeric Benefits', excerpt: 'A comprehensive guide to turmeric and its various health benefits...', category: 'Products', status: 'REVIEW', author: 'Hari Editor', views: 0, createdAt: new Date(Date.now() - 259200000).toISOString(), updatedAt: new Date(Date.now() - 7200000).toISOString() },
  { id: 'JRN-005', title: 'Farm-to-Table Journey', excerpt: 'Follow the journey of our products from the farms of Terai to your kitchen...', category: 'Behind the Scenes', status: 'PUBLISHED', author: 'Hari Editor', views: 2103, createdAt: new Date(Date.now() - 1296000000).toISOString(), updatedAt: new Date(Date.now() - 864000000).toISOString(), publishedAt: new Date(Date.now() - 864000000).toISOString() },
];

const STATUS_VARIANT: Record<JournalStatus, string> = {
  DRAFT: 'neutral',
  REVIEW: 'warning',
  PUBLISHED: 'success',
};

/** Screen: Journal / Blog
 *  Can view: SUPER_ADMIN, ADMIN, CONTENT_MANAGER
 *  Can edit: CONTENT_MANAGER
 *  Can publish: SUPER_ADMIN, ADMIN
 */
export default function JournalPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [statusFilter, setStatusFilter] = useState('');
  const [publishDialog, setPublishDialog] = useState<JournalPost | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  const canEdit = user && canAct(user.role, 'journal:edit');
  const canPublish = user && canAct(user.role, 'journal:publish');

  const filteredPosts = MOCK_POSTS.filter((p) => {
    if (statusFilter && p.status !== statusFilter) return false;
    return true;
  });

  const handlePublish = async () => {
    if (!publishDialog) return;
    setIsPublishing(true);
    await new Promise((r) => setTimeout(r, 500));
    addToast({
      type: 'success',
      title: 'Article published',
      description: publishDialog.title,
    });
    setPublishDialog(null);
    setIsPublishing(false);
  };

  const columns = useMemo<ColumnDef<JournalPost>[]>(() => [
    {
      accessorKey: 'title',
      header: 'Article',
      cell: ({ row }) => (
        <div className="max-w-md">
          <p className="font-medium text-surface-900">{row.original.title}</p>
          <p className="text-xs text-surface-500 line-clamp-1">{row.original.excerpt}</p>
        </div>
      ),
    },
    {
      accessorKey: 'category',
      header: 'Category',
      cell: ({ row }) => (
        <Badge variant="neutral">{row.original.category}</Badge>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={(STATUS_VARIANT[row.original.status] ?? 'neutral') as any} dot>
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: 'views',
      header: 'Views',
      cell: ({ row }) => (
        <span className="tabular-nums text-surface-600">{row.original.views.toLocaleString()}</span>
      ),
    },
    {
      accessorKey: 'updatedAt',
      header: 'Updated',
      cell: ({ row }) => (
        <span className="text-xs text-surface-500">{relativeTime(row.original.updatedAt)}</span>
      ),
    },
    {
      id: 'actions',
      header: '',
      size: 150,
      cell: ({ row }) => {
        const post = row.original;
        return (
          <div className="flex items-center gap-1" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            {canEdit && (
              <Button variant="ghost" size="sm">
                <Edit className="h-3.5 w-3.5" /> Edit
              </Button>
            )}
            {canPublish && post.status === 'REVIEW' && (
              <Button variant="primary" size="sm" onClick={() => setPublishDialog(post)}>
                <Send className="h-3.5 w-3.5" /> Publish
              </Button>
            )}
          </div>
        );
      },
    },
  ], [canEdit, canPublish]);

  const tabs = [
    { id: '', label: 'All' },
    { id: 'DRAFT', label: 'Drafts' },
    { id: 'REVIEW', label: 'In Review' },
    { id: 'PUBLISHED', label: 'Published' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Journal / Blog"
        description="Manage blog articles and editorial content"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Journal' }]}
        actions={
          canEdit ? (
            <Button>
              <Plus className="h-4 w-4" /> New Article
            </Button>
          ) : undefined
        }
      />

      <Tabs tabs={tabs} activeTab={statusFilter} onChange={setStatusFilter} />

      <DataTable
        columns={columns}
        data={filteredPosts}
        isLoading={false}
        searchPlaceholder="Search articles…"
        emptyState={
          <EmptyState
            icon={Newspaper}
            title="No articles yet"
            description="Create your first blog article to share stories about AamaKo Agro."
          />
        }
      />

      {/* Publish Dialog */}
      {publishDialog && (
        <Dialog
          open={!!publishDialog}
          onClose={() => setPublishDialog(null)}
          title="Publish article?"
          description="This will make the article visible on the public website."
          primaryAction={{
            label: 'Publish Now',
            onClick: handlePublish,
            isLoading: isPublishing,
          }}
        >
          <div className="rounded-lg bg-surface-50 p-3 text-sm">
            <p><span className="font-medium">Title:</span> {publishDialog.title}</p>
            <p><span className="font-medium">Category:</span> {publishDialog.category}</p>
            <p><span className="font-medium">Author:</span> {publishDialog.author}</p>
          </div>
        </Dialog>
      )}
    </div>
  );
}
