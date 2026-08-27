import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

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
    return this.issueTokens(user.id, user.email, user.role, userAgent, ip);
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
