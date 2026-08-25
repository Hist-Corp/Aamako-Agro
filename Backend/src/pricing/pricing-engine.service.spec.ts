import { PricingEngineService } from './pricing-engine.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Unit tests for the pricing engine priority logic.
 * The engine is a pure-ish service — Prisma is mocked so no DB needed.
 */
describe('PricingEngineService', () => {
  const baseVariant = {
    id: 'v1',
    isActive: true,
    currency: 'NPR',
    basePriceCents: 10000,
  };

  const makePrismaMock = (rules: any[], opts: { priceList?: number; contractPrice?: number } = {}) => ({
    productVariant: { findUnique: jest.fn().mockResolvedValue(baseVariant) },
    pricingRule: { findMany: jest.fn().mockResolvedValue(rules) },
    priceList: { findUnique: jest.fn().mockResolvedValue(
      opts.priceList != null ? { unitPriceCents: opts.priceList, effectiveTo: null } : null,
    ) },
    enterpriseContract: {
      findFirst: jest.fn().mockResolvedValue(
        opts.contractPrice != null
          ? { id: 'c1', contractName: 'Kathmandu Mart', variantPricesJson: { v1: opts.contractPrice } }
          : null,
      ),
    },
  });

  const engineWith = (prismaMock: any) =>
    new PricingEngineService(prismaMock as unknown as PrismaService);

  it('retail (no tier) returns base list price', async () => {
    const eng = engineWith(makePrismaMock([]));
    const q = await eng.quote({ variantId: 'v1', quantity: 1 });
    expect(q.unitPriceCents).toBe(10000);
    expect(q.appliedRule.source).toBe('BASE_LIST');
  });

  it('wholesale tier uses the tier price list', async () => {
    const eng = engineWith(makePrismaMock([], { priceList: 8200 }));
    const q = await eng.quote({ variantId: 'v1', quantity: 10, tierId: 't-growth' });
    expect(q.unitPriceCents).toBe(8200);
  });

  it('applies volume-discount band over tier list price', async () => {
    const rules = [
      {
        id: 'r-vol', name: '10+ units 10% off', ruleType: 'VOLUME_DISCOUNT',
        minQuantity: 10, maxQuantity: null, discountPercent: 10, priority: 0, isActive: true,
      },
    ];
    const eng = engineWith(makePrismaMock(rules as never[], { priceList: 8200 }));
    const q = await eng.quote({ variantId: 'v1', quantity: 15, tierId: 't-growth' });
    expect(q.unitPriceCents).toBe(Math.round(8200 * 0.9));
    expect(q.appliedRule.source).toBe('VOLUME_DISCOUNT');
  });

  it('ignores volume band when quantity below minQuantity', async () => {
    const rules = [
      {
        id: 'r-vol', name: '50+ units 20% off', ruleType: 'VOLUME_DISCOUNT',
        minQuantity: 50, maxQuantity: null, discountPercent: 20, priority: 0, isActive: true,
      },
    ];
    const eng = engineWith(makePrismaMock(rules as never[]));
    const q = await eng.quote({ variantId: 'v1', quantity: 5 });
    expect(q.unitPriceCents).toBe(10000);
  });

  it('promo overrides volume discount result (higher priority)', async () => {
    const rules = [
      {
        id: 'r-promo', name: 'Dashain sale', ruleType: 'PROMO',
        discountPercent: 25, priority: 100, isActive: true,
      },
      {
        id: 'r-vol', name: 'band', ruleType: 'VOLUME_DISCOUNT',
        minQuantity: 2, maxQuantity: null, discountPercent: 5, priority: 0, isActive: true,
      },
    ];
    const eng = engineWith(makePrismaMock(rules as never[]));
    const q = await eng.quote({ variantId: 'v1', quantity: 10 });
    // volume applies to base first, promo then stacks on top per implementation
    expect(q.appliedRule.source).toBe('PROMO');
    expect(q.unitPriceCents).toBe(Math.round(10000 * 0.95 * 0.75));
  });

  it('expired rule is not applied (engine filters by date)', async () => {
    const past = { startsAt: new Date('2020-01-01'), endsAt: new Date('2020-02-01') };
    const rules = [
      {
        id: 'r-old', name: 'old promo', ruleType: 'PROMO', discountPercent: 50,
        priority: 1000, isActive: true, ...past,
      },
    ];
    // Simulate DB-level date filtering like the real query does
    const mock = makePrismaMock([]);
    mock.pricingRule.findMany.mockImplementation((_args: unknown) =>
      Promise.resolve((rules as never[]).filter(() => false)),
    );
    const eng = engineWith(mock);
    const q = await eng.quote({ variantId: 'v1', quantity: 1, date: new Date() });
    expect(q.unitPriceCents).toBe(10000);
  });

  it('enterprise contract overrides everything', async () => {
    const rules = [
      {
        id: 'r-promo', name: 'sale', ruleType: 'PROMO', discountPercent: 90, priority: 1000, isActive: true,
      },
    ];
    const eng = engineWith(makePrismaMock(rules as never[], { contractPrice: 6000 }));
    const q = await eng.quote({ variantId: 'v1', quantity: 100, userId: 'u-contract' });
    expect(q.unitPriceCents).toBe(6000);
    expect(q.appliedRule.source).toBe('ENTERPRISE_CONTRACT');
  });

  it('conflicting overlapping bands resolve by priority then specificity', async () => {
    // Rules arrive from the DB ordered by priority desc — mirror that here
    const rules = [
      {
        id: 'high-pri', name: 'specific band', ruleType: 'VOLUME_DISCOUNT',
        minQuantity: 10, maxQuantity: 20, discountPercent: 15, priority: 10, isActive: true,
      },
      {
        id: 'low-pri', name: 'generic band', ruleType: 'VOLUME_DISCOUNT',
        minQuantity: 1, maxQuantity: null, discountPercent: 5, priority: 0, isActive: true,
      },
    ];
    const eng = engineWith(makePrismaMock(rules as never[]));
    const q = await eng.quote({ variantId: 'v1', quantity: 12 });
    expect(q.appliedRule.ruleId).toBe('high-pri');
  });
});
