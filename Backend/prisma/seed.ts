/* eslint-disable */
import { PrismaClient, Role, Tier, Unit } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Staff admin for local dev: admin@aamako.agro / Admin123! (SUPER_ADMIN)
  await prisma.user.upsert({
    where: { email: 'admin@aamako.agro' },
    update: {},
    create: {
      email: 'admin@aamako.agro',
      passwordHash: await bcrypt.hash('Admin123!', 12),
      firstName: 'Aamako',
      lastName: 'Admin',
      role: Role.SUPER_ADMIN,
    },
  });

  // Demo staff accounts for the hierarchical RBAC
  await prisma.user.upsert({
    where: { email: 'sales@aamako.agro' },
    update: {},
    create: {
      email: 'sales@aamako.agro',
      passwordHash: await bcrypt.hash('Sales123!', 12),
      firstName: 'Sita',
      lastName: 'Sales',
      role: Role.STAFF_SALES,
    },
  });
  await prisma.user.upsert({
    where: { email: 'content@aamako.agro' },
    update: {},
    create: {
      email: 'content@aamako.agro',
      passwordHash: await bcrypt.hash('Content123!', 12),
      firstName: 'Cita',
      lastName: 'Content',
      role: Role.CONTENT_MANAGER,
    },
  });

  const tiers = Object.values(Tier);
  for (const [i, tier] of tiers.entries()) {
    await prisma.pricingTier.upsert({
      where: { tier },
      update: {},
      create: {
        tier,
        displayName: `${tier[0]}${tier.slice(1).toLowerCase()} Wholesale`,
        minOrderValueCents: 1000000 * (i + 1),
      },
    });
  }

  const cat = await prisma.category.upsert({
    where: { slug: 'freeze-dried-fruits' },
    update: {},
    create: { name: 'Freeze-Dried Fruits', slug: 'freeze-dried-fruits', sortOrder: 1 },
  });

  const products = [
    { name: 'Freeze-Dried Apple Slices', slug: 'fd-apple-slices', sku: 'AA-APL-30G', variantName: '30g pack', unit: Unit.UNIT_30G, price: 25000 },
    { name: 'Freeze-Dried Mango Chunks', slug: 'fd-mango-chunks', sku: 'AA-MNG-50G', variantName: '50g pack', unit: Unit.UNIT_50G, price: 42000 },
    { name: 'Freeze-Dried Strawberry', slug: 'fd-strawberry', sku: 'AA-STR-50G', variantName: '50g pack', unit: Unit.UNIT_50G, price: 45000 },
  ];

  for (const p of products) {
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        name: p.name,
        slug: p.slug,
        description: `Nepali ${p.name.toLowerCase()}, freeze-dried to lock in flavour.`,
        categoryId: cat.id,
        isPublished: true,
        variants: {
          create: {
            sku: p.sku,
            name: p.variantName,
            unit: p.unit,
            basePriceCents: p.price,
            inventory: { create: { stockOnHand: 500 } },
          },
        },
      },
      include: { variants: true },
    });

    // Wholesale list prices (10–25% below retail by tier)
    const allTiers = await prisma.pricingTier.findMany();
    for (const t of allTiers) {
      const discount = t.tier === Tier.STARTER ? 10 : t.tier === Tier.GROWTH ? 18 : 25;
      await prisma.priceList.upsert({
        where: {
          tierId_variantId: { tierId: t.id, variantId: product.variants[0].id },
        },
        update: {},
        create: {
          tierId: t.id,
          variantId: product.variants[0].id,
          unitPriceCents: Math.round(p.price * (1 - discount / 100)),
        },
      });
    }
  }

  console.log('Seed complete: staff admin + tiers + catalog + wholesale price lists');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
