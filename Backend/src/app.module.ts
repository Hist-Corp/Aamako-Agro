import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common/common.module';
import { CacheModule } from './common/cache.module';
import { CacheControlInterceptor } from './common/cache-control.interceptor';
import { JwtRolesGuard } from './common/guards/roles.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { CatalogModule } from './catalog/catalog.module';
import { CartModule } from './cart/cart.module';
import { OrdersController, AdminOrdersController } from './orders/orders.controller';
import { OrdersModule } from './orders/orders.module';
import { PrismaModule } from './prisma/prisma.service';
import { PricingModule } from './pricing/pricing.module';
import { UsersModule } from './users/users.module';
import { WholesaleModule } from './wholesale/wholesale.module';
import { ContentModule } from './content/content.module';
import { SupportModule } from './support/support.module';
import { AdminModule } from './admin/admin.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MediaModule } from './media/media.module';
import { TasksModule } from './tasks/tasks.module';
import { NewsletterModule } from './newsletter/newsletter.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 120 },
    ]),
    PrismaModule,
    CommonModule,
    CacheModule,
    AuthModule,
    UsersModule,
    CatalogModule,
    PricingModule,
    CartModule,
    OrdersModule,
    WholesaleModule,
    ContentModule,
    SupportModule,
    AdminModule,
    NotificationsModule,
    MediaModule,
    TasksModule,
    NewsletterModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: JwtRolesGuard },
    { provide: APP_INTERCEPTOR, useClass: CacheControlInterceptor },
  ],
})
export class AppModule {}
