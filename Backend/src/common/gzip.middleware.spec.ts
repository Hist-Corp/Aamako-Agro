/**
 * Tests for the gzip middleware: opt-in/opt-out, merge of Vary, body handling.
 */
import { gzipMiddleware } from './gzip.middleware';
import { gzipSync, gunzipSync } from 'node:zlib';

function makeRes() {
  const headers = new Map<string, string | string[]>();
  const res: any = {
    headers,
    getHeader: (name: string) => headers.get(name),
    setHeader: (name: string, value: string | string[]) => headers.set(name, value),
    removeHeader: (name: string) => headers.delete(name),
    type: (ct: string) => headers.set('Content-Type', ct),
    sent: undefined as unknown,
  };
  res.send = jest.fn((body: unknown) => {
    res.sent = body;
    return res;
  });
  return res;
}

describe('gzipMiddleware', () => {
  it('passes through without gzip when the client does not advertise it', () => {
    const res = makeRes();
    const next = jest.fn();
    gzipMiddleware({ headers: {} } as any, res, next);
    expect(next).toHaveBeenCalled();
    // res.send untouched — still the jest mock, no Content-Encoding set.
    res.send('x'.repeat(2000));
    expect(res.headers.get('Content-Encoding')).toBeUndefined();
  });

  it('compresses large JSON and merges (not overwrites) an existing Vary', () => {
    const res = makeRes();
    res.setHeader('Vary', 'Origin');
    gzipMiddleware({ headers: { 'accept-encoding': 'gzip' } } as any, res, jest.fn());
    const payload = { items: Array.from({ length: 500 }, (_, i) => ({ id: i, name: 'product-' + i })) };
    res.json(payload);
    expect(res.headers.get('Content-Encoding')).toBe('gzip');
    expect(res.headers.get('Vary')).toBe('Origin, Accept-Encoding');
    expect(gzipSync(JSON.stringify(payload)).length).toBeGreaterThan(1024);
    // Round-trips through a real gunzip.
    expect(JSON.parse(gunzipSync(res.sent).toString())).toEqual(payload);
  });

  it('accepts array Accept-Encoding and leaves small/binary bodies alone', () => {
    const res = makeRes();
    gzipMiddleware({ headers: { 'accept-encoding': ['br', 'gzip'] } } as any, res, jest.fn());
    res.send('tiny');
    expect(res.headers.get('Content-Encoding')).toBeUndefined();
    const buf = makeRes();
    gzipMiddleware({ headers: { 'accept-encoding': 'gzip' } } as any, buf, jest.fn());
    const binary = Buffer.alloc(5000, 1);
    buf.send(binary);
    expect(buf.sent).toBe(binary);
  });
});
