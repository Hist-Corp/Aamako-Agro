'use client';

import React, { useState } from 'react';
import { useAuth } from '@/config/auth-context';
import { useOrders, useCustomers } from '@/lib/api-hooks';
import { formatCurrency, formatDateTime, relativeTime } from '@/lib/utils';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Tabs } from '@/components/ui/tabs';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { ROLE_PERMISSIONS, type Role } from '@aamako/shared-types';
import {
  UserCircle,
  Mail,
  Phone,
  Shield,
  Calendar,
  Clock,
  Package,
  MapPin,
  Edit,
  Save,
} from 'lucide-react';

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

const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  SALES: 'Sales',
  INVENTORY_MANAGER: 'Inventory Manager',
  CONTENT_MANAGER: 'Content Manager',
  CUSTOMER_SUPPORT: 'Customer Support',
  // Real backend roles
  STAFF_ADMIN: 'Staff Admin',
  STAFF_MANAGER: 'Staff Manager',
  STAFF_SALES: 'Staff Sales',
  STAFF_SUPPORT: 'Staff Support',
  RETAIL_CUSTOMER: 'Retail Customer',
  WHOLESALE_CUSTOMER: 'Wholesale Customer',
};

const DEPARTMENT_MAP: Record<Role, string> = {
  SUPER_ADMIN: 'Administration',
  ADMIN: 'Administration',
  MANAGER: 'Operations',
  SALES: 'Sales',
  INVENTORY_MANAGER: 'Inventory',
  CONTENT_MANAGER: 'Content',
  CUSTOMER_SUPPORT: 'Support',
  // Real backend roles
  STAFF_ADMIN: 'Administration',
  STAFF_MANAGER: 'Operations',
  STAFF_SALES: 'Sales',
  STAFF_SUPPORT: 'Support',
  RETAIL_CUSTOMER: 'Customers',
  WHOLESALE_CUSTOMER: 'Wholesale',
};

/** Screen: User Profile
 *  Shows different views based on role (customer vs staff)
 */
export default function ProfilePage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // For staff/admin users
  const { data: ordersData } = useOrders();
  const recentOrders = ordersData?.data?.slice(0, 5) ?? [];

  if (!user) return null;

  const roleVariant = (ROLE_BADGE_VARIANT[user.role] ?? 'neutral') as any;
  const permissions = ROLE_PERMISSIONS[user.role] ?? [];
  const department = DEPARTMENT_MAP[user.role];

  const handleSave = () => {
    addToast({
      type: 'success',
      title: 'Profile updated',
      description: 'Your profile has been saved successfully.',
    });
    setIsEditing(false);
  };

  const staffTabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'activity', label: 'Recent Activity' },
    { id: 'permissions', label: 'Permissions' },
  ];

  const customerTabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'orders', label: 'Order History' },
    { id: 'support', label: 'Support History' },
  ];

  const isCustomer =
    user.role === 'RETAIL_CUSTOMER' || user.role === 'WHOLESALE_CUSTOMER' || user.role === 'CUSTOMER_SUPPORT';

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Profile"
        description="View and manage your account"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Profile' }]}
        actions={
          <Button
            variant={isEditing ? 'primary' : 'secondary'}
            onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
          >
            {isEditing ? <><Save className="h-4 w-4" /> Save Changes</> : <><Edit className="h-4 w-4" /> Edit Profile</>}
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <Card className="lg:col-span-1">
          <div className="p-6 text-center">
            <div className="w-20 h-20 rounded-full bg-brand-100 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-brand-700">
                {user.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
              </span>
            </div>
            <h2 className="text-lg font-semibold text-surface-900">{user.name}</h2>
            <p className="text-sm text-surface-500">{user.email}</p>
            <Badge variant={roleVariant} className="mt-2">
              {ROLE_LABELS[user.role]}
            </Badge>

            <div className="mt-6 space-y-3 text-left">
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-surface-400" />
                <span className="text-surface-600">{user.email}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Shield className="h-4 w-4 text-surface-400" />
                <span className="text-surface-600">Department: {department}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-surface-400" />
                <span className="text-surface-600">Joined: {formatDateTime(user.createdAt)}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Clock className="h-4 w-4 text-surface-400" />
                <span className="text-surface-600">Last login: {relativeTime(user.lastLoginAt)}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs
            tabs={isCustomer ? customerTabs : staffTabs}
            activeTab={activeTab}
            onChange={setActiveTab}
          />

          {activeTab === 'overview' && (
            <Card>
              <CardHeader title="Account Information" />
              <div className="p-5 space-y-4">
                {isEditing ? (
                  <>
                    <Input label="Full Name" defaultValue={user.name} />
                    <Input label="Email" type="email" defaultValue={user.email} />
                    <Input label="Phone" defaultValue="+977-9841234567" />
                  </>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-medium text-surface-500 uppercase">Full Name</p>
                      <p className="text-sm text-surface-900 mt-1">{user.name}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-surface-500 uppercase">Email</p>
                      <p className="text-sm text-surface-900 mt-1">{user.email}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-surface-500 uppercase">Phone</p>
                      <p className="text-sm text-surface-900 mt-1">+977-9841234567</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-surface-500 uppercase">Department</p>
                      <p className="text-sm text-surface-900 mt-1">{department}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-surface-500 uppercase">MFA Status</p>
                      <Badge variant={user.mfaEnabled ? 'success' : 'warning'} className="mt-1">
                        {user.mfaEnabled ? 'Enabled' : 'Not Enabled'}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-surface-500 uppercase">Last Login</p>
                      <p className="text-sm text-surface-900 mt-1">{formatDateTime(user.lastLoginAt)}</p>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {activeTab === 'activity' && (
            <Card>
              <CardHeader title="Recent Activity" description="Your recent actions in the system" />
              <div className="p-5">
                <div className="space-y-4">
                  {[
                    { action: 'Approved wholesale application', entity: 'Chitwan Fresh Direct', time: '2 hours ago' },
                    { action: 'Updated product pricing', entity: 'Basmati Rice (5kg)', time: '5 hours ago' },
                    { action: 'Adjusted inventory stock', entity: 'Mustard Oil (1L) +200', time: '1 day ago' },
                    { action: 'Moderated customer review', entity: 'Review by Ram S.', time: '2 days ago' },
                    { action: 'Created new batch', entity: 'BAT-0090', time: '3 days ago' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-brand-500 mt-2 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-surface-900">{item.action}</p>
                        <p className="text-xs text-surface-500">{item.entity} • {item.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {activeTab === 'permissions' && (
            <Card>
              <CardHeader title="Your Permissions" description={`Role: ${ROLE_LABELS[user.role]}`} />
              <div className="p-5">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {permissions.map((perm) => (
                    <div key={perm} className="flex items-center gap-2 text-sm text-surface-700">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      <span className="font-mono text-xs">{perm}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {activeTab === 'orders' && (
            <Card>
              <CardHeader title="Order History" description="Your recent orders" />
              <div className="p-5">
                {recentOrders.length > 0 ? (
                  <div className="space-y-3">
                    {recentOrders.map((order) => (
                      <div key={order.id} className="flex items-center justify-between p-3 rounded-lg border border-surface-200 hover:bg-surface-50">
                        <div>
                          <p className="font-medium text-surface-900">{order.orderNumber}</p>
                          <p className="text-xs text-surface-500">{formatDateTime(order.createdAt)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium tabular-nums">{formatCurrency(order.total)}</p>
                          <Badge variant={order.status === 'DELIVERED' ? 'success' : 'info'}>
                            {order.status.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={Package}
                    title="No orders yet"
                    description="Your order history will appear here."
                  />
                )}
              </div>
            </Card>
          )}

          {activeTab === 'support' && (
            <Card>
              <CardHeader title="Support History" description="Your support tickets and communications" />
              <div className="p-5">
                <EmptyState
                  icon={UserCircle}
                  title="No support history"
                  description="Your support tickets and communications will appear here."
                />
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
