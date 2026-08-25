import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';

export interface AuthenticatedRequest extends Request {
  user?: { id: string; email: string; role: Role };
}

/**
 * Authorization half of the global chain (JWT authentication happens first
 * via JwtAuthGuard): enforces explicit @Roles(...); unmarked routes are
 * staff-only by default (explicit, not implicit).
 */
@Injectable()
export class JwtRolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) throw new UnauthorizedException('Missing or invalid token');

    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const allowed: Role[] =
      required ??
      [
        Role.STAFF_SALES,
        Role.STAFF_SUPPORT,
        Role.CONTENT_MANAGER,
        Role.STAFF_MANAGER,
        Role.STAFF_ADMIN,
        Role.SUPER_ADMIN,
      ];

    // SUPER_ADMIN can access everything
    if (request.user.role === Role.SUPER_ADMIN) return true;

    if (!allowed.includes(request.user.role)) {
      throw new ForbiddenException(
        `Role ${request.user.role} cannot access this resource`,
      );
    }
    return true;
  }
}
