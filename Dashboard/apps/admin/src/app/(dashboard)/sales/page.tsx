'use client';

import React, { useState, useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useOrders } from '@/lib/api-hooks';
import { useAuth } from '@/config/auth-context';
import { formatCurrency, formatDateTime, formatNumber, relativeTime } from '@/lib/utils';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Badge, statusToBadgeVariant } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Tabs } from '@/components/ui/tabs';
import { Card, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { DollarSign, ShoppingCart, TrendingUp, TrendingDown } from 'lucide-react';
import type { Order, OrderStatus } from '@aamako/shared-types';

const MOCK_SALES_DATA = Array.from({ length: 7 }, (_, i) => ({
  date: new Date(Date.now() - (6 - i) * 86400000).toLocaleDateString('en-US', { weekday: 'short' }),
  revenue: Math.floor(80000 + Math.random() * 40000),
  orders: Math.floor(8 + Math.random() * 12),
}));

/** Screen: Sales
 *  Can view: SUPER_ADMIN, ADMIN, MANAGER, SALES
 *  Sales-focused view of orders and revenue
 */
export default function SalesPage() {
  const { user } = useAuth();
  const [channelFilter, setChannelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data: ordersData, isLoading } = useOrders({
    channel: (channelFilter as any) || undefined,
    status: (statusFilter as OrderStatus) || undefined,
  });

  const orders = ordersData?.data ?? [];

  // Calculate sales metrics
  const totalRevenue = orders.reduce((acc, o) => acc + o.total, 0);
  const totalOrders = orders.length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const columns = useMemo<ColumnDef<Order>[]>(() => [
    {
      accessorKey: 'orderNumber',
      header: 'Order',
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-surface-900">{row.original.orderNumber}</p>
          <p className="text-2xs text-surface-400">{relativeTime(row.original.createdAt)}</p>
        </div>
      ),
    },
    {
      accessorKey: 'customerName',
      header: 'Customer',
      cell: ({ row }) => (
        <div>
          <p className="text-sm text-surface-700">{row.original.customerName}</p>
          <p className="text-2xs text-surface-400">{row.original.channel}</p>
        </div>
      ),
    },
    {
      accessorKey: 'itemCount',
      header: 'Items',
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.itemCount}</span>
      ),
    },
    {
      accessorKey: 'total',
      header: 'Total',
      cell: ({ row }) => (
        <span className="font-medium tabular-nums">{formatCurrency(row.original.total)}</span>
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
      accessorKey: 'paymentStatus',
      header: 'Payment',
      cell: ({ row }) => {
        const { variant, label } = statusToBadgeVariant(row.original.paymentStatus);
        return <Badge variant={variant}>{label}</Badge>;
      },
    },
    {
      accessorKey: 'updatedAt',
      header: 'Updated',
      cell: ({ row }) => (
        <span className="text-xs text-surface-500">{formatDateTime(row.original.updatedAt)}</span>
      ),
    },
  ], []);

  const statusTabs = [
    { id: '', label: 'All' },
    { id: 'PENDING', label: 'Pending' },
    { id: 'CONFIRMED', label: 'Confirmed' },
    { id: 'SHIPPED', label: 'Shipped' },
    { id: 'DELIVERED', label: 'Delivered' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales"
        description="Sales overview and order management"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Sales' }]}
      />

      {/* Sales KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-100">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-surface-500 uppercase">Total Revenue</p>
              <p className="text-xl font-semibold text-surface-900 tabular-nums">{formatCurrency(totalRevenue)}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <TrendingUp className="h-3 w-3 text-green-600" />
                <span className="text-xs text-green-600">+12.5%</span>
              </div>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100">
              <ShoppingCart className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-surface-500 uppercase">Total Orders</p>
              <p className="text-xl font-semibold text-surface-900 tabular-nums">{formatNumber(totalOrders)}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <TrendingUp className="h-3 w-3 text-green-600" />
                <span className="text-xs text-green-600">+8.3%</span>
              </div>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-100">
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-surface-500 uppercase">Avg Order Value</p>
              <p className="text-xl font-semibold text-surface-900 tabular-nums">{formatCurrency(avgOrderValue)}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-100">
              <DollarSign className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-surface-500 uppercase">Conversion Rate</p>
              <p className="text-xl font-semibold text-surface-900 tabular-nums">3.2%</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Sales Chart */}
      <Card>
        <CardHeader title="Sales Trend" description="Daily revenue for the last 7 days" />
        <div className="h-64 px-4 pb-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={MOCK_SALES_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value: number) => [formatCurrency(value), 'Revenue']} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
              <Bar dataKey="revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Orders Table */}
      <div>
        <h3 className="text-lg font-semibold text-surface-900 mb-4">Recent Orders</h3>
        <Tabs tabs={statusTabs} activeTab={statusFilter} onChange={setStatusFilter} />
        <div className="mt-4">
          <DataTable
            columns={columns}
            data={orders}
            isLoading={isLoading}
            searchPlaceholder="Search orders…"
            emptyState={
              <EmptyState
                icon={ShoppingCart}
                title="No orders found"
                description="Orders will appear here as they come in."
              />
            }
          />
        </div>
      </div>
    </div>
  );
}
