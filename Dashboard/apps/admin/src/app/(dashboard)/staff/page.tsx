'use client';

import React, { useState, useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useUsers, useCreateStaff } from '@/lib/api-hooks';
import { useAuth } from '@/config/auth-context';
import { formatDateTime } from '@/lib/utils';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { User, Role } from '@aamako/shared-types';
import { canAddStaff, creatableRolesFor, isCustomerRole } from '@aamako/shared-types';
import { UsersRound, Plus } from 'lucide-react';

const DEPARTMENT_OPTIONS = [
  { value: '', label: 'All Departments' },
  { value: 'Operations', label: 'Operations' },
  { value: 'Sales', label: 'Sales' },
  { value: 'Inventory', label: 'Inventory' },
  { value: 'Content', label: 'Content' },
  { value: 'Support', label: 'Support' },
];

/** Which department each role belongs to (used by the department filter). */
const ROLE_DEPARTMENT: Record<Role, string> = {
  SUPER_ADMIN: 'Operations',
  ADMIN: 'Operations',
  STAFF_ADMIN: 'Operations',
  MANAGER: 'Operations',
  SALES: 'Sales',
  STAFF_SALES: 'Sales',
  INVENTORY_MANAGER: 'Inventory',
  STAFF_MANAGER: 'Inventory',
  CONTENT_MANAGER: 'Content',
  CUSTOMER_SUPPORT: 'Support',
  STAFF_SUPPORT: 'Support',
  RETAIL_CUSTOMER: 'Operations',
  WHOLESALE_CUSTOMER: 'Operations',
};

/** Friendly labels for the roles selectable in the Add Staff dialog. */
const ROLE_LABELS: Partial<Record<Role, string>> = {
  INVENTORY_MANAGER: 'Inventory Manager',
  STAFF_MANAGER: 'Staff Manager',
  CUSTOMER_SUPPORT: 'Customer Support',
  STAFF_SUPPORT: 'Staff Support',
  CONTENT_MANAGER: 'Content Manager',
  SALES: 'Sales',
  STAFF_SALES: 'Staff Sales',
  MANAGER: 'Manager',
  ADMIN: 'Admin',
  STAFF_ADMIN: 'Staff Admin',
};

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
 *  Can view: roles with staff:view
 *  Can Add Staff: Super Admin, Admin, Manager, Sales — NOT inventory
 *  managers, content managers or customer support.
 */
export default function StaffPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [addDialog, setAddDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newStaff, setNewStaff] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: '' as Role | '',
  });

  const createStaff = useCreateStaff();
  const { data: users, isLoading } = useUsers();
  const [profileUser, setProfileUser] = useState<User | null>(null);

  const creatableRoles = creatableRolesFor(user?.role);

  // Filter to dashboard staff (exclude SUPER_ADMIN and storefront customer
  // accounts), then apply the department filter based on each role's department.
  const staffUsers = useMemo(() => {
    return (users ?? []).filter((u) => {
      if (u.role === 'SUPER_ADMIN') return false;
      if (isCustomerRole(u.role)) return false;
      if (departmentFilter && ROLE_DEPARTMENT[u.role] !== departmentFilter) {
        return false;
      }
      return true;
    });
  }, [users, departmentFilter]);

  const handleCreateStaff = async () => {
    if (!newStaff.firstName || !newStaff.email || !newStaff.password || !newStaff.role) {
      addToast({
        type: 'error',
        title: 'Missing fields',
        description: 'First name, email, password and role are required.',
      });
      return;
    }
    setIsCreating(true);
    try {
      await createStaff.mutateAsync({
        email: newStaff.email,
        password: newStaff.password,
        firstName: newStaff.firstName,
        lastName: newStaff.lastName || undefined,
        role: newStaff.role as Role,
      });
      addToast({
        type: 'success',
        title: 'Staff member added',
        description: `${newStaff.firstName} (${newStaff.email}) added as ${ROLE_LABELS[newStaff.role] ?? newStaff.role}`,
      });
      setAddDialog(false);
      setNewStaff({ firstName: '', lastName: '', email: '', password: '', role: '' });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Failed to add staff member', description: err?.message ?? 'Unknown error' });
    } finally {
      setIsCreating(false);
    }
  };

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
          <Button variant="secondary" size="sm" onClick={() => setProfileUser(row.original)}>
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
          canAddStaff(user?.role) ? (
            <Button
              onClick={() => {
                setNewStaff((s) => ({ ...s, role: creatableRoles[0] ?? '' }));
                setAddDialog(true);
              }}
            >
              <Plus className="h-4 w-4" /> Add Staff
            </Button>
          ) : undefined
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

      {/* View Profile Dialog */}
      {profileUser && (
        <Dialog
          open={!!profileUser}
          onClose={() => setProfileUser(null)}
          title="Staff Profile"
          description="Account details for this team member."
        >
          <div className="space-y-2 rounded-lg bg-surface-50 p-4 text-sm">
            <p><span className="font-medium">Name:</span> {profileUser.name}</p>
            <p><span className="font-medium">Email:</span> {profileUser.email}</p>
            <p><span className="font-medium">Role:</span> {ROLE_LABELS[profileUser.role] ?? profileUser.role}</p>
            <p><span className="font-medium">Department:</span> {ROLE_DEPARTMENT[profileUser.role] ?? '—'}</p>
            <p><span className="font-medium">MFA Enabled:</span> {profileUser.mfaEnabled ? 'Yes' : 'No'}</p>
            <p><span className="font-medium">Joined:</span> {formatDateTime(profileUser.createdAt)}</p>
            {profileUser.lastLoginAt && (
              <p><span className="font-medium">Last Login:</span> {formatDateTime(profileUser.lastLoginAt)}</p>
            )}
          </div>
        </Dialog>
      )}

      {/* Add Staff Dialog */}
      {addDialog && (
        <Dialog
          open={addDialog}
          onClose={() => setAddDialog(false)}
          title="Add Staff Member"
          description="Create a new staff account. The member can sign in immediately with the email and password you set."
          primaryAction={{
            label: 'Add Staff',
            onClick: handleCreateStaff,
            isLoading: isCreating,
          }}
        >
          <div className="space-y-4">
            <Input
              label="First Name"
              value={newStaff.firstName}
              onChange={(e) => setNewStaff({ ...newStaff, firstName: e.target.value })}
              placeholder="Gita"
            />
            <Input
              label="Last Name"
              value={newStaff.lastName}
              onChange={(e) => setNewStaff({ ...newStaff, lastName: e.target.value })}
              placeholder="Shrestha"
            />
            <Input
              label="Email"
              type="email"
              value={newStaff.email}
              onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
              placeholder="staff@aamako.agro"
            />
            <Input
              label="Temporary Password"
              type="password"
              value={newStaff.password}
              onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
              placeholder="Min. 8 characters"
            />
            <Select
              label="Role"
              value={newStaff.role}
              onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value as Role })}
              options={creatableRoles.map((r) => ({
                value: r,
                label: ROLE_LABELS[r] ?? r.replace(/_/g, ' '),
              }))}
            />
          </div>
        </Dialog>
      )}
    </div>
  );
}
