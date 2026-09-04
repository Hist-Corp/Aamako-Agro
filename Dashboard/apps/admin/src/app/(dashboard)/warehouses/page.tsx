'use client';

import React, { useState } from 'react';
import { useWarehouses, useCreateWarehouse, useUpdateWarehouse } from '@/lib/api-hooks';
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
import { useRouter } from 'next/navigation';
import type { Warehouse } from '@aamako/shared-types';
import { MapPin, Plus, Package, AlertTriangle, CheckCircle2 } from 'lucide-react';

/** Screen: Warehouses
 *  Can view: SUPER_ADMIN, ADMIN, MANAGER, INVENTORY_MANAGER
 *  Can manage: SUPER_ADMIN, ADMIN, INVENTORY_MANAGER
 */
export default function WarehousesPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [createDialog, setCreateDialog] = useState(false);
  const [newWarehouse, setNewWarehouse] = useState({ name: '', code: '', address: '' });
  const [editWarehouse, setEditWarehouse] = useState<Warehouse | null>(null);
  const router = useRouter();

  const canManage = user && canAct(user.role, 'warehouses:manage');
  const { data: warehouses, isLoading } = useWarehouses();
  const createMutation = useCreateWarehouse();
  const updateMutation = useUpdateWarehouse();

  const handleCreate = async () => {
    if (!newWarehouse.name.trim() || !newWarehouse.code.trim()) {
      addToast({ type: 'error', title: 'Missing fields', description: 'Name and code are required.' });
      return;
    }
    try {
      await createMutation.mutateAsync({
        name: newWarehouse.name.trim(),
        code: newWarehouse.code.trim().toUpperCase(),
        address: newWarehouse.address.trim(),
      });
      addToast({
        type: 'success',
        title: 'Warehouse created',
        description: `${newWarehouse.name} (${newWarehouse.code}) has been added.`,
      });
      setCreateDialog(false);
      setNewWarehouse({ name: '', code: '', address: '' });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Creation failed', description: err.message });
    }
  };

  const handleSaveEdit = async () => {
    if (!editWarehouse) return;
    if (!editWarehouse.name.trim()) {
      addToast({ type: 'error', title: 'Name required', description: 'Warehouse name cannot be empty.' });
      return;
    }
    try {
      await updateMutation.mutateAsync({
        id: editWarehouse.id,
        data: {
          name: editWarehouse.name,
          address: editWarehouse.address,
          isActive: editWarehouse.isActive,
        },
      });
      addToast({
        type: 'success',
        title: 'Warehouse updated',
        description: `${editWarehouse.name} has been saved.`,
      });
      setEditWarehouse(null);
    } catch (err: any) {
      addToast({ type: 'error', title: 'Update failed', description: err.message });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const warehouseList = warehouses ?? [];
  const totalStock = warehouseList.reduce((acc, w) => acc + (w.stats?.totalStock ?? 0), 0);

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
          <p className="mt-1 text-2xl font-semibold text-surface-900">{warehouseList.length}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-surface-500 uppercase">Active Warehouses</p>
          <p className="mt-1 text-2xl font-semibold text-surface-900">
            {warehouseList.filter((w) => w.isActive).length}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-surface-500 uppercase">Total Stock Units</p>
          <p className="mt-1 text-2xl font-semibold text-surface-900 tabular-nums">
            {formatNumber(totalStock)}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-surface-500 uppercase">Low Stock Alerts</p>
          <p className="mt-1 text-2xl font-semibold text-surface-900 tabular-nums text-amber-600">
            {warehouseList.reduce((acc, w) => acc + (w.stats?.lowStock ?? 0), 0)}
          </p>
        </Card>
      </div>

      {/* Warehouse Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {warehouseList.map((warehouse) => {
          const stats = warehouse.stats;
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
                  <Button variant="secondary" size="sm" className="flex-1" onClick={() => router.push('/inventory')}>
                    View Inventory
                  </Button>
                  {canManage && (
                    <Button variant="ghost" size="sm" onClick={() => setEditWarehouse({ ...warehouse })}>
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

      {/* Edit Warehouse Dialog */}
      {editWarehouse && (
        <Dialog
          open={!!editWarehouse}
          onClose={() => setEditWarehouse(null)}
          title="Edit warehouse"
          description="Update the warehouse details."
          primaryAction={{
            label: 'Save Changes',
            onClick: handleSaveEdit,
          }}
        >
          <div className="space-y-4">
            <Input
              label="Warehouse Name"
              value={editWarehouse.name}
              onChange={(e) => setEditWarehouse({ ...editWarehouse, name: e.target.value })}
            />
            <Input
              label="Warehouse Code"
              value={editWarehouse.code}
              onChange={(e) => setEditWarehouse({ ...editWarehouse, code: e.target.value })}
            />
            <Input
              label="Address"
              value={editWarehouse.address ?? ''}
              onChange={(e) => setEditWarehouse({ ...editWarehouse, address: e.target.value })}
            />
          </div>
        </Dialog>
      )}
    </div>
  );
}
