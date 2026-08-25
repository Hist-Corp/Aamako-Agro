'use client';

import React, { useState } from 'react';
import { useAuth } from '@/config/auth-context';
import { formatNumber } from '@/lib/utils';
import { canAct } from '@/config/rbac';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import type { Warehouse } from '@aamako/shared-types';
import { MapPin, Plus, Package, AlertTriangle, CheckCircle2 } from 'lucide-react';

const MOCK_WAREHOUSES: Warehouse[] = [
  { id: 'WH001', name: 'Main Warehouse - Kathmandu', code: 'KTM-MAIN', address: 'Balkhu, Kathmandu', isActive: true },
  { id: 'WH002', name: 'Secondary Warehouse - Pokhara', code: 'PKR-SEC', address: 'Lakeside, Pokhara', isActive: true },
  { id: 'WH003', name: 'Distribution Hub - Chitwan', code: 'CHW-DIST', address: 'Bharatpur, Chitwan', isActive: true },
  { id: 'WH004', name: 'Cold Storage - Kathmandu', code: 'KTM-COLD', address: 'Thankot, Kathmandu', isActive: false },
];

const MOCK_WAREHOUSE_STATS = [
  { warehouseId: 'WH001', totalProducts: 12, totalStock: 450, lowStock: 2, value: 1250000 },
  { warehouseId: 'WH002', totalProducts: 8, totalStock: 180, lowStock: 1, value: 480000 },
  { warehouseId: 'WH003', totalProducts: 6, totalStock: 95, lowStock: 0, value: 210000 },
  { warehouseId: 'WH004', totalProducts: 0, totalStock: 0, lowStock: 0, value: 0 },
];

/** Screen: Warehouses
 *  Can view: SUPER_ADMIN, ADMIN, MANAGER, INVENTORY_MANAGER
 *  Can manage: SUPER_ADMIN, ADMIN, INVENTORY_MANAGER
 */
export default function WarehousesPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [createDialog, setCreateDialog] = useState(false);
  const [newWarehouse, setNewWarehouse] = useState({ name: '', code: '', address: '' });

  const canManage = user && canAct(user.role, 'warehouses:manage');

  const handleCreate = () => {
    addToast({
      type: 'success',
      title: 'Warehouse created',
      description: `${newWarehouse.name} (${newWarehouse.code}) has been added.`,
    });
    setCreateDialog(false);
    setNewWarehouse({ name: '', code: '', address: '' });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Warehouses"
        description="Manage warehouse locations and their inventory"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Warehouses' }]}
        actions={
          canManage ? (
            <Button onClick={() => setCreateDialog(true)}>
              <Plus className="h-4 w-4" /> Add Warehouse
            </Button>
          ) : undefined
        }
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <p className="text-xs font-medium text-surface-500 uppercase">Total Warehouses</p>
          <p className="mt-1 text-2xl font-semibold text-surface-900">{MOCK_WAREHOUSES.length}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-surface-500 uppercase">Active Warehouses</p>
          <p className="mt-1 text-2xl font-semibold text-surface-900">
            {MOCK_WAREHOUSES.filter((w) => w.isActive).length}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-surface-500 uppercase">Total Stock Units</p>
          <p className="mt-1 text-2xl font-semibold text-surface-900 tabular-nums">
            {formatNumber(MOCK_WAREHOUSE_STATS.reduce((acc, s) => acc + s.totalStock, 0))}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-surface-500 uppercase">Low Stock Alerts</p>
          <p className="mt-1 text-2xl font-semibold text-surface-900 tabular-nums text-amber-600">
            {MOCK_WAREHOUSE_STATS.reduce((acc, s) => acc + s.lowStock, 0)}
          </p>
        </Card>
      </div>

      {/* Warehouse Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {MOCK_WAREHOUSES.map((warehouse) => {
          const stats = MOCK_WAREHOUSE_STATS.find((s) => s.warehouseId === warehouse.id);
          return (
            <Card key={warehouse.id}>
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-brand-100">
                      <MapPin className="h-5 w-5 text-brand-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-surface-900">{warehouse.name}</h3>
                      <p className="text-xs text-surface-500 font-mono">{warehouse.code}</p>
                    </div>
                  </div>
                  <Badge variant={warehouse.isActive ? 'success' : 'neutral'}>
                    {warehouse.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                {warehouse.address && (
                  <p className="text-sm text-surface-600 mb-4">{warehouse.address}</p>
                )}

                {stats && (
                  <div className="grid grid-cols-3 gap-3 pt-3 border-t border-surface-100">
                    <div>
                      <p className="text-2xs text-surface-500">Products</p>
                      <p className="text-sm font-medium text-surface-900">{stats.totalProducts}</p>
                    </div>
                    <div>
                      <p className="text-2xs text-surface-500">Stock Units</p>
                      <p className="text-sm font-medium text-surface-900 tabular-nums">{formatNumber(stats.totalStock)}</p>
                    </div>
                    <div>
                      <p className="text-2xs text-surface-500">Low Stock</p>
                      <p className={`text-sm font-medium ${stats.lowStock > 0 ? 'text-amber-600' : 'text-surface-900'}`}>
                        {stats.lowStock}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 mt-4">
                  <Button variant="secondary" size="sm" className="flex-1">
                    View Inventory
                  </Button>
                  {canManage && (
                    <Button variant="ghost" size="sm">
                      Edit
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Create Warehouse Dialog */}
      {createDialog && (
        <Dialog
          open={createDialog}
          onClose={() => setCreateDialog(false)}
          title="Add New Warehouse"
          description="Create a new warehouse location for inventory management"
          primaryAction={{
            label: 'Create Warehouse',
            onClick: handleCreate,
          }}
        >
          <div className="space-y-4">
            <Input
              label="Warehouse Name"
              value={newWarehouse.name}
              onChange={(e) => setNewWarehouse({ ...newWarehouse, name: e.target.value })}
              placeholder="e.g. Main Warehouse - Kathmandu"
            />
            <Input
              label="Warehouse Code"
              value={newWarehouse.code}
              onChange={(e) => setNewWarehouse({ ...newWarehouse, code: e.target.value })}
              placeholder="e.g. KTM-MAIN"
            />
            <Input
              label="Address"
              value={newWarehouse.address}
              onChange={(e) => setNewWarehouse({ ...newWarehouse, address: e.target.value })}
              placeholder="Full address"
            />
          </div>
        </Dialog>
      )}
    </div>
  );
}
