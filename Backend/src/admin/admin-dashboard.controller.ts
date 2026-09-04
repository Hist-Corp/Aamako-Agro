import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OrderStatus, Role } from '@prisma/client';
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

@ApiBearerAuth()
@ApiTags('admin/dashboard')
@Controller('admin')
export class AdminDashboardController {
  constructor(private prisma: PrismaService) {}

  /** KPI tiles for the dashboard home page — computed from real records. */
  @Roles(...STAFF_READ)
  @Get('overview')
  async overview() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday.getTime() - 86_400_000);

    const [ordersToday, ordersYesterday, revTodayAgg, revYestAgg, pendingWholesale, lowStock, openQuotes, pendingReviews, totalCustomers, activeProducts] =
      await Promise.all([
        this.prisma.order.count({ where: { createdAt: { gte: startOfToday } } }),
        this.prisma.order.count({ where: { createdAt: { gte: startOfYesterday, lt: startOfToday } } }),
        this.prisma.order.aggregate({
          where: { createdAt: { gte: startOfToday }, status: { notIn: [OrderStatus.CANCELLED, OrderStatus.REFUNDED] } },
          _sum: { totalCents: true },
        }),
        this.prisma.order.aggregate({
          where: { createdAt: { gte: startOfYesterday, lt: startOfToday }, status: { notIn: [OrderStatus.CANCELLED, OrderStatus.REFUNDED] } },
          _sum: { totalCents: true },
        }),
        this.prisma.wholesaleInquiry.count({ where: { status: 'PENDING' } }),
        this.prisma.inventory.count({ where: { stockOnHand: { lte: this.prisma.inventory.fields.lowStockThreshold } } }),
        this.prisma.privateLabelLead.count({ where: { status: 'PENDING' } }),
        this.prisma.review.count({ where: { status: 'PENDING' } }),
        this.prisma.user.count({ where: { role: { in: [Role.RETAIL_CUSTOMER, Role.WHOLESALE_CUSTOMER] } } }),
        this.prisma.product.count({ where: { isPublished: true } }),
      ]);

    const pct = (cur: number, prev: number) => (prev === 0 ? (cur > 0 ? 100 : 0) : Math.round(((cur - prev) / prev) * 100));
    const revToday = (revTodayAgg._sum.totalCents ?? 0) / 100;
    const revYest = (revYestAgg._sum.totalCents ?? 0) / 100;

    return {
      ordersToday,
      ordersTodayChange: pct(ordersToday, ordersYesterday),
      revenueToday: revToday,
      revenueTodayChange: pct(revToday, revYest),
      pendingWholesaleApprovals: pendingWholesale,
      lowStockAlerts: lowStock,
      openQuotes,
      pendingReviews,
      totalCustomers,
      activeProducts,
    };
  }

  /** Fulfilment pipeline counts by order status. */
  @Roles(...STAFF_READ)
  @Get('pipeline')
  async pipeline() {
    const dayAgo = new Date(Date.now() - 86_400_000);
    const [placed, confirmed, paid, fulfilled, deliveredToday] = await Promise.all([
      this.prisma.order.count({ where: { status: OrderStatus.PLACED } }),
      this.prisma.order.count({ where: { status: OrderStatus.CONFIRMED } }),
      this.prisma.order.count({ where: { status: OrderStatus.PAID } }),
      this.prisma.order.count({ where: { status: OrderStatus.FULFILLED } }),
      this.prisma.order.count({ where: { status: OrderStatus.DELIVERED, updatedAt: { gte: dayAgo } } }),
    ]);

    return {
      pending: placed,
      confirmed: confirmed + paid,
      processing: paid,
      readyToShip: fulfilled,
      shipped: fulfilled,
      deliveredToday,
    };
  }

  /** Recent activity blended from real writes across modules. */
  @Roles(...STAFF_READ)
  @Get('activity-feed')
  async activityFeed() {
    const [orders, wholesale, reviews, batches, pricing] = await Promise.all([
      this.prisma.order.findMany({ take: 6, orderBy: { createdAt: 'desc' }, select: { id: true, orderNumber: true, contactName: true, totalCents: true, createdAt: true } }),
      this.prisma.wholesaleInquiry.findMany({ take: 4, orderBy: { createdAt: 'desc' }, select: { id: true, companyName: true, contactName: true, createdAt: true } }),
      this.prisma.review.findMany({ take: 4, orderBy: { createdAt: 'desc' }, select: { id: true, customerName: true, product: { select: { name: true } }, createdAt: true } }),
      this.prisma.batch.findMany({ take: 3, orderBy: { createdAt: 'desc' }, select: { id: true, batchNumber: true, product: { select: { name: true } }, createdAt: true } }),
      this.prisma.pricingHistory.findMany({ take: 3, orderBy: { changedAt: 'desc' }, select: { id: true, action: true, changedAt: true } }),
    ]);

    type Item = { id: string; type: string; message: string; actor?: string; entityId?: string; entityType?: string; timestamp: string };
    const items: Item[] = [
      ...orders.map((o) => ({ id: `ord-${o.id}`, type: 'order', message: `Order #${o.orderNumber} placed by ${o.contactName} — Rs. ${(o.totalCents / 100).toLocaleString()}`, actor: o.contactName, entityId: o.id, entityType: 'ORDER', timestamp: o.createdAt.toISOString() })),
      ...wholesale.map((w) => ({ id: `ws-${w.id}`, type: 'wholesale', message: `Wholesale inquiry from ${w.companyName} (${w.contactName})`, actor: w.contactName, entityId: w.id, entityType: 'BUSINESS', timestamp: w.createdAt.toISOString() })),
      ...reviews.map((r) => ({ id: `rev-${r.id}`, type: 'review', message: `${r.customerName} reviewed ${r.product.name}`, actor: r.customerName, entityId: r.id, entityType: 'REVIEW', timestamp: r.createdAt.toISOString() })),
      ...batches.map((b) => ({ id: `bat-${b.id}`, type: 'batch', message: `Batch ${b.batchNumber} recorded for ${b.product.name}`, entityId: b.id, entityType: 'BATCH', timestamp: b.createdAt.toISOString() })),
      ...pricing.map((ph) => ({ id: `pr-${ph.id}`, type: 'inventory', message: `Pricing rule ${ph.action.toLowerCase()}`, entityId: ph.id, entityType: 'INVENTORY', timestamp: ph.changedAt.toISOString() })),
    ];

    items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return items.slice(0, 12);
  }
}