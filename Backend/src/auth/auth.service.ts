import {
  ConflictException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

/** Roles allowed to sign in through the customer-facing storefront. */
const STOREFRONT_ALLOWED_ROLES: Role[] = [
  Role.RETAIL_CUSTOMER,
  Role.WHOLESALE_CUSTOMER,
];

/** Google public-key endpoint (JWKS) for ID-token signature verification. */
const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);
const JWKS_TTL_MS = 60 * 60 * 1000;

let jwksCache: { keys: JwkKey[]; fetchedAt: number } | null = null;

/** A JWK entry returned by Google's certs endpoint. */
interface JwkKey {
  kid?: string;
  kty?: string;
  n?: string;
  e?: string;
}

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

export interface AuthPayload {
  sub: string;
  email: string;
  role: Role;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (exists) throw new ConflictException('Email already registered');

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash: await bcrypt.hash(dto.password, 12),
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        role: Role.RETAIL_CUSTOMER,
      },
    });
    return this.issueTokens(user.id, user.email, user.role);
  }

  async login(dto: LoginDto, userAgent?: string, ip?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user || !user.isActive) throw new UnauthorizedException('Invalid credentials');
    if (!(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Storefront restriction: accounts registered by the Admin Dashboard
    // (staff/team roles) can never sign in on the customer storefront — even
    // with valid credentials.
    if (dto.scope === 'storefront' && !STOREFRONT_ALLOWED_ROLES.includes(user.role)) {
      throw new ForbiddenException(
        'This email is registered as an Admin Dashboard (staff) account and cannot be used to sign in to the storefront. Please use the staff dashboard instead.',
      );
    }

    return this.issueTokens(user.id, user.email, user.role, userAgent, ip);
  }

  /**
   * Google Sign-In (Google Identity Services): verify the ID token handed
   * over by Google, then look up or create the matching customer account.
   * New Google sign-ups are created as RETAIL_CUSTOMER so they appear in the
   * Dashboard → People → Customers list exactly like storefront registrations.
   */
  async googleLogin(idToken: string, userAgent?: string, ip?: string) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new ServiceUnavailableException(
        'Google Sign-In is not configured. Set GOOGLE_CLIENT_ID in the backend environment to enable it.',
      );
    }

    const profile = await this.verifyGoogleIdToken(idToken, clientId);
    if (profile.emailVerified === false) {
      throw new ForbiddenException('Google email is not verified');
    }

    const email = profile.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });

    if (existing) {
      // Same storefront restriction as password login: staff accounts
      // registered by the Admin Dashboard can never sign in here.
      if (!STOREFRONT_ALLOWED_ROLES.includes(existing.role)) {
        throw new ForbiddenException(
          'This email is registered as an Admin Dashboard (staff) account and cannot be used to sign in to the storefront. Please use the staff dashboard instead.',
        );
      }
      if (!existing.isActive) throw new UnauthorizedException('Account is suspended');
      return this.issueTokens(existing.id, existing.email, existing.role, userAgent, ip);
    }

    // New Google sign-up → create a normal retail customer account so the
    // customer shows up in the admin dashboard immediately.
    const givenName =
      profile.givenName?.trim() ||
      profile.name?.trim().split(/\s+/)[0] ||
      email.split('@')[0] ||
      'Google';
    const lastName =
      profile.familyName?.trim() ||
      (profile.name && profile.name.trim().split(/\s+/).slice(1).join(' ').trim()) ||
      null;

    const created = await this.prisma.user.create({
      data: {
        email,
        // Google accounts hold no password; store an unusable random hash so
        // the row is compatible with the shared users table.
        passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12),
        firstName: givenName,
        lastName,
        phone: null,
        role: Role.RETAIL_CUSTOMER,
        isActive: true,
      },
    });

    return this.issueTokens(created.id, created.email, created.role, userAgent, ip);
  }

  /** Rotating refresh: old token is revoked (single-use), new pair issued. */
  async refresh(refreshToken: string, userAgent?: string, ip?: string) {
    const stored = await this.prisma.session.findUnique({
      where: { refreshTokenHash: sha256(refreshToken) },
      include: { user: true },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    let payload: AuthPayload;
    try {
      payload = this.jwt.verify<AuthPayload>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.session.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(
      payload.sub,
      payload.email,
      payload.role,
      userAgent,
      ip,
    );
  }

  async logout(refreshToken: string) {
    await this.prisma.session.updateMany({
      where: { refreshTokenHash: sha256(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  /** Full own-profile view for the storefront account pages. */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        phone: true,
        createdAt: true,
        isActive: true,
      },
    });
    if (!user || !user.isActive) throw new UnauthorizedException('Account not found');
    return user;
  }

  /** Self-service profile edit — whitelist-only fields. */
  async updateProfile(userId: string, dto: { firstName?: string; lastName?: string; phone?: string }) {
    const data: Record<string, string> = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName.trim();
    if (dto.lastName !== undefined) data.lastName = dto.lastName?.trim();
    if (dto.phone !== undefined) data.phone = dto.phone?.trim();
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        phone: true,
        createdAt: true,
      },
    });
    return updated;
  }

  /**
   * Change password: verify the current one, rehash, and revoke every OTHER
   * session so stolen tokens stop working. The initiating session survives
   * when its refresh token is supplied.
   */
  async changePassword(
    userId: string,
    dto: { currentPassword: string; newPassword: string; refreshToken?: string },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) throw new UnauthorizedException('Account not found');
    if (!(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Current password is incorrect' });
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
      this.prisma.session.updateMany({
        where: {
          userId,
          revokedAt: null,
          ...(dto.refreshToken ? { refreshTokenHash: { not: sha256(dto.refreshToken) } } : {}),
        },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { success: true };
  }


  /**
   * Cryptographically verify a Google ID token (JWT) using Google's public
   * keys (JWKS) and the RSA signature. Claim checks mirror the OpenID Connect
   * spec: issuer, audience (our OAuth client), expiry, and verified email.
   */
  private async verifyGoogleIdToken(
    idToken: string,
    clientId: string,
  ): Promise<{
    email: string;
    emailVerified: boolean;
    givenName?: string;
    familyName?: string;
    name?: string;
  }> {
    const parts = idToken.split('.');
    if (parts.length !== 3) throw new UnauthorizedException('Invalid Google token');

    const header = this.decodeJwtPart<{ alg?: string; kid?: string }>(parts[0]);
    const payload = this.decodeJwtPart<{
      iss?: string;
      aud?: string;
      exp?: number;
      email?: string;
      email_verified?: boolean;
      given_name?: string;
      family_name?: string;
      name?: string;
    }>(parts[1]);
    const signature = Buffer.from(parts[2], 'base64url');

    if (header.alg !== 'RS256') throw new UnauthorizedException('Invalid Google token algorithm');
    if (!payload.iss || !GOOGLE_ISSUERS.has(payload.iss)) {
      throw new UnauthorizedException('Invalid Google token issuer');
    }
    if (payload.aud !== clientId) throw new UnauthorizedException('Google token audience mismatch');
    if (typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()) {
      throw new UnauthorizedException('Google token expired');
    }
    if (!payload.email) throw new UnauthorizedException('Google account has no email');

    const keys = await this.fetchGoogleJwks();
    const key = keys.find((k) => k.kid === header.kid);
    if (!key || !key.n || !key.e) throw new UnauthorizedException('Google signing key not found');

    const publicKey = crypto.createPublicKey({
      key: { kty: key.kty ?? 'RSA', n: key.n, e: key.e } as crypto.JsonWebKey,
      format: 'jwk',
    });

    const data = Buffer.from(`${parts[0]}.${parts[1]}`, 'utf8');
    if (!crypto.verify('sha256', data, publicKey, signature)) {
      throw new UnauthorizedException('Google token signature invalid');
    }

    return {
      email: payload.email,
      emailVerified: payload.email_verified === true,
      givenName: payload.given_name,
      familyName: payload.family_name,
      name: payload.name,
    };
  }

  private decodeJwtPart<T>(part: string): T {
    try {
      return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as T;
    } catch {
      throw new UnauthorizedException('Invalid Google token');
    }
  }

  /** Google's public keys, cached for one hour (kid-keyed, low churn). */
  private async fetchGoogleJwks(): Promise<JwkKey[]> {
    if (jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS) {
      return jwksCache.keys;
    }
    const res = await fetch(GOOGLE_JWKS_URL, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new UnauthorizedException('Unable to verify Google token');
    const body = (await res.json()) as { keys?: JwkKey[] };
    jwksCache = { keys: body.keys ?? [], fetchedAt: Date.now() };
    return jwksCache.keys;
  }

  private async issueTokens(
    userId: string,
    email: string,
    role: Role,
    userAgent?: string,
    ip?: string,
  ) {
    const access = await this.jwt.signAsync(
      { sub: userId, email, role },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '15m' },
    );

    const days = Number(process.env.JWT_REFRESH_EXPIRES_DAYS ?? 30);
    const expiresAt = new Date(Date.now() + days * 24 * 3600 * 1000);
    const refresh = await this.jwt.signAsync(
      { sub: userId, email, role },
      { secret: process.env.JWT_REFRESH_SECRET, expiresIn: `${days}d` },
    );

    await this.prisma.session.create({
      data: {
        userId,
        refreshTokenHash: sha256(refresh),
        userAgent,
        ip,
        expiresAt,
      },
    });

    return {
      accessToken: access,
      refreshToken: refresh,
      user: { id: userId, email, role },
    };
  }
}
