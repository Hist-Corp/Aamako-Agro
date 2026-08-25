import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import {
  AdminWholesaleController,
  WholesaleController,
} from './wholesale.controller';
import { WholesaleService } from './wholesale.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [WholesaleController, AdminWholesaleController],
  providers: [WholesaleService],
})
export class WholesaleModule {}
