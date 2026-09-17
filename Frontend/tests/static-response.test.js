/**
 * Tests for the static-response helper: gzip opt-in/out, content hashing,
 * and revalidation behave correctly across encodings.
 *
 * Runs under node --test via the built-in node:test runner.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { gunzipSync } = require('node:zlib');
const { staticResponse, acceptsGzip } = require('../static-response');

describe('acceptsGzip', () => {
  it('accepts plain gzip and wildcard', () => {
    assert.equal(acceptsGzip('gzip'), true);
    assert.equal(acceptsGzip('gzip, deflate, br, zstd'), true);
    assert.equal(acceptsGzip('*'), true);
  });

  it('rejects missing, declined, and out-of-range encodings', () => {
    assert.equal(acceptsGzip(undefined), false);
    assert.equal(acceptsGzip(''), false);
    assert.equal(acceptsGzip('br'), false);
    // Explicit gzip;q=0 overrides a wildcard — must not compress.
    assert.equal(acceptsGzip('*, gzip;q=0'), false);
    assert.equal(acceptsGzip('gzip;q=0'), false);
    assert.equal(acceptsGzip('gzip;q=9'), false);
  });

  it('respects quality values', () => {
    assert.equal(acceptsGzip('gzip;q=0.5'), true);
    assert.equal(acceptsGzip('gzip ; q=0.8'), true);
  });
});

describe('staticResponse', () => {
  const bigJs = Buffer.from('const a = 1;\n'.repeat(500));
  const etagOf = (data) => 'W/"' + createHash('sha256').update(data).digest('hex') + '"';

  it('serves gzip when accepted and smaller, plain otherwise', async () => {
    const gz = await staticResponse(bigJs, 'application/javascript', {
      'accept-encoding': 'gzip',
    });
    assert.equal(gz.status, 200);
    assert.equal(gz.headers['Content-Encoding'], 'gzip');
    assert.equal(gz.headers['Content-Length'], gz.body.length);
    assert.ok(gunzipSync(gz.body).equals(bigJs));

    const plain = await staticResponse(bigJs, 'application/javascript', {
      'accept-encoding': 'br',
    });
    assert.equal(plain.headers['Content-Encoding'], undefined);
    assert.ok(plain.body.equals(bigJs));

    const noHeader = await staticResponse(bigJs, 'application/javascript', {});
    assert.equal(noHeader.headers['Content-Encoding'], undefined);
  });

  it('never gzips images or tiny bodies', async () => {
    const png = Buffer.alloc(5000, 7);
    const img = await staticResponse(png, 'image/png', { 'accept-encoding': 'gzip' });
    assert.equal(img.headers['Content-Encoding'], undefined);

    const tiny = await staticResponse(Buffer.from('hi'), 'text/css', {
      'accept-encoding': 'gzip',
    });
    assert.equal(tiny.headers['Content-Encoding'], undefined);
  });

  it('uses a content hash etag shared across encodings and supports revalidation', async () => {
    const gz = await staticResponse(bigJs, 'application/javascript', {
      'accept-encoding': 'gzip',
    });
    const plain = await staticResponse(bigJs, 'application/javascript', {});
    assert.equal(gz.headers.ETag, etagOf(bigJs));
    assert.equal(plain.headers.ETag, gz.headers.ETag);

    const notModified = await staticResponse(bigJs, 'application/javascript', {
      'if-none-match': gz.headers.ETag,
    });
    assert.equal(notModified.status, 304);
    assert.equal(notModified.body, undefined);
    // Strong validator for a weak etag of the same content also matches.
    const strong = await staticResponse(bigJs, 'application/javascript', {
      'if-none-match': gz.headers.ETag.slice(2),
    });
    assert.equal(strong.status, 304);

    // Same byte length, different content → different etag (no stale 304s).
    const sameLength = Buffer.from(bigJs.toString().replace('const a = 1;', 'const b = 2;'));
    assert.equal(sameLength.length, bigJs.length);
    const edited = await staticResponse(sameLength, 'application/javascript', {
      'if-none-match': gz.headers.ETag,
    });
    assert.equal(edited.status, 200);

    const star = await staticResponse(bigJs, 'application/javascript', {
      'if-none-match': '*',
    });
    assert.equal(star.status, 304);
  });

  it('keeps cache revalidation safe (no immutable for non-fingerprinted urls)', async () => {
    const res = await staticResponse(bigJs, 'application/javascript', {});
    assert.equal(res.headers['Cache-Control'], 'no-cache');
    assert.equal(res.headers.Vary, 'Accept-Encoding');
  });
});
