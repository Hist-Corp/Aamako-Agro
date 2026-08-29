import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import {
  CREATABLE_ROLES_BY_ACTOR,
  MANAGEABLE_USER_ROLES,
  ROLE_RANK,
} from '../common/rbac';

/**
 * Permissions exposed to the Admin Dashboard "Roles & Permissions" screen.
 * Mirrors @aamako/shared-types ROLE_PERMISSIONS for every REAL backend role
 * so the dashboard can render each role's assigned permissions.
 *
 * RESTRICTED: accessible by SUPER_ADMIN ("Superadmin"), STAFF_ADMIN
 * ("Admin") and STAFF_MANAGER ("Manager").
 */
export const BACKEND_ROLE_PERMISSIONS: Record<Role, string[]> = {
  [Role.SUPER_ADMIN]: ['*'],
  [Role.STAFF_ADMIN]: [
    'dashboard:view', 'roles:view', 'users:view', 'users:create', 'users:edit', 'users:delete',
    'staff:view', 'staff:manage',
    'products:view', 'products:edit', 'products:create', 'products:publish',
    'inventory:view', 'inventory:adjust', 'warehouses:view', 'warehouses:manage',
    'batches:view', 'batches:create', 'batches:recall',
    'distribution:view', 'distribution:manage', 'inventory-monitoring:view',
    'orders:view', 'orders:advance', 'orders:cancel', 'orders:payment-status', 'orders:refund',
    'sales:view', 'sales:manage',
    'wholesale:view', 'wholesale:approve', 'wholesale:reject',
    'quotes:view', 'quotes:respond',
    'customers:view', 'customers:suspend', 'customers:edit',
    'content:view', 'content:edit', 'content:publish', 'content:approve',
    'journal:view', 'journal:edit', 'journal:publish',
    'media:view', 'media:upload',
    'support:view', 'support:manage',
    'reports:view', 'reports:export', 'analytics:view',
    'audit:view', 'notifications:view',
    'settings:view', 'settings:manage',
    'profile:view', 'profile:edit',
  ],
  [Role.STAFF_MANAGER]: [
    'dashboard:view', 'roles:view', 'users:view', 'staff:view', 'settings:view',
    'products:view', 'products:edit', 'products:create',
    'inventory:view', 'inventory:adjust', 'warehouses:view', 'batches:view',
    'distribution:view', 'distribution:manage', 'inventory-monitoring:view',
    'orders:view', 'orders:advance', 'orders:payment-status', 'orders:refund',
    'sales:view', 'sales:manage',
    'wholesale:view', 'wholesale:approve',
    'quotes:view', 'quotes:respond',
    'customers:view', 'customers:edit',
    'content:view', 'content:edit', 'content:publish', 'content:approve',
    'reports:view', 'analytics:view',
    'profile:view', 'profile:edit',
  ],
  [Role.STAFF_SALES]: [
    'dashboard:view', 'users:view', 'users:create', 'users:edit', 'users:delete',
    'products:view', 'customers:view', 'customers:edit',
    'orders:view', 'orders:payment-status', 'orders:refund',
    'sales:view', 'wholesale:view', 'quotes:view', 'quotes:respond',
    'reports:view', 'analytics:view',
    'profile:view', 'profile:edit',
  ],
  [Role.CONTENT_MANAGER]: [
    'dashboard:view',
    'products:view', 'products:content-fields', 'products:create', 'products:publish',
    // Full content-management rights: edit all existing pages, create new
    // pages, publish and approve directly.
    'content:view', 'content:create', 'content:edit', 'content:publish', 'content:approve',
    'journal:view', 'journal:edit', 'journal:publish',
    'media:view', 'media:upload', 'media:edit', 'media:publish', 'media:delete',
    'reviews:view', 'reviews:moderate',
    'profile:view', 'profile:edit',
  ],
  [Role.STAFF_SUPPORT]: [
    'dashboard:view',
    'customers:view', 'customers:edit', 'customers:support-notes',
    'orders:view', 'orders:limited-status',
    'support:view', 'support:manage',
    'profile:view', 'profile:edit',
  ],
  [Role.WHOLESALE_CUSTOMER]: ['profile:view', 'profile:edit'],
  [Role.RETAIL_CUSTOMER]: ['profile:view', 'profile:edit'],
};

@ApiBearerAuth()
@ApiTags('admin/rbac')
@Controller('admin/rbac')
export class RbacPermissionsController {
  /** Role overview: permission list + rank + manageable roles. */
  @Roles(Role.SUPER_ADMIN, Role.STAFF_ADMIN, Role.STAFF_MANAGER)
  @Get('permissions')
  listPermissions() {
    return Object.values(Role).map((role) => ({
      role,
      rank: ROLE_RANK[role],
      manageableRoles:
        MANAGEABLE_USER_ROLES.filter((r) => ROLE_RANK[role] > ROLE_RANK[r]),
      creatableRoles: CREATABLE_ROLES_BY_ACTOR[role] ?? [],
      permissions: BACKEND_ROLE_PERMISSIONS[role],
    }));
  }
}
