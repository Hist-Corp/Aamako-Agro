import { NextFunction, Request, Response } from 'express';
import { gzip, isCompressibleContentType, MIN_COMPRESSIBLE_BYTES } from './compress';

/**
 * Zero-dependency gzip response middleware for the REST API.
 *
 * - Only engages when the client advertises `Accept-Encoding: gzip`.
 * - Only compresses text/JSON bodies >= 1 KB and never already-encoded or
 *   binary payloads.
 * - Overrides `res.send`/`res.json` as a single choke point and hands the
 *   compressed bytes to the ORIGINAL send, so there is no recursion and each
 *   request (fresh `res` object) is independent.
 * - `Vary: Accept-Encoding` is appended (not overwritten) so an upstream
 *   value like `Vary: Origin` survives.
 * - Streaming (SSE/WebSocket) and static-file (express.static → sendFile)
 *   responses bypass this entirely and are never double-compressed.
 * - Set `DISABLE_GZIP=1` to turn it off (escape hatch, defaults on).
 */

/** True when an Accept-Encoding value (string or string[]) opts into gzip. */
function acceptsGzip(value: string | string[] | undefined): boolean {
  const values = Array.isArray(value) ? value : [value];
  return values.some(
    (v) =>
      typeof v === 'string' &&
      /(?:^|,)\s*gzip\b/.test(v) &&
      // An explicit `gzip;q=0` (or `q=0.0`) is a refusal — never compress for it.
      !/(?:^|,)\s*gzip\s*;\s*q=0(?:\.0+)?\s*(?:,|$)/i.test(v),
  );
}
export function gzipMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (process.env.DISABLE_GZIP === '1') {
    next();
    return;
  }

  const acceptsGzipHeader = acceptsGzip(req.headers['accept-encoding']);
  if (!acceptsGzipHeader) {
    next();
    return;
  }

  const originalSend = res.send.bind(res);

  const sendCompressed = (body: unknown): Response => {
    const contentType = String(res.getHeader('Content-Type') ?? '');
    const isBinary = Buffer.isBuffer(body) || body instanceof Uint8Array;
    const alreadyEncoded = Boolean(res.getHeader('Content-Encoding'));

    if (isBinary || alreadyEncoded || !isCompressibleContentType(contentType)) {
      return originalSend(body as never);
    }

    const text = typeof body === 'string' ? body : JSON.stringify(body);
    // JSON.stringify(undefined) returns undefined (e.g. 204/304 empty sends) —
    // pass those through untouched instead of throwing on `.length`.
    if (text == null) return originalSend(body as never);
    if (text.length < MIN_COMPRESSIBLE_BYTES) {
      return originalSend(text);
    }

    const compressed = gzip(text);
    res.setHeader('Content-Encoding', 'gzip');
    // Merge with any existing Vary instead of overwriting — dropping something
    // like `Vary: Origin` would poison shared caches with cross-origin bodies.
    const varyHeader = res.getHeader('Vary');
    const varyValues = Array.isArray(varyHeader)
      ? varyHeader
      : typeof varyHeader === 'string'
        ? varyHeader.split(',').map((part) => part.trim())
        : [];
    if (!varyValues.some((v) => v === '*' || v.toLowerCase() === 'accept-encoding')) {
      res.setHeader('Vary', [...varyValues, 'Accept-Encoding'].filter(Boolean).join(', '));
    }
    // Let Express recompute Content-Length for the compressed body.
    if (res.getHeader('Content-Length')) res.removeHeader('Content-Length');
    return originalSend(compressed);
  };

  res.send = (body: unknown): Response => {
    if (typeof body === 'object' && body !== null && !Buffer.isBuffer(body) && !(body instanceof Uint8Array)) {
      if (!res.getHeader('Content-Type')) res.type('application/json');
      return sendCompressed(JSON.stringify(body));
    }
    return sendCompressed(body);
  };

  res.json = (body: unknown): Response => {
    if (!res.getHeader('Content-Type')) res.type('application/json');
    return res.send(body);
  };

  next();
}