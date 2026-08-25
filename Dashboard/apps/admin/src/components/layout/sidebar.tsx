'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/config/auth-context';
import { getVisibleNav, type NavGroup } from '@/config/rbac';
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  Leaf,
} from 'lucide-react';

export function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  if (!user) return null;

  const navGroups = getVisibleNav(user.role);

  return (
    <aside
      className={cn(
        'flex flex-col h-screen bg-surface-900 text-white transition-all duration-200 border-r border-surface-800',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-surface-800 flex-shrink-0">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-600 flex-shrink-0">
          <Leaf className="h-4 w-4 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">आमाको एग्रो</p>
            <p className="text-2xs text-surface-400">Admin Dashboard</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin py-3 px-2">
        {navGroups.map((group) => (
          <NavGroupSection key={group.label} group={group} pathname={pathname} collapsed={collapsed} />
        ))}
      </nav>

      {/* User / Collapse */}
      <div className="border-t border-surface-800 p-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-surface-400 hover:text-white hover:bg-surface-800 transition-colors text-sm"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4 mx-auto" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span className="text-xs">Collapse</span>
            </>
          )}
        </button>

        {!collapsed && (
          <div className="mt-2 px-3 py-2 rounded-lg bg-surface-800/50">
            <p className="text-xs font-medium text-white truncate">{user.name}</p>
            <p className="text-2xs text-surface-400 truncate">{user.email}</p>
            <p className="text-2xs text-surface-500 mt-0.5">{user.role.replace(/_/g, ' ')}</p>
          </div>
        )}

        <button
          onClick={logout}
          className={cn(
            'flex items-center gap-2 w-full px-3 py-2 mt-1 rounded-lg text-surface-400 hover:text-white hover:bg-surface-800 transition-colors text-sm'
          )}
          title="Sign out"
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          {!collapsed && <span className="text-xs">Sign out</span>}
        </button>
      </div>
    </aside>
  );
}

function NavGroupSection({
  group,
  pathname,
  collapsed,
}: {
  group: NavGroup;
  pathname: string;
  collapsed: boolean;
}) {
  return (
    <div className="mb-4">
      {!collapsed && (
        <p className="px-3 mb-1 text-2xs font-semibold text-surface-500 uppercase tracking-wider">
          {group.label}
        </p>
      )}
      <div className="space-y-0.5">
        {group.items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-brand-600/20 text-brand-400 font-medium'
                  : 'text-surface-400 hover:text-white hover:bg-surface-800',
                collapsed && 'justify-center px-0'
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
