'use client';

import React, { useState, useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useCustomers, useSuspendCustomer } from '@/lib/api-hooks';
import { useAuth } from '@/config/auth-context';
import { formatCurrency, formatDateTime, relativeTime } from '@/lib/utils';
import { canAct } from '@/config/rbac';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Badge, statusToBadgeVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs } from '@/components/ui/tabs';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import type { Customer, CustomerStatus } from '@aamako/shared-types';
import { Users, UserX, UserCheck } from 'lucide-react';

/** Screen: Customers
 *  Can view: ADMIN, MANAGER, SALES, CUSTOMER_SUPPORT
 *  Can suspend/reinstate: ADMIN
 */
export default function CustomersPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [typeFilter, setTypeFilter] = useState<'' | 'PERSONAL' | 'WHOLESALE'>('');
  const [statusFilter, setStatusFilter] = useState<'' | 'ACTIVE' | 'SUSPENDED'>('');
  const [actionDialog, setActionDialog] = useState<Customer | null>(null);

  const canSuspend = user && canAct(user.role, 'customers:suspend');
  const suspendMutation = useSuspendCustomer();

  // Fetch ALL customers once; type/status segmentation happens client-side so
  // each section (Personal/Wholesale × Active/Suspended) has live counts.
  const { data: customersData, isLoading, isError, error } = useCustomers();
  const customers = customersData?.data ?? [];

  const ofType = (type: '' | 'PERSONAL' | 'WHOLESALE') =>
    type === '' ? customers : customers.filter((c) => c.customerType === type);

  const visibleCustomers = ofType(typeFilter).filter(
    (c) => statusFilter === '' || c.status === statusFilter,
  );

  const counts = {
    all: customers.length,
    personal: customers.filter((c) => c.customerType === 'PERSONAL').length,
    wholesale: customers.filter((c) => c.customerType === 'WHOLESALE').length,
  };
  const statusCounts = (type: '' | 'PERSONAL' | 'WHOLESALE') => {
    const scoped = ofType(type);
    return {
      all: scoped.length,
      active: scoped.filter((c) => c.status === 'ACTIVE').length,
      suspended: scoped.filter((c) => c.status === 'SUSPENDED').length,
    };
  };

  const handleAction = async (customer: Customer) => {
    const newStatus = customer.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await suspendMutation.mutateAsync({ id: customer.id, status: newStatus });
      addToast({
        type: 'success',
        title: `Customer ${newStatus === 'SUSPENDED' ? 'suspended' : 'reinstated'}`,
        description: customer.name,
      });
      setActionDialog(null);
    } catch (err: any) {
      addToast({ type: 'error', title: 'Action failed', description: err.message });
    }
  };

  const columns = useMemo<ColumnDef<Customer>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Customer',
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-surface-900">{row.original.name}</p>
            <p className="text-2xs text-surface-400">{row.original.email}</p>
          </div>
        ),
      },
      {
        id: 'type',
        header: 'Type',
        cell: ({ row }) => (
          <Badge variant={row.original.customerType === 'WHOLESALE' ? 'info' : 'neutral'}>
            {row.original.customerType === 'WHOLESALE' ? 'Wholesale' : 'Personal'}
          </Badge>
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
        accessorKey: 'orderCount',
        header: 'Orders',
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.orderCount}</span>
        ),
      },
      {
        accessorKey: 'totalSpent',
        header: 'Total Spent',
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">{formatCurrency(row.original.totalSpent)}</span>
        ),
      },
      {
        accessorKey: 'lastOrderDate',
        header: 'Last Order',
        cell: ({ row }) =>
          row.original.lastOrderDate ? (
            <span className="text-xs text-surface-500">{relativeTime(row.original.lastOrderDate)}</span>
          ) : (
            <span className="text-xs text-surface-400">Never</span>
          ),
      },
      {
        accessorKey: 'createdAt',
        header: 'Joined',
        cell: ({ row }) => (
          <span className="text-xs text-surface-500">{formatDateTime(row.original.createdAt)}</span>
        ),
      },
      ...(canSuspend
        ? [
            {
              id: 'actions' as const,
              header: '' as const,
              size: 100,
              cell: ({ row }: { row: any }) => {
                const customer = row.original as Customer;
                if (customer.status === 'DEACTIVATED') return null;
                return (
                  <div onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setActionDialog(customer)}
                    >
                      {customer.status === 'ACTIVE' ? (
                        <><UserX className="h-4 w-4 text-red-500" /> Suspend</>
                      ) : (
                        <><UserCheck className="h-4 w-4 text-green-500" /> Reinstate</>
                      )}
                    </Button>
                  </div>
                );
              },
            },
          ]
        : []),
    ],
    [canSuspend]
  );

  const typeTabs = [
    { id: '', label: `All (${counts.all})` },
    { id: 'PERSONAL', label: `Personal / Individual (${counts.personal})` },
    { id: 'WHOLESALE', label: `Wholesale (${counts.wholesale})` },
  ];
  const sc = statusCounts(typeFilter);
  const statusTabs = [
    { id: '', label: `All (${sc.all})` },
    { id: 'ACTIVE', label: `Active (${sc.active})` },
    { id: 'SUSPENDED', label: `Suspended (${sc.suspended})` },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Personal (individual) and wholesale customer accounts, with active/suspended status"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Customers' }]}
      />

      {/* Fetch failed — show why instead of fake/empty rows */}
      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm">
          <p className="font-medium text-red-800">Couldn&apos;t load your customer list.</p>
          <p className="mt-1 text-red-600">
            {(error as Error)?.message ?? 'The customer service did not respond. Refresh to try again.'}
          </p>
        </div>
      )}

      {/* Customer-type segmentation */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-400">Customer type</p>
        <Tabs tabs={typeTabs} activeTab={typeFilter} onChange={(t) => setTypeFilter(t as typeof typeFilter)} />
      </div>

      {/* Active / Suspended status within the selected type */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-400">Account status</p>
        <Tabs tabs={statusTabs} activeTab={statusFilter} onChange={(s) => setStatusFilter(s as typeof statusFilter)} />
      </div>

      {/* Status summary cards for the selected type */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-surface-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <Badge variant="success" dot>ACTIVE</Badge>
            <span className="text-2xl font-bold text-surface-900">{sc.active}</span>
          </div>
          <p className="mt-1 text-xs text-surface-500">
            {typeFilter === 'WHOLESALE' ? 'Wholesale' : typeFilter === 'PERSONAL' ? 'Personal' : 'All'} customers who can place orders
          </p>
        </div>
        <div className="rounded-lg border border-surface-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <Badge variant="warning" dot>SUSPENDED</Badge>
            <span className="text-2xl font-bold text-surface-900">{sc.suspended}</span>
          </div>
          <p className="mt-1 text-xs text-surface-500">
            {typeFilter === 'WHOLESALE' ? 'Wholesale' : typeFilter === 'PERSONAL' ? 'Personal' : 'All'} customers blocked from ordering
          </p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={visibleCustomers}
        isLoading={isLoading}
        searchPlaceholder="Search by name, email…"
        emptyState={
          <EmptyState
            icon={Users}
            title="No customers found"
            description="Customer accounts will appear here as users register on the platform."
          />
        }
      />

      {actionDialog && (
        <Dialog
          open={!!actionDialog}
          onClose={() => setActionDialog(null)}
          title={
            actionDialog.status === 'ACTIVE'
              ? `Suspend ${actionDialog.name}?`
              : `Reinstate ${actionDialog.name}?`
          }
          description={
            actionDialog.status === 'ACTIVE'
              ? 'This will prevent the customer from placing new orders. Existing orders are not affected.'
              : 'This will restore the customer\'s ability to place orders.'
          }
          primaryAction={{
            label: actionDialog.status === 'ACTIVE' ? 'Suspend Customer' : 'Reinstate Customer',
            onClick: () => handleAction(actionDialog),
          }}
        >
          <div className="rounded-lg bg-surface-50 p-3 text-sm space-y-1">
            <p><span className="font-medium">Name:</span> {actionDialog.name}</p>
            <p><span className="font-medium">Email:</span> {actionDialog.email}</p>
            <p><span className="font-medium">Orders:</span> {actionDialog.orderCount}</p>
            <p><span className="font-medium">Total spent:</span> {formatCurrency(actionDialog.totalSpent)}</p>
          </div>
        </Dialog>
      )}
    </div>
  );
}
