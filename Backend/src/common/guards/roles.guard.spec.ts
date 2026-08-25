import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { JwtRolesGuard, type AuthenticatedRequest } from './roles.guard';

/**
 * Template authorization suite: proves a retail customer cannot hit
 * staff/admin routes. Reuse this pattern for every new module.
 */
describe('JwtRolesGuard (RBAC)', () => {
  const makeContext = (user?: AuthenticatedRequest['user'], required?: Role[]) => {
    const reflector = {
      getAllAndOverride: jest.fn((key: string) =>
        key === 'isPublic' ? false : required,
      ),
    };
    const http = {
      getRequest: () => ({ user }),
      getHandler: () => undefined,
      getClass: () => undefined,
    };
    return {
      guard: new JwtRolesGuard(reflector as unknown as Reflector),
      context: {
        switchToHttp: () => http,
        getHandler: http.getHandler,
        getClass: http.getClass,
      },
    };
  };

  it('rejects unauthenticated requests', async () => {
    const { guard, context } = makeContext(undefined);
    await expect(guard.canActivate(context as never)).rejects.toThrow(
      'Missing or invalid token',
    );
  });

  it('allows a retail customer on explicitly public retail routes', async () => {
    const { guard, context } = makeContext(
      { id: 'u1', email: 'a@b.c', role: Role.RETAIL_CUSTOMER },
      [Role.RETAIL_CUSTOMER, Role.WHOLESALE_CUSTOMER],
    );
    await expect(guard.canActivate(context as never)).resolves.toBe(true);
  });

  it('REJECTS a retail customer hitting /admin/* routes', async () => {
    const { guard, context } = makeContext({
      id: 'u1', email: 'a@b.c', role: Role.RETAIL_CUSTOMER,
    });
    // No explicit roles => default staff-only
    await expect(guard.canActivate(context as never)).rejects.toThrow('cannot access');
  });

  it('REJECTS a wholesale customer without the required role', async () => {
    const { guard, context } = makeContext(
      { id: 'u2', email: 'w@b.c', role: Role.WHOLESALE_CUSTOMER },
      [Role.STAFF_ADMIN],
    );
    await expect(guard.canActivate(context as never)).rejects.toThrow('cannot access');
  });

  it('allows a staff admin anywhere', async () => {
    const { guard, context } = makeContext({
      id: 'u3', email: 'admin@x.y', role: Role.STAFF_ADMIN,
    });
    await expect(guard.canActivate(context as never)).resolves.toBe(true);
  });
});
