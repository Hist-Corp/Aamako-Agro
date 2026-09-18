import { of, throwError } from 'rxjs';
import { CacheControlInterceptor } from './cache-control.interceptor';

/**
 * Regression guard for the public-route Cache-Control whitelist.
 *
 * The whitelist originally listed `/api/catalog/products`, a path that does not
 * exist (the catalog controller is `@Controller()` + `@Get('products')`, i.e.
 * `/api/products`). Nothing failed — the headers were simply never applied — so
 * these tests pin the patterns to the real served routes.
 *
 * The header is attached in a `tap` AFTER the handler emits, so the mock here
 * must return a real observable and subscribe.
 */
function run(path: string, method = 'GET', preset?: string, onEmit?: (res: any) => unknown) {
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
  const next: any = { handle: () => of(onEmit ? onEmit(res) : null) };
  new CacheControlInterceptor().intercept(context, next).subscribe({ error: () => undefined });
  return headers['Cache-Control'];
}

/** Same as run() but the handler stream errors (e.g. 404/500 from the route). */
function runErroring(path: string, method = 'GET') {
  const headers: Record<string, string> = {};
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
  const next: any = { handle: () => throwError(() => new Error('boom')) };
  new CacheControlInterceptor().intercept(context, next).subscribe({ error: () => undefined });
  return headers['Cache-Control'];
}

/** Same as run() but the handler sets an error status manually instead of throwing. */
function runWithStatus(path: string, statusCode: number) {
  const headers: Record<string, string> = {};
  const req: any = { method: 'GET', originalUrl: path, url: path };
  const res: any = {
    statusCode,
    getHeader: (name: string) => headers[name],
    setHeader: (name: string, value: string) => {
      headers[name] = value;
    },
  };
  const context: any = {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  };
  const next: any = { handle: () => of(null) };
  new CacheControlInterceptor().intercept(context, next).subscribe({ error: () => undefined });
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

  it('respects a Cache-Control set during handling (route wins)', () => {
    // /api/content sets `public, max-age=10` + ETag inside its handler.
    const header = run('/api/content', 'GET', undefined, (res) =>
      res.setHeader('Cache-Control', 'public, max-age=10'),
    );
    expect(header).toBe('public, max-age=10');
  });

  it('never caches an error response (404/500 must stay uncacheable)', () => {
    // A 404 for a not-yet-published slug must not stick in browser/CDN caches.
    expect(runErroring('/api/products/does-not-exist')).toBeUndefined();
    expect(runErroring('/api/products')).toBeUndefined();
    expect(runErroring('/api/categories')).toBeUndefined();
  });

  it('never caches a manually-set error status (no throw involved)', () => {
    expect(runWithStatus('/api/products', 404)).toBeUndefined();
    expect(runWithStatus('/api/products/power-fruits-powder', 500)).toBeUndefined();
    // 2xx/3xx still get the header (304 keeps the route's own value, see below).
    expect(runWithStatus('/api/products', 200)).toContain('public, max-age=60');
  });
});
