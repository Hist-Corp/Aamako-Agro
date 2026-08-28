import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { OrderStatus, Role } from '@prisma/client';
import { IsEnum } from 'class-validator';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CartService } from '../cart/cart.service';
import { CheckoutDto } from '../cart/dto/cart.dto';
import { LiveEventsService } from '../common/live-events.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrdersService } from './orders.service';

export class TransitionDto {
  @ApiPropertyOptional({ enum: OrderStatus })
  @IsEnum(OrderStatus)
  status!: OrderStatus;
}

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(
    private orders: OrdersService,
    private cart: CartService,
    private live: LiveEventsService,
  ) {}

  /** Checkout â€” requires Idempotency-Key header. Prices always recomputed server-side. */
  @Roles(
    Role.RETAIL_CUSTOMER,
    Role.WHOLESALE_CUSTOMER,
    Role.STAFF_SUPPORT,
    Role.STAFF_MANAGER,
    Role.STAFF_ADMIN,
  )
  @Post()
  async checkout(
    @Req() req: Request,
    @Body() dto: CheckoutDto,
    @Headers('idempotency-key') idempotencyKey?: string,
    @CurrentUser() user?: { id: string },
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }
    const anonSession = req.headers['x-cart-session'] as string | undefined;
    const view = await this.cart.view(user?.id, anonSession);
    const order = await this.orders.place(
      view.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
      { ...dto, userId: user?.id, idempotencyKey },
    );
    this.live.emit('order:new', { orderNumber: order.orderNumber, totalCents: order.totalCents });
    return order;
  }

  @ApiBearerAuth()
  @Roles(
    Role.RETAIL_CUSTOMER,
    Role.WHOLESALE_CUSTOMER,
    Role.STAFF_SUPPORT,
    Role.STAFF_MANAGER,
    Role.STAFF_ADMIN,
  )
  @Get('mine')
  mine(@CurrentUser() user?: { id: string }) {
    return this.orders.listForUser(user!.id);
  }
}

@ApiBearerAuth()
@ApiTags('admin/orders')
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(
    private orders: OrdersService,
    private live: LiveEventsService,
    private notifications: NotificationsService,
  ) {}

  /** Notify Sales of payment / refund / cancellation events on an order. */
  private notifySales(title: string, message: string) {
    void this.notifications
      .notifyRole(Role.STAFF_SALES, {
        type: 'ORDER',
        title,
        message,
        actionUrl: '/orders',
      })
      .catch(() => undefined);
  }

  /** Sales needs the full order list to manage payments & refunds. */
  @Roles(Role.STAFF_SALES, Role.STAFF_SUPPORT, Role.STAFF_MANAGER, Role.STAFF_ADMIN)
  @Get()
  list() {
    return this.orders.listAll();
  }

  @Roles(Role.STAFF_SALES, Role.STAFF_SUPPORT, Role.STAFF_MANAGER, Role.STAFF_ADMIN)
  @Get(':id')
  detail(@Param('id') id: string) {
    return this.orders.detail(id);
  }

  /**
   * Fulfilment transitions (confirm â†’ fulfil â†’ deliver). The Inventory
   * Manager-side fulfilment updates live here; payment workflows use the
   * dedicated /payment-status endpoint below. Cancelling notifies Sales.
   */
  @Roles(Role.STAFF_MANAGER, Role.STAFF_ADMIN)
  @Patch(':id/status')
  async transition(
    @Param('id') id: string,
    @Body() dto: TransitionDto,
    @CurrentUser() actor?: { id: string; email: string },
  ) {
    const order = await this.orders.transition(id, dto.status);
    this.live.emit('order:updated', { orderNumber: order.orderNumber, status: order.status });
    if (dto.status === OrderStatus.CANCELLED) {
      this.notifySales(
        'Order cancelled',
        `${actor!.email ?? 'A manager'} cancelled order ${order.orderNumber} (${order.currency} ${(order.totalCents / 100).toLocaleString()}).`,
      );
    }
    return order;
  }

  /** Sales: update the payment status of an order. */
  @Roles(Role.STAFF_SALES, Role.STAFF_MANAGER, Role.STAFF_ADMIN)
  @Patch(':id/payment-status')
  async paymentStatus(
    @Param('id') id: string,
    @Body() dto: TransitionDto,
    @CurrentUser() actor?: { id: string; email: string; role: Role },
  ) {
    const order = await this.orders.updatePaymentStatus(id, dto.status);
    this.live.emit('order:updated', { orderNumber: order.orderNumber, status: order.status });
    // Sales owns payment workflow â€” notify the whole Sales team (skip when a
    // sales user records it themselves? No: the team should stay in sync).
    this.notifySales(
      `Order payment status: ${dto.status}`,
      `Order ${order.orderNumber} was set to ${dto.status} by ${actor!.email ?? 'staff'} (${actor!.role}).`,
    );
    return order;
  }

  /** Sales: process a full refund for a paid/fulfilled/delivered order. */
  @Roles(Role.STAFF_SALES, Role.STAFF_MANAGER, Role.STAFF_ADMIN)
  @Post(':id/refund')
  async refund(
    @Param('id') id: string,
    @CurrentUser() actor?: { id: string; email: string; role: Role },
  ) {
    const order = await this.orders.refund(id);
    this.live.emit('order:updated', { orderNumber: order.orderNumber, status: order.status });
    this.notifySales(
      'Order refunded',
      `Order ${order.orderNumber} was refunded (${order.currency} ${(order.totalCents / 100).toLocaleString()}) by ${actor!.email ?? 'staff'} (${actor!.role}).`,
    );
    return order;
  }
}

