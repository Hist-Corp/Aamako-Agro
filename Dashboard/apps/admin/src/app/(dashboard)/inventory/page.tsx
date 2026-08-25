'use client';

import React, { useState, useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useInventory, useAdjustInventory } from '@/lib/api-hooks';
import { useAuth } from '@/config/auth-context';
import { formatNumber, formatDateTime } from '@/lib/utils';
import { canAct } from '@/config/rbac';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Dialog } from '@/components/ui/dialog';
import { Tabs } from '@/components/ui/tabs';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { Warehouse, AlertTriangle, Settings } from 'lucide-react';
import { type InventoryItem, type AdjustmentReason } from '@aamako/shared-types';

const REASON_OPTIONS: { value: AdjustmentReason; label: string }[] = [
  { value: 'RECEIVED', label: 'Received' },
  { value: 'DAMAGED', label: 'Damaged' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'RECALLED', label: 'Recalled' },
  { value: 'CORRECTION', label: 'Count Correction' },
  { value: 'CYCLE_COUNT', label: 'Cycle Count' },
  { value: 'RETURN', label: 'Customer Return' },
  { value: 'TRANSFER', label: 'Warehouse Transfer' },
];

/** Screen: Inventory
 *  Can view: ADMIN, INVENTORY_MANAGER
 *  Can adjust: ADMIN, INVENTORY_MANAGER
 */
export default function InventoryPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [adjustDialog, setAdjustDialog] = useState<InventoryItem | null>(null);
  const [adjustValue, setAdjustValue] = useState('');
  const [adjustReason, setAdjustReason] = useState<AdjustmentReason | ''>('');
  const [adjustNote, setAdjustNote] = useState('');
  const [isAdjusting, setIsAdjusting] = useState(false);

  const canAdjust = user && canAct(user.role, 'inventory:adjust');
  const adjustMutation = useAdjustInventory();

  const { data: inventoryData, isLoading } = useInventory({
    lowStock: lowStockOnly || undefined,
  });

  const inventory = inventoryData?.data ?? [];

  const handleAdjust = async () => {
    if (!adjustDialog || !adjustReason) return;
    setIsAdjusting(true);
    const newQty = adjustDialog.quantity + parseInt(adjustValue, 10);
    try {
      await adjustMutation.mutateAsync({
        inventoryItemId: adjustDialog.id,
        adjustment: parseInt(adjustValue, 10),
        reason: adjustReason,
        reasonNote: adjustNote,
      });
      addToast({
        type: 'success',
        title: `Stock adjusted: ${adjustDialog.productName}`,
        description: `${adjustDialog.quantity} → ${newQty}`,
      });
      setAdjustDialog(null);
      setAdjustValue('');
      setAdjustReason('');
      setAdjustNote('');
    } catch (err: any) {
      addToast({ type: 'error', title: 'Adjustment failed', description: err.message });
    } finally {
      setIsAdjusting(false);
    }
  };

  const columns = useMemo<ColumnDef<InventoryItem>[]>(
    () => [
      {
        accessorKey: 'productName',
        header: 'Product',
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-surface-900">{row.original.productName}</p>
            {row.original.variantName && (
              <p className="text-2xs text-surface-400">{row.original.variantName}</p>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'warehouseName',
        header: 'Warehouse',
        cell: ({ row }) => (
          <span className="text-sm text-surface-600">{row.original.warehouseName}</span>
        ),
      },
      {
        accessorKey: 'batchNumber',
        header: 'Batch',
        cell: ({ row }) =>
          row.original.batchNumber ? (
            <Badge variant="info">{row.original.batchNumber}</Badge>
          ) : (
            <span className="text-xs text-surface-400">—</span>
          ),
      },
      {
        accessorKey: 'quantity',
        header: 'On Hand',
        cell: ({ row }) => {
          const isLow = row.original.quantity <= row.original.reorderLevel;
          return (
            <span className={`tabular-nums font-medium ${isLow ? 'text-red-600' : ''}`}>
              {formatNumber(row.original.quantity)}
            </span>
          );
        },
      },
      {
        accessorKey: 'reservedQuantity',
        header: 'Reserved',
        cell: ({ row }) => (
          <span className="tabular-nums text-surface-500">{formatNumber(row.original.reservedQuantity)}</span>
        ),
      },
      {
        accessorKey: 'availableQuantity',
        header: 'Available',
        cell: ({ row }) => (
          <span className="tabular-nums font-medium">{formatNumber(row.original.availableQuantity)}</span>
        ),
      },
      {
        accessorKey: 'reorderLevel',
        header: 'Reorder At',
        cell: ({ row }) => {
          const isLow = row.original.quantity <= row.original.reorderLevel;
          return (
            <div className="flex items-center gap-1.5">
              <span className="tabular-nums">{formatNumber(row.original.reorderLevel)}</span>
              {isLow && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
            </div>
          );
        },
      },
      ...(canAdjust
        ? [
            {
              id: 'actions' as const,
              header: '' as const,
              size: 100,
              cell: ({ row }: { row: any }) => (
                <div onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                  <Button variant="secondary" size="sm" onClick={() => setAdjustDialog(row.original)}>
                    <Settings className="h-3.5 w-3.5" /> Adjust
                  </Button>
                </div>
              ),
            },
          ]
        : []),
    ],
    [canAdjust]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Stock levels across all warehouses"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Inventory' }]}
        actions={
          canAdjust ? (
            <Button onClick={() => setLowStockOnly(!lowStockOnly)}>
              {lowStockOnly ? 'Show All' : (
                <><AlertTriangle className="h-4 w-4" /> Low Stock Only</>
              )}
            </Button>
          ) : undefined
        }
      />

      <DataTable
        columns={columns}
        data={inventory}
        isLoading={isLoading}
        searchPlaceholder="Search by product, warehouse, batch…"
        emptyState={
          <EmptyState
            icon={Warehouse}
            title="No inventory data"
            description="Inventory records will appear here once products are assigned to warehouses and stock is received."
          />
        }
      />

      {/* Adjustment dialog — every adjustment requires a reason code */}
      {adjustDialog && (
        <Dialog
          open={!!adjustDialog}
          onClose={() => { setAdjustDialog(null); setAdjustValue(''); setAdjustReason(''); setAdjustNote(''); }}
          title="Adjust Stock"
          description={`Adjust inventory for ${adjustDialog.productName} at ${adjustDialog.warehouseName}`}
          primaryAction={{
            label: 'Apply Adjustment',
            onClick: handleAdjust,
            isLoading: isAdjusting,
          }}
        >
          <div className="space-y-4">
            <div className="rounded-lg bg-surface-50 p-3 text-sm">
              <p><span className="font-medium">Current stock:</span> {formatNumber(adjustDialog.quantity)}</p>
              <p><span className="font-medium">Available:</span> {formatNumber(adjustDialog.availableQuantity)}</p>
              {adjustDialog.batchNumber && (
                <p><span className="font-medium">Batch:</span> {adjustDialog.batchNumber}</p>
              )}
            </div>

            <Input
              label="Adjustment quantity"
              type="number"
              placeholder="Use positive to add, negative to subtract"
              value={adjustValue}
              onChange={(e) => setAdjustValue(e.target.value)}
              hint={
                adjustValue
                  ? `New stock level: ${formatNumber(adjustDialog.quantity + parseInt(adjustValue || '0', 10))}`
                  : undefined
              }
            />

            <Select
              label="Reason (required)"
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value as AdjustmentReason)}
              options={REASON_OPTIONS}
              placeholder="Select a reason…"
            />

            <div>
              <label className="text-sm font-medium text-surface-700">Note</label>
              <textarea
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value)}
                placeholder="Add context for this adjustment…"
                className="mt-1 w-full h-20 rounded-lg border border-surface-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 resize-none"
              />
            </div>

            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
              <p className="text-sm text-amber-800">
                This adjustment will be logged in the audit trail and cannot be undone. A negative adjustment that would result in negative stock will be rejected.
              </p>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
