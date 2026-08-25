'use client';

import React from 'react';
import { useActivityFeed } from '@/lib/api-hooks';
import { relativeTime } from '@/lib/utils';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ShoppingCart,
  Building2,
  Warehouse,
  Star,
  FlaskConical,
} from 'lucide-react';
import type { ActivityFeedItem } from '@aamako/shared-types';

const TYPE_CONFIG: Record<
  ActivityFeedItem['type'],
  { icon: React.ElementType; color: string }
> = {
  order: { icon: ShoppingCart, color: 'text-blue-500' },
  wholesale: { icon: Building2, color: 'text-purple-500' },
  inventory: { icon: Warehouse, color: 'text-amber-500' },
  review: { icon: Star, color: 'text-yellow-500' },
  batch: { icon: FlaskConical, color: 'text-red-500' },
};

export function ActivityFeed() {
  const { data: activities, isLoading } = useActivityFeed();

  if (isLoading) {
    return (
      <Card>
        <CardHeader title="Recent Activity" />
        <div className="space-y-3 px-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-3/4 rounded" />
                <Skeleton className="h-2.5 w-1/4 rounded" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Recent Activity"
        description="Latest actions across the platform"
      />
      <div className="px-5 pb-5">
        {(!activities || activities.length === 0) ? (
          <p className="text-sm text-surface-500 text-center py-8">No recent activity</p>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-thin">
            {activities.map((item) => {
              const config = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.order;
              const Icon = config.icon;
              return (
                <div key={item.id} className="flex items-start gap-3 group">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-surface-100 flex-shrink-0">
                    <Icon className={`h-4 w-4 ${config.color}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-surface-700 leading-snug">{item.message}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-2xs text-surface-400">
                        {relativeTime(item.timestamp)}
                      </span>
                      {item.actor && (
                        <span className="text-2xs text-surface-500">by {item.actor}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
