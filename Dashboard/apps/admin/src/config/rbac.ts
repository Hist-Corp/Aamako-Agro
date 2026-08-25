// ─── RBAC Configuration ───────────────────────────────────────────────
// Defines what each role can see and do in the dashboard.
// Nav rendering is driven by this config, not scattered conditionals.

import type { Role } from '@aamako/shared-types';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Warehouse,
  FlaskConical,
  Building2,
  Users,
  Star,
  BarChart3,
  Shield,
  Settings,
  FileText,
  UserCog,
  UsersRound,
  ClipboardList,
  UserCircle,
  Truck,
  Eye,
  DollarSign,
  MessageSquareQuote,
  BookOpen,
  Newspaper,
  Image,
  Headphones,
  BarChart2,
  Bell,
  Activity,
  MapPin,
  FolderOpen,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  permission: string;
  /** If set, only these roles see this item. If absent, visible to all with the permission. */
  roles?: Role[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_STRUCTURE: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      {
        label: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
        permission: 'dashboard:view',
      },
    ],
  },
  {
    label: 'Administration',
    items: [
      {
        label: 'Users',
        href: '/users',
        icon: Users,
        permission: 'users:view',
      },
      {
        label: 'Roles & Permissions',
        href: '/roles',
        icon: Shield,
        permission: 'roles:view',
      },
      {
        label: 'Staff',
        href: '/staff',
        icon: UsersRound,
        permission: 'staff:view',
      },
      {
        label: 'Settings',
        href: '/settings',
        icon: Settings,
        permission: 'settings:view',
      },
    ],
  },
  {
    label: 'Products & Inventory',
    items: [
      {
        label: 'Products',
        href: '/products',
        icon: Package,
        permission: 'products:view',
      },
      {
        label: 'Inventory',
        href: '/inventory',
        icon: Warehouse,
        permission: 'inventory:view',
      },
      {
        label: 'Warehouses',
        href: '/warehouses',
        icon: MapPin,
        permission: 'warehouses:view',
      },
      {
        label: 'Batches',
        href: '/batches',
        icon: FlaskConical,
        permission: 'batches:view',
      },
      {
        label: 'Distribution',
        href: '/distribution',
        icon: Truck,
        permission: 'distribution:view',
      },
      {
        label: 'Inventory Monitoring',
        href: '/inventory-monitoring',
        icon: Eye,
        permission: 'inventory-monitoring:view',
      },
    ],
  },
  {
    label: 'Orders & Sales',
    items: [
      {
        label: 'Orders',
        href: '/orders',
        icon: ShoppingCart,
        permission: 'orders:view',
      },
      {
        label: 'Sales',
        href: '/sales',
        icon: DollarSign,
        permission: 'sales:view',
      },
      {
        label: 'Wholesale',
        href: '/wholesale',
        icon: Building2,
        permission: 'wholesale:view',
      },
      {
        label: 'Quotes',
        href: '/quotes',
        icon: MessageSquareQuote,
        permission: 'quotes:view',
      },
    ],
  },
  {
    label: 'People',
    items: [
      {
        label: 'Customers',
        href: '/customers',
        icon: Users,
        permission: 'customers:view',
      },
      {
        label: 'Customer Support',
        href: '/support',
        icon: Headphones,
        permission: 'support:view',
      },
    ],
  },
  {
    label: 'Content',
    items: [
      {
        label: 'Content Management',
        href: '/content',
        icon: FileText,
        permission: 'content:view',
      },
      {
        label: 'Journal / Blog',
        href: '/journal',
        icon: Newspaper,
        permission: 'journal:view',
      },
      {
        label: 'Media',
        href: '/media',
        icon: Image,
        permission: 'media:view',
      },
      {
        label: 'Reviews',
        href: '/reviews',
        icon: Star,
        permission: 'reviews:view',
      },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      {
        label: 'Reports',
        href: '/reports',
        icon: BarChart2,
        permission: 'reports:view',
      },
      {
        label: 'Analytics',
        href: '/analytics',
        icon: BarChart3,
        permission: 'analytics:view',
      },
      {
        label: 'Notifications',
        href: '/notifications',
        icon: Bell,
        permission: 'notifications:view',
      },
      {
        label: 'Activity / Audit Logs',
        href: '/audit-log',
        icon: Activity,
        permission: 'audit:view',
      },
    ],
  },
];

/** Check if a role has a specific permission */
export function hasPermission(role: Role, permission: string): boolean {
  const { ROLE_PERMISSIONS } = require('@aamako/shared-types');
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** Get nav items visible to a given role */
export function getVisibleNav(role: Role): NavGroup[] {
  return NAV_STRUCTURE.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      // Check role restriction
      if (item.roles && !item.roles.includes(role)) return false;
      // Check permission
      return hasPermission(role, item.permission);
    }),
  })).filter((group) => group.items.length > 0);
}

/** Action-level permission check for specific screens */
export function canAct(role: Role, permission: string): boolean {
  return hasPermission(role, permission);
}
