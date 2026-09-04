import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

/** Staff roles allowed to read analytics / audit reports. */
const STAFF_READ = [
  Role.STAFF_SUPPORT,
  Role.CONTENT_MANAGER,
  Role.STAFF_MANAGER,
  Role.STAFF_SALES,
  Role.STAFF_ADMIN,
  Role.SUPER_ADMIN,
];

/** Query DTO for the sales report. All keys optional because the global
 *  ValidationPipe runs forbidNonWhitelisted — every query key the dashboard
 *  sends must be declared here or the request is rejected. */
class SalesReportQueryDto {
  @IsOptional() @IsIn(['7d', '30d', '90d', '1y', 'custom']) range = '30d';
  @IsOptional() @IsString() dateFrom?: string;
  @IsOptional() @IsString() dateTo?: string;
}

/** Query DTO for audit logs (mirrors AuditLogListParams in shared-types). */
class AuditLogQueryDto {
  @IsOptional() @IsString() entityType?: string;
  @IsOptional() @IsString() action?: string;
  @IsOptional() @IsString() actorId?: string;
  @IsOptional() @IsString() entityId?: string;
  @IsOptional() @IsString() dateFrom?: string;
  @IsOptional() @IsString() dateTo?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsInt() @Min(1) page?: number;
  @IsOptional() @IsInt() @Min(1) @Max(200) limit?: number;
}

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
function isoDay(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

@ApiBearerAuth()
@ApiTags('admin/analytics')
@Controller('admin')
export class AdminAnalyticsController {
  constructor(private prisma: PrismaService) {}

  /** Daily revenue/orders aggregate over the requested range, plus totals
   *  and period-over-period change. No schema change — pure order aggregation. */
  @Roles(...STAFF_READ)
  @Get('reports/sales')
  async salesReport(@Query() q: SalesReportQueryDto) {
    const rangeDays: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };
    const end = dayStart(new Date());
    const start = (q.range === 'custom' && q.dateFrom)
      ? dayStart(new Date(q.dateFrom))
      : addDays(end, -(rangeDays[q.range] ?? 30) + 1);
    const endExcl = addDays(end, 1);
    const spanDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
    const prevStart = addDays(start, -spanDays);
    const prevEnd = dayStart(start);

    const [current, previous] = await Promise.all([
      this.prisma.order.findMany({
        where: { createdAt: { gte: start, lt: endExcl } },
        select: { createdAt: true, totalCents: true },
      }),
      this.prisma.order.findMany({
        where: { createdAt: { gte: prevStart, lt: prevEnd } },
        select: { totalCents: true },
      }),
    ]);

    const prevRevenue = previous.reduce((s, o) => s + o.totalCents, 0) / 100;

    // Bucket current orders by UTC-cast local day.
    const bucket = new Map<string, { revenue: number; orders: number }>();
    for (let i = 0; i < spanDays; i++) {
      bucket.set(isoDay(addDays(start, i)), { revenue: 0, orders: 0 });
    }
    current.forEach((o) => {
      const key = isoDay(o.createdAt);
      const b = bucket.get(key);
      if (b) { b.revenue += o.totalCents / 100; b.orders += 1; }
    });

    const dataPoints = Array.from(bucket.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([date, b]) => ({
        date,
        revenue: Math.round(b.revenue),
        orders: b.orders,
        averageOrderValue: b.orders ? Math.round(b.revenue / b.orders) : 0,
      }));

    const totalRevenue = dataPoints.reduce((s, d) => s + d.revenue, 0);
    const totalOrders = dataPoints.reduce((s, d) => s + d.orders, 0);

    return {
      dataPoints,
      totalRevenue,
      totalOrders,
      averageOrderValue: totalOrders ? Math.round(totalRevenue / totalOrders) : 0,
      revenueChange: pctChange(totalRevenue, prevRevenue),
      ordersChange: pctChange(totalOrders, previous.length),
    };
  }

  /** Audit log blended from real, tracked records: pricing history (with
   *  before/after diffs), orders, and user creation. Filterable by entity. */
  @Roles(...STAFF_READ)
  @Get('audit-logs')
  async auditLogs(@Query() q: AuditLogQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 50;

    type Log = {
      id: string; actorId: string; actorName: string; actorEmail: string;
      action: string; entityType: string; entityId: string; entityLabel: string;
      before?: unknown; after?: unknown; createdAt: string;
    };

    // Source 1: pricing history — the only model with true before/after diffs.
    const pricing = await this.prisma.pricingHistory.findMany({
      orderBy: { changedAt: 'desc' },
      take: 300,
      include: { rule: { select: { name: true } } },
    });

    const userIds = pricing.map((p) => p.changedByUserId).filter(Boolean);
    const staff = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    const userMap = new Map(staff.map((u) => [u.id, u]));

    const logs: Log[] = [];
    pricing.forEach((p) => {
      const u = userMap.get(p.changedByUserId);
      const action =
        (p.action || '').startsWith('CRE') ? 'CREATE'
        : (p.action || '').startsWith('DEL') ? 'DELETE'
        : 'UPDATE';
      logs.push({
        id: `price-${p.id}`,
        actorId: p.changedByUserId,
        actorName: u ? [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email : 'System',
        actorEmail: u?.email ?? '',
        action,
        entityType: 'INVENTORY',
        entityId: p.ruleId ?? p.priceListId ?? p.id,
        entityLabel: p.rule?.name ?? 'Pricing rule',
        before: (p.beforeJson as unknown) ?? undefined,
        after: (p.afterJson as unknown) ?? undefined,
        createdAt: p.changedAt.toISOString(),
      });
    });

    // Source 2: recent orders.
    const orders = await this.prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, orderNumber: true, contactName: true, createdAt: true, userId: true },
    });
    orders.forEach((o) =>
      logs.push({
        id: `order-${o.id}`,
        actorId: o.userId ?? '',
        actorName: o.contactName ?? 'Customer',
        actorEmail: '',
        action: 'CREATE',
        entityType: 'ORDER',
        entityId: o.id,
        entityLabel: o.orderNumber,
        createdAt: o.createdAt.toISOString(),
      }),
    );

    // Source 3: account creation.
    const createdUsers = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 60,
      select: { id: true, firstName: true, lastName: true, email: true, createdAt: true },
    });
    createdUsers.forEach((u) =>
      logs.push({
        id: `user-${u.id}`,
        actorId: u.id,
        actorName: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
        actorEmail: u.email,
        action: 'CREATE',
        entityType: 'USER',
        entityId: u.id,
        entityLabel: u.email,
        createdAt: u.createdAt.toISOString(),
      }),
    );

    // Apply filters (entity, action, free search) + sort newest first.
    let filtered = logs;
    if (q.entityType) filtered = filtered.filter((l) => l.entityType === q.entityType!.toUpperCase());
    if (q.action) filtered = filtered.filter((l) => l.action.toUpperCase() === q.action!.toUpperCase());
    if (q.search) {
      const s = q.search.toLowerCase();
      filtered = filtered.filter(
        (l) =>
          l.actorName.toLowerCase().includes(s) ||
          l.actorEmail.toLowerCase().includes(s) ||
          l.entityLabel.toLowerCase().includes(s) ||
          l.entityType.toLowerCase().includes(s),
      );
    }
    filtered.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    const total = filtered.length;
    const startIdx = (page - 1) * limit;
    return {
      data: filtered.slice(startIdx, startIdx + limit),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }
}