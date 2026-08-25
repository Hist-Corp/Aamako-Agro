import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RuleType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface QuoteInput {
  variantId: string;
  quantity: number;
  /** Resolved server-side: null => retail base price; otherwise tier id */
  tierId?: string | null;
  /** Authenticated user id for enterprise-contract lookup (resolved server-side) */
  userId?: string | null;
  date?: Date;
}

export interface AppliedRule {
  source: 'ENTERPRISE_CONTRACT' | 'VOLUME_DISCOUNT' | 'PROMO' | 'BASE_LIST';
  ruleId?: string;
  ruleName?: string;
}

export interface Quote {
  variantId: string;
  unitPriceCents: number;
  currency: string;
  appliedRule: AppliedRule;
}

/**
 * Pure pricing engine — no HTTP concerns. Priority order:
 *   1. Enterprise contract override
 *   2. Volume-discount band
 *   3. Active promo
 *   4. Base list price (tier price list, else retail base price)
 */
@Injectable()
export class PricingEngineService {
  constructor(private prisma: PrismaService) {}

  async quote(input: QuoteInput): Promise<Quote> {
    const date = input.date ?? new Date();

    const variant = await this.prisma.productVariant.findUnique({
      where: { id: input.variantId },
    });
    if (!variant || !variant.isActive) throw new NotFoundException('Variant not found');

    // 1) Enterprise contract override
    if (input.userId) {
      const contract = await this.prisma.enterpriseContract.findFirst({
        where: {
          accountUserId: input.userId,
          isActive: true,
          startsAt: { lte: date },
          OR: [{ endsAt: null }, { endsAt: { gt: date } }],
        },
        orderBy: { startsAt: 'desc' },
      });
      const prices = contract?.variantPricesJson as Record<string, number> | null;
      if (contract && prices && prices[input.variantId] != null) {
        return {
          variantId: input.variantId,
          unitPriceCents: Number(prices[input.variantId]),
          currency: variant.currency,
          appliedRule: {
            source: 'ENTERPRISE_CONTRACT',
            ruleId: contract.id,
            ruleName: contract.contractName,
          },
        };
      }
    }

    // Candidate rules active at date for this variant
    const rules = await this.prisma.pricingRule.findMany({
      where: {
        isActive: true,
        startsAt: { lte: date },
        OR: [{ endsAt: null }, { endsAt: { gt: date } }],
        AND: [
          { OR: [{ variantId: null }, { variantId: input.variantId }] },
          ...(input.tierId ? [{ OR: [{ tierId: null }, { tierId: input.tierId }] }] : []),
        ],
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    // 2) Volume-discount band (most specific matching band wins)
    const volume = rules.find(
      (r) =>
        r.ruleType === RuleType.VOLUME_DISCOUNT &&
        input.quantity >= r.minQuantity &&
        (r.maxQuantity === null || input.quantity <= r.maxQuantity),
    );
    // 3) Promo (first matching by priority)
    const promo = rules.find((r) => r.ruleType === RuleType.PROMO);

    let baseUnitPriceCents: number;
    let appliedRule: AppliedRule;

    if (input.tierId) {
      const listEntry = await this.prisma.priceList.findUnique({
        where: { tierId_variantId: { tierId: input.tierId, variantId: input.variantId } },
      });
      const inWindow =
        listEntry &&
        (!listEntry.effectiveTo || listEntry.effectiveTo > date);
      baseUnitPriceCents = inWindow
        ? listEntry!.unitPriceCents
        : variant.basePriceCents;
    } else {
      baseUnitPriceCents = variant.basePriceCents;
    }
    appliedRule = { source: 'BASE_LIST' };

    if (volume?.discountPercent != null) {
      baseUnitPriceCents = Math.round(
        baseUnitPriceCents * (1 - Number(volume.discountPercent) / 100),
      );
      appliedRule = { source: 'VOLUME_DISCOUNT', ruleId: volume.id, ruleName: volume.name };
    }

    if (promo) {
      if (promo.overrideUnitPriceCents != null) {
        baseUnitPriceCents = promo.overrideUnitPriceCents;
      } else if (promo.discountPercent != null) {
        baseUnitPriceCents = Math.round(
          baseUnitPriceCents * (1 - Number(promo.discountPercent) / 100),
        );
      }
      appliedRule = { source: 'PROMO', ruleId: promo.id, ruleName: promo.name };
    }

    return {
      variantId: input.variantId,
      unitPriceCents: baseUnitPriceCents,
      currency: variant.currency,
      appliedRule,
    };
  }

  async quoteCart(items: QuoteInput[]): Promise<Quote[]> {
    return Promise.all(items.map((i) => this.quote(i)));
  }
}
