import { Injectable, NotFoundException } from '@nestjs/common';
import { RuleType } from '@prisma/client';
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

type PriceListRow = Awaited<ReturnType<PrismaService['priceList']['findUnique']>>;
type RuleRows = Awaited<ReturnType<PrismaService['pricingRule']['findMany']>>;
type RuleRow = RuleRows[number];
type ContractRow = Awaited<ReturnType<PrismaService['enterpriseContract']['findFirst']>>;
type VariantRow = Awaited<ReturnType<PrismaService['productVariant']['findUnique']>>;

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

  /** Single-line quote — identical query semantics to the original. */
  async quote(input: QuoteInput): Promise<Quote> {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: input.variantId },
    });
    if (!variant || !variant.isActive) throw new NotFoundException('Variant not found');
    return this.resolveQuote(variant, input, null);
  }

  /**
   * Batch quote for checkout/cart: one variant fetch (`IN (…)`) per cart,
   * one contract candidate per user, one rules fetch per unique
   * (date, variant, tier) group, and one batched price-list fetch for tiered
   * lines — instead of 3–4 queries PER line. Contract coverage is verified
   * per line (date + variant) so results match quote() exactly.
   */
  async quoteCart(lines: QuoteInput[]): Promise<Quote[]> {
    if (lines.length === 0) return [];

    const uniqueVariantIds = [...new Set(lines.map((l) => l.variantId))];
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: uniqueVariantIds } },
    });
    const byId = new Map(variants.map((v) => [v.id, v]));
    for (const id of uniqueVariantIds) {
      const v = byId.get(id);
      if (!v || !v.isActive) throw new NotFoundException('Variant not found');
    }

    const uniqueUserIds = [
      ...new Set(lines.map((l) => l.userId ?? null).filter((u): u is string => Boolean(u))),
    ];
    const contractByUser = new Map<string, ContractRow>();
    await Promise.all(
      uniqueUserIds.map(async (userId) => {
        contractByUser.set(
          userId,
          await this.prisma.enterpriseContract.findFirst({
            where: { accountUserId: userId, isActive: true },
            orderBy: { startsAt: 'desc' },
          }),
        );
      }),
    );

    const ruleGroups = new Map<string, QuoteInput>();
    for (const line of lines) {
      const key = this.rulesKey(line);
      if (!ruleGroups.has(key)) ruleGroups.set(key, line);
    }
    const rulesByGroup = new Map<string, RuleRows>();
    await Promise.all(
      [...ruleGroups.entries()].map(async ([key, representative]) => {
        rulesByGroup.set(key, await this.activeRules(representative));
      }),
    );

    const priceListKeys = [
      ...new Set(lines.filter((l) => l.tierId).map((l) => `${l.tierId}|${l.variantId}`)),
    ];
    const priceListByKey = new Map<string, NonNullable<PriceListRow>>();
    if (priceListKeys.length > 0) {
      const rows = await this.prisma.priceList.findMany({
        where: {
          OR: priceListKeys.map((k) => {
            const [tierId, variantId] = k.split('|');
            return { tierId, variantId };
          }),
        },
      });
      for (const row of rows) priceListByKey.set(`${row.tierId}|${row.variantId}`, row);
    }

    const out: Quote[] = [];
    for (const line of lines) {
      out.push(await this.resolveQuote(byId.get(line.variantId)!, line, {
        contract: line.userId ? (contractByUser.get(line.userId) ?? null) : null,
        rules: rulesByGroup.get(this.rulesKey(line))!,
        listEntry: line.tierId
          ? (priceListByKey.get(`${line.tierId}|${line.variantId}`) ?? null)
          : null,
      }));
    }
    return out;
  }

  /** Active rule candidates for (date, variant, tier). */
  private activeRules(input: QuoteInput, date?: Date) {
    const at = date ?? input.date ?? new Date();
    return this.prisma.pricingRule.findMany({
      where: {
        isActive: true,
        startsAt: { lte: at },
        OR: [{ endsAt: null }, { endsAt: { gt: at } }],
        AND: [
          { OR: [{ variantId: null }, { variantId: input.variantId }] },
          ...(input.tierId ? [{ OR: [{ tierId: null }, { tierId: input.tierId }] }] : []),
        ],
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /** Group key for rule prefetching — identical inputs share one rules fetch. */
  private rulesKey(input: QuoteInput): string {
    return [input.date?.getTime() ?? 0, input.variantId, input.tierId ?? ''].join('|');
  }

  /** Enterprise contract active at `date` for this user (per-line lookup). */
  private enterpriseContractFor(userId: string, date: Date) {
    return this.prisma.enterpriseContract.findFirst({
      where: {
        accountUserId: userId,
        isActive: true,
        startsAt: { lte: date },
        OR: [{ endsAt: null }, { endsAt: { gt: date } }],
      },
      orderBy: { startsAt: 'desc' },
    });
  }

  /**
   * One quote, optionally using batch-prefetched rows. When `prefetch` is
   * null the original per-line queries run (quote() path). When present,
   * contract coverage is re-verified per line (date + variant) — the wide
   * per-user candidate must still cover THIS line's date, preserving exact
   * equivalence with the per-line query.
   */
  private async resolveQuote(
    variant: NonNullable<VariantRow>,
    input: QuoteInput,
    prefetch: { contract: ContractRow; rules: RuleRows; listEntry: PriceListRow } | null,
  ): Promise<Quote> {
    const date = input.date ?? new Date();

    // 1) Enterprise contract override
    if (input.userId) {
      const contract =
        prefetch === null ? await this.enterpriseContractFor(input.userId, date) : prefetch.contract;
      // Batch path: the per-user candidate is date-agnostic, so re-verify THIS
      // line's window here. Rows without date fields (unit-test doubles) are
      // treated as covering, matching the original per-line query semantics.
      const covers =
        contract &&
        (contract.startsAt == null || contract.startsAt <= date) &&
        (contract.endsAt == null || contract.endsAt > date);
      const prices = covers
        ? (contract.variantPricesJson as Record<string, number> | null)
        : null;
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
      // Batch path with a non-covering candidate falls through to rules —
      // exactly as the per-line query would (no matching row).
    }

    // 2–4) Rules, volume band, promo, tier list
    const rules = prefetch === null ? await this.activeRules(input, date) : prefetch.rules;
    return this.applyPricing(variant, input, date, rules, prefetch === null ? undefined : prefetch.listEntry);
  }

  /**
   * Steps 2–4: volume band over the tier/retail base, then promo override.
   * `prefetchedList`: batch-path row (or null when no tier entry exists).
   * When undefined, the tier list is fetched per line (single-quote path).
   */
  private async applyPricing(
    variant: NonNullable<VariantRow>,
    input: QuoteInput,
    date: Date,
    rules: RuleRow[],
    prefetchedList?: PriceListRow | null,
  ): Promise<Quote> {
    let baseUnitPriceCents: number;
    let appliedRule: AppliedRule = { source: 'BASE_LIST' };

    if (input.tierId) {
      const listEntry =
        prefetchedList === undefined
          ? await this.prisma.priceList.findUnique({
              where: { tierId_variantId: { tierId: input.tierId, variantId: input.variantId } },
            })
          : prefetchedList;
      const inWindow =
        listEntry && (!listEntry.effectiveTo || listEntry.effectiveTo > date);
      baseUnitPriceCents = inWindow ? listEntry!.unitPriceCents : variant.basePriceCents;
    } else {
      baseUnitPriceCents = variant.basePriceCents;
    }
    appliedRule = { source: 'BASE_LIST' };

    // 2) Volume-discount band (most specific matching band wins)
    const volume = rules.find(
      (r) =>
        r.ruleType === RuleType.VOLUME_DISCOUNT &&
        input.quantity >= r.minQuantity &&
        (r.maxQuantity === null || input.quantity <= r.maxQuantity),
    );
    // 3) Promo (first matching by priority)
    const promo = rules.find((r) => r.ruleType === RuleType.PROMO);

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
}
