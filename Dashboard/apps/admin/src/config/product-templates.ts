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
  type: 'text' | 'textarea' | 'richtext' | 'number' | 'url' | 'select';
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
}

export interface ProductTemplateSection {
  label: string;
  description: string;
  fields: ProductTemplateField[];
}

export const PRODUCT_TEMPLATE_SECTIONS: ProductTemplateSection[] = [
  {
    label: 'Basic info',
    description: 'Product name, category and badge shown on the product card.',
    fields: [
      { key: 'name', label: 'Product name', description: 'The display name shown on the product page and card.', type: 'text', required: true, placeholder: 'e.g. Freeze-Dried Mango' },
      { key: 'slug', label: 'URL slug', description: 'Kebab-case identifier used in the product page URL.', type: 'text', required: true, placeholder: 'e.g. fd-mango' },
      { key: 'badge', label: 'Badge', description: 'Small tag shown on the product card (e.g. Best seller, New).', type: 'text', placeholder: 'e.g. Best seller' },
      { key: 'category', label: 'Category', description: 'Product category for the shop filter.', type: 'select', required: true, options: [{ value: 'fruits', label: 'Fruits' }, { value: 'vegetables', label: 'Vegetables' }, { value: 'spices', label: 'Spices & Powders' }, { value: 'meals', label: 'Ready Meals' }, { value: 'gifts', label: 'Gift Sets' }] },
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
      { key: 'image-url', label: 'Image URL', description: 'Secure https:// link to a high-resolution product image (min 1000px wide).', type: 'url', required: true, placeholder: 'https://images.unsplash.com/...' },
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
