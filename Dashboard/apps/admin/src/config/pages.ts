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

export const SITE_PAGES: SitePage[] = [
  {
    slug: 'home',
    name: 'Home',
    route: 'index.html',
    previewPath: '/',
    badge: 'Marketing',
    description: 'The landing page — hero, benefits strip and calls to action.',
    sections: [
      {
        key: 'home.hero',
        label: 'Hero',
        description: 'Eyebrow, headline, sub-line and primary call to action.',
      },
      {
        key: 'home.benefits',
        label: 'Benefits strip',
        description: '“Why freeze-dried” highlights shown beneath the hero.',
      },
      {
        key: 'home.cta',
        label: 'Call to action',
        description: 'Closing band encouraging the visitor to shop or go wholesale.',
      },
    ],
  },
  {
    slug: 'shop',
    name: 'Shop',
    route: 'shop.html',
    previewPath: '/shop.html',
    badge: 'Catalogue',
    description: 'Product catalogue — hero heading, intro filters and category prompts.',
    sections: [
      {
        key: 'page.shop.hero',
        label: 'Catalogue hero',
        description: 'Headline, one-line summary and the hero call to action.',
      },
      {
        key: 'page.shop.intro',
        label: 'Intro',
        description: 'Section heading shown above the product grid.',
      },
    ],
  },
  {
    slug: 'why-we-freeze',
    name: 'Why We Freeze',
    route: 'process.html',
    previewPath: '/process.html',
    badge: 'Story',
    description: '“Why freeze-dried, not just dried.” — the freeze-drying explainer.',
    sections: [
      {
        key: 'page.process.hero',
        label: 'Hero',
        description: 'The science headline and supporting description.',
      },
      {
        key: 'page.process.steps',
        label: 'Steps intro',
        description: '“From harvest to sealed pack” step-by-step section heading.',
      },
      {
        key: 'page.process.compare',
        label: 'Comparison',
        description: 'Drying-method comparison table heading.',
      },
      {
        key: 'page.process.cta',
        label: 'Call to action',
        description: '“Taste the difference yourself.” closing band.',
      },
    ],
  },
  {
    slug: 'our-story',
    name: 'Our Story',
    route: 'story.html',
    previewPath: '/story.html',
    badge: 'Story',
    description: 'Brand origin story — hero, stats and timeline narrative.',
    sections: [
      {
        key: 'page.story.hero',
        label: 'Hero',
        description: 'The “Built on the same trust Aama already had.” headline.',
      },
      {
        key: 'page.story.timeline',
        label: 'Timeline heading',
        description: 'Heading introducing the milestones timeline.',
      },
    ],
  },
  {
    slug: 'wholesale',
    name: 'Wholesale',
    route: 'wholesale.html',
    previewPath: '/wholesale.html',
    badge: 'B2B',
    description: 'B2B onboarding — pricing tiers, sample kits, private label and access.',
    sections: [
      {
        key: 'page.wholesale.hero',
        label: 'Hero',
        description: 'B2B headline and value proposition strip.',
      },
      {
        key: 'page.wholesale.pricing',
        label: 'Pricing tiers',
        description: 'Wholesale pricing table heading.',
      },
      {
        key: 'page.wholesale.samples',
        label: 'Sample kits',
        description: '“Try before you commit” sample-kit section.',
      },
      {
        key: 'page.wholesale.access',
        label: 'Request access',
        description: 'Final “Get started” access-request section.',
      },
    ],
  },
  {
    slug: 'journal',
    name: 'Journal / Learn',
    route: 'journal.html',
    previewPath: '/journal.html',
    badge: 'Content',
    description: 'The blog and resources hub — hero, latest articles and FAQ.',
    sections: [
      {
        key: 'page.journal.hero',
        label: 'Hero',
        description: '“From Aama’s notebook.” headline and intro.',
      },
      {
        key: 'page.journal.faq',
        label: 'FAQ',
        description: 'Frequently-asked questions section heading.',
      },
      {
        key: 'page.journal.contact',
        label: 'Contact',
        description: 'Closing “Get in touch” section.',
      },
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