'use client';

import React, { useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
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
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={report.dataPoints}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  tickLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Orders chart */}
      {report && (
        <Card>
          <CardHeader title="Orders Trend" description="Daily order count" />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report.dataPoints}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} />
                <Tooltip
                  formatter={(value: number) => [value, 'Orders']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
                <Bar dataKey="orders" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </div>
  );
}
