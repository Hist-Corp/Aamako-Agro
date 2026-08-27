'use client';

import React, { useState, useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useProducts, useToggleProductStatus, useCreateProduct } from '@/lib/api-hooks';
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

  // ---- Add product (inventory -> content manager flow) ----
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    imageUrl: '',
    categoryId: '',
    sku: '',
    variantName: '',
    unit: 'UNIT_50G',
    priceRupees: '',
  });
  const [imageStatus, setImageStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const createMutation = useCreateProduct();

  const slugify = (s: string) =>
    s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const canCreate = user && (canAct(user.role, 'products:create') || canAct(user.role, 'products:publish'));

  // Load categories for the Add Product form (matches the product schema).
  React.useEffect(() => {
    let cancelled = false;
    import('@/lib/api-client')
      .then(({ apiClient }) => apiClient.get<any[]>('/categories'))
      .then((cats) => {
        if (!cancelled) setCategories(cats.map((c) => ({ id: c.id, name: c.name })));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // Deep link: /products?add=1 opens the Add Product flow (used by the
  // dedicated Inventory Manager entry point).
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('add') === '1') setShowAddDialog(true);
  }, []);

  // Validate the product image: must load AND be high-resolution.
  const validateImage = (url: string) => {
    if (!url) {
      setImageStatus(null);
      return;
    }
    if (!/^https:\/\/.+/i.test(url)) {
      setImageStatus({ ok: false, message: 'Image URL must be a secure https:// link.' });
      return;
    }
    const img = new window.Image();
    img.onload = () => {
      if (img.naturalWidth >= 1000) {
        setImageStatus({ ok: true, message: `High-resolution image detected (${img.naturalWidth}×${img.naturalHeight}px).` });
      } else {
        setImageStatus({ ok: false, message: `Image is only ${img.naturalWidth}×${img.naturalHeight}px — at least 1000px wide is required.` });
      }
    };
    img.onerror = () => setImageStatus({ ok: false, message: 'Image could not be loaded — check the URL.' });
    img.src = url;
  };

  const handleCreate = async () => {
    if (!form.name.trim() || form.name.trim().length < 2) {
      addToast({ type: 'error', title: 'Missing fields', description: 'Product name is required.' });
      return;
    }
    if (form.description.trim().length < 30) {
      addToast({
        type: 'error',
        title: 'Description too short',
        description: 'Provide a detailed description (at least 30 characters).',
      });
      return;
    }
    if (!form.imageUrl.trim()) {
      addToast({
        type: 'error',
        title: 'Product image required',
        description: 'Upload or link a high-resolution product image (https://, ≥1000px wide).',
      });
      return;
    }
    if (imageStatus && !imageStatus.ok) {
      addToast({ type: 'error', title: 'Invalid product image', description: imageStatus.message });
      return;
    }
    if (!form.categoryId) {
      addToast({ type: 'error', title: 'Category required', description: 'Select the product category.' });
      return;
    }
    if (!form.sku.trim() || !form.priceRupees || parseFloat(form.priceRupees) <= 0) {
      addToast({
        type: 'error',
        title: 'Variant incomplete',
        description: 'SKU and a price greater than 0 are required for the first variant.',
      });
      return;
    }
    setIsCreating(true);
    try {
      await createMutation.mutateAsync({
        name: form.name.trim(),
        slug: slugify(form.name),
        description: form.description.trim(),
        imageUrl: form.imageUrl.trim(),
        categoryId: form.categoryId,
        variants: [
          {
            sku: form.sku.trim(),
            name: form.variantName.trim() || form.unit.replace(/_/g, ' ').toLowerCase(),
            unit: form.unit,
            basePriceCents: Math.round(parseFloat(form.priceRupees) * 100),
          },
        ],
      });
      addToast({
        type: 'success',
        title: 'Product added to inventory',
        description: 'Content managers have been notified to publish it to the website.',
      });
      setForm({ name: '', description: '', imageUrl: '', categoryId: '', sku: '', variantName: '', unit: 'UNIT_50G', priceRupees: '' });
      setImageStatus(null);
      setShowAddDialog(false);
    } catch (err: any) {
      addToast({ type: 'error', title: 'Failed to create product', description: err.message });
    } finally {
      setIsCreating(false);
    }
  };

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
          canCreate ? (
            <Button onClick={() => setShowAddDialog(true)}>
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
            action={canCreate ? { label: 'Add Product', onClick: () => setShowAddDialog(true) } : undefined}
          />
        }
      />

      {showAddDialog && (
        <Dialog
          open={showAddDialog}
          onClose={() => setShowAddDialog(false)}
          maxWidth="lg"
          title="Add product to inventory"
          description="Complete all product details. The product is created as a draft and content managers are notified automatically so they can publish it to the website."
          primaryAction={{
            label: 'Create Product',
            onClick: handleCreate,
            isLoading: isCreating,
          }}
        >
          <div className="space-y-4">
            {/* ── Basic details ── */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-surface-500 mb-2">Basic details</p>
              <label className="text-xs font-medium text-surface-600">Product name *</label>
              <input
                className="mt-1 w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Freeze-Dried Mango"
              />
              <p className="mt-1 text-2xs text-surface-400">
                URL slug: <span className="font-mono">{slugify(form.name || '…') || '—'}</span>
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-surface-600">Category *</label>
                <select
                  className="mt-1 w-full rounded-lg border border-surface-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={form.categoryId}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                >
                  <option value="">Select a category…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {categories.length === 0 && (
                  <p className="mt-1 text-2xs text-amber-600">
                    Categories could not be loaded — you can still create the product without one.
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-surface-600">First variant label</label>
                <input
                  className="mt-1 w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={form.variantName}
                  onChange={(e) => setForm({ ...form, variantName: e.target.value })}
                  placeholder="e.g. 50g pouch"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-surface-600">Description * (min. 30 characters)</label>
              <textarea
                className="mt-1 w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Detailed customer-facing description: origin, taste profile, packaging, shelf life…"
              />
              <p className={`mt-1 text-2xs ${form.description.trim().length >= 30 ? 'text-green-600' : 'text-surface-400'}`}>
                {form.description.trim().length}/30 characters
              </p>
            </div>

            {/* ── Media ── */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-surface-500 mb-2">Media</p>
              <label className="text-xs font-medium text-surface-600">High-resolution product image (https://, ≥1000px wide) *</label>
              <input
                type="url"
                className="mt-1 w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={form.imageUrl}
                onChange={(e) => {
                  setForm({ ...form, imageUrl: e.target.value });
                  validateImage(e.target.value);
                }}
                placeholder="https://cdn.aamako.com/products/mango-hero.jpg"
              />
              {imageStatus && (
                <p className={`mt-1 text-2xs ${imageStatus.ok ? 'text-green-600' : 'text-red-600'}`}>
                  {imageStatus.message}
                </p>
              )}
              {imageStatus?.ok && (
                <img
                  src={form.imageUrl}
                  alt="Product preview"
                  className="mt-2 h-28 w-full max-w-[224px] object-cover rounded-lg border border-surface-200 bg-surface-100"
                />
              )}
            </div>

            {/* ── First variant / pricing ── */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-surface-500 mb-2">Variant & pricing</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-surface-600">SKU *</label>
                <input
                  className="mt-1 w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  placeholder="AKA-MNG-050"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-surface-600">Unit</label>
                <select
                  className="mt-1 w-full rounded-lg border border-surface-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                >
                  <option value="UNIT_30G">30g pouch</option>
                  <option value="UNIT_50G">50g pouch</option>
                  <option value="UNIT_100G">100g jar</option>
                  <option value="UNIT_250G">250g jar</option>
                  <option value="CASE_12X30G">Case 12×30g</option>
                  <option value="CASE_12X50G">Case 12×50g</option>
                </select>
              </div>
            </div>
              <div className="mt-3">
                <label className="text-xs font-medium text-surface-600">Base price (Rs) *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="mt-1 w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={form.priceRupees}
                  onChange={(e) => setForm({ ...form, priceRupees: e.target.value })}
                  placeholder="450"
                />
              </div>
            </div>

            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
              <p className="text-xs text-blue-800">
                Stock tracking is initialized at 0 for new products — adjust quantities from the Inventory page after creating the product.
              </p>
            </div>
          </div>
        </Dialog>
      )}

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
