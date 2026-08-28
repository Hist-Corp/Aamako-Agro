// ─── Auth & RBAC Types ────────────────────────────────────────────────
// Shared between admin dashboard and customer storefront

export type Role =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'MANAGER'
  | 'SALES'
  | 'INVENTORY_MANAGER'
  | 'CONTENT_MANAGER'
  | 'CUSTOMER_SUPPORT'
  // Real backend roles (source of truth from the API)
  | 'STAFF_ADMIN'
  | 'STAFF_MANAGER'
  | 'STAFF_SALES'
  | 'STAFF_SUPPORT'
  | 'RETAIL_CUSTOMER'
  | 'WHOLESALE_CUSTOMER';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  avatarUrl?: string;
  mfaEnabled: boolean;
  lastLoginAt: string;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  email: string;
  password: string;
  totpCode?: string;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}

// Role → Permission mapping
export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  SUPER_ADMIN: [
    'dashboard:view',
    // Users & Roles
    'users:view', 'users:create', 'users:edit', 'users:delete',
    'roles:view', 'roles:manage',
    // Staff
    'staff:view', 'staff:manage',
    // Products
    'products:view', 'products:edit', 'products:create', 'products:publish', 'products:delete',
    // Inventory & Warehouses
    'inventory:view', 'inventory:adjust', 'inventory:create',
    'warehouses:view', 'warehouses:manage',
    'batches:view', 'batches:create', 'batches:recall',
    // Distribution
    'distribution:view', 'distribution:manage',
    'inventory-monitoring:view', 'inventory-monitoring:manage',
    // Orders & Sales
    'orders:view', 'orders:advance', 'orders:cancel',
    'sales:view', 'sales:manage',
    'wholesale:view', 'wholesale:approve', 'wholesale:reject',
    'quotes:view', 'quotes:respond',
    // Customers
    'customers:view', 'customers:suspend', 'customers:edit',
    // Content
    'content:view', 'content:edit', 'content:publish', 'content:approve',
    'journal:view', 'journal:edit', 'journal:publish',
    'media:view', 'media:upload', 'media:delete',
    // Support
    'support:view', 'support:manage',
    // Reports & Analytics
    'reports:view', 'reports:export',
    'analytics:view',
    // Audit & Notifications
    'audit:view',
    'notifications:view', 'notifications:manage',
    // Settings
    'settings:view', 'settings:manage', 'settings:roles:manage',
    // Profile
    'profile:view', 'profile:edit',
  ],
  ADMIN: [
    'dashboard:view',
    // Users & Roles
    'users:view', 'users:create', 'users:edit',
    'roles:view',
    // Staff
    'staff:view', 'staff:manage',
    // Products
    'products:view', 'products:edit', 'products:create', 'products:publish',
    // Inventory & Warehouses
    'inventory:view', 'inventory:adjust',
    'warehouses:view', 'warehouses:manage',
    'batches:view', 'batches:create', 'batches:recall',
    // Distribution
    'distribution:view', 'distribution:manage',
    'inventory-monitoring:view',
    // Orders & Sales
    'orders:view', 'orders:advance', 'orders:cancel',
    'sales:view', 'sales:manage',
    'wholesale:view', 'wholesale:approve', 'wholesale:reject',
    'quotes:view', 'quotes:respond',
    // Customers
    'customers:view', 'customers:suspend', 'customers:edit',
    // Content
    'content:view', 'content:edit', 'content:publish', 'content:approve',
    'journal:view', 'journal:edit', 'journal:publish',
    'media:view', 'media:upload',
    // Support
    'support:view', 'support:manage',
    // Reports & Analytics
    'reports:view', 'reports:export',
    'analytics:view',
    // Audit & Notifications
    'audit:view',
    'notifications:view',
    // Settings
    'settings:view', 'settings:manage',
    // Profile
    'profile:view', 'profile:edit',
  ],
  MANAGER: [
    'dashboard:view',
    // Roles & Permissions — Manager can inspect every role's assigned perms
    'roles:view',
    // Staff
    'staff:view',
    // Products
    'products:view', 'products:edit',
    // Inventory
    'inventory:view', 'inventory:adjust',
    'warehouses:view',
    'batches:view',
    // Distribution
    'distribution:view', 'distribution:manage',
    'inventory-monitoring:view',
    // Orders & Sales
    'orders:view', 'orders:advance',
    'sales:view', 'sales:manage',
    'wholesale:view', 'wholesale:approve',
    'quotes:view', 'quotes:respond',
    // Customers
    'customers:view', 'customers:edit',
    // Reports & Analytics
    'reports:view',
    'analytics:view',
    // Profile
    'profile:view', 'profile:edit',
  ],
  SALES: [
    'dashboard:view',
    // Products (view only)
    'products:view',
    // Customers
    'customers:view', 'customers:edit',
    // Orders & Sales
    'orders:view',
    // Payment status updates + refunds are Sales responsibilities
    'orders:payment-status', 'orders:refund',
    'sales:view',
    'wholesale:view',
    'quotes:view', 'quotes:respond',
    // Reports (sales only)
    'reports:view',
    'analytics:view',
    // Profile
    'profile:view', 'profile:edit',
  ],
  INVENTORY_MANAGER: [
    'dashboard:view',
    // Products (view/stock only; can add new products to inventory)
    'products:view', 'products:stock-fields', 'products:create',
    // Order status updates for products already handled by inventory ops
    'orders:view', 'orders:advance',
    // Inventory & Warehouses
    'inventory:view', 'inventory:adjust', 'inventory:create',
    'warehouses:view', 'warehouses:manage',
    'batches:view', 'batches:create',
    // Distribution
    'distribution:view', 'distribution:manage',
    'inventory-monitoring:view', 'inventory-monitoring:manage',
    // Profile
    'profile:view', 'profile:edit',
  ],
  CONTENT_MANAGER: [
    'dashboard:view',
    // Products (content only) — can add products and publish them to the storefront
    'products:view', 'products:content-fields', 'products:create', 'products:publish',
    // Content — Content Manager may fully edit all existing pages and create
    // new pages, publishing directly without waiting for approval.
    'content:view', 'content:create', 'content:edit', 'content:publish', 'content:approve',
    'journal:view', 'journal:edit', 'journal:publish',
    'media:view', 'media:upload', 'media:edit', 'media:publish', 'media:delete',
    // Reviews
    'reviews:view', 'reviews:moderate',
    // Profile
    'profile:view', 'profile:edit',
  ],
  CUSTOMER_SUPPORT: [
    'dashboard:view',
    // Customers
    'customers:view', 'customers:edit', 'customers:support-notes',
    // Orders (limited)
    'orders:view', 'orders:limited-status',
    // Support
    'support:view', 'support:manage',
    // Profile
    'profile:view', 'profile:edit',
  ],

  // ── Real backend roles (returned by the API) ────────────────────────
  // STAFF_ADMIN: can view/manage Users, Staff, Settings and Roles. Roles &
  // Permissions is accessible to Admin, Super Admin and Manager roles.
  STAFF_ADMIN: [
    'dashboard:view',
    // Users & Roles
    'users:view', 'users:create', 'users:edit', 'users:delete',
    'roles:view',
    // Staff
    'staff:view', 'staff:manage',
    // Products
    'products:view', 'products:edit', 'products:create', 'products:publish',
    // Inventory & Warehouses
    'inventory:view', 'inventory:adjust',
    'warehouses:view', 'warehouses:manage',
    'batches:view', 'batches:create', 'batches:recall',
    // Distribution
    'distribution:view', 'distribution:manage',
    'inventory-monitoring:view',
    // Orders & Sales
    'orders:view', 'orders:advance', 'orders:cancel',
    'sales:view', 'sales:manage',
    'wholesale:view', 'wholesale:approve', 'wholesale:reject',
    'quotes:view', 'quotes:respond',
    // Customers
    'customers:view', 'customers:suspend', 'customers:edit',
    // Content
    'content:view', 'content:edit', 'content:publish', 'content:approve',
    'journal:view', 'journal:edit', 'journal:publish',
    'media:view', 'media:upload',
    // Support
    'support:view', 'support:manage',
    // Reports & Analytics
    'reports:view', 'reports:export',
    'analytics:view',
    // Audit & Notifications
    'audit:view',
    'notifications:view',
    // Settings (view + manage non-role settings; role assignment is super-only)
    'settings:view', 'settings:manage',
    // Profile
    'profile:view', 'profile:edit',
  ],

  // STAFF_MANAGER: inventory/business operations. Can VIEW users below
  // manager but cannot add users or assign roles — that is admin-only.
  STAFF_MANAGER: [
    'dashboard:view',
    // Roles & Permissions — Manager can view each role's assigned permissions
    'roles:view',
    // Users (view only — no create/edit/delete, no role assignment)
    'users:view',
    // Staff (view)
    'staff:view',
    // Settings (view)
    'settings:view',
    // Products
    'products:view', 'products:edit',
    // Inventory
    'inventory:view', 'inventory:adjust',
    'warehouses:view',
    'batches:view',
    // Distribution
    'distribution:view', 'distribution:manage',
    'inventory-monitoring:view',
    // Orders & Sales
    'orders:view', 'orders:advance',
    'sales:view', 'sales:manage',
    'wholesale:view', 'wholesale:approve',
    'quotes:view', 'quotes:respond',
    // Customers
    'customers:view', 'customers:edit',
    // Content management — Manager reviews & approves Content Manager changes
    'content:view', 'content:edit', 'content:publish', 'content:approve',
    // Notifications (content approval requests arrive here)
    'notifications:view',
    // Reports & Analytics
    'reports:view',
    'analytics:view',
    // Profile
    'profile:view', 'profile:edit',
  ],

  // STAFF_SALES: manages users below sales (customers/content), sales &
  // wholesale, quotes, customers, products (view). No staff/settings/roles.
  // Sales also updates order PAYMENT statuses and processes refunds.
  STAFF_SALES: [
    'dashboard:view',
    // Users (manage below sales only)
    'users:view', 'users:create', 'users:edit', 'users:delete',
    // Products (view only)
    'products:view',
    // Customers
    'customers:view', 'customers:edit',
    // Orders & Sales
    'orders:view',
    'orders:payment-status', 'orders:refund',
    'sales:view',
    'wholesale:view',
    'quotes:view', 'quotes:respond',
    // Reports (sales only)
    'reports:view',
    'analytics:view',
    // Profile
    'profile:view', 'profile:edit',
  ],

  // STAFF_SUPPORT: customer support only — no administration sections.
  STAFF_SUPPORT: [
    'dashboard:view',
    // Customers
    'customers:view', 'customers:edit', 'customers:support-notes',
    // Orders (limited)
    'orders:view', 'orders:limited-status',
    // Support
    'support:view', 'support:manage',
    // Profile
    'profile:view', 'profile:edit',
  ],

  // Customers have no admin dashboard access.
  RETAIL_CUSTOMER: ['profile:view', 'profile:edit'],
  WHOLESALE_CUSTOMER: ['profile:view', 'profile:edit'],
};

/**
 * Which roles each actor may ADD (create) via the Add User / Add Staff flows.
 * Actors absent from this map cannot create users at all.
 *
 *  - Super Admin / Admin / Staff Admin: any role except Super Admin
 *  - Manager (incl. Staff Manager): Customer Support, Inventory Manager,
 *    Sales, Content Manager
 *  - Sales (incl. Staff Sales): Customer Support, Inventory Manager
 */
export const USER_CREATION_ALLOWED_TARGETS: Partial<Record<Role, Role[]>> = {
  SUPER_ADMIN: [
    'ADMIN', 'MANAGER', 'SALES', 'INVENTORY_MANAGER', 'CONTENT_MANAGER',
    'CUSTOMER_SUPPORT', 'STAFF_ADMIN', 'STAFF_MANAGER', 'STAFF_SALES',
    'STAFF_SUPPORT', 'RETAIL_CUSTOMER', 'WHOLESALE_CUSTOMER',
  ],
  ADMIN: [
    'MANAGER', 'SALES', 'INVENTORY_MANAGER', 'CONTENT_MANAGER',
    'CUSTOMER_SUPPORT', 'STAFF_MANAGER', 'STAFF_SALES', 'STAFF_SUPPORT',
  ],
  STAFF_ADMIN: [
    'MANAGER', 'SALES', 'INVENTORY_MANAGER', 'CONTENT_MANAGER',
    'CUSTOMER_SUPPORT', 'STAFF_MANAGER', 'STAFF_SALES', 'STAFF_SUPPORT',
  ],
  MANAGER: [
    'CUSTOMER_SUPPORT', 'STAFF_SUPPORT', 'INVENTORY_MANAGER',
    'SALES', 'STAFF_SALES', 'CONTENT_MANAGER',
  ],
  STAFF_MANAGER: [
    'CUSTOMER_SUPPORT', 'STAFF_SUPPORT', 'INVENTORY_MANAGER',
    'SALES', 'STAFF_SALES', 'CONTENT_MANAGER',
  ],
  SALES: ['CUSTOMER_SUPPORT', 'STAFF_SUPPORT', 'INVENTORY_MANAGER'],
  STAFF_SALES: ['CUSTOMER_SUPPORT', 'STAFF_SUPPORT', 'INVENTORY_MANAGER'],
};

/** Roles an actor may pick when adding a user/staff member. */
export function creatableRolesFor(role: Role | undefined | null): Role[] {
  if (!role) return [];
  return USER_CREATION_ALLOWED_TARGETS[role] ?? [];
}

/** Whether the actor can add users / staff members at all. */
export function canCreateUsers(role: Role | undefined | null): boolean {
  return creatableRolesFor(role).length > 0;
}

/**
 * Who may use the "Add Staff" action on the Staff screen. Same actors that
 * can create users, EXCEPT inventory managers — they never get Add Staff.
 */
const ADD_STAFF_ROLES: Role[] = [
  'SUPER_ADMIN', 'ADMIN', 'STAFF_ADMIN',
  'MANAGER', 'STAFF_MANAGER',
  'SALES', 'STAFF_SALES',
];

export function canAddStaff(role: Role | undefined | null): boolean {
  return !!role && ADD_STAFF_ROLES.includes(role);
}
