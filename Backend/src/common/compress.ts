import { crc32, deflateSync } from 'node:zlib';

/**
 * Minimal deterministic gzip (RFC 1952) encoder with no dependencies.
 *
 * Unlike the async `zlib.gzip` (Node >= 22), `deflateSync` + `crc32` are
 * available on Node 20 (the documented runtime for this API). We compress
 * with zlib's raw DEFLATE at level 6, strip the 2-byte zlib header and the
 * 4-byte Adler-32 trailer, then wrap the remaining stream in a standard gzip
 * header/trailer (CRC-32 + ISIZE). Round-tripped against `gunzip`/`gunzipSync`
 * in the test suite to guarantee correctness across payload sizes.
 */

const GZIP_HEADER = Buffer.from([0x1f, 0x8b, 8, 0, 0, 0, 0, 0, 0, 0xff]);
const GZIP_LEVEL = 6;

export const MIN_COMPRESSIBLE_BYTES = 1024;

/** True when a response content-type should be compressed (text/JSON families). */
export function isCompressibleContentType(contentType: string): boolean {
  return /json|text\/(?:html|css|javascript|plain|xml)|application\/json|application\/xml/.test(
    contentType ?? '',
  );
}

/** Compress a Buffer/UTF-8 string into a valid gzip stream. */
export function gzip(data: Buffer | string): Buffer {
  const bytes = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
  const raw = deflateSync(bytes, { level: GZIP_LEVEL });
  const body = raw.subarray(2, raw.length - 4); // strip zlib header + adler32 trailer
  const trailer = Buffer.alloc(8);
  trailer.writeUInt32LE(crc32(bytes), 0); // CRC-32 (LE)
  trailer.writeUInt32LE(bytes.length & 0xffffffff, 4); // ISIZE = uncompressed size mod 2^32
  return Buffer.concat([GZIP_HEADER, body, trailer]);
}