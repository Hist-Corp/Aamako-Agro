import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePricingRuleDto,
  UpdateInventoryDto,
  UpdatePricingRuleDto,
} from './dto/admin.dto';

@ApiBearerAuth()
@ApiTags('admin/pricing')
@Controller('admin/pricing-rules')
export class AdminPricingController {
  constructor(private prisma: PrismaService) {}

  @Roles(Role.STAFF_MANAGER, Role.STAFF_ADMIN)
  @Get()
  list() {
    return this.prisma.pricingRule.findMany({
      orderBy: [{ ruleType: 'asc' }, { priority: 'desc' }],
    });
  }

  /**
   * Every write to pricing_rules appends a pricing_history entry in the SAME
   * transaction — this cannot be bypassed (service-layer wrapper).
   */
  private async withHistory<T>(
    action: string,
    beforeJson: unknown,
    afterJson: unknown,
    ruleId: string | null,
    priceListId: string | null,
    userId: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      const result = await fn();
      await tx.pricingHistory.create({
        data: {
          ruleId,
          priceListId,
          action,
          beforeJson: beforeJson as never,
          afterJson: afterJson as never,
          changedByUserId: userId,
        },
      });
      return result;
    });
  }

  @Roles(Role.STAFF_MANAGER, Role.STAFF_ADMIN)
  @Post()
  create(@Body() dto: CreatePricingRuleDto, @CurrentUser() user?: { id: string }) {
    const data = {
      ...dto,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
      endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      discountPercent: dto.discountPercent ?? undefined,
    };
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.pricingRule.create({ data });
      await tx.pricingHistory.create({
        data: {
          ruleId: created.id,
          action: 'CREATED',
          afterJson: dto as never,
          changedByUserId: user!.id,
        },
      });
      return created;
    });
  }

  @Roles(Role.STAFF_MANAGER, Role.STAFF_ADMIN)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePricingRuleDto,
    @CurrentUser() user?: { id: string },
  ) {
    const before = await this.prisma.pricingRule.findUniqueOrThrow({ where: { id } });
    const patch = { ...dto };
    if (dto.startsAt) (patch as Record<string, unknown>).startsAt = new Date(dto.startsAt);
    if (dto.endsAt) (patch as Record<string, unknown>).endsAt = new Date(dto.endsAt);
    return this.withHistory(
      'UPDATED',
      before,
      dto,
      id,
      null,
      user!.id,
      () =>
        this.prisma.pricingRule.update({
          where: { id },
          data: patch,
        }) as never,
    );
  }

  @Roles(Role.STAFF_ADMIN)
  @Delete(':id')
  async deactivate(@Param('id') id: string, @CurrentUser() user?: { id: string }) {
    const before = await this.prisma.pricingRule.findUniqueOrThrow({ where: { id } });
    await this.withHistory(
      'DEACTIVATED',
      before,
      { isActive: false },
      id,
      null,
      user!.id,
      () =>
        this.prisma.pricingRule.update({
          where: { id },
          data: { isActive: false },
        }) as never,
    );
    return { success: true };
  }
}

@ApiBearerAuth()
@ApiTags('admin/inventory')
@Controller('admin/inventory')
export class AdminInventoryController {
  constructor(private prisma: PrismaService) {}

  @Roles(Role.STAFF_SUPPORT, Role.STAFF_MANAGER, Role.STAFF_ADMIN)
  @Get()
  list() {
    return this.prisma.inventory.findMany({ include: { variant: true } });
  }

  @Roles(Role.STAFF_MANAGER, Role.STAFF_ADMIN)
  @Patch(':variantId')
  setStock(@Param('variantId') variantId: string, @Body() dto: UpdateInventoryDto) {
    return this.prisma.inventory.upsert({
      where: { variantId },
      update: { stockOnHand: dto.stockOnHand },
      create: { variantId, stockOnHand: dto.stockOnHand },
    });
  }
}

@ApiBearerAuth()
@ApiTags('admin/audit')
@Controller('admin/pricing-history')
export class PricingHistoryController {
  constructor(private prisma: PrismaService) {}

  @Roles(Role.STAFF_SUPPORT, Role.STAFF_MANAGER, Role.STAFF_ADMIN)
  @Get()
  list() {
    return this.prisma.pricingHistory.findMany({
      orderBy: { changedAt: 'desc' },
      take: 500,
    });
  }
}
