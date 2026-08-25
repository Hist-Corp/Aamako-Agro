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
import { Select } from '@/components/ui/select';
import { Tabs } from '@/components/ui/tabs';
import { Card, CardHeader } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { FileText, Plus, Edit, Eye, CheckCircle2, Send, Clock } from 'lucide-react';

type ContentStatus = 'DRAFT' | 'REVIEW' | 'APPROVED' | 'PUBLISHED';

interface ContentItem {
  id: string;
  title: string;
  type: 'HOMEPAGE' | 'PRODUCT' | 'PAGE' | 'BANNER' | 'FAQ' | 'ANNOUNCEMENT';
  status: ContentStatus;
  author: string;
  lastEditedBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

const MOCK_CONTENT: ContentItem[] = [
  { id: 'CNT-001', title: 'Homepage Hero Banner', type: 'HOMEPAGE', status: 'PUBLISHED', author: 'Hari Editor', lastEditedBy: 'Hari Editor', createdAt: new Date(Date.now() - 864000000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString(), publishedAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'CNT-002', title: 'About Us - Our Story', type: 'PAGE', status: 'DRAFT', author: 'Hari Editor', lastEditedBy: 'Hari Editor', createdAt: new Date(Date.now() - 172800000).toISOString(), updatedAt: new Date(Date.now() - 3600000).toISOString() },
  { id: 'CNT-003', title: 'Basmati Rice Product Description', type: 'PRODUCT', status: 'REVIEW', author: 'Hari Editor', lastEditedBy: 'Hari Editor', createdAt: new Date(Date.now() - 259200000).toISOString(), updatedAt: new Date(Date.now() - 7200000).toISOString() },
  { id: 'CNT-004', title: 'Summer Sale Banner', type: 'BANNER', status: 'APPROVED', author: 'Hari Editor', lastEditedBy: 'Super Admin', createdAt: new Date(Date.now() - 345600000).toISOString(), updatedAt: new Date(Date.now() - 172800000).toISOString() },
  { id: 'CNT-005', title: 'Frequently Asked Questions', type: 'FAQ', status: 'PUBLISHED', author: 'Hari Editor', lastEditedBy: 'Hari Editor', createdAt: new Date(Date.now() - 518400000).toISOString(), updatedAt: new Date(Date.now() - 259200000).toISOString(), publishedAt: new Date(Date.now() - 259200000).toISOString() },
  { id: 'CNT-006', title: 'New Product Launch Announcement', type: 'ANNOUNCEMENT', status: 'DRAFT', author: 'Hari Editor', lastEditedBy: 'Hari Editor', createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date(Date.now() - 3600000).toISOString() },
  { id: 'CNT-007', title: 'Wholesale Partnership Page', type: 'PAGE', status: 'REVIEW', author: 'Hari Editor', lastEditedBy: 'Hari Editor', createdAt: new Date(Date.now() - 432000000).toISOString(), updatedAt: new Date(Date.now() - 172800000).toISOString() },
  { id: 'CNT-008', title: 'Our Process - Farm to Table', type: 'PAGE', status: 'PUBLISHED', author: 'Hari Editor', lastEditedBy: 'Super Admin', createdAt: new Date(Date.now() - 604800000).toISOString(), updatedAt: new Date(Date.now() - 345600000).toISOString(), publishedAt: new Date(Date.now() - 345600000).toISOString() },
];

const STATUS_VARIANT: Record<ContentStatus, string> = {
  DRAFT: 'neutral',
  REVIEW: 'warning',
  APPROVED: 'info',
  PUBLISHED: 'success',
};

const TYPE_ICONS: Record<string, typeof FileText> = {
  HOMEPAGE: FileText,
  PRODUCT: FileText,
  PAGE: FileText,
  BANNER: FileText,
  FAQ: FileText,
  ANNOUNCEMENT: FileText,
};

/** Screen: Content Management
 *  Can view: SUPER_ADMIN, ADMIN, CONTENT_MANAGER
 *  Can edit: CONTENT_MANAGER
 *  Can approve/publish: SUPER_ADMIN, ADMIN
 */
export default function ContentPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [approveDialog, setApproveDialog] = useState<{ item: ContentItem; action: 'APPROVED' | 'PUBLISHED' } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const canEdit = user && canAct(user.role, 'content:edit');
  const canApprove = user && canAct(user.role, 'content:approve');

  const filteredContent = MOCK_CONTENT.filter((item) => {
    if (statusFilter && item.status !== statusFilter) return false;
    if (typeFilter && item.type !== typeFilter) return false;
    return true;
  });

  const handleApprove = async () => {
    if (!approveDialog) return;
    setIsProcessing(true);
    // Mock API call
    await new Promise((r) => setTimeout(r, 500));
    addToast({
      type: 'success',
      title: `Content ${approveDialog.action === 'APPROVED' ? 'approved' : 'published'}`,
      description: approveDialog.item.title,
    });
    setApproveDialog(null);
    setIsProcessing(false);
  };

  const handleSubmitForReview = (item: ContentItem) => {
    addToast({
      type: 'success',
      title: 'Submitted for review',
      description: `${item.title} has been sent for review.`,
    });
  };

  const columns = useMemo<ColumnDef<ContentItem>[]>(() => [
    {
      accessorKey: 'title',
      header: 'Content',
      cell: ({ row }) => {
        const Icon = TYPE_ICONS[row.original.type] || FileText;
        return (
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-surface-100">
              <Icon className="h-4 w-4 text-surface-500" />
            </div>
            <div>
              <p className="font-medium text-surface-900">{row.original.title}</p>
              <p className="text-2xs text-surface-400">{row.original.type.replace(/_/g, ' ')}</p>
            </div>
          </div>
        );
      },
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
      accessorKey: 'author',
      header: 'Author',
      cell: ({ row }) => (
        <span className="text-sm text-surface-600">{row.original.author}</span>
      ),
    },
    {
      accessorKey: 'updatedAt',
      header: 'Last Updated',
      cell: ({ row }) => (
        <div>
          <p className="text-sm tabular-nums">{relativeTime(row.original.updatedAt)}</p>
          <p className="text-2xs text-surface-400">by {row.original.lastEditedBy}</p>
        </div>
      ),
    },
    {
      id: 'actions',
      header: '',
      size: 200,
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex items-center gap-1" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            {canEdit && (
              <Button variant="ghost" size="sm">
                <Edit className="h-3.5 w-3.5" /> Edit
              </Button>
            )}
            {canEdit && item.status === 'DRAFT' && (
              <Button variant="secondary" size="sm" onClick={() => handleSubmitForReview(item)}>
                <Send className="h-3.5 w-3.5" /> Submit
              </Button>
            )}
            {canApprove && item.status === 'REVIEW' && (
              <>
                <Button variant="primary" size="sm" onClick={() => setApproveDialog({ item, action: 'APPROVED' })}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                </Button>
              </>
            )}
            {canApprove && item.status === 'APPROVED' && (
              <Button variant="primary" size="sm" onClick={() => setApproveDialog({ item, action: 'PUBLISHED' })}>
                <Send className="h-3.5 w-3.5" /> Publish
              </Button>
            )}
          </div>
        );
      },
    },
  ], [canEdit, canApprove]);

  const statusTabs = [
    { id: '', label: 'All' },
    { id: 'DRAFT', label: 'Drafts' },
    { id: 'REVIEW', label: 'In Review' },
    { id: 'APPROVED', label: 'Approved' },
    { id: 'PUBLISHED', label: 'Published' },
  ];

  const typeTabs = [
    { id: '', label: 'All Types' },
    { id: 'HOMEPAGE', label: 'Homepage' },
    { id: 'PRODUCT', label: 'Products' },
    { id: 'PAGE', label: 'Pages' },
    { id: 'BANNER', label: 'Banners' },
    { id: 'FAQ', label: 'FAQs' },
    { id: 'ANNOUNCEMENT', label: 'Announcements' },
  ];

  // Workflow summary
  const workflowCounts = {
    DRAFT: MOCK_CONTENT.filter((c) => c.status === 'DRAFT').length,
    REVIEW: MOCK_CONTENT.filter((c) => c.status === 'REVIEW').length,
    APPROVED: MOCK_CONTENT.filter((c) => c.status === 'APPROVED').length,
    PUBLISHED: MOCK_CONTENT.filter((c) => c.status === 'PUBLISHED').length,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content Management"
        description="Manage website content with draft → review → publish workflow"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Content' }]}
        actions={
          canEdit ? (
            <Button>
              <Plus className="h-4 w-4" /> New Content
            </Button>
          ) : undefined
        }
      />

      {/* Workflow Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {(['DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED'] as ContentStatus[]).map((status) => (
          <button
            key={status}
            className="bg-white rounded-lg border border-surface-200 p-5 cursor-pointer hover:bg-surface-50 transition-colors text-left"
            onClick={() => setStatusFilter(status)}
          >
            <div className="flex items-center gap-3">
              <Badge variant={(STATUS_VARIANT[status] ?? 'neutral') as any}>
                {status === 'DRAFT' && <Edit className="h-3 w-3 mr-1" />}
                {status === 'REVIEW' && <Clock className="h-3 w-3 mr-1" />}
                {status === 'APPROVED' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                {status === 'PUBLISHED' && <Send className="h-3 w-3 mr-1" />}
                {status}
              </Badge>
              <span className="text-2xl font-bold text-surface-900">{workflowCounts[status]}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select
          options={typeTabs.map((t) => ({ value: t.id, label: t.label }))}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="w-48"
        />
      </div>

      <Tabs tabs={statusTabs} activeTab={statusFilter} onChange={setStatusFilter} />

      <DataTable
        columns={columns}
        data={filteredContent}
        isLoading={false}
        searchPlaceholder="Search content…"
        emptyState={
          <EmptyState
            icon={FileText}
            title="No content found"
            description="Create your first content piece to get started with the CMS."
          />
        }
      />

      {/* Approve/Publish Dialog */}
      {approveDialog && (
        <Dialog
          open={!!approveDialog}
          onClose={() => setApproveDialog(null)}
          title={`${approveDialog.action === 'APPROVED' ? 'Approve' : 'Publish'} content?`}
          description={`This will ${approveDialog.action === 'APPROVED' ? 'mark the content as approved and ready for publishing' : 'make the content live on the website'}.`}
          primaryAction={{
            label: approveDialog.action === 'APPROVED' ? 'Approve Content' : 'Publish Now',
            onClick: handleApprove,
            isLoading: isProcessing,
          }}
        >
          <div className="rounded-lg bg-surface-50 p-3 text-sm">
            <p><span className="font-medium">Title:</span> {approveDialog.item.title}</p>
            <p><span className="font-medium">Type:</span> {approveDialog.item.type}</p>
            <p><span className="font-medium">Author:</span> {approveDialog.item.author}</p>
          </div>
        </Dialog>
      )}
    </div>
  );
}
