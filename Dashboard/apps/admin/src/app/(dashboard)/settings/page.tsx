'use client';

import React, { useState, useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useUsers, useUpdateUserRole, useRemoveUser } from '@/lib/api-hooks';
import { useAuth } from '@/config/auth-context';
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
import { rolesBelow, canPromoteDemote, isCustomerRole } from '@aamako/shared-types';
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
  const removeUserMutation = useRemoveUser();
  const { data: users, isLoading } = useUsers();
  const [removeTarget, setRemoveTarget] = useState<User | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  // Settings manages dashboard users only — hide storefront customer accounts
  // (retail / wholesale customers) from the list entirely.
  const staffUsers = useMemo(
    () => (users ?? []).filter((u) => !isCustomerRole(u.role)),
    [users],
  );

  // Gate: Super Admin / Admin / Staff Admin / Manager / Staff Manager / Sales
  // / Staff Sales can open Settings and promote/demote users. The role picker
  // is limited to roles strictly below the actor's rank (see rolesBelow), so
  // nobody can assign their own rank or higher, or assign SUPER_ADMIN.
  const canManageRoles = !!user && canPromoteDemote(user.role);
  const canView = canManageRoles;

  // Only admin and super admin may remove dashboard users.
  const canRemoveUsers =
    !!user && (user.role === 'SUPER_ADMIN' || user.role === 'STAFF_ADMIN' || user.role === 'ADMIN');

  // Roles the actor may promote/demote a user to — strictly below their own
  // rank, so their own rank / higher and SUPER_ADMIN are never offered.
  const assignableRoleOptions = useMemo(() => {
    const allowed = new Set(rolesBelow(user?.role));
    return ROLE_OPTIONS.filter((o) => allowed.has(o.value));
  }, [user]);

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

  const handleRemoveUser = async () => {
    if (!removeTarget) return;
    setIsRemoving(true);
    try {
      await removeUserMutation.mutateAsync(removeTarget.id);
      addToast({
        type: 'success',
        title: 'User removed',
        description: `${removeTarget.name} has been removed from the dashboard.`,
      });
      setRemoveTarget(null);
    } catch (err: any) {
      addToast({ type: 'error', title: 'Failed to remove user', description: err.message });
    } finally {
      setIsRemoving(false);
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
          // Can't change your own role; only actors with a higher rank may
          // promote/demote (Super Admin / Admin / Manager / Sales).
          if (targetUser.id === user?.id || !canManageRoles) return null;
          return (
            <div className="flex items-center gap-2" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
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
              {canRemoveUsers && targetUser.id !== user?.id && (
                <Button variant="danger" size="sm" onClick={() => setRemoveTarget(targetUser)}>
                  Remove
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [user?.id, canManageRoles, canRemoveUsers]
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
        data={staffUsers}
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
              options={
                assignableRoleOptions.length > 0
                  ? assignableRoleOptions
                  : [{ value: 'STAFF_SUPPORT' as Role, label: 'No lower roles available' }]
              }
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

      {/* Remove User Confirmation Dialog */}
      {removeTarget && (
        <Dialog
          open={!!removeTarget}
          onClose={() => setRemoveTarget(null)}
          title="Remove user"
          description="This permanently removes the user and all their associated data. This action cannot be undone."
          destructiveAction={{
            label: 'Remove User',
            onClick: handleRemoveUser,
            isLoading: isRemoving,
          }}
        >
          <div className="rounded-lg bg-surface-50 p-3 text-sm">
            <p><span className="font-medium">User:</span> {removeTarget.name}</p>
            <p><span className="font-medium">Email:</span> {removeTarget.email}</p>
            <p><span className="font-medium">Role:</span> {removeTarget.role.replace(/_/g, ' ')}</p>
          </div>
        </Dialog>
      )}
    </div>
  );
}
