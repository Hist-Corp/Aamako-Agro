import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';

/**
 * Adds conservative `Cache-Control` headers to PUBLIC (unauthenticated) GET
 * responses so edge/CDN caches and browsers can safely reuse them. It is a
 * strict whitelist: only URLs we cache server-side receive a header, the TTLs
 * are short (60s) so content edits surface quickly, and any header already set
 * by the route is respected (never overridden). Authenticated / mutation
 * routes are never touched.
 */
const ROUTES: { pattern: RegExp; cacheControl: string }[] = [
  { pattern: /^\/api\/catalog\/products/, cacheControl: 'public, max-age=60, stale-while-revalidate=30' },
  { pattern: /^\/api\/catalog\/categories$/, cacheControl: 'public, max-age=300, stale-while-revalidate=60' },
  { pattern: /^\/api\/catalog\/products\/[\w-]+$/, cacheControl: 'public, max-age=60, stale-while-revalidate=30' },
  { pattern: /^\/api\/content$/, cacheControl: 'public, max-age=60, stale-while-revalidate=30' },
  { pattern: /^\/api\/media$/, cacheControl: 'public, max-age=60, stale-while-revalidate=30' },
];

@Injectable()
export class CacheControlInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();

    if (req.method === 'GET') {
      const path = String(req.originalUrl ?? req.url ?? '/').split('?')[0];
      for (const { pattern, cacheControl } of ROUTES) {
        if (pattern.test(path) && !res.getHeader('Cache-Control')) {
          res.setHeader('Cache-Control', cacheControl);
          break;
        }
      }
    }

    return next.handle();
  }
}