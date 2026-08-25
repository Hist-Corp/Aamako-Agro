'use client';

import React, { useState, useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useAuth } from '@/config/auth-context';
import { formatNumber, formatDateTime, relativeTime } from '@/lib/utils';
import { canAct } from '@/config/rbac';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Tabs } from '@/components/ui/tabs';
import { Card, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { Truck, ArrowRight, ArrowLeft, Package, MapPin } from 'lucide-react';

interface DistributionRecord {
  id: string;
  productName: string;
  fromWarehouse: string;
  toWarehouse: string;
  quantity: number;
  status: 'PENDING' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED';
  initiatedBy: string;
  createdAt: string;
  completedAt?: string;
}

const MOCK_DISTRIBUTIONS: DistributionRecord[] = [
  {
    id: 'DIST-001',
    productName: 'Basmati Rice (5kg)',
    fromWarehouse: 'Main Warehouse - Kathmandu',
    toWarehouse: 'Distribution Hub - Chitwan',
    quantity: 50,
    status: 'COMPLETED',
    initiatedBy: 'Gita Manager',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    completedAt: new Date(Date.now() - 43200000).toISOString(),
  },
  {
    id: 'DIST-002',
    productName: 'Turmeric Powder (250g)',
    fromWarehouse: 'Main Warehouse - Kathmandu',
    toWarehouse: 'Secondary Warehouse - Pokhara',
    quantity: 100,
    status: 'IN_TRANSIT',
    initiatedBy: 'Gita Manager',
    createdAt: new Date(Date.now() - 43200000).toISOString(),
  },
  {
    id: 'DIST-003',
    productName: 'Mustard Oil (1L)',
    fromWarehouse: 'Secondary Warehouse - Pokhara',
    toWarehouse: 'Main Warehouse - Kathmandu',
    quantity: 25,
    status: 'PENDING',
    initiatedBy: 'Super Admin',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'DIST-004',
    productName: 'Red Lentils (1kg)',
    fromWarehouse: 'Main Warehouse - Kathmandu',
    toWarehouse: 'Distribution Hub - Chitwan',
    quantity: 30,
    status: 'CANCELLED',
    initiatedBy: 'Gita Manager',
    createdAt: new Date(Date.now() - 172800000).toISOString(),
  },
];

const STATUS_VARIANT: Record<string, string> = {
  PENDING: 'warning',
  IN_TRANSIT: 'info',
  COMPLETED: 'success',
  CANCELLED: 'danger',
};

/** Screen: Distribution
 *  Can view: SUPER_ADMIN, ADMIN, MANAGER, INVENTORY_MANAGER
 *  Can manage: SUPER_ADMIN, ADMIN, INVENTORY_MANAGER, MANAGER
 */
export default function DistributionPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [statusFilter, setStatusFilter] = useState('');
  const [directionFilter, setDirectionFilter] = useState('');

  const canManage = user && canAct(user.role, 'distribution:manage');

  const filteredDistributions = MOCK_DISTRIBUTIONS.filter((d) => {
    if (statusFilter && d.status !== statusFilter) return false;
    return true;
  });

  const columns = useMemo<ColumnDef<DistributionRecord>[]>(() => [
    {
      accessorKey: 'productName',
      header: 'Product',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-surface-400" />
          <span className="font-medium text-surface-900">{row.original.productName}</span>
        </div>
      ),
    },
    {
      id: 'route',
      header: 'Route',
      cell: ({ row }) => (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-surface-600">{row.original.fromWarehouse.split(' - ')[0]}</span>
          <ArrowRight className="h-3 w-3 text-surface-400" />
          <span className="text-surface-600">{row.original.toWarehouse.split(' - ')[0]}</span>
        </div>
      ),
    },
    {
      accessorKey: 'quantity',
      header: 'Quantity',
      cell: ({ row }) => (
        <span className="tabular-nums font-medium">{formatNumber(row.original.quantity)}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={(STATUS_VARIANT[row.original.status] ?? 'neutral') as any} dot>
          {row.original.status.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      accessorKey: 'initiatedBy',
      header: 'Initiated By',
      cell: ({ row }) => (
        <span className="text-sm text-surface-600">{row.original.initiatedBy}</span>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Date',
      cell: ({ row }) => (
        <div>
          <p className="text-sm tabular-nums">{formatDateTime(row.original.createdAt)}</p>
          {row.original.completedAt && (
            <p className="text-2xs text-surface-400">Completed: {relativeTime(row.original.completedAt)}</p>
          )}
        </div>
      ),
    },
    ...(canManage
      ? [
          {
            id: 'actions' as const,
            header: '' as const,
            size: 120,
            cell: ({ row }: { row: any }) => {
              const dist = row.original as DistributionRecord;
              if (dist.status === 'COMPLETED' || dist.status === 'CANCELLED') return null;
              return (
                <div className="flex items-center gap-1" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                  {dist.status === 'PENDING' && (
                    <Button variant="secondary" size="sm">Start Transit</Button>
                  )}
                  {dist.status === 'IN_TRANSIT' && (
                    <Button variant="primary" size="sm">Mark Complete</Button>
                  )}
                </div>
              );
            },
          },
        ]
      : []),
  ], [canManage]);

  const tabs = [
    { id: '', label: 'All' },
    { id: 'PENDING', label: 'Pending' },
    { id: 'IN_TRANSIT', label: 'In Transit' },
    { id: 'COMPLETED', label: 'Completed' },
    { id: 'CANCELLED', label: 'Cancelled' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Distribution"
        description="Manage stock transfers between warehouses"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Distribution' }]}
        actions={
          canManage ? (
            <Button>
              <Truck className="h-4 w-4" /> New Transfer
            </Button>
          ) : undefined
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <p className="text-xs font-medium text-surface-500 uppercase">Pending</p>
          <p className="mt-1 text-2xl font-semibold text-amber-600">
            {MOCK_DISTRIBUTIONS.filter((d) => d.status === 'PENDING').length}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-surface-500 uppercase">In Transit</p>
          <p className="mt-1 text-2xl font-semibold text-blue-600">
            {MOCK_DISTRIBUTIONS.filter((d) => d.status === 'IN_TRANSIT').length}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-surface-500 uppercase">Completed (30d)</p>
          <p className="mt-1 text-2xl font-semibold text-green-600">
            {MOCK_DISTRIBUTIONS.filter((d) => d.status === 'COMPLETED').length}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-surface-500 uppercase">Total Items Transferred</p>
          <p className="mt-1 text-2xl font-semibold text-surface-900 tabular-nums">
            {formatNumber(MOCK_DISTRIBUTIONS.filter((d) => d.status === 'COMPLETED').reduce((acc, d) => acc + d.quantity, 0))}
          </p>
        </Card>
      </div>

      <Tabs tabs={tabs} activeTab={statusFilter} onChange={setStatusFilter} />

      <DataTable
        columns={columns}
        data={filteredDistributions}
        isLoading={false}
        searchPlaceholder="Search by product, warehouse…"
        emptyState={
          <EmptyState
            icon={Truck}
            title="No distribution records"
            description="Stock transfers between warehouses will appear here."
          />
        }
      />
    </div>
  );
}
