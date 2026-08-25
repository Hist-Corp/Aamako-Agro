import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { CREATABLE_ROLES_BY_ACTOR, MANAGEABLE_USER_ROLES, outranks } from '../common/rbac';

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

export const USER_MANAGEMENT_ROLES = [
  Role.STAFF_SALES,
  Role.STAFF_MANAGER,
  Role.STAFF_ADMIN,
  Role.SUPER_ADMIN,
];

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

  /** Promote / demote / reassign — same actor/target rules as creation. */
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
    const allowed = CREATABLE_ROLES_BY_ACTOR[actor!.role] ?? [];
    if (!allowed.includes(dto.role)) {
      throw new ForbiddenException(
        `A ${actor!.role} cannot assign the role ${dto.role}`,
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

  /** Permanently remove a user (cascades sessions, carts, wholesale accounts). */
  @Roles(...USER_MANAGEMENT_ROLES)
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

