/* eslint-disable */
// ─── Seed product templates from the storefront + catalog ─────────────
// Creates every `product-template.<slug>.<field>` ContentItem that the
// Dashboard's Product Templates editor needs for the products that exist
// in the catalog DB, so each template opens PRE-FILLED:
//
//   • Product-specific data (name, slug, price, pack, SKU, description,
//     image) comes from the live catalog database — the same values the
//     storefront product page renders.
//   • The long-form copy (Description / How to use / Nutrition /
//     Certifications / Why choose / Sourcing / Key highlights / FAQ) is
//     read at runtime from the storefront's own Frontend/product.html
//     CONTENT[fd|dh|pw] + FAQ blocks — the EXACT texts customers see, by
//     process category (freeze-dried / dehydrated / powders).
//   • Trace fields mirror what the storefront page draws for every pack
//     (Batch: AA-<SKU>-<year>, Source: [Region] Nepal, …).
//
// Items are created as DRAFTS (unpublished) so the live storefront keeps
// rendering its authored content exactly as before; the Dashboard editor
// still shows every field filled so a content manager knows what goes
// where and can publish when ready.
//
// Usage:  npm run seed:product-templates   (from the Backend directory)

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const prisma = new PrismaClient();
const PRODUCT_HTML = resolve(__dirname, '../../Frontend/product.html');

type ProcessKind = 'fd' | 'dh' | 'pw';

interface KindCopy {
  highlights: string[];      // list-check rows
  desc: string[];            // long-description paragraphs
  howto: { usage: string; recipes: string; storage: string };
  nutrition: [string, string][]; // nutrition rows
  why: string[];             // list-check rows
  sourcing: string[];        // sourcing paragraphs
}

interface StorefrontCopy {
  CONTENT: Record<ProcessKind, KindCopy>;
  FAQ: Record<ProcessKind, [string, string][]>;
}

/**
 * Read the CONTENT and FAQ objects straight out of Frontend/product.html.
 * They are plain JavaScript object literals, so eval() yields the exact
 * strings the storefront renders — no transcription in this file.
 */
function readStorefrontCopy(): StorefrontCopy {
  const html = readFileSync(PRODUCT_HTML, 'utf8');
  const m = html.match(/var CONTENT=(\{[\s\S]*?\n\s*\});\s*\n\s*var FAQ=(\{[\s\S]*?\n\s*\});/);
  if (!m) throw new Error('Could not locate CONTENT/FAQ blocks in product.html');
  const evalExpr = (src: string) =>
    new Function(`return (${src});`)() as StorefrontCopy['CONTENT'] | StorefrontCopy['FAQ'];
  return {
    CONTENT: evalExpr(m[1]) as StorefrontCopy['CONTENT'],
    FAQ: evalExpr(m[2]) as StorefrontCopy['FAQ'],
  };
}

function kindOf(categorySlug?: string | null): ProcessKind {
  if (categorySlug === 'dehydrated') return 'dh';
  if (categorySlug === 'powders') return 'pw';
  return 'fd';
}

function packLabel(unit: string, variantName: string): string {
  // Variant names already read "50g pack", "100g pack" — prefer them.
  const n = (variantName || '').trim();
  if (n) return n;
  const map: Record<string, string> = {
    UNIT_30G: '30g pack',
    UNIT_50G: '50g pack',
    UNIT_100G: '100g pack',
    UNIT_250G: '250g pack',
    CASE_12X30G: 'Case of 12 × 30g',
    CASE_12X50G: 'Case of 12 × 50g',
  };
  return map[unit] ?? '—';
}

/** Storage: fields live in `title`; only the rich/structured editors
 *  (textarea/richtext/list-check/nutrition/faq/howto/gallery) store into
 *  `body`, matching the product-template editor in the Dashboard. */
const BODY_FIELDS = new Set([
  'description', 'highlights', 'long-description', 'howto', 'nutrition',
  'certifications', 'why', 'sourcing', 'faq', 'gallery', 'related-cards',
]);
async function main() {
  const copy = readStorefrontCopy();
  const products = await prisma.product.findMany({
    include: { category: true, variants: { orderBy: { basePriceCents: 'asc' } } },
  });
  if (!products.length) throw new Error('No catalog products found — run db:push + seed first.');

  console.log(`Read storefront copy (CONTENT + FAQ) from ${PRODUCT_HTML}`);
  console.log(`Seeding product templates for ${products.length} catalog products...`);

  const year = String(new Date().getFullYear());
  let created = 0;
  let updated = 0;

  for (const product of products) {
    const kind = kindOf(product.category?.slug);
    const c = copy.CONTENT[kind];
    const faq = copy.FAQ[kind];
    const active = product.variants.filter((v) => v.isActive !== false);
    const variant = active.length ? active[0] : product.variants[0];
    const priceCents = variant?.basePriceCents ?? 0;
    const sku = variant?.sku?.trim() ?? '';

    // Trace card: mirror the values product.html renders on every page.
    const batchNo = `AA-${sku.replace(/^AA-/, '')}-${year}`;

    const fields: Record<string, string> = {
      // --- Basic info ---
      name: product.name,
      slug: product.slug,
      'process-category': product.category?.slug ?? '',
      // --- Pricing & availability ---
      price: priceCents > 0 ? String(Math.round(priceCents / 100)) : '',
      pack: packLabel(variant?.unit ?? '', variant?.name ?? ''),
      availability: 'In stock',
      sku,
      // --- Descriptions ---
      description: product.description ?? '',
      // --- Key highlights (from the storefront CONTENT block) ---
      highlights: c.highlights.join('\n'),
      // --- Description tab ---
      'long-description': c.desc.join('\n\n'),
      // --- How to use tab ---
      howto: [
        `Usage: ${c.howto.usage}`,
        `Recipes: ${c.howto.recipes}`,
        `Storage: ${c.howto.storage}`,
      ].join('\n\n'),
      // --- Nutrition tab (rows + the exact lab-status note) ---
      nutrition:
        c.nutrition.map((row) => `${row[0]}: ${row[1]}`).join('\n') +
        '\n\nFull nutrition panel pending third-party lab data [PLACEHOLDER].',
      // --- Certifications tab ---
      certifications: 'DFTQC-compliant facility\nThird-party lab tested\nBatch-coded packs\nMade in Nepal',
      // --- Why choose tab ---
      why: c.why.join('\n'),
      // --- Sourcing tab ---
      sourcing: c.sourcing.join('\n\n'),
      // --- FAQ accordion ---
      faq: faq.map((pair) => `Q: ${pair[0]}\nA: ${pair[1]}`).join('\n\n'),
      // --- Batch traceability (as drawn on the live product page) ---
      'batch-no': batchNo,
      'trace-source': '[Region], Nepal',
      'trace-processed': '[Date]',
      'trace-quality': 'Passed',
      // --- Product images ---
      gallery: product.imageUrl ?? '',
    };

    for (const [field, value] of Object.entries(fields)) {
      if (value === '') continue; // skip empty (editor falls back to its own hints)
      const key = `product-template.${product.slug}.${field}`;
      const isBody = BODY_FIELDS.has(field);
      const data = isBody ? { body: value, title: field } : { title: value, body: '' };
      const existing = await prisma.contentItem.findUnique({ where: { key } });
      if (existing) {
        await prisma.contentItem.update({ where: { key }, data });
        updated++;
      } else {
        await prisma.contentItem.create({ data: { key, isPublished: false, ...data } });
        created++;
      }
    }
  }

  console.log(`Product template seed complete: ${created} created, ${updated} updated.`);
  console.log(`Sample products: ${products[0].slug}, ${products[products.length - 1].slug}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());