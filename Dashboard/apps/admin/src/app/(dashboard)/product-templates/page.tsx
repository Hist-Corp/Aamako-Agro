'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/config/auth-context';
import { canAct } from '@/config/rbac';
import { apiClient, ApiError } from '@/lib/api-client';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LayoutList,
  ExternalLink,
  Pencil,
  Globe,
  Lock,
  Plus,
  Package,
} from 'lucide-react';

interface CmsItem {
  id: string;
  key: string;
  title: string;
  isPublished: boolean;
}

interface ProductTemplate {
  slug: string;
  name: string;
  category: string;
  processCategory: string;
  price: string;
  isPublished: boolean;
}

const PROCESS_CATEGORY_LABELS: Record<string, string> = {
  'freeze-dried-fruits': 'Freeze-Dried Fruits',
  dehydrated: 'Dehydrated Fruits & Vegetables',
  powders: 'Milled Powders',
};

const STOREFRONT_URL =
  process.env.NEXT_PUBLIC_STOREFRONT_URL ?? 'http://localhost:8080';

export default function ProductTemplatesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { addToast } = useToast();
  const [items, setItems] = useState<CmsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const allowed = !!user && canAct(user.role, 'product-templates:view');
  const canCreate = !!user && canAct(user.role, 'product-templates:create');

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.get<CmsItem[]>('/content/manage');
      setItems(data);
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Could not load product templates',
        description: err instanceof ApiError ? err.message : 'Unexpected error',
      });
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    if (!user) return;
    if (!allowed) {
      router.replace('/dashboard');
      return;
    }
    void load();
  }, [user, allowed, router, load]);

  const products = React.useMemo(() => {
    const map = new Map<string, ProductTemplate>();
    for (const item of items) {
      const match = item.key.match(/^product-template\.([^.]+)\.(.+)$/);
      if (!match) continue;
      const slug = match[1];
      const field = match[2];
      const existing = map.get(slug) ?? { slug, name: slug, category: '', processCategory: '', price: '', isPublished: true };
      if (field === 'name') existing.name = item.title || slug;
      if (field === 'category') existing.category = item.title;
      if (field === 'process-category') existing.processCategory = item.title;
      if (field === 'price') existing.price = item.title;
      existing.isPublished = existing.isPublished && item.isPublished;
      map.set(slug, existing);
    }
    return Array.from(map.values());
  }, [items]);

  return (
    <div>
      <PageHeader
        title="Product Templates"
        description="Every product on the storefront is managed here."
        actions={
          <div className="flex gap-2">
            {canCreate && (
              <Link href="/product-templates/new">
                <Button>
                  <Plus className="h-4 w-4" /> Add product
                </Button>
              </Link>
            )}
            <a href={STOREFRONT_URL} target="_blank" rel="noreferrer">
              <Button variant="secondary">
                <ExternalLink className="h-4 w-4" /> Open storefront
              </Button>
            </a>
          </div>
        }
        breadcrumbs={[{ label: 'Content' }, { label: 'Product Templates' }]}
      />

            <div className="mb-5 flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-700">
        <Lock className="h-4 w-4 flex-shrink-0" />
        <span>
          <span className="font-medium">Restricted:</span> Managers, Content Managers, Admins
          and Super Admins only.
        </span>
      </div>

      {!user ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      ) : !allowed ? null : isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
            ) : products.length === 0 ? (
        <EmptyState
          icon={LayoutList}
          title="No products yet"
          description="Add your first product using the fully editable template."
          action={
            canCreate
              ? {
                  label: 'Add product',
                  onClick: () => router.push('/product-templates/new'),
                }
              : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => (
            <Card key={product.slug} className="flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-brand-50 text-brand-600">
                    <Package className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-surface-900">{product.name}</h3>
                    <p className="text-2xs text-surface-500 font-mono">{product.slug}</p>
                  </div>
                </div>
                <Badge variant={product.isPublished ? 'success' : 'neutral'} dot>
                  {product.isPublished ? 'Published' : 'Draft'}
                </Badge>
              </div>
              <div className="mt-3 text-sm text-surface-500">
                {product.category && (
                  <span className="inline-block rounded bg-surface-100 px-2 py-0.5 text-xs font-medium text-surface-600">
                    {product.category}
                  </span>
                )}
                {product.processCategory && (
                  <a
                    href={`${STOREFRONT_URL}/collection.html?cat=${encodeURIComponent(product.processCategory)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block rounded bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 hover:bg-brand-100"
                    title="Open the storefront category page for this process category"
                  >
                    {PROCESS_CATEGORY_LABELS[product.processCategory] ?? product.processCategory} ↗
                  </a>
                )}
                {product.price && (
                  <span className="ml-2 text-xs text-surface-500">Rs {product.price}</span>
                )}
              </div>
              <div className="mt-auto flex flex-wrap gap-2 pt-4">
                <Link href={`/product-templates/${product.slug}`}>
                  <Button size="sm">
                    <Pencil className="h-3.5 w-3.5" /> Edit template
                  </Button>
                </Link>
                <a
                  href={`${STOREFRONT_URL}/product.html?slug=${product.slug}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button size="sm" variant="secondary">
                    <Globe className="h-3.5 w-3.5" /> View live
                  </Button>
                </a>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
