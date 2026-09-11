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
 * - Streaming (SSE/WebSocket) and static-file (express.static → sendFile)
 *   responses bypass this entirely and are never double-compressed.
 * - Set `DISABLE_GZIP=1` to turn it off (escape hatch, defaults on).
 */
export function gzipMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (process.env.DISABLE_GZIP === '1') {
    next();
    return;
  }

  const acceptEncoding = req.headers['accept-encoding'];
  const acceptsGzip = typeof acceptEncoding === 'string' && /(?:^|,)\s*gzip\b/.test(acceptEncoding);
  if (!acceptsGzip) {
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
    if (text.length < MIN_COMPRESSIBLE_BYTES) {
      return originalSend(text);
    }

    const compressed = gzip(text);
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Vary', 'Accept-Encoding');
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