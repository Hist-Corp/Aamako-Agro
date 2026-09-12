// ─── Product Template Catalog ──────────────────────────────────────────
// Defines the editable template for every product on the storefront. When a
// Content Manager adds a new product, they fill in these fields — every
// section of the product page is fully editable (titles, descriptions, specs,
// nutrition, ingredients, origin, storage, rehydration, pricing, images).
//
// Each field maps to a ContentItem in the backend (keyed like
// "product-template.<slug>.<field>"), edited through the shared content API
// (/content/manage, PUT /content/:key).

export interface ProductTemplateField {
  key: string;
  label: string;
  description: string;
  type: 'text' | 'textarea' | 'richtext' | 'number' | 'url' | 'select' | 'image' | 'gallery' | 'list-check' | 'nutrition-rows' | 'faq-pairs' | 'howto-blocks' | 'related-cards' | 'cert-cards';
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
}

export interface ProductTemplateSection {
  label: string;
  description: string;
  /** lucide-react icon name rendered in the editor's section navigator. */
  icon?: string;
  /** Where this section's content appears on the storefront product page. */
  storefront?: string;
  fields: ProductTemplateField[];
}

// Sections are ordered to mirror how a customer reads the real product page
// (Frontend/product.html): name & breadcrumb → price & pack → description →
// key highlights → SKU → image → ingredients → nutrition → sourcing →
// storage → usage.
export const PRODUCT_TEMPLATE_SECTIONS: ProductTemplateSection[] = [
  {
    label: 'Basic info',
    description: 'Product name, category and badge shown on the product card.',
    icon: 'Tag',
    storefront: 'Page header & breadcrumb',
    fields: [
      { key: 'name', label: 'Product name', description: 'The display name shown on the product page and card.', type: 'text', required: true, placeholder: 'e.g. Freeze-Dried Mango' },
      { key: 'slug', label: 'URL slug', description: 'Kebab-case identifier used in the product page URL.', type: 'text', required: true, placeholder: 'e.g. fd-mango' },
      { key: 'process-category', label: 'Process Category', description: 'Links this product to its storefront category page (Freeze-Dried Fruits, Dehydrated Fruits & Vegetables or Milled Powders) and creates a product card on that page.', type: 'select', required: true, options: [{ value: 'freeze-dried-fruits', label: 'Freeze-Dried Fruits' }, { value: 'dehydrated', label: 'Dehydrated Fruits & Vegetables' }, { value: 'powders', label: 'Milled Powders' }] },
    ],
  },
  {
    label: 'Pricing & availability',
    description: 'Price, pack size, stock status and SKU.',
    fields: [
      { key: 'price', label: 'Base price (Rs)', description: 'Selling price in Nepalese rupees.', type: 'number', required: true, placeholder: '450' },
      { key: 'pack', label: 'Pack size', description: 'Size/weight of the pack (e.g. 50g pouch).', type: 'text', required: true, placeholder: 'e.g. 50g pouch' },
      { key: 'availability', label: 'Availability', description: 'Stock status shown to customers.', type: 'select', required: true, options: [{ value: 'In stock', label: 'In stock' }, { value: 'Low stock', label: 'Low stock' }, { value: 'Out of stock', label: 'Out of stock' }, { value: 'Pre-order', label: 'Pre-order' }] },
      { key: 'sku', label: 'SKU', description: 'Stock-keeping unit — shown on the product page next to Pack size and Availability (e.g. SKU-FDMANGO).', type: 'text', placeholder: 'e.g. SKU-FDMANGO' },
    ],
  },
  {
    label: 'Descriptions',
    description: 'The headline copy — a one-line intro shown below the product name.',
    fields: [
      { key: 'description', label: 'Short description', description: 'One-line summary shown below the product name (e.g. “Sample product for freeze-dried mango — seeded for dashboard demo.”).', type: 'textarea', required: true, placeholder: 'e.g. Sample product for freeze-dried mango — seeded for dashboard demo.' },
    ],
  },
  {
    label: 'Key highlights',
    description: 'The “Key Highlights” card under the product price — each line becomes a check-marked bullet on the product page.',
    icon: 'Sparkles',
    storefront: 'Key Highlights card (below the price, above Pack size)',
    fields: [
      { key: 'highlights', label: 'Key highlights', description: 'One highlight per row. Tick the checkbox for a green check on the page, or untick it for a cross — and type the highlight text next to it. Add or remove rows as needed.', type: 'list-check', placeholder: 'Freeze-dried within hours of harvest\n100% fruit or vegetable — nothing added\nNo added sugar, sulphites or preservatives\nCrunchy straight from the pack, rehydrates in minutes\nBatch-coded and graded before it ships\nLightweight and pantry-stable — no refrigeration' },
    ],
  },
  {
    label: 'Description Section',
    description: 'The six tabs beneath the buy box — Description, How to use, Nutrition, Certifications, Why choose and Sourcing. Each field below maps to the tab with the same name on the storefront product page, and the certificate images fill the picture slots inside the certification cards.',
    icon: 'Sparkles',
    storefront: 'Tabbed section below the buy box (Description · How to use · Nutrition · Certifications · Why choose · Sourcing)',
    fields: [
      { key: 'long-description', label: 'Description (tab)', description: 'The full product story for the Description tab — rich text; separate paragraphs with a blank line.', type: 'richtext', placeholder: 'Freeze-drying removes the water, not the goodness. This product was picked ripe from partner farms across Nepal, frozen within hours of harvest and dried under vacuum so the cell structure — and the crunch, colour and flavour — stay exactly as picked.\n\nUnlike conventional drying, freeze-drying happens at low temperature, which protects delicate vitamins and aromatic compounds...' },
      { key: 'howto', label: 'How to use (tab)', description: 'Three simple boxes — Usage, Recipes and Storage — matching the How to use tab on the product page. Type each section in its own box; empty boxes are hidden on the page.', type: 'howto-blocks', placeholder: 'Usage: Eat straight from the pack as a crunchy snack, or rehydrate by covering with hot or cold water and waiting 5–10 minutes.\n\nRecipes: Rehydrated pieces fold beautifully into cakes, porridge and smoothie bowls.\n\nStorage: Store in a cool, dry place away from direct sunlight.' },
      { key: 'nutrition', label: 'Nutrition (tab)', description: 'One nutrient per row — type the nutrient name and its value (e.g. Energy → 347 kcal). The last paragraph box is for the lab-status note shown under the table.', type: 'nutrition-rows', placeholder: 'Energy: [PLACEHOLDER] kcal\nProtein: [PLACEHOLDER] g\nCarbohydrate: [PLACEHOLDER] g\n— of which sugars: [PLACEHOLDER] g\nFibre: [PLACEHOLDER] g\nFat: [PLACEHOLDER] g\n\nFull nutrition panel pending third-party lab data.' },
      { key: 'certifications', label: 'Certifications (tab)', description: 'One certificate per row — type the certificate name and attach its image (badge, certificate scan or photo). Leave the image empty to keep the default icon on the card.', type: 'cert-cards', placeholder: 'DFTQC-compliant facility\nThird-party lab tested\nBatch-coded packs\nMade in Nepal' },
      { key: 'why', label: 'Why choose (tab)', description: 'One selling point per row. Tick the checkbox for a green check on the page, or untick it for a cross — then type the point next to it. Add or remove rows as needed.', type: 'list-check', placeholder: 'Picked ripe — flavour is locked in at its peak, not ripened in a truck.\nNothing added: no sugar, no sulphites, no colouring, no preservatives.\nUp to [N] months of pantry life with no refrigeration.\nAround 90% lighter than fresh — perfect for treks, travel and lunchboxes.\nBatch-coded packs trace every step from farm gate to shelf.' },
      { key: 'sourcing', label: 'Sourcing (tab)', description: 'The sourcing story for the Sourcing tab — multi-paragraph; separate each paragraph with a blank line.', type: 'textarea', placeholder: 'This product is grown by our partner farmers in the hills and terai of Nepal, harvested at peak ripeness and delivered to our facility within hours.\n\nWe buy directly from the farms — no middle traders — which keeps quality high and returns fair.' },
    ],
  },
  {
    label: 'Frequently asked',
    description: 'The “Frequently asked” accordion beneath the tabs on the product page — each question with its answer.',
    icon: 'Sparkles',
    storefront: 'FAQ accordion below the tabs',
    fields: [
      { key: 'faq', label: 'Frequently asked questions & answers', description: 'One card per question — type the question in the top box and its answer in the box below. Add or remove cards as needed; every card renders as an accordion row on the product page.', type: 'faq-pairs', placeholder: 'Q: Is it 100% fruit or vegetable?\nA: Yes. The ingredient list is one line long — the fruit or vegetable itself.\n\nQ: How do I rehydrate it?\nA: Cover with hot or cold water and wait 5–10 minutes.' },
    ],
  },
  {
    label: 'Batch traceability',
    description: 'The “Batch traceability” tear-strip card beside the Add to cart button — each row is its own editable field.',
    icon: 'Sparkles',
    storefront: 'Batch traceability card (under Add to cart)',
    fields: [
      { key: 'batch-no', label: 'Batch', description: 'The batch number shown on the first row of the traceability card.', type: 'text', placeholder: 'e.g. BATCH-2026-014' },
      { key: 'trace-source', label: 'Source', description: 'Where the produce comes from (shown on the second row, e.g. “[Region], Nepal”).', type: 'text', placeholder: 'e.g. [Region], Nepal' },
      { key: 'trace-processed', label: 'Processed', description: 'Processing/packing date shown on the third row.', type: 'text', placeholder: 'e.g. [Date]' },
      { key: 'trace-quality', label: 'Quality check', description: 'Quality status shown on the fourth row (e.g. “Passed”).', type: 'text', placeholder: 'e.g. Passed' },
    ],
  },
  {
    label: 'Product images',
    description: 'Up to 8 product images. Image 1 is the THEME image — the consistent photo of this product shown large on the product page and on every product card across the storefront (Shop, Collections, Related products). Images 2–8 are the product gallery thumbnails. Click "Add image" to add more.',
    icon: 'Image',
    storefront: 'Product gallery — mosaic',
    fields: [
      { key: 'gallery', label: 'Product gallery', description: 'Image 1 = THEME image — stays consistent everywhere (product page hero + every product card: Shop, Collections, Related). Images 2–8 = product gallery thumbnails (Texture view, Pack detail, Serving idea, …). Add up to 8.', type: 'gallery', required: true, placeholder: 'https://images.unsplash.com/...' },
    ],
  },
  {
    label: 'You might also like',
    description: 'Four product cards shown at the bottom of the product page — each with a title and a link to another product. Empty slots are hidden.',
    icon: 'Heart',
    storefront: 'Product page — "You might also like" section',
    fields: [
      { key: 'related-cards', label: 'Related product cards', description: 'Up to 4 cards. Type a card title (e.g. "Freeze-Dried Strawberry") and paste the product link (e.g. /product.html?slug=fd-strawberry) for each. Slots left empty are hidden on the storefront.', type: 'related-cards', placeholder: 'Card 1 title: Freeze-Dried Strawberry\nCard 1 link: /product.html?slug=fd-strawberry\n\nCard 2 title: Dehydrated Apple Slices\nCard 2 link: /product.html?slug=dh-apple\n\nCard 3 title: Mango Powder\nCard 3 link: /product.html?slug=pw-mango\n\nCard 4 title: Freeze-Dried Pineapple\nCard 4 link: /product.html?slug=fd-pineapple' },
    ],
  },
];

export const ALL_PRODUCT_FIELD_KEYS = PRODUCT_TEMPLATE_SECTIONS.flatMap((s) =>
  s.fields.map((f) => f.key),
);

export function productFieldKey(slug: string, fieldKey: string): string {
  return `product-template.${slug}.${fieldKey}`;
}

// ─── Storefront-prefilled content ────────────────────────────────────────
// The storefront product page (Frontend/product.html) ships with rich
// per-process-category copy (its CONTENT[fd|dh|pw] blocks). Those exact
// texts are mirrored here so the template editor opens PRE-FILLED — the
// editor sees the same copy customers see, knows what belongs in each
// field, and can simply refine it instead of writing from a blank slate.

export type ProcessKind = 'fd' | 'dh' | 'pw';

export function processKindOf(processCategory?: string | null): ProcessKind {
  if (processCategory === 'dehydrated') return 'dh';
  if (processCategory === 'powders') return 'pw';
  return 'fd';
}

const KIND_DEFAULTS: Record<ProcessKind, Record<string, string>> = {
  fd: {
    description:
      'Picked ripe from partner farms across Nepal and freeze-dried within hours of harvest — crisp, intense and 100% fruit.',
    highlights:
      'Freeze-dried within hours of harvest\n100% fruit or vegetable — nothing added\nNo added sugar, sulphites or preservatives\nCrunchy straight from the pack, rehydrates in minutes\nBatch-coded and graded before it ships\nLightweight and pantry-stable — no refrigeration',
    howto:
      'Usage: Eat straight from the pack as a crunchy snack, or rehydrate by covering with hot or cold water and waiting 5–10 minutes. Stir into yoghurt, muesli and batters near the end of preparation.\n\nRecipes: Rehydrated pieces fold beautifully into cakes, porridge and smoothie bowls. Crushed, they make a bright, natural topping for desserts and breakfast bowls.\n\nStorage: Store in a cool, dry place away from direct sunlight. Reseal the pouch after opening and consume within [N] weeks for the best texture.',
    certifications:
      'DFTQC-compliant facility\nThird-party lab tested\nBatch-coded packs\nMade in Nepal',
    why:
      'Picked ripe — flavour is locked in at its peak, not ripened in a truck.\nNothing added: no sugar, no sulphites, no colouring, no preservatives.\nUp to [N] months of pantry life with no refrigeration.\nAround 90% lighter than fresh — perfect for treks, travel and lunchboxes.\nBatch-coded packs trace every step from farm gate to shelf.',
    sourcing:
      'This product is grown by our partner farmers in the hills and terai of Nepal, harvested at peak ripeness and delivered to our facility within hours. Each batch is inspected, graded and freeze-dried on site before packing.\n\nWe buy directly from the farms — no middle traders — which keeps quality high and returns fair. The batch code on your pack identifies the farm cluster and the packing run. See our story page to meet the growers.',
    faq:
      'Q: Is it 100% fruit or vegetable?\nA: Yes. The ingredient list is one line long — the fruit or vegetable itself. No added sugar, sulphites, colouring or preservatives.\n\nQ: How do I rehydrate it?\nA: Cover with hot or cold water and wait 5–10 minutes. It also eats straight from the pack as a crunchy snack.\n\nQ: How should I store it?\nA: In a cool, dry place, resealed after opening. No refrigeration needed — the pack is moisture-barrier sealed.\n\nQ: How long does it keep?\nA: Up to [N] months unopened. Once opened, enjoy within [N] weeks for the best crunch.\n\nQ: Do you sell wholesale?\nA: Yes — retailers and distributors can request tiered pricing and sample kits on our wholesale page.',
    'long-description':
      'Freeze-drying removes the water, not the goodness. This product was picked ripe from partner farms across Nepal, frozen within hours of harvest and dried under vacuum so the cell structure — and the crunch, colour and flavour — stay exactly as picked.\n\nUnlike conventional drying, freeze-drying happens at low temperature, which protects delicate vitamins and aromatic compounds. Open the pack and you get the harvest itself: crisp, intense and ready in seconds.\n\nEat it straight from the pouch as a snack, toss it into trail mixes and muesli, or rehydrate with a splash of water for baking, smoothies and plating. Every pack is batch-coded so you can trace it back to the farm and the packing date.',
    ingredients:
      '100% freeze-dried fruit or vegetable. No added sugar, sulphites, colouring or preservatives.',
    nutrition:
      'Energy: [PLACEHOLDER] kcal\nProtein: [PLACEHOLDER] g\nCarbohydrate: [PLACEHOLDER] g\n— of which sugars: [PLACEHOLDER] g\nFibre: [PLACEHOLDER] g\nFat: [PLACEHOLDER] g\n\nFull nutrition panel pending third-party lab data.',
    origin:
      'This product is grown by our partner farmers in the hills and terai of Nepal, harvested at peak ripeness and delivered to our facility within hours. Each batch is inspected, graded and freeze-dried on site before packing.\n\nWe buy directly from the farms — no middle traders — which keeps quality high and returns fair. The batch code on your pack identifies the farm cluster and the packing run.',
    storage:
      'Store in a cool, dry place away from direct sunlight. Reseal the pouch after opening and consume within [N] weeks for the best texture.',
    rehydrate:
      'Usage: Eat straight from the pack as a crunchy snack, or rehydrate by covering with hot or cold water and waiting 5–10 minutes. Stir into yoghurt, muesli and batters near the end of preparation.\n\nRecipes: Rehydrated pieces fold beautifully into cakes, porridge and smoothie bowls. Crushed, they make a bright, natural topping for desserts and breakfast bowls.',
  },
  dh: {
    description:
      'Slow-dried at low temperature to concentrate natural sweetness — whole fruit or vegetable, nothing added.',
    highlights:
      'Slow-dried at low temperature\nWhole fruit or vegetable — nothing added\nNo oil dips, sulphur or refined sugar\nConcentrated, caramelised natural sweetness\nBatch-coded and graded before it ships\nPantry life measured in months',
    howto:
      'Usage: Eat straight from the pouch, or soak in warm water for 15–30 minutes to rehydrate for cooking. Add to trail mixes, baking and morning porridge.\n\nRecipes: Simmer rehydrated pieces into pilafs, curries and compotes, or fold chopped pieces into breads, cookies and granola bars.\n\nStorage: Store in a cool, dry place away from direct sunlight. Reseal after opening; refrigerate in humid weather to keep the texture chewy, not sticky.',
    certifications:
      'DFTQC-compliant facility\nThird-party lab tested\nBatch-coded packs\nMade in Nepal',
    why:
      'Slow-dried at low temperature — colour and vitamins survive the process.\nNo oil dips, no sulphur, no refined sugar — just the harvest.\nMonths of pantry life without refrigeration.\nConcentrated flavour means a little goes a long way in cooking.\nBatch-coded packs trace every step from farm gate to shelf.',
    sourcing:
      'This product is grown by partner farmers across Nepal and dried at our facility in small, dated runs. Fruit is inspected and hand-sorted before it goes into the dryers.\n\nWe buy directly from the farms — no middle traders — which keeps quality high and returns fair. The batch code on your pack identifies the farm cluster and the drying run. See our story page to meet the growers.',
    faq:
      'Q: Is it 100% fruit or vegetable?\nA: Yes — with nothing added. No oil dips, no sulphur, no refined sugar.\n\nQ: How do I rehydrate it?\nA: Soak in warm water for 15–30 minutes, or simmer directly into curries, pilafs and compotes.\n\nQ: How should I store it?\nA: Cool and dry, resealed after opening. In humid weather, refrigerate to keep the texture chewy rather than sticky.\n\nQ: How long does it keep?\nA: Months from the packing date when stored sealed — the batch code on the pack shows when it was dried.\n\nQ: Do you sell wholesale?\nA: Yes — retailers and distributors can request tiered pricing and sample kits on our wholesale page.',
    'long-description':
      'Dehydration is the patient way to keep food. Gentle, low heat draws the water out slowly, concentrating natural sugars and flavour into a chewy, intense result with a pantry life measured in months.\n\nWe dry at controlled temperatures to protect colour and vitamins, and add nothing along the way — no oil dips, no sulphur, no refined sugar. What you taste is the fruit or vegetable itself, just concentrated.',
    ingredients:
      '100% dehydrated fruit or vegetable. No oil dips, sulphur or refined sugar.',
    nutrition:
      'Energy: [PLACEHOLDER] kcal\nProtein: [PLACEHOLDER] g\nCarbohydrate: [PLACEHOLDER] g\nFibre: [PLACEHOLDER] g\nFat: [PLACEHOLDER] g\n\nFull nutrition panel pending third-party lab data.',
    origin:
      'Grown by partner farmers across the hills and terai of Nepal and dried at our facility in small, dated batches. Each lot is inspected and graded before packing, and the batch code on your pack identifies the farm cluster and the drying run.',
    storage:
      'Cool and dry, resealed after opening. In humid weather, refrigerate to keep the texture chewy rather than sticky.',
    rehydrate:
      'Usage: Soak in warm water for 15–30 minutes, or simmer directly into curries, pilafs and compotes.\n\nRecipes: Chop into baking and porridge, simmer into compotes, or snack on it as-is.',
  },
  pw: {
    description:
      'Single-origin plants from the mid-hills of Nepal, milled slow and cool in small batches — no fillers, no added salt.',
    highlights:
      'Stone-milled from whole leaves, roots and berries\nShade-dried or sun-dried before milling\nSingle origin — traceable to the farm cluster\nNo fillers, anti-caking agents or added salt\nSmall-batch milling keeps aroma intact\nBatch-coded and lab-checked [PLACEHOLDER]',
    howto:
      'Usage: Start with ½–1 teaspoon per serving. Stir into smoothies, dals, soups and warm water, or blend into marinades, rubs and salad dressings.\n\nRecipes: Whisk into batter for rotis and pancakes, bloom in hot ghee for tempering, or shake with honey and lemon for a quick tonic.\n\nStorage: Keep the jar tightly closed in a cool, dry place. Use a dry spoon every time — moisture is the enemy of powder. Best within [N] months of opening.',
    certifications:
      'DFTQC-compliant facility\nThird-party lab tested\nBatch-coded packs\nMade in Nepal',
    why:
      'Whole-plant milling — nothing isolated, nothing synthetic.\nNo fillers, flow agents or added salt — the label is one line long.\nSmall-batch milling keeps the aroma that large runs burn off.\nSingle origin and traceable to the farm cluster on every jar.',
    sourcing:
      'Leaves, roots and berries are bought directly from partner growers across the mid-hills of Nepal, dried at the facility and milled in small, dated batches.\n\nEach lot is inspected before milling and the jar is batch-coded to the grower cluster. See our story page to meet the growers behind the harvest.',
    faq:
      'Q: Is it pure, or a blend?\nA: Single plant, single origin. No fillers, flow agents or added salt — the ingredient list is one line long.\n\nQ: How much should I use?\nA: Start with ½–1 teaspoon per serving and adjust to taste.\n\nQ: How should I store it?\nA: Tightly closed in a cool, dry place, always with a dry spoon. Moisture clumps powder.\n\nQ: How long does it keep?\nA: Best within [N] months of opening. The jar is batch-coded with the milling date.\n\nQ: Do you sell wholesale?\nA: Yes — retailers and distributors can request tiered pricing and sample kits on our wholesale page.',
    'long-description':
      'Nothing is lost between the farm and your kitchen. Milling fast and hot burns off aroma; we do it slow and cool, in small runs, and pack immediately into resealable jars.\n\nNo fillers, no anti-caking agents, no added salt — just the plant, milled. One spoon goes a long way: stir into smoothies, dals and soups, or blend into marinades and rubs. The batch code on every jar traces it back to the farm cluster and the milling run.',
    ingredients:
      'Single plant, single origin. No fillers, flow agents or added salt — the ingredient list is one line long.',
    nutrition:
      'Energy: [PLACEHOLDER] kcal\nProtein: [PLACEHOLDER] g\nCarbohydrate: [PLACEHOLDER] g\nFibre: [PLACEHOLDER] g\nFat: [PLACEHOLDER] g\nSalt: 0 g (none added)\n\nFull nutrition panel pending third-party lab data.',
    origin:
      'Leaves, roots and berries are bought directly from partner growers across the mid-hills of Nepal, dried at the facility and milled in small, dated batches. Each lot is inspected before milling and the jar is batch-coded to the grower cluster.',
    storage:
      'Keep the jar tightly closed in a cool, dry place. Use a dry spoon every time — moisture is the enemy of powder. Best within [N] months of opening.',
    rehydrate:
      'Usage: Start with ½–1 teaspoon per serving. Stir into smoothies, dals, soups and warm water, or blend into marinades, rubs and salad dressings.\n\nRecipes: Whisk into batter for rotis and pancakes, bloom in hot ghee for tempering, or shake with honey and lemon for a quick tonic.',
  },
};

/** Shared defaults, independent of process category. */
const BASE_DEFAULTS: Record<string, string> = {
  badge: 'Best seller',
  availability: 'In stock',
  'shelf-life': '18 months, unopened',
};

/**
 * Prefill values for the editor, mirroring what the live storefront page
 * currently renders for this product's process category. Fields the user
 * has already saved always win over these defaults.
 */
export function getProductFieldDefaults(processCategory?: string | null): Record<string, string> {
  return { ...BASE_DEFAULTS, ...KIND_DEFAULTS[processKindOf(processCategory)] };
}
