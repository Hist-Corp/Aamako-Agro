import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { LiveEventsService } from './live-events.service';
import { HealthController } from './health.controller';

@Global()
@Module({
  imports: [JwtModule.register({})],
  controllers: [HealthController],
  providers: [LiveEventsService],
  exports: [LiveEventsService],
})
export class CommonModule {}
