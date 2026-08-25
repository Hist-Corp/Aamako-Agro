'use client';

import React, { useState } from 'react';
import { useAuth } from '@/config/auth-context';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
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
import { FileText, Download, Calendar, Filter } from 'lucide-react';

const REPORT_TYPES = [
  { id: 'sales', label: 'Sales Report', description: 'Revenue, orders, and sales performance' },
  { id: 'inventory', label: 'Inventory Report', description: 'Stock levels, movements, and valuation' },
  { id: 'customers', label: 'Customer Report', description: 'Customer activity and demographics' },
  { id: 'products', label: 'Product Report', description: 'Product performance and catalog health' },
  { id: 'wholesale', label: 'Wholesale Report', description: 'Wholesale orders and business accounts' },
];

const MOCK_SALES_DATA = Array.from({ length: 12 }, (_, i) => ({
  month: new Date(2026, i, 1).toLocaleString('en-US', { month: 'short' }),
  revenue: Math.floor(800000 + Math.random() * 400000),
  orders: Math.floor(150 + Math.random() * 100),
}));

const MOCK_CATEGORY_DATA = [
  { name: 'Grains & Rice', value: 35, color: '#22c55e' },
  { name: 'Oils & Condiments', value: 25, color: '#3b82f6' },
  { name: 'Spices', value: 20, color: '#f59e0b' },
  { name: 'Pulses & Legumes', value: 15, color: '#8b5cf6' },
  { name: 'Other', value: 5, color: '#94a3b8' },
];

const MOCK_TOP_PRODUCTS = [
  { name: 'Basmati Rice (5kg)', sales: 450, revenue: 382500 },
  { name: 'Mustard Oil (1L)', sales: 320, revenue: 102400 },
  { name: 'Turmeric Powder (250g)', sales: 280, revenue: 54600 },
  { name: 'Red Lentils (1kg)', sales: 200, revenue: 48000 },
  { name: 'Cumin Seeds (500g)', sales: 150, revenue: 42000 },
];

/** Screen: Reports
 *  Can view: SUPER_ADMIN, ADMIN, MANAGER, SALES
 */
export default function ReportsPage() {
  const { user } = useAuth();
  const [reportType, setReportType] = useState('sales');
  const [dateRange, setDateRange] = useState('30d');

  const dateRangeOptions = [
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: '1y', label: 'Last year' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Generate and view business reports"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Reports' }]}
        actions={
          <Button variant="secondary">
            <Download className="h-4 w-4" /> Export Report
          </Button>
        }
      />

      {/* Report Type Selector */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {REPORT_TYPES.map((type) => (
          <button
            key={type.id}
            onClick={() => setReportType(type.id)}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              reportType === type.id
                ? 'border-brand-500 bg-brand-50'
                : 'border-surface-200 hover:border-surface-300 hover:bg-surface-50'
            }`}
          >
            <FileText className={`h-5 w-5 mb-2 ${reportType === type.id ? 'text-brand-600' : 'text-surface-400'}`} />
            <p className="text-sm font-medium text-surface-900">{type.label}</p>
            <p className="text-2xs text-surface-500 mt-0.5">{type.description}</p>
          </button>
        ))}
      </div>

      {/* Date Range */}
      <div className="flex items-center gap-3">
        <Select
          options={dateRangeOptions}
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="w-44"
        />
      </div>

      {/* Report Content */}
      {reportType === 'sales' && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Card>
              <p className="text-xs font-medium text-surface-500 uppercase">Total Revenue</p>
              <p className="mt-1 text-2xl font-semibold text-surface-900 tabular-nums">{formatCurrency(12450000)}</p>
              <Badge variant="success" className="mt-1">+15.2%</Badge>
            </Card>
            <Card>
              <p className="text-xs font-medium text-surface-500 uppercase">Total Orders</p>
              <p className="mt-1 text-2xl font-semibold text-surface-900 tabular-nums">{formatNumber(1234)}</p>
              <Badge variant="success" className="mt-1">+8.7%</Badge>
            </Card>
            <Card>
              <p className="text-xs font-medium text-surface-500 uppercase">Avg Order Value</p>
              <p className="mt-1 text-2xl font-semibold text-surface-900 tabular-nums">{formatCurrency(10089)}</p>
            </Card>
            <Card>
              <p className="text-xs font-medium text-surface-500 uppercase">Conversion Rate</p>
              <p className="mt-1 text-2xl font-semibold text-surface-900 tabular-nums">3.2%</p>
            </Card>
          </div>

          {/* Revenue Chart */}
          <Card>
            <CardHeader title="Monthly Revenue" description="Revenue trend over the past 12 months" />
            <div className="h-72 px-4 pb-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={MOCK_SALES_DATA}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => [formatCurrency(value), 'Revenue']} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                  <Bar dataKey="revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Category Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader title="Sales by Category" description="Revenue distribution by product category" />
              <div className="h-64 px-4 pb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={MOCK_CATEGORY_DATA}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {MOCK_CATEGORY_DATA.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [`${value}%`, 'Share']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <CardHeader title="Top Products" description="Best performing products by sales volume" />
              <div className="p-4">
                <div className="space-y-3">
                  {MOCK_TOP_PRODUCTS.map((product, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-surface-500 w-5">{i + 1}.</span>
                        <span className="text-sm text-surface-900">{product.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium tabular-nums">{formatNumber(product.sales)} units</p>
                        <p className="text-2xs text-surface-500 tabular-nums">{formatCurrency(product.revenue)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {reportType === 'inventory' && (
        <Card>
          <CardHeader title="Inventory Valuation" description="Current stock value across all warehouses" />
          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-lg bg-surface-50">
                <p className="text-sm text-surface-500">Total Stock Value</p>
                <p className="text-2xl font-bold text-surface-900 tabular-nums">{formatCurrency(1940000)}</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-surface-50">
                <p className="text-sm text-surface-500">Low Stock Items</p>
                <p className="text-2xl font-bold text-amber-600 tabular-nums">3</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-surface-50">
                <p className="text-sm text-surface-500">Out of Stock</p>
                <p className="text-2xl font-bold text-red-600 tabular-nums">1</p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {reportType === 'customers' && (
        <Card>
          <CardHeader title="Customer Overview" description="Customer growth and activity metrics" />
          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="text-center p-4 rounded-lg bg-surface-50">
                <p className="text-sm text-surface-500">Total Customers</p>
                <p className="text-2xl font-bold text-surface-900 tabular-nums">{formatNumber(342)}</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-surface-50">
                <p className="text-sm text-surface-500">Active (30d)</p>
                <p className="text-2xl font-bold text-green-600 tabular-nums">{formatNumber(186)}</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-surface-50">
                <p className="text-sm text-surface-500">Avg Lifetime Value</p>
                <p className="text-2xl font-bold text-surface-900 tabular-nums">{formatCurrency(45200)}</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-surface-50">
                <p className="text-sm text-surface-500">Retention Rate</p>
                <p className="text-2xl font-bold text-surface-900 tabular-nums">78%</p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {(reportType === 'products' || reportType === 'wholesale') && (
        <Card>
          <CardHeader title={`${REPORT_TYPES.find((r) => r.id === reportType)?.label}`} description="Report data will be displayed here" />
          <div className="p-8 text-center">
            <FileText className="h-12 w-12 text-surface-300 mx-auto mb-3" />
            <p className="text-sm text-surface-500">This report is being generated. Data will appear here shortly.</p>
          </div>
        </Card>
      )}
    </div>
  );
}
