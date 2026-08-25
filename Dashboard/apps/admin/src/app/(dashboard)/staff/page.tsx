'use client';

import React, { useState, useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useUsers } from '@/lib/api-hooks';
import { useAuth } from '@/config/auth-context';
import { formatDateTime } from '@/lib/utils';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import type { User, Role } from '@aamako/shared-types';
import { UsersRound, Plus } from 'lucide-react';

const DEPARTMENT_OPTIONS = [
  { value: '', label: 'All Departments' },
  { value: 'Operations', label: 'Operations' },
  { value: 'Sales', label: 'Sales' },
  { value: 'Inventory', label: 'Inventory' },
  { value: 'Content', label: 'Content' },
  { value: 'Support', label: 'Support' },
];

const ROLE_BADGE_VARIANT: Record<Role, string> = {
  SUPER_ADMIN: 'danger',
  ADMIN: 'warning',
  MANAGER: 'info',
  SALES: 'neutral',
  INVENTORY_MANAGER: 'info',
  CONTENT_MANAGER: 'neutral',
  CUSTOMER_SUPPORT: 'success',
  // Real backend roles
  STAFF_ADMIN: 'warning',
  STAFF_MANAGER: 'info',
  STAFF_SALES: 'neutral',
  STAFF_SUPPORT: 'success',
  RETAIL_CUSTOMER: 'neutral',
  WHOLESALE_CUSTOMER: 'neutral',
};

/** Screen: Staff Management
 *  Can view: SUPER_ADMIN, ADMIN, MANAGER, INVENTORY_MANAGER
 *  Can manage: SUPER_ADMIN, ADMIN, MANAGER
 */
export default function StaffPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [departmentFilter, setDepartmentFilter] = useState('');

  const { data: users, isLoading } = useUsers();

  // Filter to staff roles (exclude SUPER_ADMIN from staff list)
  const staffUsers = (users ?? []).filter((u) => u.role !== 'SUPER_ADMIN');

  const columns = useMemo<ColumnDef<User>[]>(() => [
    {
      accessorKey: 'name',
      header: 'Staff Member',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-semibold text-brand-700">
              {row.original.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
            </span>
          </div>
          <div>
            <p className="font-medium text-surface-900">{row.original.name}</p>
            <p className="text-2xs text-surface-400">{row.original.email}</p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ row }) => {
        const variant = (ROLE_BADGE_VARIANT[row.original.role] ?? 'neutral') as any;
        return <Badge variant={variant}>{row.original.role.replace(/_/g, ' ')}</Badge>;
      },
    },
    {
      accessorKey: 'mfaEnabled',
      header: 'Security',
      cell: ({ row }) => (
        <Badge variant={row.original.mfaEnabled ? 'success' : 'warning'}>
          {row.original.mfaEnabled ? 'MFA On' : 'MFA Off'}
        </Badge>
      ),
    },
    {
      accessorKey: 'lastLoginAt',
      header: 'Last Active',
      cell: ({ row }) =>
        row.original.lastLoginAt ? (
          <span className="text-xs text-surface-500">{formatDateTime(row.original.lastLoginAt)}</span>
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
    {
      id: 'actions',
      header: '',
      size: 100,
      cell: ({ row }) => (
        <div onClick={(e: React.MouseEvent) => e.stopPropagation()}>
          <Button variant="secondary" size="sm">
            View Profile
          </Button>
        </div>
      ),
    },
  ], []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff"
        description="Manage team members and their roles"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Staff' }]}
        actions={
          <Button>
            <Plus className="h-4 w-4" /> Add Staff
          </Button>
        }
      />

      <div className="flex items-center gap-3">
        <Select
          options={DEPARTMENT_OPTIONS}
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
          className="w-48"
        />
      </div>

      <DataTable
        columns={columns}
        data={staffUsers}
        isLoading={isLoading}
        searchPlaceholder="Search staff by name, email, role…"
        emptyState={
          <EmptyState
            icon={UsersRound}
            title="No staff members found"
            description="Staff members will appear here as they are added to the system."
          />
        }
      />
    </div>
  );
}
