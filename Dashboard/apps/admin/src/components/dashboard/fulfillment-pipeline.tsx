'use client';

import React from 'react';
import { useFulfillmentPipeline } from '@/lib/api-hooks';
import { Card, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import {
  Clock,
  CheckCircle2,
  Cog,
  PackageCheck,
  Truck,
  CheckCircle,
} from 'lucide-react';
import type { FulfillmentPipeline as PipelineType } from '@aamako/shared-types';

const STAGES: {
  key: keyof PipelineType;
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  href: string;
}[] = [
  { key: 'pending', label: 'Pending', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', href: '/orders?status=PENDING' },
  { key: 'confirmed', label: 'Confirmed', icon: CheckCircle2, color: 'text-blue-600', bg: 'bg-blue-50', href: '/orders?status=CONFIRMED' },
  { key: 'processing', label: 'Processing', icon: Cog, color: 'text-purple-600', bg: 'bg-purple-50', href: '/orders?status=PROCESSING' },
  { key: 'readyToShip', label: 'Ready to Ship', icon: PackageCheck, color: 'text-indigo-600', bg: 'bg-indigo-50', href: '/orders?status=READY_TO_SHIP' },
  { key: 'shipped', label: 'Shipped', icon: Truck, color: 'text-cyan-600', bg: 'bg-cyan-50', href: '/orders?status=SHIPPED' },
  { key: 'deliveredToday', label: 'Delivered Today', icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', href: '/orders?status=DELIVERED' },
];

export function FulfillmentPipeline() {
  const { data: pipeline, isLoading } = useFulfillmentPipeline();

  if (isLoading) {
    return (
      <Card>
        <CardHeader title="Fulfillment Pipeline" />
        <div className="px-5 pb-5">
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-16 rounded" />
                <Skeleton className="h-8 w-12 rounded" />
              </div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  const total = pipeline
    ? Object.entries(pipeline)
        .filter(([k]) => k !== 'deliveredToday')
        .reduce((sum, [, v]) => sum + (v as number), 0)
    : 0;

  return (
    <Card>
      <CardHeader
        title="Fulfillment Pipeline"
        description={`${total} orders in progress`}
      />
      <div className="px-5 pb-5">
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
          {STAGES.map((stage) => {
            const count = pipeline?.[stage.key] ?? 0;
            const Icon = stage.icon;
            return (
              <Link
                key={stage.key}
                href={stage.href}
                className="group rounded-lg border border-surface-200 p-3 hover:border-surface-300 transition-colors"
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <Icon className={`h-3.5 w-3.5 ${stage.color}`} />
                  <span className="text-xs font-medium text-surface-600">{stage.label}</span>
                </div>
                <p className="text-xl font-semibold text-surface-900 tabular-nums">{count}</p>
                {total > 0 && (
                  <div className="mt-2 h-1.5 bg-surface-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${stage.bg} ${stage.color.replace('text-', 'bg-')}`}
                      style={{ width: `${(count / total) * 100}%` }}
                    />
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
