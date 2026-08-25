'use client';

import React, { useState, useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useBatches, useRecallImpact, useInitiateRecall } from '@/lib/api-hooks';
import { useAuth } from '@/config/auth-context';
import { formatNumber, formatDate, formatDateTime } from '@/lib/utils';
import { canAct } from '@/config/rbac';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Badge, statusToBadgeVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Tabs } from '@/components/ui/tabs';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardHeader } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { Skeleton } from '@/components/ui/skeleton';
import type { Batch, QcStatus, RecallSeverity } from '@aamako/shared-types';
import { FlaskConical, AlertTriangle, Shield, Users, ShoppingCart, Warehouse } from 'lucide-react';

/** Screen: Batches & Recall
 *  Can view: ADMIN, INVENTORY_MANAGER
 *  Can initiate recall: ADMIN, INVENTORY_MANAGER
 */
export default function BatchesPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [qcFilter, setQcFilter] = useState('');
  const [recallDialog, setRecallDialog] = useState<Batch | null>(null);
  const [recallStep, setRecallStep] = useState<'preview' | 'confirm'>('preview');
  const [recallSeverity, setRecallSeverity] = useState<RecallSeverity>('HIGH');
  const [recallReason, setRecallReason] = useState('');
  const [notifyCustomers, setNotifyCustomers] = useState(true);
  const [isRecalling, setIsRecalling] = useState(false);

  const canRecall = user && canAct(user.role, 'batches:recall');
  const recallMutation = useInitiateRecall();

  const { data: batchesData, isLoading } = useBatches({
    qcStatus: (qcFilter as QcStatus) || undefined,
  });
  const batches = batchesData?.data ?? [];

  // Fetch recall impact when dialog opens
  const { data: recallImpact, isLoading: impactLoading } = useRecallImpact(
    recallDialog?.id ?? ''
  );

  const handleRecall = async () => {
    if (!recallDialog) return;
    setIsRecalling(true);
    try {
      await recallMutation.mutateAsync({
        batchId: recallDialog.id,
        severity: recallSeverity,
        reason: recallReason,
        notifyAffectedCustomers: notifyCustomers,
      });
      addToast({
        type: 'success',
        title: `Recall initiated for batch ${recallDialog.batchNumber}`,
        description: notifyCustomers
          ? `Affected customers will be notified.`
          : `No customer notifications sent.`,
      });
      setRecallDialog(null);
      resetRecall();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Recall failed', description: err.message });
    } finally {
      setIsRecalling(false);
    }
  };

  const resetRecall = () => {
    setRecallStep('preview');
    setRecallSeverity('HIGH');
    setRecallReason('');
    setNotifyCustomers(true);
  };

  const columns = useMemo<ColumnDef<Batch>[]>(
    () => [
      {
        accessorKey: 'batchNumber',
        header: 'Batch',
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-surface-900 font-mono">{row.original.batchNumber}</p>
            <p className="text-2xs text-surface-400">{row.original.productName}</p>
          </div>
        ),
      },
      {
        accessorKey: 'productionDate',
        header: 'Produced',
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">{formatDate(row.original.productionDate)}</span>
        ),
      },
      {
        accessorKey: 'expiryDate',
        header: 'Expires',
        cell: ({ row }) => {
          const daysUntilExpiry = Math.ceil(
            (new Date(row.original.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );
          const isExpired = daysUntilExpiry < 0;
          const isExpiringSoon = daysUntilExpiry >= 0 && daysUntilExpiry <= 30;
          return (
            <span
              className={
                isExpired
                  ? 'text-red-600 font-medium'
                  : isExpiringSoon
                  ? 'text-amber-600 font-medium'
                  : ''
              }
            >
              {formatDate(row.original.expiryDate)}
              {isExpired && ' (expired)'}
              {isExpiringSoon && ` (${daysUntilExpiry}d)`}
            </span>
          );
        },
      },
      {
        accessorKey: 'quantity',
        header: 'Quantity',
        cell: ({ row }) => (
          <span className="tabular-nums">{formatNumber(row.original.remainingQuantity)} / {formatNumber(row.original.quantity)}</span>
        ),
      },
      {
        accessorKey: 'qcStatus',
        header: 'QC Status',
        cell: ({ row }) => {
          const { variant, label } = statusToBadgeVariant(row.original.qcStatus);
          return <Badge variant={variant} dot>{label}</Badge>;
        },
      },
      {
        accessorKey: 'recallStatus',
        header: 'Recall',
        cell: ({ row }) => {
          if (row.original.recallStatus === 'NONE') {
            return <span className="text-xs text-surface-400">—</span>;
          }
          const { variant, label } = statusToBadgeVariant(row.original.recallStatus);
          return <Badge variant={variant}>{label}</Badge>;
        },
      },
      {
        accessorKey: 'supplier',
        header: 'Supplier',
        cell: ({ row }) => (
          <span className="text-sm text-surface-600">{row.original.supplier ?? '—'}</span>
        ),
      },
      ...(canRecall
        ? [
            {
              id: 'actions' as const,
              header: '' as const,
              size: 100,
              cell: ({ row }: { row: any }) => {
                const batch = row.original as Batch;
                if (batch.recallStatus !== 'NONE') return null;
                return (
                  <div onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        resetRecall();
                        setRecallDialog(batch);
                      }}
                    >
                      <Shield className="h-3.5 w-3.5" /> Recall
                    </Button>
                  </div>
                );
              },
            },
          ]
        : []),
    ],
    [canRecall]
  );

  const qcTabs = [
    { id: '', label: 'All' },
    { id: 'PENDING', label: 'Pending QC' },
    { id: 'PASSED', label: 'Passed' },
    { id: 'FAILED', label: 'Failed' },
    { id: 'QUARANTINED', label: 'Quarantined' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Batches & Recall"
        description="Batch tracking, QC status, and recall management"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Batches & Recall' }]}
      />

      <Tabs tabs={qcTabs} activeTab={qcFilter} onChange={setQcFilter} />

      <DataTable
        columns={columns}
        data={batches}
        isLoading={isLoading}
        searchPlaceholder="Search by batch number, product, supplier…"
        emptyState={
          <EmptyState
            icon={FlaskConical}
            title="No batches yet"
            description="Batches are created when production lots are received into inventory. Each batch tracks production date, expiry, QC status, and recall state."
          />
        }
      />

      {/* Recall initiation dialog — the multi-step workflow */}
      {recallDialog && (
        <Dialog
          open={!!recallDialog}
          onClose={() => { setRecallDialog(null); resetRecall(); }}
          title={
            recallStep === 'preview'
              ? `Recall impact: ${recallDialog.batchNumber}`
              : `Confirm recall: ${recallDialog.batchNumber}`
          }
          maxWidth="lg"
          primaryAction={
            recallStep === 'preview'
              ? { label: 'Proceed to confirm', onClick: () => setRecallStep('confirm') }
              : {
                  label: 'Initiate Recall',
                  onClick: handleRecall,
                  isLoading: isRecalling,
                }
          }
          destructiveAction={
            recallStep === 'confirm'
              ? {
                  label: 'Initiate Recall',
                  onClick: handleRecall,
                  isLoading: isRecalling,
                }
              : undefined
          }
        >
          {recallStep === 'preview' ? (
            <div className="space-y-4">
              {/* Impact preview */}
              <div className="rounded-lg bg-surface-50 p-4">
                <h4 className="text-sm font-semibold text-surface-900 mb-3">Recall Impact Assessment</h4>
                {impactLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full rounded" />
                    <Skeleton className="h-4 w-3/4 rounded" />
                  </div>
                ) : recallImpact ? (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-red-100 mx-auto mb-2">
                        <Warehouse className="h-5 w-5 text-red-600" />
                      </div>
                      <p className="text-2xl font-bold text-surface-900">{recallImpact.affectedInventoryCount}</p>
                      <p className="text-xs text-surface-500">Inventory records</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-100 mx-auto mb-2">
                        <ShoppingCart className="h-5 w-5 text-amber-600" />
                      </div>
                      <p className="text-2xl font-bold text-surface-900">{recallImpact.affectedOrderCount}</p>
                      <p className="text-xs text-surface-500">Affected orders</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100 mx-auto mb-2">
                        <Users className="h-5 w-5 text-blue-600" />
                      </div>
                      <p className="text-2xl font-bold text-surface-900">{recallImpact.affectedCustomerCount}</p>
                      <p className="text-xs text-surface-500">Affected customers</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-surface-500">Impact data unavailable</p>
                )}
              </div>

              {/* Affected orders preview */}
              {recallImpact && recallImpact.affectedOrders.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-surface-900 mb-2">Affected Orders (first 10)</h4>
                  <div className="border border-surface-200 rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-surface-50 border-b border-surface-200">
                          <th className="px-3 py-2 text-left font-semibold text-surface-600">Order</th>
                          <th className="px-3 py-2 text-left font-semibold text-surface-600">Customer</th>
                          <th className="px-3 py-2 text-right font-semibold text-surface-600">Qty</th>
                          <th className="px-3 py-2 text-left font-semibold text-surface-600">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recallImpact.affectedOrders.slice(0, 10).map((order) => (
                          <tr key={order.id} className="border-b border-surface-100">
                            <td className="px-3 py-2 font-medium">{order.orderNumber}</td>
                            <td className="px-3 py-2">{order.customerName}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{order.quantity}</td>
                            <td className="px-3 py-2">{order.status.replace(/_/g, ' ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {recallImpact.affectedOrders.length > 10 && (
                      <p className="px-3 py-2 text-xs text-surface-500 text-center bg-surface-50">
                        + {recallImpact.affectedOrders.length - 10} more orders
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Step 2: Confirm with severity and reason */
            <div className="space-y-4">
              <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-red-800">This action cannot be undone</p>
                    <p className="text-sm text-red-700 mt-1">
                      This will freeze inventory for batch {recallDialog.batchNumber} and
                      {notifyCustomers
                        ? ` notify ${recallImpact?.affectedCustomerCount ?? 0} affected customers.`
                        : ' not send customer notifications.'}
                    </p>
                  </div>
                </div>
              </div>

              <Select
                label="Severity"
                value={recallSeverity}
                onChange={(e) => setRecallSeverity(e.target.value as RecallSeverity)}
                options={[
                  { value: 'LOW', label: 'Low — monitoring, no immediate action' },
                  { value: 'MEDIUM', label: 'Medium — affected stock should be quarantined' },
                  { value: 'HIGH', label: 'High — immediate stock freeze required' },
                  { value: 'CRITICAL', label: 'Critical — health/safety risk, full recall' },
                ]}
              />

              <div>
                <label className="text-sm font-medium text-surface-700">
                  Reason (required)
                </label>
                <textarea
                  value={recallReason}
                  onChange={(e) => setRecallReason(e.target.value)}
                  placeholder="Describe the reason for this recall…"
                  className="mt-1 w-full h-20 rounded-lg border border-surface-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 resize-none"
                  required
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyCustomers}
                  onChange={(e) => setNotifyCustomers(e.target.checked)}
                  className="rounded border-surface-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="text-sm text-surface-700">
                  Notify {recallImpact?.affectedCustomerCount ?? 0} affected customers
                </span>
              </label>
            </div>
          )}
        </Dialog>
      )}
    </div>
  );
}
