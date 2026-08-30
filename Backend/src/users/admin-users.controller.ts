import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { CREATABLE_ROLES_BY_ACTOR, MANAGEABLE_USER_ROLES, STAFF_ROLES, outranks } from '../common/rbac';

export class CreateStaffUserDto {
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty({ minLength: 8 }) @IsString() @MinLength(8) password!: string;
  @ApiProperty() @IsString() firstName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() lastName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiProperty({ enum: Role }) @IsEnum(Role) role!: Role;
}

export class UpdateRoleDto {
  @ApiProperty({ enum: Role }) @IsEnum(Role) role!: Role;
}

/** Fields an Admin / Super Admin may change on another dashboard user's
 *  credentials. All optional — only provided fields are updated. */
export class UpdateCredentialsDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() @MaxLength(60) firstName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) lastName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(24) phone?: string;
  @ApiPropertyOptional() @IsEmail() @IsOptional() email?: string;

  /** New password — stored as a bcrypt hash, so the previous password
   *  immediately stops verifying. All sessions are revoked. */
  @ApiPropertyOptional({ minLength: 8 })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password?: string;
}

export const USER_MANAGEMENT_ROLES = [
  Role.STAFF_SALES,
  Role.STAFF_MANAGER,
  Role.STAFF_ADMIN,
  Role.SUPER_ADMIN,
];

/** Actors that may REMOVE (permanently delete) dashboard users. Only admin
 *  and super admin can remove users; hierarchy (outranks) still applies so an
 *  admin cannot remove another admin / super admin. */
export const USER_REMOVAL_ROLES = [Role.SUPER_ADMIN, Role.STAFF_ADMIN];

/** Actors that may hit the create/assign endpoints at all; the exact target
 * roles each actor may use are enforced per-request via
 * CREATABLE_ROLES_BY_ACTOR. */
const USER_CREATION_ROLES = [
  Role.STAFF_ADMIN,
  Role.SUPER_ADMIN,
  Role.STAFF_MANAGER,
  Role.STAFF_SALES,
];

const SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  role: true,
  isActive: true,
  createdAt: true,
};

@ApiBearerAuth()
@ApiTags('admin/users')
@Controller('admin/users')
export class AdminUsersController {
  constructor(private prisma: PrismaService) {}

  /**
   * List users the actor is allowed to SEE (everything strictly below
   * their own rank, plus themselves).
   */
  @Roles(...USER_MANAGEMENT_ROLES)
  @Get()
  list(@CurrentUser() actor?: { id: string; role: Role }) {
    return this.prisma.user.findMany({
      where: {
        OR: [
          { id: actor!.id },
          ...MANAGEABLE_USER_ROLES.filter((r) => outranks(actor!.role, r)).map(
            (role) => ({ role }),
          ),
        ],
      },
      select: SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Add a user. Allowed actors & target roles come from
   * CREATABLE_ROLES_BY_ACTOR: Super Admin/Staff Admin can add any manageable
   * role; Manager (STAFF_MANAGER) can add support, content, sales and
   * inventory managers; Sales (STAFF_SALES) can add support and inventory
   * managers. Everyone else is forbidden.
   */
  @Roles(...USER_CREATION_ROLES)
  @Post()
  async create(
    @Body() dto: CreateStaffUserDto,
    @CurrentUser() actor?: { id: string; role: Role },
  ) {
    if (!MANAGEABLE_USER_ROLES.includes(dto.role)) {
      throw new BadRequestException(`Role ${dto.role} cannot be assigned here`);
    }
    // Super Admin can never be created via this endpoint.
    if (dto.role === Role.SUPER_ADMIN) {
      throw new ForbiddenException('Super Admin users cannot be created here');
    }
    const allowed = CREATABLE_ROLES_BY_ACTOR[actor!.role] ?? [];
    if (!allowed.includes(dto.role)) {
      throw new ForbiddenException(
        `A ${actor!.role} cannot create a user with the role ${dto.role}`,
      );
    }

    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (exists) throw new ForbiddenException('Email already registered');

    return this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash: await bcrypt.hash(dto.password, 12),
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        role: dto.role,
      },
      select: SELECT,
    });
  }

  /**
   * Admin / Super Admin credential administration for dashboard users.
   * Updates profile fields (name, email, phone) and/or sets a new password.
   *
   * Password safety guarantees:
   *  - the new password is stored ONLY as a bcrypt hash, so the previous
   *    password no longer verifies against the database (bcrypt compare of
   *    the old password fails) — login is only possible with the new one;
   *  - every active session of the target user is revoked, so their existing
   *    access/refresh tokens stop working immediately.
   */
  @Roles(Role.STAFF_ADMIN, Role.SUPER_ADMIN)
  @Patch(':id/credentials')
  async updateCredentials(
    @Param('id') id: string,
    @Body() dto: UpdateCredentialsDto,
    @CurrentUser() actor?: { id: string; role: Role },
  ) {
    if (id === actor!.id) {
      throw new BadRequestException(
        'Use your profile settings to change your own password (current password required)',
      );
    }
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('User not found');
    // Only strictly lower-ranked dashboard users may be edited.
    if (!outranks(actor!.role, target.role)) {
      throw new ForbiddenException(
        `A ${actor!.role} cannot manage the credentials of a user with the role ${target.role}`,
      );
    }
    if (target.role === Role.SUPER_ADMIN) {
      throw new ForbiddenException('Super Admin credentials cannot be changed here');
    }

    // Email uniqueness (case-insensitive, excluding the target user).
    let email: string | undefined;
    if (dto.email !== undefined) {
      email = dto.email.toLowerCase().trim();
      const clash = await this.prisma.user.findUnique({ where: { email } });
      if (clash && clash.id !== id) {
        throw new ConflictException('Email already registered');
      }
    }

    const data: Record<string, unknown> = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName.trim();
    if (dto.lastName !== undefined) data.lastName = dto.lastName?.trim();
    if (dto.phone !== undefined) data.phone = dto.phone?.trim();
    if (email !== undefined) data.email = email;

    let passwordChanged = false;
    if (dto.password !== undefined) {
      data.passwordHash = await bcrypt.hash(dto.password, 12);
      passwordChanged = true;
    }

    const ops = [this.prisma.user.update({ where: { id }, data, select: SELECT })];
    if (passwordChanged) {
      // Kill every live session — refresh tokens become unusable at once and
      // outstanding access tokens die with their (short) 15-minute expiry.
      ops.unshift(
        this.prisma.session.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        }) as any,
      );
    }
    const [_, updated] = await this.prisma.$transaction(ops as any);
    return {
      success: true,
      user: updated,
      passwordChanged,
      message: passwordChanged
        ? 'Credentials updated. The old password no longer works and all sessions were signed out.'
        : 'Credentials updated.',
    };
  }

  /** Load target and enforce rank > target for every mutation. */
  private async assertCanManage(id: string, actor: { id: string; role: Role }) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('User not found');
    if (!outranks(actor.role, target.role)) {
      throw new ForbiddenException(
        `A ${actor.role} cannot manage a user with the role ${target.role}`,
      );
    }
    return target;
  }

  /** Promote / demote / reassign.
   *
   *  The target user must already be strictly below the actor's rank
   *  (assertCanManage). The NEW role must also be strictly below the actor's
   *  rank AND a dashboard/staff role (customer roles are excluded) — so Super
   *  Admin / Admin / Manager / Sales can promote or demote a lower-ranked user
   *  to any other staff role still below their own rank, but never to a
   *  retail/wholesale customer role. This also inherently blocks assigning
   *  SUPER_ADMIN (nobody outranks it) and prevents promoting someone to the
   *  actor's own (or a higher) rank.
   */
  @Roles(...USER_CREATION_ROLES)
  @Patch(':id/role')
  async updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() actor?: { id: string; role: Role },
  ) {
    await this.assertCanManage(id, actor!);
    if (!MANAGEABLE_USER_ROLES.includes(dto.role)) {
      throw new BadRequestException(`Role ${dto.role} cannot be assigned here`);
    }
    if (dto.role === Role.SUPER_ADMIN) {
      throw new ForbiddenException('Super Admin cannot be assigned here');
    }
    const validTargetRoles = STAFF_ROLES.filter((r) => outranks(actor!.role, r));
    if (!validTargetRoles.includes(dto.role)) {
      throw new ForbiddenException(
        `A ${actor!.role} cannot assign the role ${dto.role} — it is not a lower-rank staff role`,
      );
    }
    return this.prisma.user.update({
      where: { id },
      data: { role: dto.role },
      select: SELECT,
    });
  }

  /** Deactivate (soft "remove") a user. */
  @Roles(...USER_MANAGEMENT_ROLES)
  @Patch(':id/deactivate')
  async deactivate(
    @Param('id') id: string,
    @CurrentUser() actor?: { id: string; role: Role },
  ) {
    await this.assertCanManage(id, actor!);
    if (id === actor!.id) throw new BadRequestException('You cannot deactivate yourself');
    await this.prisma.user.update({ where: { id }, data: { isActive: false } });
    return { success: true };
  }

  /** Permanently remove a user (cascades sessions, carts, wholesale accounts).
   *  Admin and Super Admin only (see USER_REMOVAL_ROLES); target must be
   *  strictly below the actor's rank. */
  @Roles(...USER_REMOVAL_ROLES)
  @Delete(':id')
  @HttpCode(200)
  async remove(
    @Param('id') id: string,
    @CurrentUser() actor?: { id: string; role: Role },
  ) {
    await this.assertCanManage(id, actor!);
    if (id === actor!.id) throw new BadRequestException('You cannot remove yourself');
    await this.prisma.user.delete({ where: { id } });
    return { success: true };
  }
}

