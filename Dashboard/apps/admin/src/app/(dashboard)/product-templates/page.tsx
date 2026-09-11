'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/config/auth-context';
import { canAct } from '@/config/rbac';
import { apiClient, ApiError } from '@/lib/api-client';
import { assetUrl } from '@/lib/asset-url';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Apple,
  Carrot,
  FlaskConical,
  LayoutList,
  ExternalLink,
  Pencil,
  Globe,
  Lock,
  Plus,
  Package,
  Layers,
  FilePen,
} from 'lucide-react';

interface CmsItem {
  id: string;
  key: string;
  title: string;
  body: string;
  isPublished: boolean;
}

/** A product page entry — normally from the catalog DB, but CMS-only
 *  templates (created under Content → Product Templates) are also included. */
interface ProductEntry {
  slug: string;
  name: string;
  categorySlug: string;
  categoryName: string;
  price: string;
  imageUrl: string;
  isPublished: boolean;
  hasTemplate: boolean;
  templateFields: number;
}

/** Process Category taxonomy — matches the category slugs used by both the
 *  catalog DB and the product-template CMS ``process-category`` field. */
const CATEGORY_GROUPS: {
  slug: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    slug: 'freeze-dried-fruits',
    label: 'Freeze-Dried Fruits',
    description: 'Fruits preserved through low-temperature freeze drying — crisp texture and full nutrients.',
    icon: Apple,
  },
  {
    slug: 'dehydrated',
    label: 'Dehydrated Fruits & Vegetables',
    description: 'Slow-dehydrated fruit and vegetable snacks with a chewy, natural finish.',
    icon: Carrot,
  },
  {
    slug: 'powders',
    label: 'Milled Powders',
    description: 'Fine milled spice and superfood powders from partner farms.',
    icon: FlaskConical,
  },
];

const FALLBACK_GROUP: (typeof CATEGORY_GROUPS)[number] = {
  slug: 'other',
  label: 'Other products',
  description: 'Product pages without a recognised process category.',
  icon: LayoutList,
};

const STOREFRONT_URL =
  process.env.NEXT_PUBLIC_STOREFRONT_URL ?? 'http://localhost:8080';

/** Catalog product → ProductEntry (raw backend shape from /admin/products). */
function catalogEntry(p: any): ProductEntry | null {
  if (!p || !p.slug) return null;
  const cat = p.category ?? {};
  const variants: any[] = Array.isArray(p.variants) ? p.variants : [];
  const active = variants.filter((v) => v.isActive !== false);
  const prices = (active.length ? active : variants)
    .map((v) => (typeof v.basePriceCents === 'number' ? v.basePriceCents / 100 : NaN))
    .filter((n) => !Number.isNaN(n));
  const minPrice = prices.length ? Math.min(...prices) : 0;
  return {
    slug: p.slug,
    name: p.name || p.slug,
    categorySlug: cat.slug || '',
    categoryName: cat.name || '',
    price: minPrice > 0 ? String(minPrice) : '',
    imageUrl: p.imageUrl || '',
    isPublished: p.isPublished !== false,
    hasTemplate: false,
    templateFields: 0,
  };
}

/** CMS template → ProductEntry (only for products NOT in the catalog DB). */
function cmsOnlyEntry(slug: string, fields: Map<string, CmsItem>): ProductEntry | null {
  const title = (f: string) => fields.get(f)?.title?.trim() ?? '';
  return {
    slug,
    name: title('name') || slug,
    categorySlug: title('process-category') || '',
    categoryName: title('process-category') || '',
    price: title('price'),
    imageUrl: title('image-url'),
    isPublished: Array.from(fields.values()).every((f) => f.isPublished),
    hasTemplate: true,
    templateFields: fields.size,
  };
}

export default function ProductTemplatesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { addToast } = useToast();
  const [cmsItems, setCmsItems] = useState<CmsItem[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const allowed = !!user && canAct(user.role, 'product-templates:view');
  const canCreate = !!user && canAct(user.role, 'product-templates:create');

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [content, products] = await Promise.allSettled([
        apiClient.get<CmsItem[]>('/content/manage'),
        apiClient.get<any>('/admin/products'),
      ]);
      if (content.status === 'fulfilled') setCmsItems(content.value);
      else if (content.reason instanceof ApiError) {
        addToast({ type: 'error', title: 'Could not load product templates', description: content.reason.message });
      }
      if (products.status === 'fulfilled') {
        const raw = Array.isArray(products.value) ? products.value : (products.value?.items ?? []);
        setCatalog(raw);
      } else {
        // Fallback for roles without /admin/products access (e.g. legacy
        // MANAGER) — the public catalog only returns published products.
        try {
          const pub = await apiClient.get<any>('/products?limit=100');
          const raw = Array.isArray(pub) ? pub : (pub?.items ?? []);
          if (raw.length) setCatalog(raw);
        } catch (_) { /* catalog is optional — CMS templates still render */ }
      }
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

  /** Build the grouped product list from catalog + CMS templates. */
  const { groups, total } = useMemo(() => {
    // CMS template fields keyed per slug: slug -> fieldKey -> CmsItem
    const templatesBySlug = new Map<string, Map<string, CmsItem>>();
    for (const item of cmsItems) {
      const match = item.key.match(/^product-template\.([^.]+)\.(.+)$/);
      if (!match) continue;
      const [, slug, field] = match;
      if (!templatesBySlug.has(slug)) templatesBySlug.set(slug, new Map());
      templatesBySlug.get(slug)!.set(field, item);
    }

    const init = (p: ProductEntry): ProductEntry => {
      const fields = templatesBySlug.get(p.slug);
      if (!fields) return p;
      const title = (f: string) => fields.get(f)?.title?.trim() ?? '';
      return {
        ...p,
        name: title('name') || p.name,
        price: title('price') || p.price,
        imageUrl: title('image-url') || p.imageUrl,
        // Product is published when its catalog record is live AND its CMS
        // template fields are published (or the template is empty/not yet made).
        isPublished:
          p.isPublished &&
          (fields.size === 0 || Array.from(fields.values()).every((f) => f.isPublished)),
        hasTemplate: true,
        templateFields: fields.size,
      };
    };

    const bySlug = new Map<string, ProductEntry>();
    for (const p of catalog) {
      // Skip QA automation leftovers so only real product pages are listed.
      if (p?.slug?.startsWith('qa-')) continue;
      const entry = catalogEntry(p);
      if (entry) bySlug.set(entry.slug, init(entry));
    }
    for (const [slug, fields] of templatesBySlug) {
      if (!bySlug.has(slug)) {
        const entry = cmsOnlyEntry(slug, fields);
        if (entry) bySlug.set(entry.slug, entry);
      }
    }

    const entries = Array.from(bySlug.values());
    const groupFor = (e: ProductEntry) =>
      CATEGORY_GROUPS.find((g) => g.slug === e.categorySlug) ??
      (e.categorySlug ? FALLBACK_GROUP : FALLBACK_GROUP);

    const groups = CATEGORY_GROUPS.map((g) => ({
      ...g,
      items: entries.filter((e) => e.categorySlug === g.slug).sort((a, b) => a.name.localeCompare(b.name)),
    })).concat({
      ...FALLBACK_GROUP,
      items: entries
        .filter((e) => !CATEGORY_GROUPS.some((g) => g.slug === e.categorySlug))
        .sort((a, b) => a.name.localeCompare(b.name)),
    });

    return { groups: groups.filter((g) => g.items.length > 0), total: entries.length };
  }, [cmsItems, catalog]);

  return (
    <div>
      <PageHeader
        title="Product Templates"
        description="Every product page on the storefront, grouped by category — pick one to edit its template."
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
        <div className="space-y-8">
          {Array.from({ length: 3 }).map((_, s) => (
            <div key={s}>
              <Skeleton className="mb-4 h-6 w-64 rounded-lg" />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-44 w-full rounded-xl" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : total === 0 ? (
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
        <div className="space-y-10">
          {groups.map((group) => {
            const Icon = group.icon;
            return (
              <section key={group.slug} aria-label={group.label}>
                {/* Category header */}
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-surface-900">{group.label}</h2>
                      <Badge variant="neutral">{group.items.length} products</Badge>
                      {group.slug !== 'other' && (
                        <a
                          href={`${STOREFRONT_URL}/collection.html?cat=${encodeURIComponent(group.slug)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-800"
                        >
                          View category page <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-surface-500">{group.description}</p>
                  </div>
                </div>

                {/* Product cards */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {group.items.map((product) => {
                    const IconFallback = product.imageUrl ? null : Package;
                    return (
                      <Card key={product.slug} className="flex flex-col">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            {product.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={assetUrl(product.imageUrl)}
                                alt={product.name}
                                className="h-12 w-12 flex-shrink-0 rounded-lg border border-surface-200 bg-surface-100 object-cover"
                                loading="lazy"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.visibility = 'hidden';
                                }}
                              />
                            ) : (
                              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-surface-100 text-surface-400">
                                {IconFallback && <IconFallback className="h-5 w-5" />}
                              </div>
                            )}
                            <div className="min-w-0">
                              <h3 className="truncate text-sm font-semibold text-surface-900" title={product.name}>
                                {product.name}
                              </h3>
                              <p className="truncate font-mono text-2xs text-surface-500">{product.slug}</p>
                              <span
                                className={`mt-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-2xs font-medium ${
                                  product.hasTemplate
                                    ? 'bg-brand-50 text-brand-700'
                                    : 'bg-surface-100 text-surface-500'
                                }`}
                              >
                                <FilePen className="h-3 w-3" />
                                {product.hasTemplate
                                  ? `Template ready · ${product.templateFields} fields`
                                  : 'No template yet'}
                              </span>
                            </div>
                          </div>
                          <Badge variant={product.isPublished ? 'success' : 'neutral'} dot>
                            {product.isPublished ? 'Published' : 'Draft'}
                          </Badge>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-surface-500">
                          {product.categoryName && (
                            <a
                              href={`${STOREFRONT_URL}/collection.html?cat=${encodeURIComponent(product.categorySlug || product.categoryName)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 hover:bg-brand-100"
                              title="Open the storefront category page"
                            >
                              <Layers className="h-3 w-3" />
                              {product.categoryName || group.label} ↗
                            </a>
                          )}
                          {product.price && (
                            <span className="text-xs font-medium text-surface-700">Rs {product.price}</span>
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
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
