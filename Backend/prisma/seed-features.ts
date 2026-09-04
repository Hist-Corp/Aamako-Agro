/* eslint-disable */
// ─── Seed demo data for the dashboard feature modules ───────────────────
// Warehouses • Production batches & recall • Reviews • Support tickets.
// These tables were empty/never loaded; this seeds realistic rows so the
// dashboard pages show real records instead of the local mock UI.
//
// Idempotent — safe to run repeatedly: products & warehouses are upserted by
// natural key; reviews / batches / tickets are only created on first run.
//
// Usage: npm run seed:features   (from the Backend directory)

import { PrismaClient, QcStatus, RecallStatus, ReviewStatus, Role, TicketPriority, TicketStatus, Unit } from '@prisma/client';

const prisma = new PrismaClient();

async function ensureProduct(name: string, slug: string) {
  const product = await prisma.product.upsert({
    where: { slug },
    update: {},
    create: { name, slug, description: `Sample product for ${name.toLowerCase()} — seeded for dashboard demo.`, imageUrl: '', isPublished: true },
  });
  const variant = await prisma.productVariant.findFirst({ where: { productId: product.id } });
  if (!variant) {
    await prisma.productVariant.create({
      data: { productId: product.id, sku: 'SKU-' + slug.toUpperCase().replace(/-/g, ''), name, unit: Unit.UNIT_30G, basePriceCents: 45000 },
    });
  }
  return product;
}

async function main() {
  const mango = await ensureProduct('Freeze-Dried Mango', 'fd-mango');
  const apple = await ensureProduct('Dehydrated Apple', 'dehydrated-apple');

  // Inventory rows for the seeded variants.
  const variants = await prisma.productVariant.findMany({
    where: { productId: { in: [mango.id, apple.id] } },
    select: { id: true },
  });
  for (const v of variants) {
    await prisma.inventory.upsert({
      where: { variantId: v.id },
      update: {},
      create: { variantId: v.id, stockOnHand: 120, reservedQty: 0, lowStockThreshold: 20 },
    });
  }

  // Warehouses (upsert by code).
  const warehouses = [
    { name: 'Main Warehouse - Kathmandu', code: 'KTM-MAIN', address: 'Balkhu, Kathmandu' },
    { name: 'Distribution Hub - Chitwan', code: 'CHW-DIST', address: 'Bharatpur, Chitwan' },
  ];
  for (const w of warehouses) {
    await prisma.warehouse.upsert({ where: { code: w.code }, update: {}, create: w });
  }

  // Reviews (first run only).
  const retailUser = await prisma.user.findFirst({ where: { role: Role.RETAIL_CUSTOMER } });
  if ((await prisma.review.count()) === 0) {
    const name = retailUser ? [retailUser.firstName, retailUser.lastName].filter(Boolean).join(' ') || retailUser.email : 'Ravi Retail';
    const samples = [
      { p: mango.id, rating: 5, title: 'So good, tastes fresh!', content: 'The freeze-dried mango keeps its natural sweetness. Perfect for snacking.', status: 'APPROVED', verified: true },
      { p: mango.id, rating: 4, title: 'Love it', content: 'Crisp and light, ideal for my lunchbox.', status: 'PENDING', verified: false },
      { p: apple.id, rating: 3, title: 'Decent', content: 'Nice but a little tart for me.', status: 'PENDING', verified: true },
    ];
    for (const s of samples) {
      await prisma.review.create({
        data: {
          productId: s.p,
          userId: retailUser?.id,
          customerName: name,
          customerEmail: retailUser?.email ?? 'retail@aamako.agro',
          rating: s.rating,
          title: s.title,
          content: s.content,
          status: s.status as ReviewStatus,
          isVerifiedPurchase: s.verified,
          helpfulCount: Math.floor(Math.random() * 8),
        },
      });
    }
    console.log('Seeded reviews.');
  }

  // Batches (first run only).
  if ((await prisma.batch.count()) === 0) {
    await prisma.batch.create({
      data: {
        batchNumber: 'BATCH-FD-001',
        productId: mango.id,
        quantity: 500,
        remainingQuantity: 320,
        supplier: 'Terai Farms Co-op',
        qcStatus: 'PASSED' as QcStatus,
        recallStatus: 'NONE' as RecallStatus,
        productionDate: new Date(Date.now() - 30 * 86400000),
        expiryDate: new Date(Date.now() + 300 * 86400000),
      },
    });
    await prisma.batch.create({
      data: {
        batchNumber: 'BATCH-DH-001',
        productId: apple.id,
        quantity: 300,
        remainingQuantity: 0,
        supplier: 'Pokhara Orchards',
        qcStatus: 'QUARANTINED' as QcStatus,
        recallStatus: 'IN_PROGRESS' as RecallStatus,
        recallSeverity: 'MEDIUM',
        recallReason: 'Storage temperature deviation detected at source.',
        productionDate: new Date(Date.now() - 45 * 86400000),
        expiryDate: new Date(Date.now() + 260 * 86400000),
      },
    });
    console.log('Seeded batches.');
  }

  // Support tickets (first run only).
  const supportStaff = await prisma.user.findFirst({ where: { role: Role.STAFF_SUPPORT } });
  if ((await prisma.supportTicket.count()) === 0) {
    const tickets = [
      { subject: 'Order not received after 7 days', customerName: 'KTM Fresh Mart', customerEmail: 'orders@ktmfresh.com', category: 'Order Issue', status: 'IN_PROGRESS' as TicketStatus, priority: 'HIGH' as TicketPriority, message: 'Checking with courier service for tracking update.' },
      { subject: 'Wholesale pricing inquiry', customerName: 'Lalitpur Grocery', customerEmail: 'buy@lalitpurgrocery.com', category: 'General Inquiry', status: 'OPEN' as TicketStatus, priority: 'LOW' as TicketPriority, message: 'Looking for bulk pricing on freeze-dried products.' },
      { subject: 'Damaged product received', customerName: 'Bhaktapur Organics', customerEmail: 'info@bhaktapurorg.com', category: 'Product Quality', status: 'WAITING_CUSTOMER' as TicketStatus, priority: 'MEDIUM' as TicketPriority, message: 'Please share photos of the damaged product.' },
    ];
    for (const t of tickets) {
      await prisma.supportTicket.create({
        data: {
          subject: t.subject,
          customerName: t.customerName,
          customerEmail: t.customerEmail,
          category: t.category,
          status: t.status,
          priority: t.priority,
          assignedToId: supportStaff?.id,
          messages: { create: { authorName: t.customerName, body: t.message } },
        },
      });
    }
    console.log('Seeded support tickets.');
  }

  console.log('Feature seed complete.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());