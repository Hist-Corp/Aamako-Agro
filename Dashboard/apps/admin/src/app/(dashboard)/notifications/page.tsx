'use client';

import React, { useState } from 'react';
import { useAuth } from '@/config/auth-context';
import { relativeTime } from '@/lib/utils';
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead, type AdminNotification } from '@/lib/api-hooks';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs } from '@/components/ui/tabs';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Trash2,
  ShoppingCart,
  Package,
  AlertTriangle,
  MessageSquare,
  User,
  Settings,
} from 'lucide-react';

interface Notification {
  id: string;
  type: 'ORDER' | 'INVENTORY' | 'SYSTEM' | 'SUPPORT' | 'USER' | 'SETTINGS';
  title: string;
  message: string;
  read: boolean;
  actionUrl?: string;
  createdAt: string;
}

const MOCK_NOTIFICATIONS: Notification[] = [
  { id: 'N001', type: 'ORDER', title: 'New order received', message: 'Order #ORD-2847 from KTM Fresh Mart — Rs. 12,400', read: false, createdAt: new Date(Date.now() - 300000).toISOString() },
  { id: 'N002', type: 'INVENTORY', title: 'Low stock alert', message: 'Red Lentils (1kg) has only 15 units remaining', read: false, createdAt: new Date(Date.now() - 900000).toISOString() },
  { id: 'N003', type: 'SUPPORT', title: 'New support ticket', message: 'Urgent: Account access issue from Pokhara Organics', read: false, createdAt: new Date(Date.now() - 1800000).toISOString() },
  { id: 'N004', type: 'SYSTEM', title: 'System maintenance scheduled', message: 'Scheduled maintenance window: Aug 25, 2026 2:00 AM - 4:00 AM', read: true, createdAt: new Date(Date.now() - 3600000).toISOString() },
  { id: 'N005', type: 'ORDER', title: 'Order shipped', message: 'Order #ORD-2843 shipped via Pathao Courier', read: true, createdAt: new Date(Date.now() - 7200000).toISOString() },
  { id: 'N006', type: 'USER', title: 'New user registered', message: 'Ram Sales (sales@aamako.com) joined the team', read: true, createdAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'N007', type: 'INVENTORY', title: 'Batch QC completed', message: 'Batch #BAT-0090 QC check passed', read: true, createdAt: new Date(Date.now() - 172800000).toISOString() },
  { id: 'N008', type: 'SETTINGS', title: 'Role updated', message: 'Ram Sales role changed from Sales to Manager', read: true, createdAt: new Date(Date.now() - 259200000).toISOString() },
];

const TYPE_ICONS: Record<string, typeof Bell> = {
  ORDER: ShoppingCart,
  INVENTORY: Package,
  SYSTEM: Settings,
  SUPPORT: MessageSquare,
  USER: User,
  SETTINGS: Settings,
};

const TYPE_COLORS: Record<string, string> = {
  ORDER: 'text-blue-600 bg-blue-100',
  INVENTORY: 'text-amber-600 bg-amber-100',
  SYSTEM: 'text-surface-600 bg-surface-100',
  SUPPORT: 'text-purple-600 bg-purple-100',
  USER: 'text-green-600 bg-green-100',
  SETTINGS: 'text-surface-600 bg-surface-100',
};

/** Screen: Notifications
 *  Can view: All roles
 *  Can manage: SUPER_ADMIN, ADMIN
 */
export default function NotificationsPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [filter, setFilter] = useState('all');
  const { data: notifications = [], isLoading } = useNotifications();
  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.read;
    if (filter === 'read') return n.read;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = (id: string) => {
    markReadMutation.mutate(id, {
      onSuccess: () =>
        addToast({ type: 'success', title: 'Notification marked as read' }),
      onError: (err: any) =>
        addToast({ type: 'error', title: 'Failed to update notification', description: err.message }),
    });
  };

  const markAllAsRead = () => {
    markAllReadMutation.mutate(undefined, {
      onSuccess: () =>
        addToast({ type: 'success', title: 'All notifications marked as read' }),
      onError: (err: any) =>
        addToast({ type: 'error', title: 'Failed to update notifications', description: err.message }),
    });
  };

  const clearAll = () => {
    // Mark everything read — the backend keeps an audit-friendly record
    // rather than deleting notifications.
    markAllReadMutation.mutate(undefined, {
      onSuccess: () => addToast({ type: 'success', title: 'All notifications cleared' }),
      onError: (err: any) =>
        addToast({ type: 'error', title: 'Failed to clear notifications', description: err.message }),
    });
  };

  const tabs = [
    { id: 'all', label: 'All', count: notifications.length },
    { id: 'unread', label: 'Unread', count: unreadCount },
    { id: 'read', label: 'Read' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Stay updated with system alerts and activities"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Notifications' }]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={markAllAsRead}>
              <CheckCheck className="h-4 w-4" /> Mark All Read
            </Button>
            <Button variant="ghost" size="sm" onClick={clearAll}>
              <Trash2 className="h-4 w-4" /> Clear All
            </Button>
          </div>
        }
      />

      <Tabs tabs={tabs} activeTab={filter} onChange={setFilter} />

      {filteredNotifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications"
          description={filter === 'unread' ? "You're all caught up!" : "No notifications to display."}
        />
      ) : (
        <Card>
          <div className="divide-y divide-surface-100">
            {filteredNotifications.map((notification) => {
              const Icon = TYPE_ICONS[notification.type] || Bell;
              const colorClass = TYPE_COLORS[notification.type] || 'text-surface-600 bg-surface-100';

              return (
                <div
                  key={notification.id}
                  className={`flex items-start gap-4 p-4 hover:bg-surface-50 transition-colors ${
                    !notification.read ? 'bg-brand-50/30' : ''
                  }`}
                >
                  <div className={`flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0 ${colorClass}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm ${!notification.read ? 'font-semibold text-surface-900' : 'font-medium text-surface-700'}`}>
                        {notification.title}
                      </p>
                      {!notification.read && (
                        <span className="h-2 w-2 rounded-full bg-brand-500 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-sm text-surface-600 mt-0.5">{notification.message}</p>
                    <p className="text-2xs text-surface-400 mt-1">{relativeTime(notification.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!notification.read && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => markAsRead(notification.id)}
                        title="Mark as read"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
