import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, PaymentTerms, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PricingEngineService } from '../pricing/pricing-engine.service';

/** placed → confirmed → paid|payment_pending → fulfilled → delivered; plus cancelled/returned */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PLACED: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  CONFIRMED: [OrderStatus.PAID, OrderStatus.PAYMENT_PENDING, OrderStatus.CANCELLED],
  PAYMENT_PENDING: [OrderStatus.PAID, OrderStatus.CANCELLED],
  PAID: [OrderStatus.FULFILLED, OrderStatus.RETURNED],
  FULFILLED: [OrderStatus.DELIVERED, OrderStatus.RETURNED],
  DELIVERED: [OrderStatus.RETURNED],
  CANCELLED: [],
  RETURNED: [],
};

export interface CheckoutLine {
  variantId: string;
  quantity: number;
}

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private engine: PricingEngineService,
  ) {}

  async place(
    lines: CheckoutLine[],
    meta: {
      userId?: string;
      contactName: string;
      contactEmail: string;
      contactPhone?: string;
      shippingAddress: string;
      notes?: string;
      idempotencyKey: string;
    },
  ) {
    if (!lines.length) throw new BadRequestException('Cart is empty');

    // Idempotency: same key returns the original order untouched
    const existing = await this.prisma.order.findUnique({
      where: { idempotencyKey: meta.idempotencyKey },
      include: { items: true },
    });
    if (existing) return existing;

    // Resolve tier server-side — never trust client prices
    const account = meta.userId
      ? await this.prisma.wholesaleAccount.findFirst({
          where: { userId: meta.userId, isActive: true },
        })
      : null;

    // Re-run pricing engine server-side for every line
    const quotes = await Promise.all(
      lines.map((l) =>
        this.engine.quote({
          variantId: l.variantId,
          quantity: l.quantity,
          tierId: account?.tierId ?? null,
          userId: meta.userId,
        }),
      ),
    );

    let subtotalCents = 0;
    const itemRows = lines.map((line, i) => {
      const unit = quotes[i].unitPriceCents;
      const total = unit * line.quantity;
      subtotalCents += total;
      return {
        variantId: line.variantId,
        quantity: line.quantity,
        unitPriceCents: unit,
        appliedRuleName: quotes[i].appliedRule.ruleName ?? quotes[i].appliedRule.source,
        lineTotalCents: total,
        currency: quotes[i].currency,
      };
    });

    const paymentTerms: PaymentTerms =
      quotes[0]?.appliedRule.source === 'ENTERPRISE_CONTRACT'
        ? PaymentTerms.NET_30
        : PaymentTerms.PREPAID;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const order = await tx.order.create({
          data: {
            orderNumber: `AA-${Date.now()}-${randomUUID().slice(0, 4).toUpperCase()}`,
            userId: meta.userId,
            status: OrderStatus.PLACED,
            paymentTerms,
            currency: quotes[0]?.currency ?? 'NPR',
            subtotalCents,
            totalCents: subtotalCents,
            idempotencyKey: meta.idempotencyKey,
            contactName: meta.contactName,
            contactEmail: meta.contactEmail,
            contactPhone: meta.contactPhone,
            shippingAddress: meta.shippingAddress,
            notes: meta.notes,
            items: { create: itemRows },
          },
          include: { items: true },
        });

        // Decrement inventory
        for (const row of itemRows) {
          await tx.inventory.updateMany({
            where: { variantId: row.variantId },
            data: { stockOnHand: { decrement: row.quantity } },
          });
        }
        return order;
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        // Concurrent duplicate — treat as an idempotent replay
        return this.prisma.order.findUniqueOrThrow({
          where: { idempotencyKey: meta.idempotencyKey },
          include: { items: true },
        });
      }
      throw e;
    }
  }

  async transition(orderId: string, next: OrderStatus) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (!TRANSITIONS[order.status].includes(next)) {
      throw new BadRequestException(
        `Invalid transition ${order.status} → ${next}`,
      );
    }
    return this.prisma.order.update({
      where: { id: orderId },
      data: { status: next },
    });
  }

  listForUser(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Staff view — all orders, not just own. */
  listAll() {
    return this.prisma.order.findMany({
      include: { items: true, user: { select: { email: true, role: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async detail(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: { include: { variant: true } }, user: { select: { email: true, role: true } } },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }
}
