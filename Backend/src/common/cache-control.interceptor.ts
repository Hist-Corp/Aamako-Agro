import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Adds conservative `Cache-Control` headers to PUBLIC (unauthenticated) GET
 * responses so edge/CDN caches and browsers can safely reuse them. It is a
 * strict whitelist: only URLs we cache server-side receive a header, the TTLs
 * are short (60s) so content edits surface quickly, and any header already set
 * by the route is respected (never overridden). Authenticated / mutation
 * routes are never touched.
 *
 * The header is attached only AFTER the handler has produced a successful
 * response: error statuses (404/400/429/500) must stay uncacheable, otherwise
 * a 404 for a not-yet-published product slug would stick in browser/CDN caches
 * for the full TTL even after the product goes live.
 *
 * IMPORTANT: these patterns are matched against the REAL routed path — i.e.
 * after the `/api` global prefix and the controller's own prefix. The catalog
 * controller is declared as `@Controller()` with `@Get('products')`, so its
 * paths are `/api/products` and `/api/categories` (NOT `/api/catalog/...`).
 * Keep these in sync with catalog/content/media controllers; the colocated
 * spec asserts they line up with the served routes.
 */
const ROUTES: { pattern: RegExp; cacheControl: string }[] = [
  { pattern: /^\/api\/products$/, cacheControl: 'public, max-age=60, stale-while-revalidate=30' },
  { pattern: /^\/api\/products\/[\w-]+$/, cacheControl: 'public, max-age=60, stale-while-revalidate=30' },
  { pattern: /^\/api\/categories$/, cacheControl: 'public, max-age=300, stale-while-revalidate=60' },
  { pattern: /^\/api\/content$/, cacheControl: 'public, max-age=60, stale-while-revalidate=30' },
  { pattern: /^\/api\/media$/, cacheControl: 'public, max-age=60, stale-while-revalidate=30' },
];

@Injectable()
export class CacheControlInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();

    const stream = next.handle();
    if (req.method !== 'GET') return stream;

    const path = String(req.originalUrl ?? req.url ?? '/').split('?')[0];
    const match = ROUTES.find(({ pattern }) => pattern.test(path));
    if (!match) return stream;

    // Defer to the end of the (successful) handler pipeline. If the route set
    // its own Cache-Control meanwhile (e.g. /api/content → max-age=10 + ETag),
    // its value wins — never overridden.
    return stream.pipe(
      tap(() => {
        // Belt-and-braces for handlers that set an error status manually
        // (`res.status(404).json(...)` without throwing) — the stream emits
        // normally for those, so the tap still runs. Never cache a 4xx/5xx.
        if (typeof res.statusCode === 'number' && res.statusCode >= 400) return;
        if (!res.getHeader('Cache-Control')) {
          res.setHeader('Cache-Control', match.cacheControl);
        }
      }),
    );
  }
}