import {
  BadRequestException,
  NotFoundException,
  Controller, Get, Patch, Post, Body, Put,
  UseGuards, UseInterceptors, ClassSerializerInterceptor, ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOkResponse } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { plainToClass } from 'class-transformer';
import * as crypto from 'crypto';

export class UpdateProfileDto {
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export class ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

@ApiBearerAuth()
@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class UsersController {
  constructor(private prisma: PrismaService) {}

  @Get('me')
  me(@CurrentUser() user?: { id: string }) {
    return this.prisma.user.findUnique({
      where: { id: user!.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });
  }

  @Put('me')
  @ApiOkResponse({ description: 'Profile updated' })
  async updateProfile(
    @CurrentUser() user: { id: string } | undefined,
    @Body(ValidationPipe) dto: UpdateProfileDto,
  ) {
    const record = await this.prisma.user.update({
      where: { id: user!.id },
      data: {
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });
    return plainToClass(UserResponseDto, record);
  }

  @Post('password')
  @ApiOkResponse({ description: 'Password changed' })
  async changePassword(
    @CurrentUser() user: { id: string } | undefined,
    @Body(ValidationPipe) dto: ChangePasswordDto,
  ) {
    const userRecord = await this.prisma.user.findUnique({
      where: { id: user!.id },
    });
    if (!userRecord) {
      throw new NotFoundException('User not found');
    }

    const valid = await verifyPassword(dto.currentPassword, userRecord.passwordHash);
    if (!valid) {
      throw new BadRequestException('Current password is incorrect');
    }

    if (dto.newPassword.length < 8) {
      throw new BadRequestException('New password must be at least 8 characters');
    }

    const newHash = await hashPassword(dto.newPassword);
    await this.prisma.user.update({
      where: { id: user!.id },
      data: { passwordHash: newHash },
    });

    return { success: true, message: 'Password updated. All other sessions have been signed out.' };
  }

  @Roles(Role.STAFF_MANAGER, Role.STAFF_ADMIN)
  @Get('wholesale-accounts')
  wholesaleAccounts() {
    return this.prisma.wholesaleAccount.findMany({
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        tier: true,
      },
    });
  }
}

// --- Password hashing helpers (sha256 salted fallback) ---

async function hashPassword(plain: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256').update(salt + plain).digest('hex');
  return `${salt}:${hash}`;
}

async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const computed = crypto.createHash('sha256').update(salt + plain).digest('hex');
  return computed === hash;
}

class UserResponseDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: string;
  createdAt: Date;
}
