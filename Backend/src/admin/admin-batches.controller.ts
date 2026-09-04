import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OrderStatus, Prisma, QcStatus, RecallSeverity, RecallStatus, Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

const STAFF_READ: Role[] = [
  Role.STAFF_SUPPORT,
  Role.CONTENT_MANAGER,
  Role.STAFF_MANAGER,
  Role.STAFF_SALES,
  Role.STAFF_ADMIN,
  Role.SUPER_ADMIN,
];
const STAFF_WRITE: Role[] = [Role.STAFF_MANAGER, Role.STAFF_ADMIN, Role.SUPER_ADMIN];

@ApiBearerAuth()
@ApiTags('admin/batches')
@Controller('admin/batches')
export class AdminBatchesController {
  constructor(private prisma: PrismaService) {}

  /** Paginated batch list. Filters: ?productId=&qcStatus=&recallStatus=&expiringWithinDays=&page=&limit= */
  @Roles(...STAFF_READ)
  @Get()
  async list(
    @Query('productId') productId?: string,
    @Query('qcStatus') qcStatus?: string,
    @Query('recallStatus') recallStatus?: string,
    @Query('expiringWithinDays') expiringWithinDays?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    const take = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const cur = Math.max(1, parseInt(page, 10) || 1);

    const where: Prisma.BatchWhereInput = {};
    if (productId) where.productId = productId;
    if (qcStatus) where.qcStatus = qcStatus as QcStatus;
    if (recallStatus) where.recallStatus = recallStatus as RecallStatus;
    if (expiringWithinDays) {
      const days = parseInt(expiringWithinDays, 10);
      if (!Number.isNaN(days)) where.expiryDate = { lte: new Date(Date.now() + days * 86_400_000) };
    }

    const [rows, total] = await Promise.all([
      this.prisma.batch.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (cur - 1) * take,
        take,
        include: { product: { select: { name: true } } },
      }),
      this.prisma.batch.count({ where }),
    ]);

    return {
      data: rows.map((b) => ({ ...b, productName: b.product.name, product: undefined })),
      total,
      page: cur,
      limit: take,
      totalPages: Math.max(1, Math.ceil(total / take)),
    };
  }

  @Roles(...STAFF_READ)
  @Get(':id')
  async detail(@Param('id') id: string) {
    const batch = await this.prisma.batch.findUnique({ where: { id }, include: { product: { select: { name: true } } } });
    if (!batch) throw new NotFoundException('Batch not found');
    return { ...batch, productName: batch.product.name, product: undefined };
  }

  /** Customers & orders affected by a recall — matched via the batch's product on live orders. */
  @Roles(...STAFF_READ)
  @Get(':id/recall-impact')
  async recallImpact(@Param('id') id: string) {
    const batch = await this.prisma.batch.findUnique({ where: { id }, include: { product: { select: { name: true } } } });
    if (!batch) throw new NotFoundException('Batch not found');

    const orders = await this.prisma.order.findMany({
      where: {
        status: { in: [OrderStatus.PLACED, OrderStatus.CONFIRMED, OrderStatus.PAID, OrderStatus.FULFILLED] },
        items: { some: { variant: { product: { id: batch.productId } } } },
      },
      include: { items: { where: { variant: { product: { id: batch.productId } } } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const byCustomer = new Map<string, { id: string; name: string; email: string; orderCount: number; lastOrderDate: string }>();
    for (const o of orders) {
      const key = o.contactEmail || o.contactName;
      const entry = byCustomer.get(key) ?? {
        id: key,
        name: o.contactName,
        email: o.contactEmail,
        orderCount: 0,
        lastOrderDate: o.createdAt.toISOString(),
      };
      entry.orderCount += 1;
      byCustomer.set(key, entry);
    }

    const inv = await this.prisma.inventory.findMany({
      where: { variant: { product: { id: batch.productId } } },
      include: { variant: { select: { name: true } } },
    });

    return {
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      affectedInventoryCount: inv.reduce((s, i) => s + i.stockOnHand, 0),
      affectedOrderCount: orders.length,
      affectedCustomerCount: byCustomer.size,
      affectedCustomers: [...byCustomer.values()].slice(0, 20),
      affectedOrders: orders.slice(0, 20).map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.contactName,
        quantity: o.items.reduce((s, i) => s + i.quantity, 0),
        status: o.status,
        orderedAt: o.createdAt.toISOString(),
      })),
      affectedInventory: inv.map((i) => ({
        warehouseId: 'WH-DEFAULT',
        warehouseName: i.variant.name,
        quantity: i.stockOnHand,
      })),
    };
  }

  /** Initiate (or progress) a recall for a batch — records who and when. */
  @Roles(...STAFF_WRITE)
  @Post('recall')
  async initiateRecall(
    @Body() body: { batchId?: string; severity?: string; reason?: string },
    @CurrentUser() user: { id: string },
  ) {
    if (!body.batchId) throw new BadRequestException('batchId is required');
    if (!body.reason || !body.reason.trim()) throw new BadRequestException('reason is required');
    const severity = (body.severity ?? 'MEDIUM') as RecallSeverity;
    if (!['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(severity)) throw new BadRequestException('invalid severity');

    const batch = await this.prisma.batch.findUnique({ where: { id: body.batchId } });
    if (!batch) throw new NotFoundException('Batch not found');

    return this.prisma.batch.update({
      where: { id: batch.id },
      data: {
        recallStatus: 'IN_PROGRESS' as RecallStatus,
        recallSeverity: severity,
        recallReason: body.reason.trim(),
        recalledById: user?.id ?? null,
        recalledAt: new Date(),
      },
    });
  }
}