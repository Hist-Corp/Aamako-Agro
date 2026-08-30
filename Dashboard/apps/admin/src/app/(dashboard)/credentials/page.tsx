'use client';

import React, { useState, useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useUsers, useUpdateCredentials } from '@/lib/api-hooks';
import { useAuth } from '@/config/auth-context';
import { formatDateTime } from '@/lib/utils';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { User, Role } from '@aamako/shared-types';
import { KeyRound, ShieldAlert } from 'lucide-react';

/** Roles allowed to open this section — mirrors the backend guard. */
const CREDENTIALS_ROLES: Role[] = ['STAFF_ADMIN', 'SUPER_ADMIN'];

const ROLE_LABELS: Partial<Record<Role, string>> = {
  STAFF_ADMIN: 'Staff Admin', STAFF_MANAGER: 'Staff Manager', STAFF_SALES: 'Staff Sales',
  STAFF_SUPPORT: 'Staff Support', CONTENT_MANAGER: 'Content Manager', SUPER_ADMIN: 'Super Admin',
};

interface CredentialsForm {
  firstName: string; lastName: string; phone: string;
  email: string; password: string; confirmPassword: string;
}

const EMPTY_FORM: CredentialsForm = {
  firstName: '', lastName: '', phone: '', email: '', password: '', confirmPassword: '',
};

/** Screen: User Credentials — Admin / Super Admin only.
 *  Edit any dashboard user's name, email, phone and password. A changed
 *  password is hashed server-side (the old one stops verifying) and all of
 *  the user's sessions are revoked immediately. */
export default function CredentialsPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const { data: users, isLoading } = useUsers();
  const updateCredentials = useUpdateCredentials();
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState<CredentialsForm>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [fieldError, setFieldError] = useState('');

  const staffUsers = useMemo(
    () => (users ?? []).filter((u: any) => !['RETAIL_CUSTOMER', 'WHOLESALE_CUSTOMER'].includes(u.role)),
    [users],
  );

  const openEdit = (u: User) => {
    const anyU = u as any;
    setForm({
      firstName: anyU.firstName ?? (u.name || '').split(' ')[0] ?? '',
      lastName: anyU.lastName ?? (u.name || '').split(' ').slice(1).join(' ') ?? '',
      phone: anyU.phone ?? '',
      email: u.email,
      password: '',
      confirmPassword: '',
    });
    setFieldError('');
    setEditing(u);
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!form.firstName.trim()) { setFieldError('First name is required.'); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) { setFieldError('Enter a valid email address.'); return; }
    if (form.password || form.confirmPassword) {
      if (form.password.length < 8) { setFieldError('New password must be at least 8 characters.'); return; }
      if (form.password !== form.confirmPassword) { setFieldError('Passwords do not match.'); return; }
    }
    setIsSaving(true);
    setFieldError('');
    try {
      const payload: Record<string, string> = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
      };
      if (form.password) payload.password = form.password;
      const res = await updateCredentials.mutateAsync({ id: editing.id, data: payload });
      addToast({
        type: 'success',
        title: `Credentials updated for ${editing.name}`,
        description: res.passwordChanged
          ? 'The old password no longer works and all sessions were signed out.'
          : res.message,
      });
      setEditing(null);
    } catch (err: any) {
      setFieldError(err.message || 'Failed to update credentials.');
    } finally {
      setIsSaving(false);
    }
  };

  const columns = useMemo<ColumnDef<User>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'User',
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-surface-900">{row.original.name}</p>
            <p className="text-2xs text-surface-400">{row.original.email}</p>
          </div>
        ),
      },
      {
        accessorKey: 'role',
        header: 'Role',
        cell: ({ row }) => (
          <Badge variant={row.original.role === 'SUPER_ADMIN' ? 'danger' : 'info'}>
            {ROLE_LABELS[row.original.role] ?? row.original.role}
          </Badge>
        ),
      },
      {
        id: 'active',
        header: 'Status',
        cell: ({ row }) => {
          const active = (row.original as any).isActive;
          return active === false ? <Badge variant="warning">INACTIVE</Badge> : <Badge variant="success">ACTIVE</Badge>;
        },
      },
      {
        accessorKey: 'createdAt',
        header: 'Created',
        cell: ({ row }) => <span className="text-2xs text-surface-400">{formatDateTime(row.original.createdAt)}</span>,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const isSelf = user?.id === row.original.id;
          const canEdit =
            CREDENTIALS_ROLES.includes(user?.role as Role) &&
            row.original.role !== 'SUPER_ADMIN' &&
            !isSelf;
          return (
            <Button
              size="sm"
              variant={canEdit ? 'secondary' : 'ghost'}
              disabled={!canEdit}
              onClick={() => canEdit && openEdit(row.original)}
            >
              <KeyRound className="h-3.5 w-3.5" /> Edit credentials
            </Button>
          );
        },
      },
    ],
    [user],
  );

  if (user && !CREDENTIALS_ROLES.includes(user.role)) {
    return (
      <div className="space-y-6">
        <PageHeader title="User Credentials" breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'User Credentials' }]} />
        <div className="flex items-center gap-3 rounded-lg border border-surface-200 bg-surface-50 p-6 text-surface-600">
          <ShieldAlert className="h-6 w-6 text-surface-400" />
          <p className="text-sm">Only Admin and Super Admin accounts can manage dashboard user credentials.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Credentials"
        description="Update any dashboard user's name, email, phone or password. Changing a password signs the user out everywhere and the old password stops working immediately."
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'User Credentials' }]}
      />
      <DataTable
        columns={columns}
        data={staffUsers}
        isLoading={isLoading}
        searchPlaceholder="Search users by name, email, role…"
        emptyState={
          <EmptyState icon={KeyRound} title="No dashboard users found" description="Dashboard user accounts will appear here." />
        }
      />

      {editing && (
        <Dialog
          open={!!editing}
          onClose={() => setEditing(null)}
          title={`Edit credentials — ${editing.name}`}
          description="Leave the password fields empty to keep the current password. Setting a new password signs the user out of every device."
          primaryAction={{ label: 'Save changes', onClick: handleSave, isLoading: isSaving }}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input label="First Name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
              <Input label="Last Name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </div>
            <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+977…" />
            <div className="rounded-lg bg-surface-50 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-400">Reset password (optional)</p>
              <div className="space-y-3">
                <Input label="New password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min. 8 characters" />
                <Input label="Confirm new password" type="password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} />
              </div>
            </div>
            {fieldError && <p className="text-xs font-medium text-red-600">{fieldError}</p>}
          </div>
        </Dialog>
      )}
    </div>
  );
}