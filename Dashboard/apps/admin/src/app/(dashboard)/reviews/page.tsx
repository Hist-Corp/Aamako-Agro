'use client';

import React, { useState, useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useReviews, useModerateReview } from '@/lib/api-hooks';
import { useAuth } from '@/config/auth-context';
import { relativeTime } from '@/lib/utils';
import { canAct } from '@/config/rbac';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Badge, statusToBadgeVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs } from '@/components/ui/tabs';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import type { Review, ReviewStatus } from '@aamako/shared-types';
import { Star, CheckCircle2, XCircle, Flag } from 'lucide-react';

/** Screen: Reviews
 *  Can view: ADMIN, CONTENT_MANAGER
 *  Can moderate: ADMIN, CONTENT_MANAGER
 */
export default function ReviewsPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [statusFilter, setStatusFilter] = useState('');
  const [moderateDialog, setModerateDialog] = useState<{
    review: Review;
    action: 'APPROVED' | 'REJECTED' | 'FLAGGED';
  } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const canModerate = user && canAct(user.role, 'reviews:moderate');
  const moderateMutation = useModerateReview();

  const { data: reviewsData, isLoading } = useReviews({
    status: (statusFilter as ReviewStatus) || undefined,
  });
  const reviews = reviewsData?.data ?? [];

  const handleModerate = async () => {
    if (!moderateDialog) return;
    try {
      await moderateMutation.mutateAsync({
        id: moderateDialog.review.id,
        data: {
          status: moderateDialog.action,
          reason: rejectReason || undefined,
        },
      });
      addToast({
        type: 'success',
        title: `Review ${moderateDialog.action.toLowerCase()}`,
        description: `Review by ${moderateDialog.review.customerName} on ${moderateDialog.review.productName}`,
      });
      setModerateDialog(null);
      setRejectReason('');
    } catch (err: any) {
      addToast({ type: 'error', title: 'Moderation failed', description: err.message });
    }
  };

  const StarRating = ({ rating }: { rating: number }) => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${
            i <= rating ? 'text-amber-400 fill-amber-400' : 'text-surface-300'
          }`}
        />
      ))}
    </div>
  );

  const columns = useMemo<ColumnDef<Review>[]>(
    () => [
      {
        accessorKey: 'productName',
        header: 'Product',
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-surface-900">{row.original.productName}</p>
            <p className="text-2xs text-surface-400">by {row.original.customerName}</p>
          </div>
        ),
      },
      {
        accessorKey: 'rating',
        header: 'Rating',
        cell: ({ row }) => <StarRating rating={row.original.rating} />,
      },
      {
        accessorKey: 'content',
        header: 'Review',
        cell: ({ row }) => (
          <div className="max-w-md">
            {row.original.title && (
              <p className="font-medium text-surface-900 text-sm">{row.original.title}</p>
            )}
            <p className="text-xs text-surface-600 line-clamp-2">{row.original.content}</p>
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const { variant, label } = statusToBadgeVariant(row.original.status);
          return <Badge variant={variant} dot>{label}</Badge>;
        },
      },
      {
        accessorKey: 'isVerifiedPurchase',
        header: 'Verified',
        cell: ({ row }) =>
          row.original.isVerifiedPurchase ? (
            <Badge variant="success">Verified</Badge>
          ) : (
            <span className="text-xs text-surface-400">—</span>
          ),
      },
      {
        accessorKey: 'createdAt',
        header: 'Date',
        cell: ({ row }) => (
          <span className="text-xs text-surface-500">{relativeTime(row.original.createdAt)}</span>
        ),
      },
      ...(canModerate
        ? [
            {
              id: 'actions' as const,
              header: '' as const,
              size: 180,
              cell: ({ row }: { row: any }) => {
                const review = row.original as Review;
                if (review.status !== 'PENDING' && review.status !== 'FLAGGED') return null;
                return (
                  <div className="flex items-center gap-1" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setModerateDialog({ review, action: 'APPROVED' })}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setModerateDialog({ review, action: 'REJECTED' })}
                    >
                      <XCircle className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setModerateDialog({ review, action: 'FLAGGED' })}
                    >
                      <Flag className="h-3.5 w-3.5 text-amber-500" />
                    </Button>
                  </div>
                );
              },
            },
          ]
        : []),
    ],
    [canModerate]
  );

  const tabs = [
    { id: '', label: 'All' },
    { id: 'PENDING', label: 'Pending' },
    { id: 'APPROVED', label: 'Approved' },
    { id: 'REJECTED', label: 'Rejected' },
    { id: 'FLAGGED', label: 'Flagged' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reviews"
        description="Moderate customer reviews"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Reviews' }]}
      />

      <Tabs tabs={tabs} activeTab={statusFilter} onChange={setStatusFilter} />

      <DataTable
        columns={columns}
        data={reviews}
        isLoading={isLoading}
        searchPlaceholder="Search reviews…"
        emptyState={
          <EmptyState
            icon={Star}
            title="No reviews found"
            description="Customer reviews will appear here for moderation."
          />
        }
      />

      {moderateDialog && (
        <Dialog
          open={!!moderateDialog}
          onClose={() => { setModerateDialog(null); setRejectReason(''); }}
          title={`${moderateDialog.action} this review?`}
          description={`Review by ${moderateDialog.review.customerName} on "${moderateDialog.review.productName}"`}
          primaryAction={{
            label: moderateDialog.action === 'REJECTED' ? 'Reject Review' : moderateDialog.action === 'FLAGGED' ? 'Flag Review' : 'Approve Review',
            onClick: handleModerate,
          }}
        >
          <div className="space-y-4">
            <div className="rounded-lg bg-surface-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <StarRating rating={moderateDialog.review.rating} />
                {moderateDialog.review.isVerifiedPurchase && (
                  <Badge variant="success">Verified purchase</Badge>
                )}
              </div>
              {moderateDialog.review.title && (
                <p className="font-medium text-sm">{moderateDialog.review.title}</p>
              )}
              <p className="text-sm text-surface-600 mt-1">{moderateDialog.review.content}</p>
            </div>

            {(moderateDialog.action === 'REJECTED' || moderateDialog.action === 'FLAGGED') && (
              <div>
                <label className="text-sm font-medium text-surface-700">
                  {moderateDialog.action === 'REJECTED' ? 'Rejection reason' : 'Flag reason'}
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder={
                    moderateDialog.action === 'REJECTED'
                      ? 'Explain why this review is being rejected…'
                      : 'Explain why this review is being flagged…'
                  }
                  className="mt-1 w-full h-20 rounded-lg border border-surface-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 resize-none"
                />
              </div>
            )}
          </div>
        </Dialog>
      )}
    </div>
  );
}
