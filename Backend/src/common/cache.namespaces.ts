/**
 * Cache namespaces and TTLs for the response cache. Kept in one place so the
 * read sites (caching) and write sites (invalidation via `bump`) always refer
 * to the same namespace strings.
 */
export const CacheNamespaces = {
  /** Paginated storefront product listings (GET /catalog/products). */
  PRODUCTS: 'catalog:products',
  /** Category list (GET /catalog/categories). */
  CATEGORIES: 'catalog:categories',
  /** Single product detail (GET /catalog/products/:idOrSlug). */
  PRODUCT: 'catalog:product',
  /** Live published content feed (GET /content). */
  CONTENT: 'content:live',
  /** Public media feed (GET /media). */
  MEDIA: 'media:public',
} as const;

export const CacheTtls = {
  /** Products can change often (inventory/stock) — keep it short. */
  PRODUCTS_SECONDS: 30,
  CATEGORIES_SECONDS: 300,
  PRODUCT_SECONDS: 30,
  CONTENT_SECONDS: 60,
  MEDIA_SECONDS: 60,
} as const;