'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/config/auth-context';
import { ROLE_PERMISSIONS, type Role } from '@aamako/shared-types';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Shield, ShieldCheck, ShieldAlert, X } from 'lucide-react';

const ROLE_INFO: Record<Role, { label: string; description: string; color: string; icon: typeof Shield }> = {
  SUPER_ADMIN: { label: 'Super Admin', description: 'Full access to everything', color: 'bg-purple-500', icon: ShieldCheck },
  ADMIN: { label: 'Admin', description: 'Almost full access, second-level administrator', color: 'bg-blue-500', icon: Shield },
  MANAGER: { label: 'Manager', description: 'Handles overall business operations', color: 'bg-green-500', icon: Shield },
  SALES: { label: 'Sales', description: 'Handles sales, customers, and wholesale', color: 'bg-cyan-500', icon: Shield },
  INVENTORY_MANAGER: { label: 'Inventory Manager', description: 'Warehouse and distribution inventory', color: 'bg-amber-500', icon: Shield },
  CONTENT_MANAGER: { label: 'Content Manager', description: 'Manages all website/platform content', color: 'bg-pink-500', icon: Shield },
  CUSTOMER_SUPPORT: { label: 'Customer Support', description: 'Customer support tickets and communication', color: 'bg-indigo-500', icon: Shield },
  // Real backend roles
  STAFF_ADMIN: { label: 'Staff Admin', description: 'Manages users/staff/settings below admin level', color: 'bg-blue-600', icon: Shield },
  STAFF_MANAGER: { label: 'Staff Manager', description: 'Manages operations and users below manager', color: 'bg-green-600', icon: Shield },
  STAFF_SALES: { label: 'Staff Sales', description: 'Handles sales and users below sales', color: 'bg-cyan-600', icon: Shield },
  STAFF_SUPPORT: { label: 'Staff Support', description: 'Customer support tickets and communication', color: 'bg-indigo-600', icon: Shield },
  RETAIL_CUSTOMER: { label: 'Retail Customer', description: 'End customer with storefront access', color: 'bg-surface-500', icon: Shield },
  WHOLESALE_CUSTOMER: { label: 'Wholesale Customer', description: 'B2B wholesale customer account', color: 'bg-emerald-600', icon: Shield },
};

// Group permissions by module
const PERMISSION_GROUPS = [
  { label: 'Dashboard', permissions: ['dashboard:view'] },
  { label: 'Users & Roles', permissions: ['users:view', 'users:create', 'users:edit', 'users:delete', 'roles:view', 'roles:manage'] },
  { label: 'Staff', permissions: ['staff:view', 'staff:manage'] },
  { label: 'Products', permissions: ['products:view', 'products:edit', 'products:create', 'products:publish', 'products:delete', 'products:stock-fields', 'products:content-fields'] },
  { label: 'Inventory & Warehouses', permissions: ['inventory:view', 'inventory:adjust', 'inventory:create', 'warehouses:view', 'warehouses:manage', 'batches:view', 'batches:create', 'batches:recall'] },
  { label: 'Distribution', permissions: ['distribution:view', 'distribution:manage', 'inventory-monitoring:view', 'inventory-monitoring:manage'] },
  { label: 'Orders & Sales', permissions: ['orders:view', 'orders:advance', 'orders:cancel', 'orders:limited-status', 'sales:view', 'sales:manage'] },
  { label: 'Wholesale & Quotes', permissions: ['wholesale:view', 'wholesale:approve', 'wholesale:reject', 'quotes:view', 'quotes:respond'] },
  { label: 'Customers', permissions: ['customers:view', 'customers:suspend', 'customers:edit', 'customers:order-history', 'customers:support-notes'] },
  { label: 'Content', permissions: ['content:view', 'content:edit', 'content:publish', 'content:approve', 'journal:view', 'journal:edit', 'journal:publish', 'media:view', 'media:upload', 'media:delete'] },
  { label: 'Reviews', permissions: ['reviews:view', 'reviews:moderate'] },
  { label: 'Support', permissions: ['support:view', 'support:manage'] },
  { label: 'Reports & Analytics', permissions: ['reports:view', 'reports:export', 'analytics:view'] },
  { label: 'Audit & Notifications', permissions: ['audit:view', 'notifications:view', 'notifications:manage'] },
  { label: 'Settings', permissions: ['settings:view', 'settings:manage', 'settings:roles:manage'] },
  { label: 'Profile', permissions: ['profile:view', 'profile:edit'] },
];

/** Screen: Roles & Permissions
 *  Can view: SUPER_ADMIN, ADMIN
 *  Read-only overview of all roles and their permissions.
 *  Role cards are clickable — clicking one opens the full permission
 *  list of that role, grouped by module.
 */
export default function RolesPage() {
  const { user } = useAuth();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  const roles = Object.keys(ROLE_PERMISSIONS) as Role[];

  // Close the details panel with the Escape key
  useEffect(() => {
    if (!selectedRole) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedRole(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedRole]);

  const handleCardKeyDown = (e: React.KeyboardEvent, role: Role) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSelectedRole(role);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & Permissions"
        description="Click a role to see its full permission list"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Roles & Permissions' }]}
      />

      {/* Role Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {roles.map((role) => {
          const info = ROLE_INFO[role];
          const permissions = ROLE_PERMISSIONS[role];
          const Icon = info.icon;
          const isCurrentUser = user?.role === role;
          const isSelected = selectedRole === role;

          return (
            <Card
              key={role}
              padding="none"
              role="button"
              tabIndex={0}
              aria-expanded={isSelected}
              onClick={() => setSelectedRole(role)}
              onKeyDown={(e) => handleCardKeyDown(e, role)}
              className={cn(
                'cursor-pointer transition-all focus-ring hover:shadow-md hover:border-brand-300',
                isCurrentUser && 'ring-2 ring-brand-500 ring-offset-2',
                isSelected && 'border-brand-500 shadow-md'
              )}
            >
              <div className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${info.color}`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-surface-900">{info.label}</h3>
                    <p className="text-xs text-surface-500">{info.description}</p>
                  </div>
                </div>

                {isCurrentUser && (
                  <Badge variant="success" className="mb-3">Your Role</Badge>
                )}

                <div className="space-y-2">
                  <p className="text-xs font-medium text-surface-500 uppercase">Permissions ({permissions.length})</p>
                  <div className="flex flex-wrap gap-1">
                    {permissions.slice(0, 8).map((perm) => (
                      <Badge key={perm} variant="neutral" className="text-2xs">
                        {perm.split(':').pop()}
                      </Badge>
                    ))}
                    {permissions.length > 8 && (
                      <Badge variant="neutral" className="text-2xs">
                        +{permissions.length - 8} more
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-brand-600 pt-1">View all permissions →</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Permissions Matrix */}
      <Card>
        <CardHeader title="Permissions Matrix" description="Detailed view of what each role can access" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200">
                <th className="px-4 py-3 text-left font-semibold text-surface-600">Module</th>
                {roles.map((role) => (
                  <th key={role} className="px-4 py-3 text-center font-semibold text-surface-600">
                    <button
                      type="button"
                      onClick={() => setSelectedRole(role)}
                      title={`View ${ROLE_INFO[role].label} permissions`}
                      className="cursor-pointer rounded px-2 py-1 text-2xs hover:bg-surface-100 hover:text-brand-700 focus-ring"
                    >
                      {ROLE_INFO[role].label}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_GROUPS.map((group) => (
                <tr key={group.label} className="border-b border-surface-100 hover:bg-surface-50">
                  <td className="px-4 py-3 font-medium text-surface-700">{group.label}</td>
                  {roles.map((role) => {
                    const hasAll = group.permissions.every((p) => ROLE_PERMISSIONS[role].includes(p));
                    const hasSome = group.permissions.some((p) => ROLE_PERMISSIONS[role].includes(p));
                    return (
                      <td key={role} className="px-4 py-3 text-center">
                        {hasAll ? (
                          <ShieldCheck className="h-4 w-4 text-green-600 mx-auto" />
                        ) : hasSome ? (
                          <ShieldAlert className="h-4 w-4 text-amber-500 mx-auto" />
                        ) : (
                          <Shield className="h-4 w-4 text-surface-300 mx-auto" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Role Permission Details Modal */}
      {selectedRole && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`${ROLE_INFO[selectedRole].label} permissions`}
        >
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-surface-900/60 cursor-default"
            onClick={() => setSelectedRole(null)}
            tabIndex={-1}
          />

          {/* Panel */}
          <div className="relative bg-white rounded-lg border border-surface-200 shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between p-5 border-b border-surface-100">
              <div className="flex items-center gap-3">
                <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${ROLE_INFO[selectedRole].color}`}>
                  {React.createElement(ROLE_INFO[selectedRole].icon, { className: 'h-5 w-5 text-white' })}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-surface-900">{ROLE_INFO[selectedRole].label}</h2>
                    {user?.role === selectedRole && <Badge variant="success">Your Role</Badge>}
                  </div>
                  <p className="text-xs text-surface-500">{ROLE_INFO[selectedRole].description}</p>
                  <p className="mt-1 text-xs font-medium text-brand-600">
                    {ROLE_PERMISSIONS[selectedRole].length} total permissions
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRole(null)}
                className="rounded-md p-1.5 text-surface-400 hover:bg-surface-100 hover:text-surface-700 focus-ring"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body: permissions grouped by module */}
            <div className="overflow-y-auto p-5 space-y-5">
              {(() => {
                const granted = new Set(ROLE_PERMISSIONS[selectedRole]);
                const shown = new Set<string>();
                const sections: { label: string; perms: string[] }[] = [];

                for (const group of PERMISSION_GROUPS) {
                  const perms = group.permissions.filter((p) => granted.has(p));
                  if (perms.length > 0) {
                    sections.push({ label: group.label, perms });
                    perms.forEach((p) => shown.add(p));
                  }
                }

                const other = [...granted].filter((p) => !shown.has(p));
                if (other.length > 0) sections.push({ label: 'Other', perms: other });

                if (sections.length === 0) {
                  return (
                    <p className="text-sm text-surface-500">This role has no permissions assigned.</p>
                  );
                }

                return sections.map((section) => (
                  <div key={section.label}>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-surface-600">{section.label}</h4>
                      <span className="text-2xs text-surface-400">{section.perms.length}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {section.perms.map((perm) => (
                        <Badge key={perm} variant="success" className="text-2xs font-mono">
                          {perm}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-surface-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedRole(null)}
                className="inline-flex items-center justify-center rounded-lg text-sm font-medium h-9 px-4 bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 focus-ring"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
