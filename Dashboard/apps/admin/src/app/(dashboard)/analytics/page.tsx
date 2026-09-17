'use client';

import React, { useState, lazy, Suspense } from 'react';
import { useSalesReport } from '@/lib/api-hooks';
import { formatCurrency, formatNumber, formatChange } from '@/lib/utils';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardHeader } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { KPISkeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { DateRange } from '@aamako/shared-types';

const DATE_RANGE_OPTIONS = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '1y', label: 'Last year' },
];

const PIE_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

// recharts (~120KB gzipped) loads only when charts are actually rendered —
// it is NOT in the initial bundle for this route. The chart itself appears
// only after the sales report loads, so the skeleton stays during the same
// loading window and there is no extra layout shift.
const RevenueTrendChart = lazy(() =>
  import('@/components/charts/revenue-trend-chart').then((m) => ({ default: m.RevenueTrendChart })),
);
const OrdersTrendChart = lazy(() =>
  import('@/components/charts/orders-trend-chart').then((m) => ({ default: m.OrdersTrendChart })),
);

/** Screen: Analytics
 *  Can view: ADMIN, MANAGER
 */
export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange>('30d');

  const { data: report, isLoading } = useSalesReport({ range: dateRange });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Sales trends, performance, and insights"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Analytics' }]}
        actions={
          <Select
            options={DATE_RANGE_OPTIONS}
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as DateRange)}
            className="w-44"
          />
        }
      />

      {/* Summary KPIs */}
      {isLoading ? (
        <KPISkeleton count={3} />
      ) : report ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <p className="text-xs font-medium text-surface-500 uppercase">Total Revenue</p>
            <p className="mt-1 text-2xl font-semibold text-surface-900 tabular-nums">
              {formatCurrency(report.totalRevenue)}
            </p>
            <div className="mt-1.5 flex items-center gap-1">
              {report.revenueChange > 0 ? (
                <TrendingUp className="h-3 w-3 text-green-600" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-600" />
              )}
              <span className={`text-xs font-medium ${report.revenueChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatChange(report.revenueChange)}
              </span>
              <span className="text-xs text-surface-400">vs previous period</span>
            </div>
          </Card>
          <Card>
            <p className="text-xs font-medium text-surface-500 uppercase">Total Orders</p>
            <p className="mt-1 text-2xl font-semibold text-surface-900 tabular-nums">
              {formatNumber(report.totalOrders)}
            </p>
            <div className="mt-1.5 flex items-center gap-1">
              {report.ordersChange > 0 ? (
                <TrendingUp className="h-3 w-3 text-green-600" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-600" />
              )}
              <span className={`text-xs font-medium ${report.ordersChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatChange(report.ordersChange)}
              </span>
              <span className="text-xs text-surface-400">vs previous period</span>
            </div>
          </Card>
          <Card>
            <p className="text-xs font-medium text-surface-500 uppercase">Avg Order Value</p>
            <p className="mt-1 text-2xl font-semibold text-surface-900 tabular-nums">
              {formatCurrency(report.averageOrderValue)}
            </p>
          </Card>
        </div>
      ) : null}

      {/* Revenue trend chart */}
      {report && (
        <Card>
          <CardHeader title="Revenue Trend" description={`Daily revenue over the selected period`} />
          <Suspense fallback={<div className="h-72 animate-pulse rounded-lg bg-surface-100" aria-hidden />}>
            <RevenueTrendChart data={report.dataPoints} />
          </Suspense>
        </Card>
      )}

      {/* Orders chart */}
      {report && (
        <Card>
          <CardHeader title="Orders Trend" description="Daily order count" />
          <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-surface-100" aria-hidden />}>
            <OrdersTrendChart data={report.dataPoints} />
          </Suspense>
        </Card>
      )}
    </div>
  );
}
