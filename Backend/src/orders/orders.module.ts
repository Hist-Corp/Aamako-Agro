import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module';
import { PricingModule } from '../pricing/pricing.module';
import {
  AdminOrdersController,
  OrdersController,
} from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [CartModule, PricingModule],
  controllers: [OrdersController, AdminOrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
