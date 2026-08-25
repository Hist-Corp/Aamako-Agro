import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { JwtModule } from '@nestjs/jwt';
import {
  AdminInventoryController,
  AdminPricingController,
  PricingHistoryController,
} from './admin.controller';
import { LiveGateway } from './live.gateway';

@Module({
  imports: [UsersModule, JwtModule.register({})],
  controllers: [
    AdminPricingController,
    AdminInventoryController,
    PricingHistoryController,
  ],
  providers: [LiveGateway],
})
export class AdminModule {}
