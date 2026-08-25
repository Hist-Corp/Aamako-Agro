'use client';

import React, { useState, useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useUsers, useUpdateUserRole } from '@/lib/api-hooks';
import { useAuth } from '@/config/auth-context';
import { formatDateTime } from '@/lib/utils';
import { canAct } from '@/config/rbac';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import type { User, Role } from '@aamako/shared-types';
import { creatableRolesFor } from '@aamako/shared-types';
import { Users, Plus, Shield, ShieldCheck } from 'lucide-react';

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

/** Screen: Users Management
 *  Can view: SUPER_ADMIN, ADMIN, MANAGER, SALES (via users:view)
 *  Can add users / assign roles: driven by USER_CREATION_ALLOWED_TARGETS
 *  in @aamako/shared-types — Super Admin/Admin/Staff Admin (any role),
 *  Manager (support, inventory mgr, sales, content mgr),
 *  Sales (support, inventory mgr).
 */

export default function UsersPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [editDialog, setEditDialog] = useState<User | null>(null);
  const [createDialog, setCreateDialog] = useState(false);
  const DEFAULT_NEW_USER_ROLE: Role = 'STAFF_MANAGER';
  const [newUser, setNewUser] = useState({ name: '', email: '', role: DEFAULT_NEW_USER_ROLE as Role });
  const [newRole, setNewRole] = useState<Role>('ADMIN');
  const [isUpdating, setIsUpdating] = useState(false);

  // Roles the current user may assign when adding a user, from the central
  // USER_CREATION_ALLOWED_TARGETS map (Super Admin is never assignable).
  const assignableRoleOptions = useMemo(() => {
    const allowed = new Set(creatableRolesFor(user?.role));
    return ROLE_OPTIONS.filter((option) => allowed.has(option.value));
  }, [user]);

  const canAssignRoles = user && canAct(user.role, 'roles:manage');
  // Whether the actor can add users at all (admins, managers, sales).
  const canAddUsers = creatableRolesFor(user?.role).length > 0;
  const updateRoleMutation = useUpdateUserRole();
  const { data: users, isLoading } = useUsers();

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

  const handleCreateUser = async () => {
    // Mock create - in real app would call API
    addToast({
      type: 'success',
      title: 'User created',
      description: `${newUser.name} (${newUser.email}) added as ${newUser.role.replace(/_/g, ' ')}`,
    });
    setCreateDialog(false);
    setNewUser({ name: '', email: '', role: DEFAULT_NEW_USER_ROLE });
  };

  const columns = useMemo<ColumnDef<User>[]>(() => [
    {
      accessorKey: 'name',
      header: 'User',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-semibold text-brand-700">
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
    ...(canAssignRoles
      ? [
          {
            id: 'actions' as const,
            header: '' as const,
            size: 100,
            cell: ({ row }: { row: any }) => {
              const targetUser = row.original as User;
              if (targetUser.id === user?.id) return null;
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
        ]
      : []),
  ], [canAssignRoles, user?.id]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Manage team members and their access"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Users' }]}
        actions={
          canAddUsers ? (
            <Button
              onClick={() => {
                setNewUser({ name: '', email: '', role: assignableRoleOptions[0]?.value ?? DEFAULT_NEW_USER_ROLE });
                setCreateDialog(true);
              }}
            >
              <Plus className="h-4 w-4" /> Add User
            </Button>
          ) : undefined
        }
      />

      <DataTable
        columns={columns}
        data={users ?? []}
        isLoading={isLoading}
        searchPlaceholder="Search users by name, email…"
        emptyState={
          <EmptyState
            icon={Users}
            title="No users found"
            description="Users will appear here as they are created in the system."
          />
        }
      />

      {/* Edit Role Dialog */}
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
            </div>

            <Select
              label="New Role"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as Role)}
              options={ROLE_OPTIONS}
            />

            {canAssignRoles && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                <p className="text-sm text-amber-800">
                  ⚠️ Only Super Admins can assign roles. Admins can view but not change roles.
                </p>
              </div>
            )}
          </div>
        </Dialog>
      )}

      {/* Create User Dialog */}
      {createDialog && (
        <Dialog
          open={createDialog}
          onClose={() => setCreateDialog(false)}
          title="Add New User"
          description="Create a new team member account"
          primaryAction={{
            label: 'Create User',
            onClick: handleCreateUser,
          }}
        >
          <div className="space-y-4">
            <Input
              label="Full Name"
              value={newUser.name}
              onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
              placeholder="Enter full name"
            />
            <Input
              label="Email"
              type="email"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              placeholder="user@aamako.com"
            />
            <Select
              label="Role"
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value as Role })}
              options={assignableRoleOptions.length > 0 ? assignableRoleOptions : [{ value: 'STAFF_MANAGER' as Role, label: 'Staff Manager' }]}
            />
          </div>
        </Dialog>
      )}
    </div>
  );
}
