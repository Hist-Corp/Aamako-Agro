// ─── Website Page Template Catalog ──────────────────────────────────────
// Each top-level site page on the public storefront is exposed here as an
// editable "template" made up of one or more editable sections. Every section
// maps 1:1 to a ContentItem in the backend (keyed like "page.shop.hero"),
// edited through the shared content API (/content/manage, PUT /content/:key).
//
// The Pages screens render a LIVE preview of the real website page alongside
// the editable template so editors can see their changes in context.

export interface PageTemplateSection {
  /** ContentItem key this section is backed by (auto-created on first save). */
  key: string;
  /** Short label shown in the section list, e.g. "Hero". */
  label: string;
  description: string;
  /** Optional group heading used to organise long section lists. */
  group?: string;
}

export interface SitePage {
  slug: string;
  name: string;
  route: string;
  /** Path appended to the storefront base URL for the live preview iframe. */
  previewPath: string;
  description: string;
  badge: string;
  sections: PageTemplateSection[];
}

/**
 * Base URL of the public storefront used for the live page preview.
 * Configure once per deploy (or rely on the localhost development default).
 */
export const STOREFRONT_URL =
  process.env.NEXT_PUBLIC_STOREFRONT_URL ??
  'http://localhost:8080';

/** Build a full URL to a real website page for live previewing. */
export function storefrontUrl(page: Pick<SitePage, 'previewPath'>): string {
  const base = STOREFRONT_URL.replace(/\/+$/, '');
  const path = page.previewPath === '/' ? '/' : `/${page.previewPath.replace(/^\/+/, '')}`;
  return `${base}${path}`;
}

// Convenience builders for repeated section patterns -------------------------
const trustBar = (): PageTemplateSection[] =>
  [1, 2, 3].map((n) => ({
    key: `site.trust.${n}`,
    label: `Bar text ${n}`,
    description:
      n === 1
        ? 'Facility / compliance line in the top strip of every page.'
        : n === 2
          ? 'Origin line in the top strip of every page.'
          : 'Quality promise line in the top strip of every page.',
    group: 'Top bar (global)',
  }));

const statSection = (
  key: string,
  label: string,
  group: string,
  desc = 'Statistic number (title) and caption (short) shown in this block.',
): PageTemplateSection => ({ key, label, description: desc, group });

export const SITE_PAGES: SitePage[] = [
  {
    slug: 'home',
    name: 'Home',
    route: 'index.html',
    previewPath: '/',
    badge: 'Marketing',
    description: 'The landing page — every block from the trust bar to the newsletter is editable.',
    sections: [
      ...trustBar(),
      { key: 'home.hero.eyebrow', label: 'Eyebrow', description: 'Small line above the hero headline.', group: 'Hero' },
      { key: 'home.hero', label: 'Headline & sub-line', description: 'Hero headline (title) and the paragraph under it (short).', group: 'Hero' },
      { key: 'home.hero.cta1', label: 'Primary button', description: '“Shop the range” button label.', group: 'Hero' },
      { key: 'home.hero.cta2', label: 'Secondary button', description: '“Wholesale & bulk” button label.', group: 'Hero' },
      { key: 'home.categories.title', label: 'Heading', description: '“With love, from Aama’s kitchen” heading.', group: 'Categories grid' },
      { key: 'home.categories', label: 'Sub-line', description: 'Description under the heading.', group: 'Categories grid' },
      ...([1, 2, 3, 4] as const).map((n): PageTemplateSection => ({
        key: `home.categories.card${n}`,
        label: `Card ${n}`,
        description: 'Category card name (title) and products count line (short).',
        group: 'Categories grid',
      })),
      { key: 'home.why.eyebrow', label: 'Eyebrow', description: '“Why freeze-dried” tag line.', group: 'Why freeze-dried' },
      { key: 'home.why', label: 'Headline & body', description: '“Less water. Same food.” headline and supporting paragraph.', group: 'Why freeze-dried' },
      statSection('home.why.farmers', 'Stat — farmers', 'Why freeze-dried'),
      statSection('home.why.shelf', 'Stat — shelf life', 'Why freeze-dried'),
      statSection('home.why.nutrients', 'Stat — nutrients', 'Why freeze-dried'),
      { key: 'home.why.link', label: 'Link', description: '“See the full process” link label.', group: 'Why freeze-dried' },
      { key: 'home.tear', label: 'Divider text', description: 'The dotted tear-strip caption between sections.', group: 'Divider' },
      { key: 'home.bestsellers.title', label: 'Heading', description: '“Our best sellers” heading.', group: 'Best sellers' },
      { key: 'home.bestsellers', label: 'Sub-line', description: 'Description under the heading.', group: 'Best sellers' },
      { key: 'home.bestsellers.link', label: 'Shop-all link', description: '“Shop best sellers” link label.', group: 'Best sellers' },
      ...([1, 2, 3, 4] as const).map((n): PageTemplateSection => ({
        key: `home.bestsellers.card${n}`,
        label: `Product ${n}`,
        description: 'Product card name (title) and meta line (short).',
        group: 'Best sellers',
      })),
      { key: 'home.gallery.title', label: 'Heading', description: '“From farm to your hands” heading.', group: 'Gallery' },
      { key: 'home.gallery', label: 'Sub-line', description: 'Description under the gallery heading.', group: 'Gallery' },
      ...([1, 2, 3, 4, 5] as const).map((n): PageTemplateSection => ({
        key: `home.gallery.label${n}`,
        label: `Photo label ${n}`,
        description: 'Caption shown over the gallery photo.',
        group: 'Gallery',
      })),
      { key: 'home.wholesale.eyebrow', label: 'Eyebrow', description: '“For retailers & distributors” tag line.', group: 'Wholesale band' },
      { key: 'home.wholesale', label: 'Headline & body', description: '“Built for shelves…” headline and paragraph.', group: 'Wholesale band' },
      { key: 'home.wholesale.items', label: 'Feature list', description: 'The bullet list (rich text, one line per feature).', group: 'Wholesale band' },
      { key: 'home.wholesale.cta1', label: 'Primary button', description: '“Request wholesale access” label.', group: 'Wholesale band' },
      { key: 'home.wholesale.cta2', label: 'Secondary button', description: '“Download catalogue” label.', group: 'Wholesale band' },
      { key: 'home.trace.eyebrow', label: 'Eyebrow', description: '“Traceability” tag line.', group: 'Traceability' },
      { key: 'home.trace', label: 'Headline & body', description: '“Proof in every pack…” headline and paragraph.', group: 'Traceability' },
      { key: 'home.trace.batch.batch', label: 'Batch row value', description: 'Value shown on the “Batch” row of the trace card.', group: 'Traceability' },
      { key: 'home.trace.batch.source', label: 'Source row value', description: 'Value shown on the “Source” row.', group: 'Traceability' },
      { key: 'home.trace.batch.processed', label: 'Processed row value', description: 'Value shown on the “Processed” row.', group: 'Traceability' },
      { key: 'home.trace.batch.quality', label: 'Quality row value', description: 'Value shown on the “Quality check” row.', group: 'Traceability' },
      { key: 'home.trace.link', label: 'Link', description: '“Meet the people behind the batch” link label.', group: 'Traceability' },
      { key: 'home.reviews.title', label: 'Heading', description: 'Reviews section heading.', group: 'Reviews' },
      { key: 'home.reviews.r1', label: 'Review 1', description: 'Quote (title) and attribution line (short).', group: 'Reviews' },
      { key: 'home.reviews.r2', label: 'Review 2', description: 'Quote (title) and attribution line (short).', group: 'Reviews' },
      { key: 'home.reviews.r3', label: 'Review 3', description: 'Quote (title) and attribution line (short).', group: 'Reviews' },
      { key: 'home.newsletter', label: 'Heading & sub-line', description: 'Newsletter band heading and description.', group: 'Newsletter' },
      { key: 'home.newsletter.button', label: 'Button', description: '“Subscribe” button label.', group: 'Newsletter' },
    ],
  },
  {
    slug: 'shop',
    name: 'Shop',
    route: 'shop.html',
    previewPath: '/shop.html',
    badge: 'Catalogue',
    description: 'Product catalogue — the hero slider copy is editable; the product grid itself comes from the catalogue.',
    sections: [
      ...([1, 2, 3, 4, 5] as const).flatMap((n): PageTemplateSection[] => [
        {
          key: `page.shop.slide${n}.eyebrow`,
          label: `Slide ${n} — eyebrow`,
          description: 'Small tag line above the slide headline.',
          group: `Hero slide ${n}`,
        },
        {
          key: `page.shop.slide${n}`,
          label: `Slide ${n} — headline & sub-line`,
          description: 'Slide headline (title) and the paragraph under it (short).',
          group: `Hero slide ${n}`,
        },
        {
          key: `page.shop.slide${n}.btn`,
          label: `Slide ${n} — button`,
          description: 'The slide’s call-to-action button label.',
          group: `Hero slide ${n}`,
        },
      ]),
    ],
  },
  {
    slug: 'product',
    name: 'Product Detail',
    route: 'product.html',
    previewPath: '/product.html',
    badge: 'Catalogue',
    description:
      'The product detail page — title, price, pack info and the five accordions. (Prices/images per product come from the catalogue; this template edits the static copy around them.)',
    sections: [
      { key: 'product-page.highlights', label: 'Key highlights heading', description: 'The “Key Highlights” heading above the highlights list.', group: 'Buy box' },
      { key: 'product-page.pack', label: 'Pack size label', description: 'The “Pack size” row label (the value comes from the catalogue).', group: 'Buy box' },
      { key: 'product-page.availability', label: 'Availability label', description: 'The “Availability” row label (the value is computed live).', group: 'Buy box' },
      { key: 'product-page.sku', label: 'SKU label', description: 'The “SKU” row label (the value comes from the catalogue).', group: 'Buy box' },
      { key: 'product-page.cta1', label: 'Add to cart button', description: 'The primary “Add to cart” button label.', group: 'Buy box' },
      { key: 'product-page.cta2', label: 'Buy now button', description: 'The “Buy now” button label.', group: 'Buy box' },
      { key: 'product-page.tear', label: 'Traceability caption', description: 'The “Batch traceability” tear-strip caption above the batch card.', group: 'Traceability' },
      { key: 'product-page.tab.desc', label: 'Tab — Description', description: 'Description tab label.', group: 'Tabs' },
      { key: 'product-page.tab.howto', label: 'Tab — How to use', description: 'How-to-use tab label.', group: 'Tabs' },
      { key: 'product-page.tab.nutrition', label: 'Tab — Nutrition', description: 'Nutrition tab label.', group: 'Tabs' },
      { key: 'product-page.tab.certs', label: 'Tab — Certifications', description: 'Certifications tab label.', group: 'Tabs' },
      { key: 'product-page.tab.why', label: 'Tab — Why choose', description: 'Why-choose tab label.', group: 'Tabs' },
      { key: 'product-page.tab.sourcing', label: 'Tab — Sourcing', description: 'Sourcing tab label.', group: 'Tabs' },
      { key: 'product-page.faq.title', label: 'FAQ heading', description: 'The “Frequently asked” heading.', group: 'Sections' },
      { key: 'product-page.reviews.title', label: 'Reviews heading', description: 'The “Reviews” section heading.', group: 'Sections' },
      { key: 'product-page.related.title', label: 'Related heading', description: 'The “You might also like” heading above related products.', group: 'Sections' },
    ],
  },
  {
    slug: 'why-we-freeze',
    name: 'Why We Freeze',
    route: 'process.html',
    previewPath: '/process.html',
    badge: 'Story',
    description: '“Why freeze-dried, not just dried.” — hero stats, all six steps, comparison and CTA.',
    sections: [
      ...trustBar(),
      { key: 'page.process.hero.eyebrow', label: 'Eyebrow', description: '“The science of less” tag line.', group: 'Hero' },
      { key: 'page.process.hero', label: 'Headline & sub-line', description: 'Hero headline (title) and paragraph (short).', group: 'Hero' },
      statSection('page.process.stat1', 'Stat 1', 'Hero stats'),
      statSection('page.process.stat2', 'Stat 2', 'Hero stats'),
      statSection('page.process.stat3', 'Stat 3', 'Hero stats'),
      { key: 'page.process.steps.eyebrow', label: 'Eyebrow', description: '“Step by step” tag line.', group: 'Process steps' },
      { key: 'page.process.steps', label: 'Heading & sub-line', description: '“From harvest to sealed pack” heading and description.', group: 'Process steps' },
      ...([1, 2, 3, 4, 5, 6] as const).map((n): PageTemplateSection => ({
        key: `page.process.step${n}`,
        label: `Step ${n}`,
        description: 'Step name (title) and description (short).',
        group: 'Process steps',
      })),
      { key: 'page.process.compare.tear', label: 'Divider text', description: 'The dotted tear-strip caption between sections.', group: 'Comparison' },
      { key: 'page.process.compare', label: 'Heading & sub-line', description: 'Comparison section heading and description.', group: 'Comparison' },
      { key: 'page.process.compare.good', label: 'Freeze-dried column', description: 'Column title (title) and blurb (short).', group: 'Comparison' },
      { key: 'page.process.compare.good.stats', label: 'Freeze-dried stats', description: 'Stat numbers/captions for the freeze-dried column (rich text).', group: 'Comparison' },
      { key: 'page.process.compare.bad', label: 'Sun/heat-dried column', description: 'Column title (title) and blurb (short).', group: 'Comparison' },
      { key: 'page.process.compare.bad.stats', label: 'Dried stats', description: 'Stat numbers/captions for the sun/heat column (rich text).', group: 'Comparison' },
      { key: 'page.process.cta.eyebrow', label: 'Eyebrow', description: '“Ready to try it?” tag line.', group: 'Call to action' },
      { key: 'page.process.cta', label: 'Headline & sub-line', description: '“Taste the difference yourself.” heading and paragraph.', group: 'Call to action' },
      { key: 'page.process.cta.btn1', label: 'Primary button', description: '“Shop the range” label.', group: 'Call to action' },
      { key: 'page.process.cta.btn2', label: 'Secondary button', description: '“Read more guides” label.', group: 'Call to action' },
    ],
  },
  {
    slug: 'our-story',
    name: 'Our Story',
    route: 'story.html',
    previewPath: '/story.html',
    badge: 'Story',
    description: 'Brand origin story — hero, stats, values, timeline, team and contact band.',
    sections: [
      ...trustBar(),
      { key: 'page.story.hero.eyebrow', label: 'Eyebrow', description: '“Who we are” tag line.', group: 'Hero' },
      { key: 'page.story.hero', label: 'Headline & sub-line', description: 'Hero headline (title) and paragraph (short).', group: 'Hero' },
      statSection('page.story.stat1', 'Stat 1', 'Hero stats'),
      statSection('page.story.stat2', 'Stat 2', 'Hero stats'),
      statSection('page.story.stat3', 'Stat 3', 'Hero stats'),
      { key: 'page.story.origin.eyebrow', label: 'Eyebrow', description: '“The beginning” tag line.', group: 'Origin' },
      { key: 'page.story.origin', label: 'Headline & body', description: 'Origin headline (title) and story paragraphs (short).', group: 'Origin' },
      { key: 'page.story.tear', label: 'Divider text', description: 'The dotted tear-strip caption between sections.', group: 'Divider' },
      { key: 'page.story.values.title', label: 'Heading', description: '“Our values” heading.', group: 'Values' },
      { key: 'page.story.values', label: 'Sub-line', description: 'Description under the values heading.', group: 'Values' },
      ...([1, 2, 3, 4] as const).map((n): PageTemplateSection => ({
        key: `page.story.value${n}`,
        label: `Value ${n}`,
        description: 'Value name (title) and text (short).',
        group: 'Values',
      })),
      { key: 'page.story.sourcing.title', label: 'Heading', description: '“Where we source” heading.', group: 'Sourcing' },
      { key: 'page.story.sourcing', label: 'Sub-line', description: 'Description under the sourcing heading.', group: 'Sourcing' },
      { key: 'page.story.sourcing.eyebrow', label: 'Eyebrow', description: '“Sourcing regions” tag line.', group: 'Sourcing' },
      { key: 'page.story.sourcing.head', label: 'Block headline & text', description: '“[N] farms across [N] districts.” headline and paragraph.', group: 'Sourcing' },
      ...([1, 2, 3, 4] as const).map((n): PageTemplateSection => ({
        key: `page.story.sourcing.row${n}`,
        label: `Detail row ${n}`,
        description: 'Value shown on this row of the sourcing detail card.',
        group: 'Sourcing',
      })),
      { key: 'page.story.team.title', label: 'Heading', description: 'Team section heading.', group: 'Team' },
      { key: 'page.story.team', label: 'Sub-line', description: 'Description under the team heading.', group: 'Team' },
      ...([1, 2, 3, 4] as const).map((n): PageTemplateSection => ({
        key: `page.story.member${n}`,
        label: `Member ${n}`,
        description: 'Team member name (title) and role (short).',
        group: 'Team',
      })),
      { key: 'page.story.newsletter', label: 'Heading & sub-line', description: '“Want the full story?” band heading and text.', group: 'Contact band' },
      { key: 'page.story.newsletter.btn1', label: 'Primary button', description: '“Wholesale inquiry” label.', group: 'Contact band' },
      { key: 'page.story.newsletter.btn2', label: 'Secondary button', description: '“Contact us” label.', group: 'Contact band' },
    ],
  },
  {
    slug: 'wholesale',
    name: 'Wholesale',
    route: 'wholesale.html',
    previewPath: '/wholesale.html',
    badge: 'B2B',
    description: 'B2B onboarding — hero, pricing tiers, sample kits and the access form band.',
    sections: [
      ...trustBar(),
      { key: 'page.wholesale.hero.eyebrow', label: 'Eyebrow', description: '“For retailers, distributors & food service” tag line.', group: 'Hero' },
      { key: 'page.wholesale.hero', label: 'Headline & sub-line', description: 'Hero headline (title) and paragraph (short).', group: 'Hero' },
      { key: 'page.wholesale.hero.cta1', label: 'Primary button', description: '“Get wholesale pricing” label.', group: 'Hero' },
      { key: 'page.wholesale.hero.cta2', label: 'Secondary button', description: '“View full catalogue” label.', group: 'Hero' },
      { key: 'page.wholesale.pricing', label: 'Heading & sub-line', description: '“Wholesale pricing” heading and description.', group: 'Pricing tiers' },
      ...([1, 2, 3] as const).flatMap((n): PageTemplateSection[] => [
        { key: `page.wholesale.tier${n}`, label: `Tier ${n}`, description: 'Tier name (title) and description (short).', group: 'Pricing tiers' },
        { key: `page.wholesale.tier${n}.moq`, label: `Tier ${n} — MOQ`, description: 'Minimum-order quantity line.', group: 'Pricing tiers' },
        { key: `page.wholesale.tier${n}.features`, label: `Tier ${n} — features`, description: 'Feature list (rich text, one line per feature).', group: 'Pricing tiers' },
        { key: `page.wholesale.tier${n}.btn`, label: `Tier ${n} — button`, description: 'Call-to-action button label.', group: 'Pricing tiers' },
      ]),
      { key: 'page.wholesale.tear', label: 'Divider text', description: 'The dotted tear-strip caption between sections.', group: 'Sample kits' },
      { key: 'page.wholesale.samples.eyebrow', label: 'Eyebrow', description: '“Sample kits” tag line.', group: 'Sample kits' },
      { key: 'page.wholesale.samples', label: 'Headline & body', description: '“Try before you commit.” heading and paragraph.', group: 'Sample kits' },
      { key: 'page.wholesale.samples.items', label: 'Kit contents list', description: 'The sample-kit bullet list (rich text).', group: 'Sample kits' },
      { key: 'page.wholesale.prlabel.head', label: 'Heading & sub-line', description: '“Private label & custom production” heading and description.', group: 'Private label' },
      { key: 'page.wholesale.prlabel.eyebrow', label: 'Eyebrow', description: '“Your brand, our process” tag line.', group: 'Private label' },
      { key: 'page.wholesale.prlabel', label: 'Headline & body', description: 'Private-label block headline and paragraph.', group: 'Private label' },
      { key: 'page.wholesale.prlabel.btn', label: 'Button', description: '“Inquire about private label” label.', group: 'Private label' },
      { key: 'page.wholesale.catalogue', label: 'Heading & sub-line', description: '“Full catalogue” heading and description (B2B-only table).', group: 'Catalogue & certifications' },
      { key: 'page.wholesale.certs.title', label: 'Certifications heading', description: '“Certifications & compliance” heading.', group: 'Catalogue & certifications' },
      { key: 'page.wholesale.certs', label: 'Certifications sub-line', description: 'Description under the certifications heading.', group: 'Catalogue & certifications' },
      ...([1, 2, 3] as const).map((n): PageTemplateSection => ({
        key: `page.wholesale.cert${n}`,
        label: `Certification ${n}`,
        description: 'Certification name (title) and details (short).',
        group: 'Catalogue & certifications',
      })),
      { key: 'page.wholesale.access.eyebrow', label: 'Eyebrow', description: '“Get started” tag line.', group: 'Request access' },
      { key: 'page.wholesale.access', label: 'Headline & sub-line', description: '“Request wholesale access” heading and description.', group: 'Request access' },
      { key: 'page.wholesale.access.btn', label: 'Submit button', description: '“Submit inquiry” button label.', group: 'Request access' },
    ],
  },
  {
    slug: 'journal',
    name: 'Journal / Learn',
    route: 'journal.html',
    previewPath: '/journal.html',
    badge: 'Content',
    description: 'The blog and resources hub — hero, stats, article cards, FAQ and contact.',
    sections: [
      ...trustBar(),
      { key: 'page.journal.hero.eyebrow', label: 'Eyebrow', description: '“Recipes, guides & the journal” tag line.', group: 'Hero' },
      { key: 'page.journal.hero', label: 'Headline & sub-line', description: '“From Aama’s notebook.” headline and intro.', group: 'Hero' },
      statSection('page.journal.stat1', 'Stat 1', 'Hero stats'),
      statSection('page.journal.stat2', 'Stat 2', 'Hero stats'),
      statSection('page.journal.stat3', 'Stat 3', 'Hero stats'),
      ...([1, 2, 3] as const).map((n): PageTemplateSection => ({
        key: `page.journal.article${n}`,
        label: `Article ${n}`,
        description: 'Article headline (title) and meta line (short).',
        group: 'Articles',
      })),
      { key: 'page.journal.faq', label: 'Heading & sub-line', description: 'FAQ section heading and description.', group: 'FAQ' },
      ...([1, 2, 3, 4, 5] as const).map((n): PageTemplateSection => ({
        key: `page.journal.faq.q${n}`,
        label: `Question ${n}`,
        description: 'Question (title) and answer (short).',
        group: 'FAQ',
      })),
      { key: 'page.journal.contact.eyebrow', label: 'Eyebrow', description: '“Get in touch” tag line.', group: 'Contact' },
      { key: 'page.journal.contact', label: 'Headline & body', description: '“Questions? We’re listening.” heading and text.', group: 'Contact' },
      { key: 'page.journal.contact.btn', label: 'Submit button', description: '“Send message” button label.', group: 'Contact' },
    ],
  },
];

export function getSitePage(slug: string): SitePage | undefined {
  return SITE_PAGES.find((p) => p.slug === slug);
}

export function getSitePageByKey(key: string): SitePage | undefined {
  return SITE_PAGES.find((p) => p.sections.some((s) => s.key === key));
}
/** Roles allowed to manage the Pages section (Manager / Content Manager / Admin / Super Admin). */
export const PAGES_ALLOWED_ROLES = [
  'MANAGER',
  'STAFF_MANAGER',
  'CONTENT_MANAGER',
  'ADMIN',
  'STAFF_ADMIN',
  'SUPER_ADMIN',
] as const;