import { Controller, Get, Query } from '@nestjs/common';
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

const RANGE_DAYS: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };

@ApiBearerAuth()
@ApiTags('admin/analytics')
@Controller('admin')
export class AdminAnalyticsController {
  constructor(private prisma: PrismaService) {}

  /**
   * Sales report aggregated from real orders. Supports ?range=7d|30d|90d|1y|custom
   * (custom uses ?dateFrom=&dateTo=). Returns daily data points + totals and
   * period-over-period change vs the preceding window.
   */
  @Roles(...STAFF_READ)
  @Get('reports/sales')
  async salesReport(
    @Query('range') range: string = '30d',
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const end = dateTo ? new Date(dateTo) : new Date();
    end.setHours(23, 59, 59, 999);

    let days = RANGE_DAYS[range];
    if (!days) {
      if (range === 'custom' && dateFrom) {
        const from = new Date(dateFrom);
        days = Math.max(1, Math.ceil((end.getTime() - from.getTime()) / 86_400_000));
      } else {
        days = 30;
      }
    }
    const start = new Date(end.getTime() - days * 86_400_000);
    const prevStart = new Date(start.getTime() - days * 86_400_000);

    const notCancelled = { notIn: [OrderStatus.CANCELLED, OrderStatus.REFUNDED] };
    const [cur, prev] = await Promise.all([
      this.prisma.order.findMany({
        where: { createdAt: { gte: start, lte: end }, status: notCancelled },
        select: { createdAt: true, totalCents: true },
      }),
      this.prisma.order.aggregate({
        where: { createdAt: { gte: prevStart, lt: start }, status: notCancelled },
        _sum: { totalCents: true },
        _count: true,
      }),
    ]);

    // Bucket orders into days (oldest → newest).
    const buckets = new Map<string, { revenue: number; orders: number }>();
    for (let i = 0; i < days; i++) {
      const d = new Date(start.getTime() + (i + 1) * 86_400_000);
      buckets.set(d.toISOString().slice(0, 10), { revenue: 0, orders: 0 });
    }
    for (const o of cur) {
      const key = o.createdAt.toISOString().slice(0, 10);
      const b = buckets.get(key) ?? { revenue: 0, orders: 0 };
      b.revenue += o.totalCents / 100;
      b.orders += 1;
      buckets.set(key, b);
    }
    const dataPoints = [...buckets.entries()].map(([date, b]) => ({
      date,
      revenue: b.revenue,
      orders: b.orders,
      averageOrderValue: b.orders ? Math.round(b.revenue / b.orders) : 0,
    }));

    const totalRevenue = dataPoints.reduce((s, d) => s + d.revenue, 0);
    const totalOrders = dataPoints.reduce((s, d) => s + d.orders, 0);
    const prevRevenue = (prev._sum.totalCents ?? 0) / 100;
    const prevOrders = prev._count;

    const pct = (a: number, b: number) => (b === 0 ? (a > 0 ? 100 : 0) : Math.round(((a - b) / b) * 100));

    return {
      dataPoints,
      totalRevenue,
      totalOrders,
      averageOrderValue: totalOrders ? Math.round(totalRevenue / totalOrders) : 0,
      revenueChange: pct(totalRevenue, prevRevenue),
      ordersChange: pct(totalOrders, prevOrders),
    };
  }

  /**
   * Audit trail blended from real tracked writes (pricing history, orders,
   * accounts). Supports ?entityType=&action=&search=&page=&limit=.
   */
  @Roles(...STAFF_READ)
  @Get('audit-logs')
  async auditLogs(
    @Query('entityType') entityType?: string,
    @Query('action') action?: string,
    @Query('search') search?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    const take = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (Math.max(1, parseInt(page, 10) || 1) - 1) * take;

    const [pricing, orders, users] = await Promise.all([
      this.prisma.pricingHistory.findMany({
        orderBy: { changedAt: 'desc' },
        include: { rule: { select: { name: true } } },
      }),
      this.prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        select: { id: true, orderNumber: true, contactName: true, contactEmail: true, status: true, createdAt: true },
      }),
      this.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        select: { id: true, firstName: true, lastName: true, email: true, role: true, createdAt: true },
      }),
    ]);

    type Entry = {
      id: string;
      actorId: string;
      actorName: string;
      actorEmail: string;
      action: string;
      entityType: string;
      entityId: string;
      entityLabel: string;
      before?: Record<string, unknown>;
      after?: Record<string, unknown>;
      createdAt: string;
    };

    let entries: Entry[] = [
      ...pricing.map((ph) => ({
        id: ph.id,
        actorId: ph.changedByUserId,
        actorName: 'Staff',
        actorEmail: '',
        action: ph.action,
        entityType: 'INVENTORY',
        entityId: ph.ruleId ?? ph.id,
        entityLabel: ph.rule?.name ?? 'Pricing rule',
        before: (ph.beforeJson ?? undefined) as Record<string, unknown> | undefined,
        after: (ph.afterJson ?? undefined) as Record<string, unknown> | undefined,
        createdAt: ph.changedAt.toISOString(),
      })),
      ...orders.map((o) => ({
        id: `ord-${o.id}`,
        actorId: o.id,
        actorName: o.contactName,
        actorEmail: o.contactEmail,
        action: 'CREATE',
        entityType: 'ORDER',
        entityId: o.id,
        entityLabel: `Order #${o.orderNumber} (${o.status})`,
        createdAt: o.createdAt.toISOString(),
      })),
      ...users.map((u) => ({
        id: `usr-${u.id}`,
        actorId: u.id,
        actorName: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
        actorEmail: u.email,
        action: 'CREATE',
        entityType: 'USER',
        entityId: u.id,
        entityLabel: `Account created (${u.role})`,
        createdAt: u.createdAt.toISOString(),
      })),
    ];

    if (entityType) entries = entries.filter((e) => e.entityType === entityType.toUpperCase());
    if (action) entries = entries.filter((e) => e.action === action.toUpperCase());
    if (search) {
      const q = search.toLowerCase();
      entries = entries.filter(
        (e) => e.entityLabel.toLowerCase().includes(q) || e.actorName.toLowerCase().includes(q) || e.actorEmail.toLowerCase().includes(q),
      );
    }
    entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return { data: entries.slice(skip, skip + take), total: entries.length, page: parseInt(page, 10) || 1, limit: take, totalPages: Math.ceil(entries.length / take) };
  }
}