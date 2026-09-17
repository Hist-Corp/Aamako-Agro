import { CacheControlInterceptor } from './cache-control.interceptor';

/**
 * Regression guard for the public-route Cache-Control whitelist.
 *
 * The whitelist originally listed `/api/catalog/products`, a path that does not
 * exist (the catalog controller is `@Controller()` + `@Get('products')`, i.e.
 * `/api/products`). Nothing failed — the headers were simply never applied — so
 * these tests pin the patterns to the real served routes.
 */
function run(path: string, method = 'GET', preset?: string) {
  const headers: Record<string, string> = preset ? { 'Cache-Control': preset } : {};
  const req: any = { method, originalUrl: path, url: path };
  const res: any = {
    getHeader: (name: string) => headers[name],
    setHeader: (name: string, value: string) => {
      headers[name] = value;
    },
  };
  const context: any = {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  };
  const next: any = { handle: () => ({ pipe: () => undefined }) };
  new CacheControlInterceptor().intercept(context, next);
  return headers['Cache-Control'];
}

describe('CacheControlInterceptor', () => {
  it('caches the public catalog list and detail routes', () => {
    expect(run('/api/products')).toContain('public, max-age=60');
    expect(run('/api/products/power-fruits-powder')).toContain('public, max-age=60');
  });

  it('gives the slow-moving category list a longer TTL', () => {
    expect(run('/api/categories')).toContain('public, max-age=300');
  });

  it('caches the published content and media lists', () => {
    expect(run('/api/content')).toContain('public, max-age=60');
    expect(run('/api/media')).toContain('public, max-age=60');
  });

  it('strips the query string before matching', () => {
    expect(run('/api/products?page=2&limit=20')).toContain('public, max-age=60');
  });

  it('never caches admin, auth or user-specific routes', () => {
    expect(run('/api/admin/products')).toBeUndefined();
    expect(run('/api/admin/users')).toBeUndefined();
    expect(run('/api/auth/me')).toBeUndefined();
    expect(run('/api/orders/mine')).toBeUndefined();
    expect(run('/api/cart')).toBeUndefined();
  });

  it('never caches a prefix that merely starts with a public route', () => {
    // `/api/categories` is public; `/api/categories-admin` must not inherit it.
    expect(run('/api/categories-admin')).toBeUndefined();
    expect(run('/api/products-internal')).toBeUndefined();
  });

  it('ignores non-GET methods so mutations cannot be cached', () => {
    expect(run('/api/products', 'POST')).toBeUndefined();
    expect(run('/api/content', 'PATCH')).toBeUndefined();
  });

  it('respects a Cache-Control already set by the route', () => {
    expect(run('/api/content', 'GET', 'private, no-store')).toBe('private, no-store');
  });
});
