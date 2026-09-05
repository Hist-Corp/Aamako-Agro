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
  // Second-level administrator for the dashboard role selector: admin2@aamako.agro / Admin123! (STAFF_ADMIN)
  await prisma.user.upsert({
    where: { email: 'admin2@aamako.agro' },
    update: {},
    create: {
      email: 'admin2@aamako.agro',
      passwordHash: await bcrypt.hash('Admin123!', 12),
      firstName: 'Bishal',
      lastName: 'Admin',
      role: Role.STAFF_ADMIN,
    },
  });

  // Business operations manager for the dashboard role selector: manager@aamako.agro / Manager123! (STAFF_MANAGER)
  await prisma.user.upsert({
    where: { email: 'manager@aamako.agro' },
    update: {},
    create: {
      email: 'manager@aamako.agro',
      passwordHash: await bcrypt.hash('Manager123!', 12),
      firstName: 'Mina',
      lastName: 'Manager',
      role: Role.STAFF_MANAGER,
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
  // Inventory manager: inventory@aamako.agro / Inventory123!
  await prisma.user.upsert({
    where: { email: 'inventory@aamako.agro' },
    update: {},
    create: {
      email: 'inventory@aamako.agro',
      passwordHash: await bcrypt.hash('Inventory123!', 12),
      firstName: 'Gita',
      lastName: 'Inventory',
      role: Role.STAFF_MANAGER,
    },
  });

  // Customer support: support@aamako.agro / Support123!
  await prisma.user.upsert({
    where: { email: 'support@aamako.agro' },
    update: {},
    create: {
      email: 'support@aamako.agro',
      passwordHash: await bcrypt.hash('Support123!', 12),
      firstName: 'Rita',
      lastName: 'Support',
      role: Role.STAFF_SUPPORT,
    },
  });

  // Storefront retail customer: customer@aamako.agro / Customer123! (RETAIL_CUSTOMER)
  await prisma.user.upsert({
    where: { email: 'customer@aamako.agro' },
    update: {},
    create: {
      email: 'customer@aamako.agro',
      passwordHash: await bcrypt.hash('Customer123!', 12),
      firstName: 'Ram',
      lastName: 'Shrestha',
      phone: '+9779800000000',
      role: Role.RETAIL_CUSTOMER,
    },
  });

  // Storefront wholesale customer: wholesale@aamako.agro / Wholesale123! (WHOLESALE_CUSTOMER)
  await prisma.user.upsert({
    where: { email: 'wholesale@aamako.agro' },
    update: {},
    create: {
      email: 'wholesale@aamako.agro',
      passwordHash: await bcrypt.hash('Wholesale123!', 12),
      firstName: 'Hari',
      lastName: 'Tamang',
      phone: '+9779811111111',
      role: Role.WHOLESALE_CUSTOMER,
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

  // Active wholesale account for wholesale@aamako.agro (GROWTH tier) so the
  // storefront wholesale flows show tier pricing immediately.
  const wholesaleUser = await prisma.user.findUniqueOrThrow({
    where: { email: 'wholesale@aamako.agro' },
  });
  const whAdmin = await prisma.user.findUniqueOrThrow({
    where: { email: 'admin@aamako.agro' },
  });
  const growthTier = await prisma.pricingTier.findUniqueOrThrow({
    where: { tier: Tier.GROWTH },
  });
  await prisma.wholesaleAccount.upsert({
    where: { userId: wholesaleUser.id },
    update: { tierId: growthTier.id, isActive: true },
    create: {
      userId: wholesaleUser.id,
      tierId: growthTier.id,
      companyName: 'Himalayan Organics Pvt. Ltd.',
      vatNumber: '302712345',
      isActive: true,
      approvedById: whAdmin.id,
    },
  });

  const cats = [
    { name: 'Freeze-Dried Fruits & Vegetables', slug: 'freeze-dried-fruits', sortOrder: 1 },
    { name: 'Dehydrated Fruits & Vegetables', slug: 'dehydrated', sortOrder: 2 },
    { name: 'Milled Powders', slug: 'powders', sortOrder: 3 },
  ];
  const catIds: Record<string, string> = {};
  for (const c of cats) {
    const cat = await prisma.category.upsert({
      where: { slug: c.slug },
      update: {},
      create: c,
    });
    catIds[c.slug] = cat.id;
  }

  const products = [
    // Freeze-dried
    { name: 'Freeze-Dried Apple Slices', slug: 'fd-apple-slices', sku: 'AA-APL-30G', variantName: '30g pack', unit: Unit.UNIT_30G, price: 25000, cat: 'freeze-dried-fruits', imageUrl: 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=800&q=80' },
    { name: 'Freeze-Dried Mango Chunks', slug: 'fd-mango-chunks', sku: 'AA-MNG-50G', variantName: '50g pack', unit: Unit.UNIT_50G, price: 42000, cat: 'freeze-dried-fruits', imageUrl: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=800&q=80' },
    { name: 'Freeze-Dried Strawberry', slug: 'fd-strawberry', sku: 'AA-STR-50G', variantName: '50g pack', unit: Unit.UNIT_50G, price: 45000, cat: 'freeze-dried-fruits', imageUrl: 'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?w=800&q=80' },
    // Dehydrated (feeds the "Wholesome Dehydrated Choices" showcase)
    { name: 'Dehydrated Apple Rings', slug: 'dehydrated-apple-rings', sku: 'AA-DAP-50G', variantName: '50g pack', unit: Unit.UNIT_50G, price: 28000, cat: 'dehydrated', imageUrl: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&q=80' },
    { name: 'Dehydrated Banana Chips', slug: 'dehydrated-banana-chips', sku: 'AA-DBN-50G', variantName: '50g pack', unit: Unit.UNIT_50G, price: 22000, cat: 'dehydrated', imageUrl: 'https://images.unsplash.com/photo-1550828520-4cb496926fc9?w=800&q=80' },
    { name: 'Sun-Dried Tomatoes', slug: 'sun-dried-tomatoes', sku: 'AA-DTM-100G', variantName: '100g pack', unit: Unit.UNIT_100G, price: 38000, cat: 'dehydrated', imageUrl: 'https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?w=800&q=80' },
    { name: 'Dehydrated Mango Leather', slug: 'dehydrated-mango-leather', sku: 'AA-DML-50G', variantName: '50g pack', unit: Unit.UNIT_50G, price: 32000, cat: 'dehydrated', imageUrl: 'https://images.unsplash.com/photo-1550989460-0adf9ea622e2?w=800&q=80' },
    // Milled powders
    { name: 'Moringa Leaf Powder', slug: 'moringa-leaf-powder', sku: 'AA-MOR-100G', variantName: '100g pack', unit: Unit.UNIT_100G, price: 35000, cat: 'powders', imageUrl: 'https://images.unsplash.com/photo-1532336414038-cf19250c5757?w=800&q=80' },
    { name: 'Ginger Powder', slug: 'ginger-powder', sku: 'AA-GIN-100G', variantName: '100g pack', unit: Unit.UNIT_100G, price: 24000, cat: 'powders', imageUrl: 'https://images.unsplash.com/photo-1532336414038-cf19250c5757?w=800&q=80' },
    { name: 'Timur (Sichuan Pepper) Powder', slug: 'timur-powder', sku: 'AA-TIM-50G', variantName: '50g pack', unit: Unit.UNIT_50G, price: 30000, cat: 'powders', imageUrl: 'https://images.unsplash.com/photo-1532336414038-cf19250c5757?w=800&q=80' },
  ];

  for (const p of products) {
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        name: p.name,
        slug: p.slug,
        description: `Nepali ${p.name.toLowerCase()} from partner farms, processed to lock in flavour.`,
        imageUrl: p.imageUrl,
        categoryId: catIds[p.cat],
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

  // Attach the dashboard-demo sample product to the dehydrated category so it
  // also appears in the "Wholesome Dehydrated Choices" showcase.
  await prisma.product.updateMany({
    where: { slug: 'dehydrated-apple', categoryId: null },
    data: { categoryId: catIds['dehydrated'] },
  });

  console.log('Seed complete: staff admin + customers + tiers + catalog + wholesale price lists');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
