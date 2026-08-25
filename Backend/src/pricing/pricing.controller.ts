import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { PricingEngineService, QuoteInput } from './pricing-engine.service';
import { QuoteCartDto } from './dto/pricing.dto';

@ApiTags('pricing')
@Controller('pricing')
export class PricingController {
  constructor(
    private engine: PricingEngineService,
    private prisma: PrismaService,
  ) {}

  /**
   * Tier is NEVER taken from the client — resolved server-side:
   * authenticated wholesale accounts get their assigned tier; everyone else
   * gets retail base price.
   */
  private async resolveTier(userId?: string): Promise<string | null> {
    if (!userId) return null;
    const acct = await this.prisma.wholesaleAccount.findFirst({
      where: { userId, isActive: true },
      select: { tierId: true },
    });
    return acct?.tierId ?? null;
  }

  @Public()
  @Get('quote')
  async quote(
    @Query('variantId') variantId: string,
    @Query('quantity') quantity: string,
    @CurrentUser() user?: { id: string },
  ) {
    const input: QuoteInput = {
      variantId,
      quantity: Math.max(1, parseInt(quantity || '1', 10) || 1),
      tierId: await this.resolveTier(user?.id),
      userId: user?.id,
    };
    const q = await this.engine.quote(input);
    return { items: [q], subtotalCents: q.unitPriceCents * input.quantity };
  }

  @Public()
  @Post('quote-cart')
  async quoteCart(@Body() dto: QuoteCartDto, @CurrentUser() user?: { id: string }) {
    const tierId = await this.resolveTier(user?.id);
    const quotes = await this.engine.quoteCart(
      dto.items.map((i) => ({
        variantId: i.variantId,
        quantity: i.quantity,
        tierId,
        userId: user?.id,
      })),
    );
    const subtotalCents = quotes.reduce(
      (sum, q, idx) => sum + q.unitPriceCents * dto.items[idx].quantity,
      0,
    );
    return { items: quotes, subtotalCents };
  }
}
