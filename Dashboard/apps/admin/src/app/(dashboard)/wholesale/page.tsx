'use client';

import React, { useState, useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useBusinesses, useBusinessAction, useQuotes, useRespondToQuote } from '@/lib/api-hooks';
import { useAuth } from '@/config/auth-context';
import { formatCurrency, formatNumber, formatDateTime, relativeTime } from '@/lib/utils';
import { canAct } from '@/config/rbac';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Badge, statusToBadgeVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Tabs } from '@/components/ui/tabs';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import type { Business, BusinessStatus } from '@aamako/shared-types';
import { Building2, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/card';

/** Screen: Wholesale / Business Management
 *  Can view: ADMIN, MANAGER, SALES
 *  Can approve/reject: ADMIN
 *  Can respond to quotes: SALES
 */
export default function WholesalePage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState('applications');
  const [statusFilter, setStatusFilter] = useState('');
  const [actionDialog, setActionDialog] = useState<{
    business: Business;
    action: 'APPROVED' | 'REJECTED';
  } | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [priceTier, setPriceTier] = useState('');
  const [isActing, setIsActing] = useState(false);

  const canApprove = user && canAct(user.role, 'wholesale:approve');
  const businessMutation = useBusinessAction();
  const quoteMutation = useRespondToQuote();

  const { data: businessesData, isLoading } = useBusinesses({
    status: (statusFilter as BusinessStatus) || undefined,
  });
  const { data: quotes, isLoading: quotesLoading } = useQuotes();

  const businesses = businessesData?.data ?? [];

  const handleAction = async () => {
    if (!actionDialog) return;
    setIsActing(true);
    try {
      await businessMutation.mutateAsync({
        id: actionDialog.business.id,
        data: {
          status: actionDialog.action,
          reason: actionReason || undefined,
          priceTier: (priceTier as any) || undefined,
        },
      });
      addToast({
        type: 'success',
        title: `Business ${actionDialog.action === 'APPROVED' ? 'approved' : 'rejected'}`,
        description: actionDialog.business.businessName,
      });
      setActionDialog(null);
      setActionReason('');
      setPriceTier('');
    } catch (err: any) {
      addToast({ type: 'error', title: 'Action failed', description: err.message });
    } finally {
      setIsActing(false);
    }
  };

  const businessColumns = useMemo<ColumnDef<Business>[]>(
    () => [
      {
        accessorKey: 'businessName',
        header: 'Business',
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-surface-900">{row.original.businessName}</p>
            <p className="text-2xs text-surface-400">{row.original.contactName}</p>
          </div>
        ),
      },
      {
        accessorKey: 'contactEmail',
        header: 'Contact',
        cell: ({ row }) => (
          <div>
            <p className="text-sm text-surface-600">{row.original.contactEmail}</p>
            <p className="text-2xs text-surface-400">{row.original.contactPhone}</p>
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
        accessorKey: 'priceTier',
        header: 'Price Tier',
        cell: ({ row }) =>
          row.original.priceTier ? (
            <Badge variant="info">{row.original.priceTier}</Badge>
          ) : (
            <span className="text-xs text-surface-400">Not assigned</span>
          ),
      },
      {
        accessorKey: 'orderCount',
        header: 'Orders',
        cell: ({ row }) => (
          <span className="tabular-nums">{formatNumber(row.original.orderCount)}</span>
        ),
      },
      {
        accessorKey: 'totalSpend',
        header: 'Total Spend',
        cell: ({ row }) => (
          <span className="tabular-nums">{formatCurrency(row.original.totalSpend)}</span>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: 'Applied',
        cell: ({ row }) => (
          <span className="text-xs text-surface-500">{relativeTime(row.original.createdAt)}</span>
        ),
      },
      ...(canApprove
        ? [
            {
              id: 'actions' as const,
              header: '' as const,
              size: 160,
              cell: ({ row }: { row: any }) => {
                const biz = row.original as Business;
                if (biz.status !== 'PENDING') return null;
                return (
                  <div className="flex items-center gap-1" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setActionDialog({ business: biz, action: 'APPROVED' })}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setActionDialog({ business: biz, action: 'REJECTED' })}
                    >
                      <XCircle className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </div>
                );
              },
            },
          ]
        : []),
    ],
    [canApprove]
  );

  const statusTabs = [
    { id: '', label: 'All' },
    { id: 'PENDING', label: 'Pending Approval' },
    { id: 'APPROVED', label: 'Approved' },
    { id: 'REJECTED', label: 'Rejected' },
    { id: 'SUSPENDED', label: 'Suspended' },
  ];

  const mainTabs = [
    { id: 'applications', label: 'Applications', count: businessesData?.total },
    { id: 'quotes', label: 'Quote Requests', count: quotes?.length },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wholesale / Business"
        description="Manage wholesale applications and quote requests"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Wholesale' }]}
      />

      <Tabs tabs={mainTabs} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'applications' && (
        <>
          <Tabs tabs={statusTabs} activeTab={statusFilter} onChange={setStatusFilter} />
          <DataTable
            columns={businessColumns}
            data={businesses}
            isLoading={isLoading}
            searchPlaceholder="Search by business name, contact…"
            emptyState={
              <EmptyState
                icon={Building2}
                title="No wholesale applications"
                description="Business applications will appear here when companies apply for wholesale accounts."
              />
            }
          />
        </>
      )}

      {activeTab === 'quotes' && (
        <Card>
          <CardHeader title="Quote Requests" />
          {/* Quote list - simplified for now */}
          <div className="px-5 pb-5">
            {!quotes || quotes.length === 0 ? (
              <EmptyState
                icon={Building2}
                title="No pending quotes"
                description="Quote requests from wholesale customers will appear here."
              />
            ) : (
              <div className="space-y-3">
                {quotes.map((quote) => (
                  <div key={quote.id} className="flex items-center justify-between p-4 rounded-lg border border-surface-200 hover:bg-surface-50 transition-colors">
                    <div>
                      <p className="font-medium text-surface-900">{quote.businessName}</p>
                      <p className="text-xs text-surface-500">
                        {quote.items.length} items • {relativeTime(quote.createdAt)}
                      </p>
                      {quote.notes && (
                        <p className="text-xs text-surface-500 mt-1">{quote.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={quote.status === 'PENDING' ? 'warning' : 'neutral'}>{quote.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Approve/Reject dialog */}
      {actionDialog && (
        <Dialog
          open={!!actionDialog}
          onClose={() => { setActionDialog(null); setActionReason(''); setPriceTier(''); }}
          title={
            actionDialog.action === 'APPROVED'
              ? `Approve ${actionDialog.business.businessName}?`
              : `Reject ${actionDialog.business.businessName}?`
          }
          description={
            actionDialog.action === 'APPROVED'
              ? 'This will grant the business wholesale access and pricing.'
              : 'This will deny the wholesale application. The business will be notified.'
          }
          primaryAction={{
            label: actionDialog.action === 'APPROVED' ? 'Approve Business' : 'Reject Application',
            onClick: handleAction,
            isLoading: isActing,
          }}
        >
          <div className="space-y-4">
            <div className="rounded-lg bg-surface-50 p-3 text-sm space-y-1">
              <p><span className="font-medium">Business:</span> {actionDialog.business.businessName}</p>
              <p><span className="font-medium">Contact:</span> {actionDialog.business.contactName}</p>
              <p><span className="font-medium">Email:</span> {actionDialog.business.contactEmail}</p>
              <p><span className="font-medium">Phone:</span> {actionDialog.business.contactPhone}</p>
            </div>

            {actionDialog.action === 'APPROVED' && (
              <Select
                label="Assign Price Tier"
                value={priceTier}
                onChange={(e) => setPriceTier(e.target.value)}
                options={[
                  { value: '', label: 'No tier assigned yet' },
                  { value: 'TIER_1', label: 'Tier 1 — Standard wholesale' },
                  { value: 'TIER_2', label: 'Tier 2 — Volume discount' },
                  { value: 'TIER_3', label: 'Tier 3 — Premium partner' },
                ]}
              />
            )}

            <div>
              <label className="text-sm font-medium text-surface-700">
                {actionDialog.action === 'APPROVED' ? 'Welcome note (optional)' : 'Rejection reason (required)'}
              </label>
              <textarea
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder={
                  actionDialog.action === 'APPROVED'
                    ? 'Add a welcome message…'
                    : 'Explain why this application is being rejected…'
                }
                className="mt-1 w-full h-20 rounded-lg border border-surface-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 resize-none"
              />
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
