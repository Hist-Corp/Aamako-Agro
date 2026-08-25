'use client';

import React, { useState, useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useUsers, useUpdateUserRole } from '@/lib/api-hooks';
import { useAuth } from '@/config/auth-context';
import { canAct } from '@/config/rbac';
import { formatDateTime } from '@/lib/utils';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import type { User, Role } from '@aamako/shared-types';
import { Settings, Shield, ShieldCheck } from 'lucide-react';

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'SALES', label: 'Sales' },
  { value: 'INVENTORY_MANAGER', label: 'Inventory Manager' },
  { value: 'CONTENT_MANAGER', label: 'Content Manager' },
  { value: 'CUSTOMER_SUPPORT', label: 'Customer Support' },
  // Real backend roles
  { value: 'STAFF_ADMIN', label: 'Staff Admin' },
  { value: 'STAFF_MANAGER', label: 'Staff Manager' },
  { value: 'STAFF_SALES', label: 'Staff Sales' },
  { value: 'STAFF_SUPPORT', label: 'Staff Support' },
  { value: 'RETAIL_CUSTOMER', label: 'Retail Customer' },
  { value: 'WHOLESALE_CUSTOMER', label: 'Wholesale Customer' },
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

/** Screen: Settings & Roles
 *  Can view: SUPER_ADMIN only
 *  Can act: SUPER_ADMIN only (role assignment)
 */
export default function SettingsPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [editDialog, setEditDialog] = useState<User | null>(null);
  const [newRole, setNewRole] = useState<Role>('ADMIN');
  const [isUpdating, setIsUpdating] = useState(false);

  const updateRoleMutation = useUpdateUserRole();
  const { data: users, isLoading } = useUsers();

  // Gate: only roles with settings:view can open this screen. Hierarchy is
  // preserved: role assignment (roles:manage) remains SUPER_ADMIN only.
  const canView = user && canAct(user.role, 'settings:view');
  const canAssignRoles = user && canAct(user.role, 'roles:manage');

  if (!canView) {
    return (
      <div className="space-y-6">
        <PageHeader title="Access Denied" />
        <EmptyState
          icon={Shield}
          title="Insufficient permissions"
          description="You don't have permission to access Settings."
        />
      </div>
    );
  }

  const handleUpdateRole = async () => {
    if (!editDialog) return;
    setIsUpdating(true);
    try {
      await updateRoleMutation.mutateAsync({ id: editDialog.id, role: newRole });
      addToast({
        type: 'success',
        title: `Role updated for ${editDialog.name}`,
        description: `New role: ${newRole.replace(/_/g, ' ')}`,
      });
      setEditDialog(null);
    } catch (err: any) {
      addToast({ type: 'error', title: 'Failed to update role', description: err.message });
    } finally {
      setIsUpdating(false);
    }
  };

  const columns = useMemo<ColumnDef<User>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'User',
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-semibold text-brand-700">
                {row.original.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)}
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
          return (
            <Badge variant={variant}>
              {row.original.role === 'SUPER_ADMIN' && <ShieldCheck className="h-3 w-3 mr-1" />}
              {row.original.role.replace(/_/g, ' ')}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'mfaEnabled',
        header: 'MFA',
        cell: ({ row }) => (
          <Badge variant={row.original.mfaEnabled ? 'success' : 'warning'}>
            {row.original.mfaEnabled ? 'Enrolled' : 'Not enrolled'}
          </Badge>
        ),
      },
      {
        accessorKey: 'lastLoginAt',
        header: 'Last Login',
        cell: ({ row }) =>
          row.original.lastLoginAt ? (
            <span className="text-xs text-surface-500">{formatDateTime(row.original.lastLoginAt)}</span>
          ) : (
            <span className="text-xs text-surface-400">Never</span>
          ),
      },
      {
        accessorKey: 'createdAt',
        header: 'Created',
        cell: ({ row }) => (
          <span className="text-xs text-surface-500">{formatDateTime(row.original.createdAt)}</span>
        ),
      },
      {
        id: 'actions',
        header: '',
        size: 80,
        cell: ({ row }) => {
          const targetUser = row.original;
          // Can't change your own role; only SUPER_ADMIN may assign roles
          if (targetUser.id === user?.id || !canAssignRoles) return null;
          return (
            <div onClick={(e: React.MouseEvent) => e.stopPropagation()}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setEditDialog(targetUser);
                  setNewRole(targetUser.role);
                }}
              >
                Edit
              </Button>
            </div>
          );
        },
      },
    ],
    [user?.id]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings & Roles"
        description="Manage team members and role assignments"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Settings' }]}
      />

      <DataTable
        columns={columns}
        data={users ?? []}
        isLoading={isLoading}
        searchPlaceholder="Search users…"
        emptyState={
          <EmptyState
            icon={Settings}
            title="No users found"
            description="Users will appear here as they are created in the system."
          />
        }
      />

      {editDialog && (
        <Dialog
          open={!!editDialog}
          onClose={() => setEditDialog(null)}
          title={`Change role for ${editDialog.name}`}
          description="Changing a user's role immediately affects what they can see and do in the dashboard."
          primaryAction={{
            label: 'Update Role',
            onClick: handleUpdateRole,
            isLoading: isUpdating,
          }}
        >
          <div className="space-y-4">
            <div className="rounded-lg bg-surface-50 p-3 text-sm">
              <p><span className="font-medium">User:</span> {editDialog.name}</p>
              <p><span className="font-medium">Email:</span> {editDialog.email}</p>
              <p><span className="font-medium">Current role:</span> {editDialog.role.replace(/_/g, ' ')}</p>
              <p><span className="font-medium">MFA:</span> {editDialog.mfaEnabled ? 'Enrolled' : 'Not enrolled'}</p>
            </div>

            <Select
              label="New Role"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as Role)}
              options={ROLE_OPTIONS}
            />

            {editDialog.id === user?.id && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                <p className="text-sm text-amber-800">
                  ⚠️ You are about to change your own role. This may affect your access immediately.
                </p>
              </div>
            )}
          </div>
        </Dialog>
      )}
    </div>
  );
}
