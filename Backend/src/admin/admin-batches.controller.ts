import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { RecallStatus, RecallSeverity, Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

const BATCH_ROLES = [Role.STAFF_MANAGER, Role.STAFF_ADMIN, Role.SUPER_ADMIN];

class BatchQueryDto {
  @IsOptional() @IsString() productId?: string;
  @IsOptional() @IsIn(['PENDING', 'PASSED', 'FAILED', 'QUARANTINED']) qcStatus?: string;
  @IsOptional() @IsIn(['NONE', 'INITIATED', 'IN_PROGRESS', 'COMPLETED']) recallStatus?: string;
  @IsOptional() @IsInt() @Min(0) expiringWithinDays?: number;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsInt() @Min(1) page?: number;
  @IsOptional() @IsInt() @Min(1) @Max(200) limit?: number;
}

class InitiateRecallDto {
  @IsString() batchId!: string;
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']) severity!: RecallSeverity;
  @IsString() reason!: string;
  @IsOptional() @IsBoolean() notifyAffectedCustomers?: boolean;
}

/** Maps a Prisma Batch row onto the dashboard Batch shape. */
function mapBatch(b: any) {
  return {
    id: b.id,
    batchNumber: b.batchNumber,
    productId: b.productId,
    productName: b.product?.name ?? 'Unknown product',
    productionDate: b.productionDate?.toISOString(),
    expiryDate: b.expiryDate?.toISOString(),
    quantity: b.quantity,
    remainingQuantity: b.remainingQuantity,
    qcStatus: b.qcStatus,
    recallStatus: b.recallStatus,
    supplier: b.supplier,
    notes: b.notes,
    createdBy: b.createdById ?? '',
    createdByName: b.createdByName ?? 'System',
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

@ApiBearerAuth()
@ApiTags('admin/batches')
@Controller('admin/batches')
export class AdminBatchesController {
  constructor(private prisma: PrismaService) {}

  @Roles(...BATCH_ROLES)
  @Get()
  async list(@Query() q: BatchQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const where: Record<string, unknown> = {};
    if (q.productId) where.productId = q.productId;
    if (q.qcStatus) where.qcStatus = q.qcStatus;
    if (q.recallStatus) where.recallStatus = q.recallStatus;
    if (q.expiringWithinDays !== undefined) {
      const cutoff = new Date(Date.now() + q.expiringWithinDays * 86400000);
      where.expiryDate = { lte: cutoff };
    }
    if (q.search) {
      where.OR = [
        { batchNumber: { contains: q.search, mode: 'insensitive' } },
        { supplier: { contains: q.search, mode: 'insensitive' } },
      ];
    }

    const [total, rows] = await Promise.all([
      this.prisma.batch.count({ where }),
      this.prisma.batch.findMany({
        where,
        include: { product: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    // Resolve creator names for the visible page.
    const creatorIds: string[] = [...new Set(rows.map((b) => b.createdById).filter((x) => !!x))] as string[];
    const names = await this.prisma.user.findMany({
      where: { id: { in: creatorIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const nameMap = new Map(names.map((u) => [u.id, [u.firstName, u.lastName].filter(Boolean).join(' ')]));

    return {
      data: rows.map((b) => ({
        ...mapBatch(b),
        createdByName: b.createdById ? (nameMap.get(b.createdById) ?? 'System') : 'System',
      })),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  @Roles(...BATCH_ROLES)
  @Get(':id')
  async get(@Param('id') id: string) {
    const b = await this.prisma.batch.findUnique({ where: { id }, include: { product: { select: { name: true } } } });
    if (!b) throw new NotFoundException('Batch not found');
    return mapBatch(b);
  }

  /** Compute the blast radius of a recall: affected inventory, orders, customers. */
  @Roles(...BATCH_ROLES)
  @Get(':id/recall-impact')
  async recallImpact(@Param('id') id: string) {
    const batch = await this.prisma.batch.findUnique({ where: { id } });
    if (!batch) throw new NotFoundException('Batch not found');

    // Affected inventory: any stock rows for this batch's product.
    const affectedInventory = await this.prisma.inventory.findMany({
      where: { variant: { productId: batch.productId } },
      include: { variant: { select: { name: true } } },
    });

    // Affected orders + customers via order items on this product's variants.
    const orderItems = await this.prisma.orderItem.findMany({
      where: { variant: { productId: batch.productId } },
      select: {
        orderId: true,
        quantity: true,
        order: { select: { orderNumber: true, contactName: true, status: true, createdAt: true, userId: true } },
      },
    });
    const orderMap = new Map<string, { id: string; orderNumber: string; customerName: string; quantity: number; status: string; orderedAt: string; userId?: string | null }>();
    orderItems.forEach((oi) => {
      const existing = orderMap.get(oi.orderId);
      if (existing) existing.quantity += oi.quantity;
      else {
        orderMap.set(oi.orderId, {
          id: oi.orderId,
          orderNumber: oi.order.orderNumber,
          customerName: oi.order.contactName,
          quantity: oi.quantity,
          status: oi.order.status,
          orderedAt: oi.order.createdAt.toISOString(),
          userId: oi.order.userId,
        });
      }
    });
    const affectedOrders = [...orderMap.values()];

    const customerMap = new Map<string, { id: string; name: string; email: string; orderCount: number; lastOrderDate: string }>();
    affectedOrders.forEach((o) => {
      const cid = o.userId ?? o.customerName;
      const existing = customerMap.get(cid);
      if (existing) {
        existing.orderCount += 1;
        if (o.orderedAt > existing.lastOrderDate) existing.lastOrderDate = o.orderedAt;
      } else {
        customerMap.set(cid, { id: cid, name: o.customerName, email: '', orderCount: 1, lastOrderDate: o.orderedAt });
      }
    });

    return {
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      affectedInventoryCount: affectedInventory.length,
      affectedOrderCount: affectedOrders.length,
      affectedCustomerCount: customerMap.size,
      affectedCustomers: [...customerMap.values()],
      affectedOrders,
      affectedInventory: affectedInventory.map((i) => ({
        warehouseId: 'MAIN',
        warehouseName: 'Main Warehouse',
        quantity: i.stockOnHand,
      })),
    };
  }

  /** Initiate a recall: mark the batch, freeze affected stock, notify customers. */
  @Roles(...BATCH_ROLES)
  @Post('recall')
  async initiateRecall(@Body() dto: InitiateRecallDto, @CurrentUser() actor?: { id: string }) {
    const batch = await this.prisma.batch.findUnique({ where: { id: dto.batchId } });
    if (!batch) throw new NotFoundException('Batch not found');

    await this.prisma.batch.update({
      where: { id: dto.batchId },
      data: {
        recallStatus: RecallStatus.IN_PROGRESS,
        recallSeverity: dto.severity,
        recallReason: dto.reason,
        recalledById: actor?.id,
        recalledAt: new Date(),
      },
    });

    // Freeze stock: set stockOnHand / reserved on this product's variants to 0.
    await this.prisma.inventory.updateMany({
      where: { variant: { productId: batch.productId } },
      data: { stockOnHand: 0, reservedQty: 0 },
    });

    // Notify affected customers when requested.
    if (dto.notifyAffectedCustomers) {
      const orderItems = await this.prisma.orderItem.findMany({
        where: { variant: { productId: batch.productId } },
        select: { order: { select: { userId: true } } },
      });
      const userIds = [...new Set(orderItems.map((o) => o.order.userId).filter(Boolean))];
      if (userIds.length) {
        await this.prisma.notification.createMany({
          data: userIds.map((uid) => ({
            userId: uid as string,
            type: 'INVENTORY',
            title: `Product recall: ${batch.batchNumber}`,
            message: `We have initiated a ${dto.severity.toLowerCase()} recall affecting a product you ordered. Please reach out to support for next steps.`,
          })),
        });
      }
    }

    return { success: true, batchId: dto.batchId, recallStatus: RecallStatus.IN_PROGRESS };
  }
}
