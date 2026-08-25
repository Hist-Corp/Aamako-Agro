'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { useOrders, useAdvanceOrder } from '@/lib/api-hooks';
import { useAuth } from '@/config/auth-context';
import { formatCurrency, formatDateTime, relativeTime } from '@/lib/utils';
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
import { ORDER_TRANSITIONS, type Order, type OrderStatus } from '@aamako/shared-types';
import { Eye, ShoppingCart } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'READY_TO_SHIP', label: 'Ready to Ship' },
  { value: 'SHIPPED', label: 'Shipped' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'REFUNDED', label: 'Refunded' },
];

const CHANNEL_OPTIONS = [
  { value: '', label: 'All Channels' },
  { value: 'RETAIL', label: 'Retail' },
  { value: 'WHOLESALE', label: 'Wholesale' },
];

/** Screen: Orders
 *  Can view: ADMIN, MANAGER, CUSTOMER_SUPPORT
 *  Can advance: ADMIN, MANAGER
 */
export default function OrdersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { addToast } = useToast();
  const [statusFilter, setStatusFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [advanceDialog, setAdvanceDialog] = useState<{ order: Order; to: OrderStatus } | null>(null);
  const [advanceReason, setAdvanceReason] = useState('');
  const [isAdvancing, setIsAdvancing] = useState(false);

  const canAdvance = user && canAct(user.role, 'orders:advance');
  const advanceMutation = useAdvanceOrder();

  const { data: ordersData, isLoading } = useOrders({
    status: (statusFilter as OrderStatus) || undefined,
    channel: (channelFilter as any) || undefined,
  });

  const orders = ordersData?.data ?? [];

  // Compute available transitions for a given status
  const getTransitions = (status: OrderStatus): OrderStatus[] => {
    return ORDER_TRANSITIONS[status] ?? [];
  };

  const handleAdvance = async () => {
    if (!advanceDialog) return;
    setIsAdvancing(true);
    try {
      await advanceMutation.mutateAsync({
        id: advanceDialog.order.id,
        to: advanceDialog.to,
        reason: advanceReason || undefined,
      });
      addToast({
        type: 'success',
        title: `Order ${advanceDialog.order.orderNumber} advanced to ${advanceDialog.to.replace(/_/g, ' ')}`,
      });
      setAdvanceDialog(null);
      setAdvanceReason('');
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Failed to advance order',
        description: err.message,
      });
    } finally {
      setIsAdvancing(false);
    }
  };

  // Next actionable transition for quick action
  const getNextTransition = (order: Order): OrderStatus | null => {
    const transitions = getTransitions(order.status);
    // Return the most common forward transition
    if (transitions.length === 1) return transitions[0];
    if (transitions.length > 1) {
      // Prefer the "happy path" transition
      const happyPath = ['CONFIRMED', 'PROCESSING', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED'];
      return happyPath.find((s) => transitions.includes(s as OrderStatus)) as OrderStatus ?? transitions[0];
    }
    return null;
  };

  const columns = useMemo<ColumnDef<Order>[]>(
    () => [
      {
        accessorKey: 'orderNumber',
        header: 'Order',
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-surface-900">{row.original.orderNumber}</p>
            <p className="text-2xs text-surface-400">{relativeTime(row.original.createdAt)}</p>
          </div>
        ),
      },
      {
        accessorKey: 'customerName',
        header: 'Customer',
        cell: ({ row }) => (
          <div>
            <p className="text-sm text-surface-700">{row.original.customerName}</p>
            <p className="text-2xs text-surface-400">{row.original.channel}</p>
          </div>
        ),
      },
      {
        accessorKey: 'itemCount',
        header: 'Items',
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.itemCount}</span>
        ),
      },
      {
        accessorKey: 'total',
        header: 'Total',
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">{formatCurrency(row.original.total)}</span>
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
        accessorKey: 'paymentStatus',
        header: 'Payment',
        cell: ({ row }) => {
          const { variant, label } = statusToBadgeVariant(row.original.paymentStatus);
          return <Badge variant={variant}>{label}</Badge>;
        },
      },
      {
        accessorKey: 'updatedAt',
        header: 'Updated',
        cell: ({ row }) => (
          <span className="text-xs text-surface-500">{formatDateTime(row.original.updatedAt)}</span>
        ),
      },
      {
        id: 'actions',
        header: '',
        size: 120,
        cell: ({ row }) => {
          const order = row.original;
          const nextTransition = canAdvance ? getNextTransition(order) : null;
          return (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              {nextTransition && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setAdvanceDialog({ order, to: nextTransition })}
                >
                  {nextTransition.replace(/_/g, ' ')}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/orders/${order.id}`)}
              >
                <Eye className="h-4 w-4" />
              </Button>
            </div>
          );
        },
      },
    ],
    [canAdvance, router]
  );

  const tabs = [
    { id: '', label: 'All', count: ordersData?.total },
    { id: 'PENDING', label: 'Pending' },
    { id: 'CONFIRMED', label: 'Confirmed' },
    { id: 'PROCESSING', label: 'Processing' },
    { id: 'SHIPPED', label: 'Shipped' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description="Manage order lifecycle and fulfillment"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Orders' }]}
      />

      {/* Quick-filter tabs */}
      <Tabs tabs={tabs} activeTab={statusFilter} onChange={setStatusFilter} />

      {/* Table */}
      <DataTable
        columns={columns}
        data={orders}
        isLoading={isLoading}
        searchPlaceholder="Search by order number, customer…"
        filterSlot={
          <Select
            options={CHANNEL_OPTIONS}
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="w-40 h-8"
          />
        }
        onRowClick={(order) => router.push(`/orders/${order.id}`)}
        emptyState={
          <EmptyState
            icon={ShoppingCart}
            title="No orders found"
            description={statusFilter ? `No orders with status "${statusFilter}"` : "Orders will appear here as they come in."}
          />
        }
      />

      {/* Advance confirmation dialog */}
      {advanceDialog && (
        <Dialog
          open={!!advanceDialog}
          onClose={() => {
            setAdvanceDialog(null);
            setAdvanceReason('');
          }}
          title={`Advance to ${advanceDialog.to.replace(/_/g, ' ')}?`}
          description={`This will change order ${advanceDialog.order.orderNumber} from ${advanceDialog.order.status.replace(/_/g, ' ')} to ${advanceDialog.to.replace(/_/g, ' ')}.`}
          primaryAction={{
            label: `Advance to ${advanceDialog.to.replace(/_/g, ' ')}`,
            onClick: handleAdvance,
            isLoading: isAdvancing,
          }}
        >
          <div className="space-y-3">
            <div className="rounded-lg bg-surface-50 p-3 text-sm">
              <p><span className="font-medium">Order:</span> {advanceDialog.order.orderNumber}</p>
              <p><span className="font-medium">Customer:</span> {advanceDialog.order.customerName}</p>
              <p><span className="font-medium">Total:</span> {formatCurrency(advanceDialog.order.total)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-surface-700">Reason (optional)</label>
              <textarea
                value={advanceReason}
                onChange={(e) => setAdvanceReason(e.target.value)}
                placeholder="Add a note about this status change…"
                className="mt-1 w-full h-20 rounded-lg border border-surface-200 p-3 text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40 resize-none"
              />
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
