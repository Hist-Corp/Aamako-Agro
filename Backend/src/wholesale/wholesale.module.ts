import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import {
  AdminBusinessesController,
  AdminQuotesController,
  AdminWholesaleController,
  WholesaleController,
} from './wholesale.controller';
import { WholesaleService } from './wholesale.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [
    WholesaleController,
    AdminWholesaleController,
    AdminQuotesController,
    AdminBusinessesController,
  ],
  providers: [WholesaleService],
})
export class WholesaleModule {}
