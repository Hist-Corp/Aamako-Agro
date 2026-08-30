import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthenticatedRequest } from '../common/guards/roles.guard';
import type { AuthPayload } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    const secret = process.env.JWT_ACCESS_SECRET;
    // Fail fast if the signing secret is missing instead of silently falling
    // back to a well-known value that would let anyone forge valid tokens.
    if (!secret) {
      throw new Error('JWT_ACCESS_SECRET is not set. Configure it before starting the API.');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: AuthPayload): AuthenticatedRequest['user'] {
    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
