'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useOrder, useAdvanceOrder } from '@/lib/api-hooks';
import { useAuth } from '@/config/auth-context';
import { formatCurrency, formatDateTime, formatDate } from '@/lib/utils';
import { canAct } from '@/config/rbac';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge, statusToBadgeVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { TableSkeleton } from '@/components/ui/skeleton';
import { ORDER_TRANSITIONS, type OrderStatus } from '@aamako/shared-types';
import { ArrowLeft, Package, Truck, CreditCard, MapPin } from 'lucide-react';

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { addToast } = useToast();
  const orderId = params.id as string;
  const canAdvance = user && canAct(user.role, 'orders:advance');

  const { data: order, isLoading } = useOrder(orderId);
  const advanceMutation = useAdvanceOrder();

  const [advanceDialog, setAdvanceDialog] = useState<{ to: OrderStatus } | null>(null);
  const [advanceReason, setAdvanceReason] = useState('');
  const [isAdvancing, setIsAdvancing] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-48 rounded" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 skeleton h-96 rounded-lg" />
          <div className="skeleton h-96 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-16">
        <p className="text-surface-500">Order not found</p>
        <Button variant="secondary" onClick={() => router.back()} className="mt-4">
          <ArrowLeft className="h-4 w-4" /> Go back
        </Button>
      </div>
    );
  }

  const transitions = ORDER_TRANSITIONS[order.status] ?? [];

  const handleAdvance = async () => {
    if (!advanceDialog) return;
    setIsAdvancing(true);
    try {
      await advanceMutation.mutateAsync({
        id: order.id,
        to: advanceDialog.to,
        reason: advanceReason || undefined,
      });
      addToast({
        type: 'success',
        title: `Order advanced to ${advanceDialog.to.replace(/_/g, ' ')}`,
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

  const { variant: statusVariant, label: statusLabel } = statusToBadgeVariant(order.status);
  const { variant: paymentVariant, label: paymentLabel } = statusToBadgeVariant(order.paymentStatus);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Order ${order.orderNumber}`}
        description={`Placed ${formatDateTime(order.createdAt)}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Orders', href: '/orders' },
          { label: order.orderNumber },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => router.push('/orders')}>
              <ArrowLeft className="h-4 w-4" /> Back to Orders
            </Button>
            {canAdvance && transitions.length > 0 && (
              <Button onClick={() => setAdvanceDialog({ to: transitions[0] })}>
                Advance to {transitions[0].replace(/_/g, ' ')}
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status bar */}
          <Card>
            <div className="flex items-center gap-6">
              <div>
                <p className="text-xs text-surface-500">Status</p>
                <Badge variant={statusVariant} dot>{statusLabel}</Badge>
              </div>
              <div>
                <p className="text-xs text-surface-500">Payment</p>
                <Badge variant={paymentVariant}>{paymentLabel}</Badge>
              </div>
              <div>
                <p className="text-xs text-surface-500">Channel</p>
                <p className="text-sm font-medium">{order.channel}</p>
              </div>
              <div>
                <p className="text-xs text-surface-500">Total</p>
                <p className="text-lg font-semibold">{formatCurrency(order.total)}</p>
              </div>
            </div>
          </Card>

          {/* Line items */}
          <Card>
            <CardHeader title="Items" description={`${order.items.length} product(s) in this order`} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-200">
                    <th className="px-4 py-2 text-left text-xs font-semibold text-surface-500">Product</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-surface-500">Batch/Lot</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-surface-500">Qty</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-surface-500">Price</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-surface-500">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id} className="border-b border-surface-100">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-surface-900">{item.productName}</p>
                          {item.variantName && (
                            <p className="text-2xs text-surface-400">{item.variantName}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {item.batchNumber ? (
                          <Badge variant="info">{item.batchNumber}</Badge>
                        ) : (
                          <span className="text-xs text-surface-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{item.quantity}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(item.unitPrice)}</td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">{formatCurrency(item.totalPrice)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-surface-200">
                    <td colSpan={4} className="px-4 py-2 text-right text-sm text-surface-500">Subtotal</td>
                    <td className="px-4 py-2 text-right font-medium tabular-nums">{formatCurrency(order.subtotal)}</td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="px-4 py-1 text-right text-sm text-surface-500">Tax</td>
                    <td className="px-4 py-1 text-right tabular-nums">{formatCurrency(order.tax)}</td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="px-4 py-1 text-right text-sm text-surface-500">Shipping</td>
                    <td className="px-4 py-1 text-right tabular-nums">{formatCurrency(order.shippingCost)}</td>
                  </tr>
                  <tr className="border-t border-surface-200">
                    <td colSpan={4} className="px-4 py-2 text-right text-sm font-semibold">Total</td>
                    <td className="px-4 py-2 text-right font-bold tabular-nums">{formatCurrency(order.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer */}
          <Card>
            <CardHeader title="Customer" icon={Package} />
            <div className="space-y-2 text-sm">
              <p className="font-medium">{order.customerName}</p>
              <p className="text-surface-500">{order.customerEmail}</p>
            </div>
          </Card>

          {/* Shipping Address */}
          <Card>
            <CardHeader title="Shipping Address" icon={MapPin} />
            <div className="text-sm text-surface-600 space-y-0.5">
              <p>{order.shippingAddress.line1}</p>
              {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
              <p>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}</p>
              <p>{order.shippingAddress.country}</p>
            </div>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader title="Timeline" />
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <div className="h-2 w-2 rounded-full bg-brand-500 mt-1.5" />
                <div>
                  <p className="font-medium">Order Placed</p>
                  <p className="text-2xs text-surface-400">{formatDateTime(order.createdAt)}</p>
                </div>
              </div>
              {order.shippedAt && (
                <div className="flex items-start gap-3">
                  <div className="h-2 w-2 rounded-full bg-blue-500 mt-1.5" />
                  <div>
                    <p className="font-medium">Shipped</p>
                    <p className="text-2xs text-surface-400">{formatDateTime(order.shippedAt)}</p>
                  </div>
                </div>
              )}
              {order.deliveredAt && (
                <div className="flex items-start gap-3">
                  <div className="h-2 w-2 rounded-full bg-green-500 mt-1.5" />
                  <div>
                    <p className="font-medium">Delivered</p>
                    <p className="text-2xs text-surface-400">{formatDateTime(order.deliveredAt)}</p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Notes */}
          {order.notes && (
            <Card>
              <CardHeader title="Notes" />
              <p className="text-sm text-surface-600">{order.notes}</p>
            </Card>
          )}
        </div>
      </div>

      {/* Advance dialog */}
      {advanceDialog && (
        <Dialog
          open={!!advanceDialog}
          onClose={() => { setAdvanceDialog(null); setAdvanceReason(''); }}
          title={`Advance to ${advanceDialog.to.replace(/_/g, ' ')}?`}
          description={`This will change order ${order.orderNumber} status.`}
          primaryAction={{
            label: `Advance to ${advanceDialog.to.replace(/_/g, ' ')}`,
            onClick: handleAdvance,
            isLoading: isAdvancing,
          }}
        >
          <div className="space-y-3">
            <div className="rounded-lg bg-surface-50 p-3 text-sm">
              <p><span className="font-medium">From:</span> {order.status.replace(/_/g, ' ')}</p>
              <p><span className="font-medium">To:</span> {advanceDialog.to.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-surface-700">Reason (optional)</label>
              <textarea
                value={advanceReason}
                onChange={(e) => setAdvanceReason(e.target.value)}
                placeholder="Add a note…"
                className="mt-1 w-full h-20 rounded-lg border border-surface-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 resize-none"
              />
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
