'use client';

import React, { useState, useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useAuth } from '@/config/auth-context';
import { formatNumber, formatDateTime } from '@/lib/utils';
import { canAct } from '@/config/rbac';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { Eye, EyeOff, AlertTriangle, TrendingDown, Package } from 'lucide-react';

interface MonitoredItem {
  id: string;
  productName: string;
  warehouseName: string;
  currentStock: number;
  reorderLevel: number;
  averageDailySales: number;
  daysUntilStockout: number;
  trend: 'DECLINING' | 'STABLE' | 'INCREASING';
  lastUpdated: string;
  notes?: string;
}

const MOCK_MONITORED: MonitoredItem[] = [
  {
    id: 'MON-001',
    productName: 'Red Lentils (1kg)',
    warehouseName: 'Main Warehouse - Kathmandu',
    currentStock: 15,
    reorderLevel: 30,
    averageDailySales: 8,
    daysUntilStockout: 2,
    trend: 'DECLINING',
    lastUpdated: new Date(Date.now() - 3600000).toISOString(),
    notes: 'Supplier delivery delayed by 3 days',
  },
  {
    id: 'MON-002',
    productName: 'Basmati Rice (5kg)',
    warehouseName: 'Secondary Warehouse - Pokhara',
    currentStock: 12,
    reorderLevel: 20,
    averageDailySales: 5,
    daysUntilStockout: 2,
    trend: 'DECLINING',
    lastUpdated: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: 'MON-003',
    productName: 'Cumin Seeds (500g)',
    warehouseName: 'Main Warehouse - Kathmandu',
    currentStock: 45,
    reorderLevel: 25,
    averageDailySales: 3,
    daysUntilStockout: 15,
    trend: 'STABLE',
    lastUpdated: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'MON-004',
    productName: 'Turmeric Powder (250g)',
    warehouseName: 'Distribution Hub - Chitwan',
    currentStock: 8,
    reorderLevel: 40,
    averageDailySales: 6,
    daysUntilStockout: 1,
    trend: 'DECLINING',
    lastUpdated: new Date(Date.now() - 1800000).toISOString(),
    notes: 'Critical - needs immediate restock',
  },
];

const TREND_VARIANT: Record<string, string> = {
  DECLINING: 'danger',
  STABLE: 'success',
  INCREASING: 'info',
};

/** Screen: Inventory Monitoring / Shortlisted Items
 *  Can view: SUPER_ADMIN, ADMIN, MANAGER, INVENTORY_MANAGER
 *  Can manage: SUPER_ADMIN, INVENTORY_MANAGER
 */
export default function InventoryMonitoringPage() {
  const { user } = useAuth();
  const { addToast } = useToast();

  const canManage = user && canAct(user.role, 'inventory-monitoring:manage');

  const columns = useMemo<ColumnDef<MonitoredItem>[]>(() => [
    {
      accessorKey: 'productName',
      header: 'Product',
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-surface-900">{row.original.productName}</p>
          <p className="text-2xs text-surface-400">{row.original.warehouseName}</p>
        </div>
      ),
    },
    {
      accessorKey: 'currentStock',
      header: 'Current Stock',
      cell: ({ row }) => {
        const isLow = row.original.currentStock <= row.original.reorderLevel;
        return (
          <span className={`tabular-nums font-medium ${isLow ? 'text-red-600' : ''}`}>
            {formatNumber(row.original.currentStock)}
          </span>
        );
      },
    },
    {
      accessorKey: 'reorderLevel',
      header: 'Reorder At',
      cell: ({ row }) => (
        <span className="tabular-nums text-surface-600">{formatNumber(row.original.reorderLevel)}</span>
      ),
    },
    {
      accessorKey: 'averageDailySales',
      header: 'Avg Daily Sales',
      cell: ({ row }) => (
        <span className="tabular-nums text-surface-600">{row.original.averageDailySales}</span>
      ),
    },
    {
      accessorKey: 'daysUntilStockout',
      header: 'Days Until Stockout',
      cell: ({ row }) => {
        const days = row.original.daysUntilStockout;
        const urgency = days <= 2 ? 'text-red-600 font-bold' : days <= 7 ? 'text-amber-600 font-medium' : 'text-surface-600';
        return <span className={`tabular-nums ${urgency}`}>{days}d</span>;
      },
    },
    {
      accessorKey: 'trend',
      header: 'Trend',
      cell: ({ row }) => (
        <Badge variant={(TREND_VARIANT[row.original.trend] ?? 'neutral') as any}>
          {row.original.trend === 'DECLINING' && <TrendingDown className="h-3 w-3 mr-1" />}
          {row.original.trend}
        </Badge>
      ),
    },
    {
      accessorKey: 'lastUpdated',
      header: 'Last Updated',
      cell: ({ row }) => (
        <span className="text-xs text-surface-500">{formatDateTime(row.original.lastUpdated)}</span>
      ),
    },
    ...(canManage
      ? [
          {
            id: 'actions' as const,
            header: '' as const,
            size: 100,
            cell: ({ row }: { row: any }) => (
              <div onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                <Button variant="secondary" size="sm">
                  Restock
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ], [canManage]);

  const criticalItems = MOCK_MONITORED.filter((i) => i.daysUntilStockout <= 2);
  const warningItems = MOCK_MONITORED.filter((i) => i.daysUntilStockout > 2 && i.daysUntilStockout <= 7);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Monitoring"
        description="Shortlisted items requiring attention"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Inventory Monitoring' }]}
      />

      {/* Alert Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className={criticalItems.length > 0 ? 'border-red-200 bg-red-50/50' : ''}>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-red-100">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-surface-500 uppercase">Critical (≤2 days)</p>
              <p className="text-2xl font-bold text-red-600">{criticalItems.length}</p>
            </div>
          </div>
        </Card>
        <Card className={warningItems.length > 0 ? 'border-amber-200 bg-amber-50/50' : ''}>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-100">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-surface-500 uppercase">Warning (3-7 days)</p>
              <p className="text-2xl font-bold text-amber-600">{warningItems.length}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-surface-100">
              <Eye className="h-5 w-5 text-surface-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-surface-500 uppercase">Total Monitored</p>
              <p className="text-2xl font-bold text-surface-900">{MOCK_MONITORED.length}</p>
            </div>
          </div>
        </Card>
      </div>

      <DataTable
        columns={columns}
        data={MOCK_MONITORED}
        isLoading={false}
        searchPlaceholder="Search monitored items…"
        emptyState={
          <EmptyState
            icon={Eye}
            title="No items being monitored"
            description="Shortlisted items for monitoring will appear here. Add items to track stock levels and get alerts."
          />
        }
      />
    </div>
  );
}
