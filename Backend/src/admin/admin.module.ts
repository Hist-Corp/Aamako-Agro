import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { JwtModule } from '@nestjs/jwt';
import {
  AdminInventoryController,
  AdminPricingController,
  PricingHistoryController,
} from './admin.controller';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminBatchesController } from './admin-batches.controller';
import { AdminReviewsController } from './admin-reviews.controller';
import { AdminWarehousesController } from './admin-warehouses.controller';
import { AdminSupportController } from './admin-support.controller';
import { LiveGateway } from './live.gateway';

@Module({
  imports: [UsersModule, JwtModule.register({})],
  controllers: [
    AdminPricingController,
    AdminInventoryController,
    PricingHistoryController,
    AdminDashboardController,
    AdminAnalyticsController,
    AdminBatchesController,
    AdminReviewsController,
    AdminWarehousesController,
    AdminSupportController,
  ],
  providers: [LiveGateway],
})
export class AdminModule {}
