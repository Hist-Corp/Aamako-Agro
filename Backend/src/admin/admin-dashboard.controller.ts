import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InquiryStatus, OrderStatus, Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Read-only dashboard aggregates backed by the database. These power the
 * dashboard home page (KPIs, fulfilment pipeline, activity feed) so it shows
 * real data instead of falling back to the demo mocks in api-hooks.ts.
 *
 * Endpoints are staff-only by default and additionally guarded with @Roles
 * so only the lowest staff tier and above may read them.
 */

const REV_AFFECTING: OrderStatus[] = [
  OrderStatus.PLACED,
  OrderStatus.CONFIRMED,
  OrderStatus.PAID,
  OrderStatus.PAYMENT_PENDING,
  OrderStatus.FULFILLED,
  OrderStatus.DELIVERED,
];

const STAFF_READ = [
  Role.STAFF_SUPPORT,
  Role.CONTENT_MANAGER,
  Role.STAFF_MANAGER,
  Role.STAFF_SALES,
  Role.STAFF_ADMIN,
  Role.SUPER_ADMIN,
];

const CUSTOMER_ROLES: Role[] = [Role.RETAIL_CUSTOMER, Role.WHOLESALE_CUSTOMER];

function dayStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}
function pctChange(current: number, previous: number): number {
  if (!previous) return 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

@ApiBearerAuth()
@ApiTags('admin/dashboard')
@Controller('admin')
export class AdminDashboardController {
  constructor(private prisma: PrismaService) {}

  /** KPI cards for the dashboard home. */
  @Roles(...STAFF_READ)
  @Get('overview')
  async overview() {
    const startToday = dayStart(new Date());
    const startYesterday = addDays(startToday, -1);
    const endToday = addDays(startToday, 1);

    const [todayOrders, yesterdayOrders] = await Promise.all([
      this.prisma.order.findMany({
        where: { createdAt: { gte: startToday, lt: endToday } },
        select: { status: true, totalCents: true },
      }),
      this.prisma.order.findMany({
        where: { createdAt: { gte: startYesterday, lt: startToday } },
        select: { status: true, totalCents: true },
      }),
    ]);

    const rev = (list: { status: OrderStatus; totalCents: number }[]) =>
      list
        .filter((o) => REV_AFFECTING.includes(o.status))
        .reduce((s, o) => s + o.totalCents, 0);

    const ordersToday = todayOrders.length;
    const revenueToday = rev(todayOrders) / 100;
    const ordersTodayChange = pctChange(ordersToday, yesterdayOrders.length);
    const revenueTodayChange = pctChange(revenueToday, rev(yesterdayOrders) / 100);

    const [pendingApprovals, customers, activeProducts] = await Promise.all([
      this.prisma.wholesaleInquiry.count({ where: { status: InquiryStatus.PENDING } }),
      this.prisma.user.count({ where: { role: { in: CUSTOMER_ROLES } } }),
      this.prisma.product.count({ where: { isPublished: true } }),
    ]);

    // Low-stock alerts: stockOnHand at/below its threshold.
    const inventory = await this.prisma.inventory.findMany({
      select: { stockOnHand: true, lowStockThreshold: true },
    });
    const lowStockAlerts = inventory.filter(
      (i) => i.stockOnHand <= i.lowStockThreshold,
    ).length;

    return {
      ordersToday,
      ordersTodayChange,
      revenueToday,
      revenueTodayChange,
      pendingWholesaleApprovals: pendingApprovals,
      lowStockAlerts,
      // No quote / review modules exist yet — report a truthful zero so the
      // cards read "0" rather than fake demo values.
      openQuotes: 0,
      pendingReviews: 0,
      totalCustomers: customers,
      activeProducts,
    };
  }

  /** Order-count pipeline by fulfilment stage. */
  @Roles(...STAFF_READ)
  @Get('pipeline')
  async pipeline() {
    const startToday = dayStart(new Date());
    const endToday = addDays(startToday, 1);

    const [byStatus, deliveredToday] = await Promise.all([
      this.prisma.order.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.order.count({
        where: { status: OrderStatus.DELIVERED, updatedAt: { gte: startToday, lt: endToday } },
      }),
    ]);

    const count = (s: OrderStatus) =>
      byStatus.find((b) => b.status === s)?._count._all ?? 0;

    return {
      pending: count(OrderStatus.PLACED),
      confirmed: count(OrderStatus.CONFIRMED),
      processing:
        count(OrderStatus.PAID) + count(OrderStatus.PAYMENT_PENDING),
      readyToShip: count(OrderStatus.FULFILLED),
      shipped: 0, // no SHIPPED stage in the order lifecycle
      deliveredToday,
    };
  }

  /** Recent activity feed blended from orders / wholesale / content / pricing. */
  @Roles(...STAFF_READ)
  @Get('activity-feed')
  async activityFeed() {
    type FeedItem = {
      id: string;
      type: 'order' | 'wholesale' | 'inventory' | 'review' | 'batch';
      message: string;
      actor?: string;
      entityId?: string;
      entityType?: string;
      timestamp: string;
    };

    const [orders, inquiries, revisions, pricing] = await Promise.all([
      this.prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: { id: true, orderNumber: true, totalCents: true, contactName: true, createdAt: true },
      }),
      this.prisma.wholesaleInquiry.findMany({
        orderBy: { createdAt: 'desc' },
        take: 4,
        select: { id: true, companyName: true, status: true, createdAt: true },
      }),
      this.prisma.contentRevision.findMany({
        orderBy: { createdAt: 'desc' },
        take: 4,
        where: { status: 'PENDING' },
        select: { id: true, proposedTitle: true, createdAt: true },
      }),
      this.prisma.pricingHistory.findMany({
        orderBy: { changedAt: 'desc' },
        take: 4,
        select: { id: true, action: true, changedAt: true },
      }),
    ]);

    const feed: FeedItem[] = [];
    orders.forEach((o) =>
      feed.push({
        id: `order-${o.id}`,
        type: 'order',
        message: `New order ${o.orderNumber} from ${o.contactName || 'a customer'} — Rs ${(o.totalCents / 100).toLocaleString('en-IN')}`,
        entityId: o.id,
        entityType: 'order',
        timestamp: o.createdAt.toISOString(),
      }),
    );
    inquiries.forEach((i) =>
      feed.push({
        id: `wholesale-${i.id}`,
        type: 'wholesale',
        message: `Wholesale application from ${i.companyName} — status: ${i.status.toLowerCase()}`,
        entityId: i.id,
        entityType: 'wholesale',
        timestamp: i.createdAt.toISOString(),
      }),
    );
    revisions.forEach((r) =>
      feed.push({
        id: `content-${r.id}`,
        type: 'review',
        message: `Content revision pending approval: "${r.proposedTitle}"`,
        entityId: r.id,
        entityType: 'content',
        timestamp: r.createdAt.toISOString(),
      }),
    );
    pricing.forEach((p) =>
      feed.push({
        id: `pricing-${p.id}`,
        type: 'inventory',
        message: `Pricing ${p.action.toLowerCase()} recorded`,
        entityId: p.id,
        entityType: 'pricing',
        timestamp: p.changedAt.toISOString(),
      }),
    );

    feed.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
    return feed.slice(0, 12);
  }
}
