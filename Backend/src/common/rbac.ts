import { Role } from '@prisma/client';

/**
 * Hierarchical authority ranking. An actor may manage (add / promote /
 * demote / remove) a target only when rank(actor) > rank(target).
 *
 *   SUPER_ADMIN (5)  — manages everyone
 *   STAFF_ADMIN (4)  — cannot manage Admin / Super Admin
 *   STAFF_MANAGER(3) — cannot manage Manager / Admin / Super Admin
 *   STAFF_SALES (2)  — cannot manage Sales / Manager / Admin / Super Admin
 *   CONTENT_MANAGER (1), WHOLESALE_CUSTOMER (1), RETAIL_CUSTOMER (0)
 */
export const ROLE_RANK: Record<Role, number> = {
  RETAIL_CUSTOMER: 0,
  WHOLESALE_CUSTOMER: 1,
  CONTENT_MANAGER: 1,
  STAFF_SALES: 2,
  STAFF_SUPPORT: 2,
  STAFF_MANAGER: 3,
  STAFF_ADMIN: 4,
  SUPER_ADMIN: 5,
};

export const MANAGEABLE_USER_ROLES: Role[] = [
  Role.RETAIL_CUSTOMER,
  Role.WHOLESALE_CUSTOMER,
  Role.CONTENT_MANAGER,
  Role.STAFF_SALES,
  Role.STAFF_MANAGER,
  Role.STAFF_ADMIN,
  Role.SUPER_ADMIN,
];

export function outranks(actorRole: Role, targetRole: Role): boolean {
  return ROLE_RANK[actorRole] > ROLE_RANK[targetRole];
}
