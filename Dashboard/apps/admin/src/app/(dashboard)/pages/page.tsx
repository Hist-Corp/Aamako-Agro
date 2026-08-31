'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/config/auth-context';
import { canAct } from '@/config/rbac';
import { apiClient, ApiError } from '@/lib/api-client';
import { SITE_PAGES, storefrontUrl, STOREFRONT_URL } from '@/config/pages';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LayoutTemplate,
  ExternalLink,
  Pencil,
  Globe,
  Lock,
} from 'lucide-react';

interface CmsItem {
  id: string;
  key: string;
  title: string;
  isPublished: boolean;
}

/** Content-entry for editing & the website Pages section.
 *  Access is limited to Manager, Content Manager, Admin and Super Admin —
 *  enforced by roles on the nav item and by a guard here on direct URL entry. */
export default function PagesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { addToast } = useToast();
  const [items, setItems] = useState<CmsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Role guard — only the four granted roles may open this screen.
  const allowed = !!user && canAct(user.role, 'pages:view');

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.get<CmsItem[]>('/content/manage');
      setItems(data);
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Could not load page templates',
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

  const filledCount = (keys: string[]) => keys.filter((k) => items.some((i) => i.key === k)).length;

  return (
    <div>
      <PageHeader
        title="Website Pages"
        description="Edit the live website's pages in place — preview the real page on the right while building its template. Access is restricted to Managers, Content Managers, Admins and Super Admins."
        actions={
          <a href={STOREFRONT_URL} target="_blank" rel="noreferrer">
            <Button variant="secondary">
              <ExternalLink className="h-4 w-4" /> Open storefront
            </Button>
          </a>
        }
        breadcrumbs={[{ label: 'Content' }, { label: 'Pages' }]}
      />

      <div className="mb-5 flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-700">
        <Lock className="h-4 w-4 flex-shrink-0" />
        <span>
          <span className="font-medium">Restricted:</span> Managers, Content Managers, Admins
          and Super Admins only. All other roles cannot view or edit these pages.
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
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {SITE_PAGES.map((page) => {
            const keys = page.sections.map((s) => s.key);
            const filled = filledCount(keys);
            const ready = filled === keys.length;
            return (
              <Card key={page.slug} className="flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-brand-50 text-brand-600">
                      <LayoutTemplate className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-surface-900">{page.name}</h3>
                      <p className="text-2xs text-surface-500 font-mono">{page.route}</p>
                    </div>
                  </div>
                  <Badge variant={ready ? 'success' : 'neutral'} dot>
                    {ready ? `${filled}/${keys.length} sections` : `${filled}/${keys.length} live`}
                  </Badge>
                </div>

                <p className="mt-3 text-sm text-surface-500">{page.description}</p>

                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  <Link href={`/pages/${page.slug}`}>
                    <Button size="sm">
                      <Pencil className="h-3.5 w-3.5" /> Edit template
                    </Button>
                  </Link>
                  <a href={storefrontUrl(page)} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="secondary">
                      <Globe className="h-3.5 w-3.5" /> View live
                    </Button>
                  </a>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {user && allowed && !isLoading && SITE_PAGES.length === 0 && (
        <EmptyState
          icon={LayoutTemplate}
          title="No website pages configured"
          description="Add entries to the page catalog in src/config/pages.ts to manage them here."
        />
      )}
    </div>
  );
}