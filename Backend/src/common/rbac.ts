import { Role } from '@prisma/client';

/**
 * Hierarchical authority ranking. An actor may manage (add / promote /
 * demote / remove) a target only when rank(actor) > rank(target).
 *
 *   SUPER_ADMIN (5)                                   — Super Admin (highest), manages everyone
 *   STAFF_ADMIN (4)                                   — Admin Staff; cannot manage Admin / Super Admin
 *   STAFF_SALES (3)                                   — Sales Manager
 *   STAFF_MANAGER (2), CONTENT_MANAGER (2)            — Content & Inventory Manager
 *   STAFF_SUPPORT (1)                                 — Customer Support
 *   RETAIL_CUSTOMER (0), WHOLESALE_CUSTOMER (0)       — Retail / Wholesale Buyer
 */
export const ROLE_RANK: Record<Role, number> = {
  RETAIL_CUSTOMER: 0,
  WHOLESALE_CUSTOMER: 0,
  STAFF_SUPPORT: 1,
  CONTENT_MANAGER: 2,
  STAFF_MANAGER: 2,
  STAFF_SALES: 3,
  STAFF_ADMIN: 4,
  SUPER_ADMIN: 5,
};

export const MANAGEABLE_USER_ROLES: Role[] = [
  Role.RETAIL_CUSTOMER,
  Role.WHOLESALE_CUSTOMER,
  Role.CONTENT_MANAGER,
  Role.STAFF_SUPPORT,
  Role.STAFF_SALES,
  Role.STAFF_MANAGER,
  Role.STAFF_ADMIN,
  Role.SUPER_ADMIN,
];

/** Dashboard / staff roles only — excludes storefront customer roles.
 *  Used for role promotion/demotion and the Staff section so that retail and
 *  wholesale customer accounts are never treated as dashboard staff. */
export const STAFF_ROLES: Role[] = MANAGEABLE_USER_ROLES.filter(
  (r) => r !== Role.RETAIL_CUSTOMER && r !== Role.WHOLESALE_CUSTOMER,
);

/**
 * Which roles each actor may CREATE via POST /admin/users:
 *  - SUPER_ADMIN / STAFF_ADMIN: any manageable role except Super Admin
 *    (Staff Admin also cannot create other Staff Admins)
 *  - STAFF_MANAGER (Manager): Customer Support, Inventory Manager, Sales,
 *    Content Manager
 *  - STAFF_SALES (Sales): Customer Support, Inventory Manager
 * Everyone else (inventory-manager-like roles excluded from creation of
 * staff, content managers, support agents themselves) can create nobody.
 */
export const CREATABLE_ROLES_BY_ACTOR: Record<Role, Role[]> = {
  [Role.SUPER_ADMIN]: [
    Role.RETAIL_CUSTOMER,
    Role.WHOLESALE_CUSTOMER,
    Role.CONTENT_MANAGER,
    Role.STAFF_SUPPORT,
    Role.STAFF_SALES,
    Role.STAFF_MANAGER,
    Role.STAFF_ADMIN,
  ],
  [Role.STAFF_ADMIN]: [
    Role.RETAIL_CUSTOMER,
    Role.WHOLESALE_CUSTOMER,
    Role.CONTENT_MANAGER,
    Role.STAFF_SUPPORT,
    Role.STAFF_SALES,
    Role.STAFF_MANAGER,
  ],
  [Role.STAFF_MANAGER]: [
    Role.STAFF_SUPPORT,
    Role.CONTENT_MANAGER,
    Role.STAFF_SALES,
    Role.STAFF_MANAGER,
  ],
  [Role.STAFF_SALES]: [Role.STAFF_SUPPORT, Role.STAFF_MANAGER],
} as Record<Role, Role[]>;

export function outranks(actorRole: Role, targetRole: Role): boolean {
  return ROLE_RANK[actorRole] > ROLE_RANK[targetRole];
}
