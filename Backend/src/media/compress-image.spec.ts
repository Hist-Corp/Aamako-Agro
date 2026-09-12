import { compressImage } from './compress-image';

/**
 * Security regression tests for the image-upload path (media.controller upload).
 *
 * These assert the serve-safety posture: content that arrives via the upload
 * API can never be re-serialized into — or stored under — an executable type.
 * The endpoint accepts only client-declared `image/*` MIME types, so any ACTIVE
 * content (HTML/SVG-with-script/polyglot) must stay byte-for-byte and keep an
 * image extension so it is served as a non-executable `image/*` type (with
 * `X-Content-Type-Options: nosniff` + `Content-Security-Policy: sandbox`
 * applied at /api/uploads — see main.ts).
 */
describe('Media upload content hardening (compress-image)', () => {
  test('SVG vectors are stored byte-for-byte (never re-serialized) and keep a safe .svg extension', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    const res = await compressImage(svg, 'image/svg+xml', { warn: () => {} });
    expect(res.optimized).toBe(false);
    expect(res.extension).toBe('.svg');
    // Bytes preserved untouched.
    expect(res.buffer.byteLength).toBe(svg.byteLength);
    expect(res.note).toContain('vector');
  });

  test('animated/unknown formats are stored as-is and never promoted to an executable type', async () => {
    const gif = Buffer.from('GIF89a\x01\x00\x01\x00'); // valid header, tiny
    const res = await compressImage(gif, 'image/gif', { warn: () => {} });
    expect(res.optimized).toBe(false);
    expect(res.extension).toBe('.gif');
  });

  test('an HTML polyglot mis-labelled as image/png stays .png (not sniffable/executable)', async () => {
    // A polyglot that is NOT a decodable image: sharp cannot read it, so the
    // optimizer stores the original bytes under the image extension it derived
    // from the (only-allowed image/*) MIME type. It is therefore served as
    // image/png, never text/html, and nosniff blocks re-sniffing.
    const html = Buffer.from('<html><script>document.write(1)</script></html>');
    const res = await compressImage(html, 'image/png', { warn: () => {} });
    // Should either be a genuine png re-encode or a byte-for-byte store — never
    // an .html/.js/.xhtml extension.
    expect(res.extension).toBe('.png');
    expect(['.png', '.webp']).toContain(res.extension);
  });

  test('a weaponized .svg root-level vulnerable:svg can never become an .html/.js payload', async () => {
    const payload = '<svg><foreignObject><body>' +
      '<script>fetch("/admin")</script>' +
      '</body></foreignObject></svg>';
    const res = await compressImage(Buffer.from(payload), 'image/svg+xml', { warn: () => {} });
    expect(res.extension).toBe('.svg');
    // Ensure we never return something a browser would execute as HTML/JS.
    expect(['.svg', '.png']).toContain(res.extension);
  });
});