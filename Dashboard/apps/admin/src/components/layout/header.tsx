'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/config/auth-context';
import { Badge } from '@/components/ui/badge';
import { Bell, Search, ChevronRight, User, LogOut, Settings, Shield } from 'lucide-react';

const ROLE_BADGE_VARIANT: Record<string, string> = {
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

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  SALES: 'Sales',
  INVENTORY_MANAGER: 'Inventory Mgr',
  CONTENT_MANAGER: 'Content Mgr',
  CUSTOMER_SUPPORT: 'Support',
  // Real backend roles
  STAFF_ADMIN: 'Staff Admin',
  STAFF_MANAGER: 'Staff Manager',
  STAFF_SALES: 'Staff Sales',
  STAFF_SUPPORT: 'Support',
  RETAIL_CUSTOMER: 'Customer',
  WHOLESALE_CUSTOMER: 'Wholesale',
};

export function Header() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // Generate breadcrumbs from pathname
  const generateBreadcrumbs = () => {
    const segments = pathname.split('/').filter(Boolean);
    const breadcrumbs = [{ label: 'Dashboard', href: '/dashboard' }];

    let currentPath = '';
    segments.forEach((segment, index) => {
      if (segment === 'dashboard' && index === 0) return;
      currentPath += `/${segment}`;
      const label = segment
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      breadcrumbs.push({ label, href: currentPath });
    });

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();
  const unreadCount = 3; // Mock unread count

  return (
    <header className="flex items-center justify-between h-16 px-6 bg-white border-b border-surface-200 flex-shrink-0">
      {/* Left: Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm">
        {breadcrumbs.map((crumb, index) => (
          <React.Fragment key={crumb.href}>
            {index > 0 && <ChevronRight className="h-3 w-3 text-surface-400" />}
            {index === breadcrumbs.length - 1 ? (
              <span className="font-medium text-surface-900">{crumb.label}</span>
            ) : (
              <Link href={crumb.href} className="text-surface-500 hover:text-surface-700 transition-colors">
                {crumb.label}
              </Link>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Center: Search */}
      <div className="flex items-center gap-3 flex-1 max-w-lg mx-8">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
          <input
            type="text"
            placeholder="Search orders, products, customers… ( / )"
            className="w-full h-9 pl-9 pr-4 rounded-lg border border-surface-200 bg-surface-50 text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:bg-white"
          />
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Role Badge */}
        {user && (
          <Badge variant={(ROLE_BADGE_VARIANT[user.role] ?? 'neutral') as any}>
            <Shield className="h-3 w-3 mr-1" />
            {ROLE_LABELS[user.role]}
          </Badge>
        )}

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-lg text-surface-500 hover:text-surface-700 hover:bg-surface-100 transition-colors"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500" />
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
              <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl border border-surface-200 shadow-lg z-50">
                <div className="p-3 border-b border-surface-100">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-surface-900">Notifications</h3>
                    <button className="text-xs text-brand-600 hover:text-brand-800">Mark all read</button>
                  </div>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {[
                    { title: 'New order received', message: 'Order #ORD-2847 — Rs. 12,400', time: '5m ago', unread: true },
                    { title: 'Low stock alert', message: 'Red Lentils — 15 units left', time: '15m ago', unread: true },
                    { title: 'Support ticket', message: 'Urgent: Account access issue', time: '30m ago', unread: true },
                  ].map((notification, i) => (
                    <div
                      key={i}
                      className={`p-3 hover:bg-surface-50 cursor-pointer border-b border-surface-100 last:border-0 ${
                        notification.unread ? 'bg-brand-50/30' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {notification.unread && (
                          <span className="h-2 w-2 rounded-full bg-brand-500 mt-1.5 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-surface-900">{notification.title}</p>
                          <p className="text-xs text-surface-500 truncate">{notification.message}</p>
                          <p className="text-2xs text-surface-400 mt-0.5">{notification.time}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-2 border-t border-surface-100">
                  <Link
                    href="/notifications"
                    className="block text-center text-sm text-brand-600 hover:text-brand-800 py-1"
                    onClick={() => setShowNotifications(false)}
                  >
                    View all notifications
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>

        {/* User Profile Menu */}
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2 hover:bg-surface-50 rounded-lg p-1.5 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center">
              <span className="text-xs font-semibold text-brand-700">
                {user?.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)}
              </span>
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-surface-900">{user?.name}</p>
              <p className="text-2xs text-surface-500">{user?.role.replace(/_/g, ' ')}</p>
            </div>
          </button>

          {/* Profile Dropdown */}
          {showProfileMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl border border-surface-200 shadow-lg z-50 py-1">
                <Link
                  href="/profile"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-surface-700 hover:bg-surface-50"
                  onClick={() => setShowProfileMenu(false)}
                >
                  <User className="h-4 w-4" />
                  My Profile
                </Link>
                <Link
                  href="/settings"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-surface-700 hover:bg-surface-50"
                  onClick={() => setShowProfileMenu(false)}
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
                <hr className="my-1 border-surface-100" />
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    logout();
                  }}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
