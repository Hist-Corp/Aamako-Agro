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
  type: 'text' | 'textarea' | 'richtext' | 'number' | 'url' | 'select' | 'image';
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
// (Frontend/product.html): name & breadcrumb → price & pack → image →
// description → ingredients → nutrition → sourcing → storage → usage.
export const PRODUCT_TEMPLATE_SECTIONS: ProductTemplateSection[] = [
  {
    label: 'Basic info',
    description: 'Product name, category and badge shown on the product card.',
    icon: 'Tag',
    storefront: 'Page header & breadcrumb',
    fields: [
      { key: 'name', label: 'Product name', description: 'The display name shown on the product page and card.', type: 'text', required: true, placeholder: 'e.g. Freeze-Dried Mango' },
      { key: 'slug', label: 'URL slug', description: 'Kebab-case identifier used in the product page URL.', type: 'text', required: true, placeholder: 'e.g. fd-mango' },
      { key: 'badge', label: 'Badge', description: 'Small tag shown on the product card (e.g. Best seller, New).', type: 'text', placeholder: 'e.g. Best seller' },
      { key: 'category', label: 'Category', description: 'Product category for the shop filter.', type: 'select', required: true, options: [{ value: 'fruits', label: 'Fruits' }, { value: 'vegetables', label: 'Vegetables' }, { value: 'spices', label: 'Spices & Powders' }, { value: 'meals', label: 'Ready Meals' }, { value: 'gifts', label: 'Gift Sets' }] },
      { key: 'process-category', label: 'Process Category', description: 'Links this product to its storefront category page (Freeze-Dried Fruits, Dehydrated Fruits & Vegetables or Milled Powders) and creates a product card on that page.', type: 'select', required: true, options: [{ value: 'freeze-dried-fruits', label: 'Freeze-Dried Fruits' }, { value: 'dehydrated', label: 'Dehydrated Fruits & Vegetables' }, { value: 'powders', label: 'Milled Powders' }] },
      { key: 'batch-no', label: 'Batch no', description: 'Production batch number for traceability (shown on the product page).', type: 'text', placeholder: 'e.g. BATCH-2026-014' },
    ],
  },
  {
    label: 'Pricing & availability',
    description: 'Price, pack size, stock status and shelf life.',
    fields: [
      { key: 'price', label: 'Base price (Rs)', description: 'Selling price in Nepalese rupees.', type: 'number', required: true, placeholder: '450' },
      { key: 'pack', label: 'Pack size', description: 'Size/weight of the pack (e.g. 50g pouch).', type: 'text', required: true, placeholder: 'e.g. 50g pouch' },
      { key: 'availability', label: 'Availability', description: 'Stock status shown to customers.', type: 'select', required: true, options: [{ value: 'In stock', label: 'In stock' }, { value: 'Low stock', label: 'Low stock' }, { value: 'Out of stock', label: 'Out of stock' }, { value: 'Pre-order', label: 'Pre-order' }] },
      { key: 'shelf-life', label: 'Shelf life', description: 'Shelf life description (unopened).', type: 'text', placeholder: 'e.g. 18 months, unopened' },
    ],
  },
  {
    label: 'Descriptions',
    description: 'Headline description and rich-text long description.',
    fields: [
      { key: 'description', label: 'Short description', description: 'One-line summary shown below the product name.', type: 'textarea', required: true, placeholder: 'e.g. Ripe mango, sliced and freeze-dried within hours of harvest.' },
      { key: 'long-description', label: 'Long description', description: 'Full rich-text description — formatting, lists, links supported.', type: 'richtext', placeholder: 'Detailed product description...' },
    ],
  },
  {
    label: 'Product image',
    description: 'High-resolution product image (https:// required).',
    fields: [
      { key: 'image-url', label: 'Product image', description: 'Paste a secure https:// image link OR upload one from your device — at least one is required.', type: 'image', required: true, placeholder: 'https://images.unsplash.com/...' },
    ],
  },
  {
    label: 'Ingredients & allergens',
    description: 'Full ingredients list and allergen statement.',
    fields: [
      { key: 'ingredients', label: 'Ingredients & allergens', description: 'Complete ingredients list and allergen information.', type: 'richtext', placeholder: 'e.g. 100% freeze-dried mango. No added sugar, preservatives or colouring.' },
    ],
  },
  {
    label: 'Nutrition',
    description: 'Nutritional information (per 100g).',
    fields: [
      { key: 'nutrition', label: 'Nutrition (per 100g)', description: 'Nutritional breakdown — energy, carbs, sugar, fibre, protein, fat.', type: 'richtext', placeholder: 'e.g. Energy: 347kcal, Carbs: 82g, Sugar: 67g...' },
    ],
  },
  {
    label: 'Origin & sourcing',
    description: 'Where the product comes from and how it is sourced.',
    fields: [
      { key: 'origin', label: 'Origin & sourcing', description: 'Sourcing story and origin details.', type: 'richtext', placeholder: 'e.g. Sourced from partner growers in the Terai region of Nepal.' },
    ],
  },
  {
    label: 'Storage & shelf life',
    description: 'How to store the product and shelf life after opening.',
    fields: [
      { key: 'storage', label: 'Storage & shelf life', description: 'Storage instructions and post-opening shelf life.', type: 'richtext', placeholder: 'e.g. Store in a cool, dry place. Reseal after opening.' },
    ],
  },
  {
    label: 'How to rehydrate',
    description: 'Step-by-step rehydration instructions.',
    fields: [
      { key: 'rehydrate', label: 'How to rehydrate', description: 'Rehydration steps shown on the product page.', type: 'richtext', placeholder: 'e.g. 1. Cover with hot water. 2. Wait 5–10 minutes. 3. Drain and enjoy.' },
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
