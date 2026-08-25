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

  /** Checkout — requires Idempotency-Key header. Prices always recomputed server-side. */
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
  constructor(private orders: OrdersService, private live: LiveEventsService) {}

  @Roles(Role.STAFF_SUPPORT, Role.STAFF_MANAGER, Role.STAFF_ADMIN)
  @Get()
  list() {
    return this.orders.listAll();
  }

  @Roles(Role.STAFF_SUPPORT, Role.STAFF_MANAGER, Role.STAFF_ADMIN)
  @Get(':id')
  detail(@Param('id') id: string) {
    return this.orders.detail(id);
  }

  @Roles(Role.STAFF_MANAGER, Role.STAFF_ADMIN)
  @Patch(':id/status')
  async transition(@Param('id') id: string, @Body() dto: TransitionDto) {
    const order = await this.orders.transition(id, dto.status);
    this.live.emit('order:updated', { orderNumber: order.orderNumber, status: order.status });
    return order;
  }
}
