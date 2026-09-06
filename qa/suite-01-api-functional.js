'use strict';
/** Suite 01 — API functional: catalog, search, filters, pagination, validation, error shape. */
const { Results, api, login } = require('./lib');

module.exports = async function run() {
  const R = new Results('01-api-functional');

  // --- health & public catalog ---
  let r = await api('GET', '/../api');
  r.status === 200 && r.json?.status === 'ok'
    ? R.pass('GET /api health returns status ok')
    : R.fail('GET /api health returns status ok', `status=${r.status} body=${JSON.stringify(r.json).slice(0, 120)}`);

  r = await api('GET', '/products?page=1&limit=5');
  const list = r.json;
  (r.status === 200 && Array.isArray(list?.items || list?.data || list))
    ? R.pass('GET /products paginated list 200', `count=${(list.items || list.data || list).length}`)
    : R.fail('GET /products paginated list 200', `status=${r.status} body=${JSON.stringify(r.json).slice(0, 200)}`);

  // pagination contract
  const p1 = await api('GET', '/products?page=1&limit=2');
  const p2 = await api('GET', '/products?page=2&limit=2');
  const a1 = (p1.json?.items || p1.json?.data || p1.json || []);
  const a2 = (p2.json?.items || p2.json?.data || p2.json || []);
  const first1 = (a1[0]?.id), first2 = (a2[0]?.id);
  first1 && first2 && first1 !== first2
    ? R.pass('Pagination page=2 returns different items than page=1')
    : R.fail('Pagination page=2 returns different items than page=1', `page1[0]=${first1} page2[0]=${first2}`);

  // invalid pagination -> 400 with standard error shape
  r = await api('GET', '/products?page=0');
  r.status === 400
    ? R.pass('GET /products?page=0 rejected with 400')
    : R.fail('GET /products?page=0 rejected with 400', `status=${r.status}`);
  r.json?.error?.code && r.json?.error?.message
    ? R.pass('Error shape is { error: { code, message } }', `code=${r.json.error.code}`)
    : R.fail('Error shape is { error: { code, message } }', `body=${JSON.stringify(r.json).slice(0, 200)}`);

  // categories
  r = await api('GET', '/categories');
  const cats = r.json;
  (r.status === 200 && Array.isArray(cats) && cats.length > 0)
    ? R.pass('GET /categories returns categories', `count=${cats.length}`)
    : R.fail('GET /categories returns categories', `status=${r.status} body=${JSON.stringify(r.json).slice(0, 150)}`);

  // product detail by slug + 404
  const prod = (a1[0] || {});
  const slug = prod.slug;
  if (slug) {
    r = await api('GET', `/products/${slug}`);
    r.status === 200 ? R.pass(`GET /products/${slug} detail 200`)
      : R.fail(`GET /products/${slug} detail 200`, `status=${r.status}`);
  } else R.warn('GET /products/:slug detail', 'no slug on first product to test');

  r = await api('GET', '/products/definitely-not-a-real-product-xyz');
  r.status === 404 ? R.pass('GET /products/:unknown → 404')
    : R.fail('GET /products/:unknown → 404', `status=${r.status}`);

  // search
  r = await api('GET', '/products?search=' + encodeURIComponent((prod.name || '').split(' ')[0] || 'mango'));
  r.status === 200 ? R.pass('GET /products?search=… 200', `results=${(r.json?.items || r.json?.data || r.json || []).length}`)
    : R.fail('GET /products?search=… 200', `status=${r.status}`);

  // category filter
  if (Array.isArray(cats) && cats[0]?.slug) {
    r = await api('GET', '/products?categorySlug=' + cats[0].slug);
    r.status === 200 ? R.pass(`GET /products?categorySlug=${cats[0].slug} 200`)
      : R.fail(`GET /products?categorySlug=${cats[0].slug} 200`, `status=${r.status}`);
  }

  // public pricing quote
  r = await api('GET', '/pricing/quote?variantId=x');
  [200, 400, 404].includes(r.status)
    ? R.pass('GET /pricing/quote reachable (no 500)', `status=${r.status}`)
    : R.fail('GET /pricing/quote reachable (no 500)', `status=${r.status} body=${JSON.stringify(r.json).slice(0, 150)}`);

  // unauthenticated staff route -> 401 with error shape
  r = await api('GET', '/admin/users');
  r.status === 401 ? R.pass('GET /admin/users without token → 401')
    : R.fail('GET /admin/users without token → 401', `status=${r.status}`);
  r.json?.error?.code ? R.pass('401 response uses standard error shape')
    : R.fail('401 response uses standard error shape', JSON.stringify(r.json).slice(0, 150));

  // forbidNonWhitelisted: unknown field rejected
  const reg = await api('POST', '/auth/register', { body: { email: `x${Date.now()}@t.io`, password: 'Passw0rd!', firstName: 'T', hackerField: 'nope' } });
  reg.status === 400 ? R.pass('Unknown DTO fields rejected (whitelist enforcement)', `status=${reg.status}`)
    : R.fail('Unknown DTO fields rejected (whitelist enforcement)', `status=${reg.status}`);

  R.save();
  return R.tests;
};
