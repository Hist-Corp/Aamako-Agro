'use client';

import React, { useState, useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useProducts, useToggleProductStatus } from '@/lib/api-hooks';
import { useAuth } from '@/config/auth-context';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { canAct } from '@/config/rbac';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Badge, statusToBadgeVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { Tabs } from '@/components/ui/tabs';
import type { Product } from '@aamako/shared-types';
import { Package, Plus, Eye, EyeOff } from 'lucide-react';

/** Screen: Products
 *  Can view: ADMIN, INVENTORY_MANAGER, CONTENT_MANAGER
 *  Can edit: ADMIN, CONTENT_MANAGER (content fields), INVENTORY_MANAGER (stock fields)
 *  Can publish/unpublish: ADMIN
 */
export default function ProductsPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [statusFilter, setStatusFilter] = useState('');
  const [toggleDialog, setToggleDialog] = useState<Product | null>(null);
  const [isToggling, setIsToggling] = useState(false);

  const canPublish = user && canAct(user.role, 'products:publish');
  const toggleMutation = useToggleProductStatus();

  const { data: productsData, isLoading } = useProducts();
  const products = productsData?.data ?? [];

  const filteredProducts = statusFilter
    ? products.filter((p) => p.status === statusFilter)
    : products;

  const handleToggle = async () => {
    if (!toggleDialog) return;
    setIsToggling(true);
    const newStatus = toggleDialog.status === 'ACTIVE' ? 'DRAFT' : 'ACTIVE';
    try {
      await toggleMutation.mutateAsync({ id: toggleDialog.id, status: newStatus });
      addToast({
        type: 'success',
        title: `Product ${newStatus === 'ACTIVE' ? 'published' : 'unpublished'}`,
        description: toggleDialog.name,
      });
      setToggleDialog(null);
    } catch (err: any) {
      addToast({ type: 'error', title: 'Failed to update product', description: err.message });
    } finally {
      setIsToggling(false);
    }
  };

  const columns = useMemo<ColumnDef<Product>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Product',
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            {row.original.images[0] ? (
              <img
                src={row.original.images[0].url}
                alt={row.original.images[0].alt}
                className="h-10 w-10 rounded-lg object-cover bg-surface-100"
              />
            ) : (
              <div className="h-10 w-10 rounded-lg bg-surface-100 flex items-center justify-center">
                <Package className="h-5 w-5 text-surface-400" />
              </div>
            )}
            <div>
              <p className="font-medium text-surface-900">{row.original.name}</p>
              <p className="text-2xs text-surface-400">{row.original.categoryName}</p>
            </div>
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
        accessorKey: 'basePrice',
        header: 'Price',
        cell: ({ row }) => (
          <span className="tabular-nums">{formatCurrency(row.original.basePrice)}</span>
        ),
      },
      {
        accessorKey: 'totalStock',
        header: 'Stock',
        cell: ({ row }) => (
          <span
            className={
              row.original.totalStock <= row.original.lowStockThreshold
                ? 'text-red-600 font-medium tabular-nums'
                : 'tabular-nums'
            }
          >
            {formatNumber(row.original.totalStock)}
          </span>
        ),
      },
      {
        accessorKey: 'variants',
        header: 'Variants',
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.variants.filter((v) => v.isActive).length}</span>
        ),
      },
      {
        accessorKey: 'isFeatured',
        header: 'Featured',
        cell: ({ row }) =>
          row.original.isFeatured ? (
            <Badge variant="info">Featured</Badge>
          ) : (
            <span className="text-xs text-surface-400">—</span>
          ),
      },
      ...(canPublish
        ? [
            {
              id: 'actions' as const,
              header: '' as const,
              size: 80,
              cell: ({ row }: { row: any }) => (
                <div onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setToggleDialog(row.original)}
                    title={row.original.status === 'ACTIVE' ? 'Unpublish' : 'Publish'}
                  >
                    {row.original.status === 'ACTIVE' ? (
                      <EyeOff className="h-4 w-4 text-surface-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-surface-400" />
                    )}
                  </Button>
                </div>
              ),
            },
          ]
        : []),
    ],
    [canPublish]
  );

  const tabs = [
    { id: '', label: 'All' },
    { id: 'ACTIVE', label: 'Active' },
    { id: 'DRAFT', label: 'Drafts' },
    { id: 'ARCHIVED', label: 'Archived' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Manage your product catalog"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Products' }]}
        actions={
          canPublish ? (
            <Button>
              <Plus className="h-4 w-4" /> Add Product
            </Button>
          ) : undefined
        }
      />

      <Tabs tabs={tabs} activeTab={statusFilter} onChange={setStatusFilter} />

      <DataTable
        columns={columns}
        data={filteredProducts}
        isLoading={isLoading}
        searchPlaceholder="Search products…"
        emptyState={
          <EmptyState
            icon={Package}
            title="No products yet"
            description="Add your first product to get started. Products appear in the customer storefront after publishing."
            action={canPublish ? { label: 'Add Product', onClick: () => {} } : undefined}
          />
        }
      />

      {toggleDialog && (
        <Dialog
          open={!!toggleDialog}
          onClose={() => setToggleDialog(null)}
          title={
            toggleDialog.status === 'ACTIVE'
              ? 'Unpublish this product?'
              : 'Publish this product?'
          }
          description={
            toggleDialog.status === 'ACTIVE'
              ? `This will hide "${toggleDialog.name}" from the customer storefront. Existing orders are not affected.`
              : `This will make "${toggleDialog.name}" visible on the customer storefront.`
          }
          primaryAction={{
            label: toggleDialog.status === 'ACTIVE' ? 'Unpublish' : 'Publish',
            onClick: handleToggle,
            isLoading: isToggling,
          }}
        >
          <div className="rounded-lg bg-surface-50 p-3 text-sm">
            <p><span className="font-medium">Product:</span> {toggleDialog.name}</p>
            <p><span className="font-medium">Current status:</span> {toggleDialog.status}</p>
            <p><span className="font-medium">Stock:</span> {formatNumber(toggleDialog.totalStock)} units</p>
          </div>
        </Dialog>
      )}
    </div>
  );
}
