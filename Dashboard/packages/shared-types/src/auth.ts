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
    // Products (view/stock only)
    'products:view', 'products:stock-fields',
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
    // Products (content only)
    'products:view', 'products:content-fields',
    // Content
    'content:view', 'content:edit',
    'journal:view', 'journal:edit', 'journal:publish',
    'media:view', 'media:upload',
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
  // STAFF_ADMIN: can view/manage Users, Staff, Settings and (view-only)
  // Roles. Per hierarchy, an admin manages everyone below admin — but can
  // never manage other admins or super admins (assignment of admin/super
  // roles stays in the backend's rank check).
  STAFF_ADMIN: [
    'dashboard:view',
    // Users & Roles (admin manages users below admin; roles view-only)
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

  // STAFF_MANAGER: manages users below manager (sales/support/content/
  // customers), can view Staff and Settings. Cannot touch Manager/Admin/
  // Super Admin roles, and has no role/permission administration.
  STAFF_MANAGER: [
    'dashboard:view',
    // Users (manage below manager only)
    'users:view', 'users:create', 'users:edit', 'users:delete',
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
    // Reports & Analytics
    'reports:view',
    'analytics:view',
    // Profile
    'profile:view', 'profile:edit',
  ],

  // STAFF_SALES: manages users below sales (customers/content), sales &
  // wholesale, quotes, customers, products (view). No staff/settings/roles.
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
