import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PricingEngineService } from '../pricing/pricing-engine.service';

@Injectable()
export class CartService {
  constructor(
    private prisma: PrismaService,
    private engine: PricingEngineService,
  ) {}

  /** Get or create cart for a logged-in user, or an anonymous session id. */
  private async getOrCreateCart(userId?: string, anonSessionId?: string) {
    if (userId) {
      return this.prisma.cart.upsert({
        where: { userId },
        update: {},
        create: { userId },
        include: { items: { include: { variant: true } } },
      });
    }
    if (!anonSessionId) throw new NotFoundException('No cart session');
    return this.prisma.cart.upsert({
      where: { anonSessionId },
      update: {},
      create: { anonSessionId },
      include: { items: { include: { variant: true } } },
    });
  }

  /**
   * Anonymous cart merges into the user cart on login — never overwrites.
   */
  async mergeAnonCart(userId: string, anonSessionId: string) {
    const anon = await this.prisma.cart.findUnique({
      where: { anonSessionId },
      include: { items: true },
    });
    if (!anon || anon.items.length === 0) return;

    const userCart = await this.getOrCreateCart(userId);
    for (const item of anon.items) {
      await this.prisma.cartItem.upsert({
        where: { cartId_variantId: { cartId: userCart.id, variantId: item.variantId } },
        // Merge quantities — never overwrite
        update: { quantity: { increment: item.quantity } },
        create: { cartId: userCart.id, variantId: item.variantId, quantity: item.quantity },
      });
    }
    await this.prisma.cart.delete({ where: { id: anon.id } }).catch(() => undefined);
  }

  async view(userId?: string, anonSessionId?: string) {
    const cart = await this.getOrCreateCart(userId, anonSessionId);
    const quotes = await Promise.all(
      cart.items.map((item) =>
        this.engine.quote({
          variantId: item.variantId,
          quantity: item.quantity,
          tierId: null,
          userId,
        }),
      ),
    );
    let subtotalCents = 0;
    const lines = cart.items.map((item, i) => {
      const lineTotal = quotes[i].unitPriceCents * item.quantity;
      subtotalCents += lineTotal;
      return {
        itemId: item.id,
        variantId: item.variantId,
        sku: item.variant.sku,
        name: item.variant.name,
        quantity: item.quantity,
        unitPriceCents: quotes[i].unitPriceCents,
        appliedRule: quotes[i].appliedRule,
        lineTotalCents: lineTotal,
      };
    });
    return { cartId: cart.id, lines, subtotalCents };
  }

  async addItem(userId: string | undefined, anonSessionId: string | undefined, variantId: string, quantity: number) {
    const cart = await this.getOrCreateCart(userId, anonSessionId);
    const variant = await this.prisma.productVariant.findUnique({ where: { id: variantId } });
    if (!variant || !variant.isActive) throw new NotFoundException('Variant not found');
    await this.prisma.cartItem.upsert({
      where: { cartId_variantId: { cartId: cart.id, variantId } },
      update: { quantity: { increment: quantity } },
      create: { cartId: cart.id, variantId, quantity },
    });
    return this.view(userId, anonSessionId);
  }

  async setQuantity(userId: string | undefined, anonSessionId: string | undefined, variantId: string, quantity: number) {
    const cart = await this.getOrCreateCart(userId, anonSessionId);
    if (quantity <= 0) {
      await this.prisma.cartItem.deleteMany({
        where: { cartId: cart.id, variantId },
      });
    } else {
      await this.prisma.cartItem.updateMany({
        where: { cartId: cart.id, variantId },
        data: { quantity },
      });
    }
    return this.view(userId, anonSessionId);
  }
}
