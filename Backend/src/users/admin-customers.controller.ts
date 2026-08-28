import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Prisma, Role } from '@prisma/client';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { outranks } from '../common/rbac';

export class UpdateCustomerStatusDto {
  @ApiProperty({ enum: ['ACTIVE', 'SUSPENDED'] })
  @IsEnum(['ACTIVE', 'SUSPENDED'])
  status!: 'ACTIVE' | 'SUSPENDED';

  @ApiPropertyOptional({ enum: ['PERSONAL', 'WHOLESALE'] })
  @IsOptional()
  @IsEnum(['PERSONAL', 'WHOLESALE'])
  type?: 'PERSONAL' | 'WHOLESALE';
}

const CUSTOMER_ROLES: Role[] = [Role.RETAIL_CUSTOMER, Role.WHOLESALE_CUSTOMER];

/** Actors that may browse the customer base. */
const CUSTOMER_VIEW_ROLES = [
  Role.STAFF_SALES,
  Role.STAFF_MANAGER,
  Role.STAFF_ADMIN,
  Role.SUPER_ADMIN,
  Role.STAFF_SUPPORT,
];

/** Actors that may suspend/reinstate customers. */
const CUSTOMER_MANAGE_ROLES = [
  Role.STAFF_MANAGER,
  Role.STAFF_ADMIN,
  Role.SUPER_ADMIN,
];

@ApiBearerAuth()
@ApiTags('admin/customers')
@Controller('admin/customers')
export class AdminCustomersController {
  constructor(private prisma: PrismaService) {}

  /**
   * All customer accounts (personal/individual + wholesale) with order
   * aggregates. status: ACTIVE/SUSPENDED mirrors isActive; customerType
   * separates individual shoppers from wholesale (B2B) accounts.
   */
  @Roles(...CUSTOMER_VIEW_ROLES)
  @Get()
  async list() {
    const [users, orderStats] = await Promise.all([
      this.prisma.user.findMany({
        where: { role: { in: CUSTOMER_ROLES } },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.groupBy({
        by: ['userId'],
        where: { userId: { not: null } },
        _count: { id: true },
        _sum: { totalCents: true },
        _max: { createdAt: true },
      }),
    ]);

    const statsByUser = new Map(orderStats.map((s) => [s.userId, s]));

    return users.map((u) => {
      const stats = statsByUser.get(u.id);
      return {
        id: u.id,
        name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
        email: u.email,
        phone: u.phone ?? undefined,
        status: u.isActive ? 'ACTIVE' : 'SUSPENDED',
        customerType: u.role === Role.WHOLESALE_CUSTOMER ? 'WHOLESALE' : 'PERSONAL',
        orderCount: stats?._count.id ?? 0,
        totalSpent: (stats?._sum.totalCents ?? 0) / 100,
        lastOrderDate: stats?._max.createdAt?.toISOString(),
        addresses: [],
        createdAt: u.createdAt.toISOString(),
        updatedAt: u.createdAt.toISOString(),
      };
    });
  }

  /** Suspend / reinstate a customer account. */
  @Roles(...CUSTOMER_MANAGE_ROLES)
  @Patch(':id')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerStatusDto,
    @CurrentUser() actor?: { id: string; role: Role },
  ) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target || !CUSTOMER_ROLES.includes(target.role)) {
      throw new NotFoundException('Customer not found');
    }
    if (!outranks(actor!.role, target.role)) {
      throw new ForbiddenException(
        `A ${actor!.role} cannot manage a customer account`,
      );
    }
    if (dto.status !== 'ACTIVE' && dto.status !== 'SUSPENDED') {
      throw new BadRequestException('status must be ACTIVE or SUSPENDED');
    }

    await this.prisma.user.update({
      where: { id },
      data: { isActive: dto.status === 'ACTIVE' },
    });
    return { success: true, status: dto.status };
  }
}