'use strict';
/** Suite 04 — Golden conversion flow: browse → cart → checkout → order visible; idempotency. */
const { Results, api, login } = require('./lib');
const { CFG } = require('./lib');

module.exports = async function run() {
  const R = new Results('04-checkout');
  const email = `qa-buyer-${Date.now()}@aamako.test`;

  // register + storefront login (with 429 retry)
  let r = await api('POST', '/auth/register', { body: { email, password: 'QaBuy123', firstName: 'Qa', lastName: 'Buyer' } });
  (r.status === 200 || r.status === 201) ? R.pass('Buyer registered') : R.fail('Buyer registered', `status=${r.status}`);
  for (let i = 0; i < 4; i++) {
    r = await api('POST', '/auth/login', { body: { email, password: 'QaBuy123', scope: 'storefront' } });
    if (r.status !== 429) break;
    await new Promise((res) => setTimeout(res, 16000));
  }
  const at = r.json?.accessToken;
  at ? R.pass('Buyer storefront login') : R.fail('Buyer storefront login', `status=${r.status}`);
  const SESSION = { 'X-Cart-Session': 'qa-' + Date.now() }; // anonymous-cart fallback header

  // find a published product with a variant
  r = await api('GET', '/products?limit=5');
  const items = r.json?.items || r.json?.data || r.json || [];
  const product = items[0];
  if (!product) { R.fail('Fetch product for cart', 'no products returned'); R.save(); return R.tests; }
  R.pass('Product fetched for cart journey', `slug=${product.slug}`);
  const detail = await api('GET', `/products/${product.slug}`);
  const variants = detail.json?.variants || product.variants || [];
  const variant = variants[0];
  if (!variant?.id) { R.fail('Fetch variant for cart', 'no variant on product'); R.save(); return R.tests; }
  R.pass('Variant fetched', `variantId=${variant.id}`);

  // add to cart (authed user; session header as fallback for anonymous carts)
  r = await api('POST', '/cart/items', { token: at, headers: SESSION, body: { variantId: variant.id, quantity: 2 } });
  r.status === 200 || r.status === 201 ? R.pass('POST /cart/items adds line') : R.fail('POST /cart/items adds line', `status=${r.status} ${JSON.stringify(r.json).slice(0, 150)}`);

  // invalid quantity
  r = await api('POST', '/cart/items', { token: at, headers: SESSION, body: { variantId: variant.id, quantity: -5 } });
  r.status === 400 ? R.pass('Negative quantity rejected 400') : R.fail('Negative quantity rejected 400', `status=${r.status}`);

  // update quantity
  r = await api('PATCH', '/cart/items', { token: at, headers: SESSION, body: { variantId: variant.id, quantity: 3 } });
  r.status === 200 || r.status === 201 ? R.pass('PATCH /cart/items updates quantity') : R.fail('PATCH /cart/items updates quantity', `status=${r.status}`);

  // view cart shows the line
  r = await api('GET', '/cart', { token: at, headers: SESSION });
  const lines = r.json?.lines || r.json?.items || [];
  lines.length > 0 ? R.pass('GET /cart shows line', `lines=${lines.length}`) : R.fail('GET /cart shows line', JSON.stringify(r.json).slice(0, 150));

  // checkout WITHOUT idempotency key → 400
  r = await api('POST', '/orders', { token: at, body: { contactName: 'Qa Buyer', contactEmail: email, shippingAddress: 'Kathmandu' } });
  r.status === 400 ? R.pass('Checkout without Idempotency-Key → 400') : R.fail('Checkout without Idempotency-Key → 400', `status=${r.status}`);

  // checkout with key
  const key = 'qa-' + Date.now();
  r = await api('POST', '/orders', {
    token: at, headers: { 'Idempotency-Key': key },
    body: { contactName: 'Qa Buyer', contactEmail: email, contactPhone: '+9779800000000', shippingAddress: 'QA Street 42, Kathmandu', notes: 'qa test order' },
  });
  const orderOk = r.status === 200 || r.status === 201;
  orderOk ? R.pass('Checkout creates order', `orderNumber=${r.json?.orderNumber} totalCents=${r.json?.totalCents}`)
          : R.fail('Checkout creates order', `status=${r.status} ${JSON.stringify(r.json).slice(0, 250)}`);
  const orderNumber = r.json?.orderNumber;

  // idempotent replay returns the same order
  r = await api('POST', '/orders', {
    token: at, headers: { 'Idempotency-Key': key },
    body: { contactName: 'Qa Buyer', contactEmail: email, shippingAddress: 'QA Street 42, Kathmandu' },
  });
  (r.status === 200 || r.status === 201) && r.json?.orderNumber === orderNumber
    ? R.pass('Idempotent replay returns same order (no duplicate)')
    : R.fail('Idempotent replay returns same order (no duplicate)', `status=${r.status} orderNumber=${r.json?.orderNumber} expected=${orderNumber}`);

  // order appears in /orders/mine
  r = await api('GET', '/orders/mine', { token: at });
  const mine = r.json?.items || r.json?.data || r.json || [];
  (Array.isArray(mine) && (orderNumber ? mine.some((o) => o.orderNumber === orderNumber) : mine.length > 0))
    ? R.pass('Order visible in GET /orders/mine')
    : R.fail('Order visible in GET /orders/mine', `status=${r.status} body=${JSON.stringify(r.json).slice(0, 200)}`);

  // staff can see it in admin order list (SUPER_ADMIN)
  const sup = (await login('SUPER_ADMIN', 'dashboard')).accessToken;
  r = await api('GET', '/admin/orders', { token: sup });
  const all = r.json?.items || r.json?.data || r.json || [];
  Array.isArray(all) && (orderNumber ? all.some((o) => o.orderNumber === orderNumber) : all.length > 0)
    ? R.pass('Order visible to staff in GET /orders')
    : R.fail('Order visible to staff in GET /orders', `status=${r.status} body=${JSON.stringify(r.json).slice(0, 200)}`);

  // empty cart checkout (fresh user) → 400
  const email2 = `qa-empty-${Date.now()}@aamako.test`;
  await api('POST', '/auth/register', { body: { email: email2, password: 'QaBuy123', firstName: 'Qa' } });
  for (let i = 0; i < 4; i++) {
    r = await api('POST', '/auth/login', { body: { email: email2, password: 'QaBuy123', scope: 'storefront' } });
    if (r.status !== 429) break;
    await new Promise((res) => setTimeout(res, 16000));
  }
  r = await api('POST', '/orders', { token: r.json?.accessToken, headers: { 'Idempotency-Key': 'qa-empty-' + Date.now() }, body: { contactName: 'Qa', contactEmail: email2, shippingAddress: 'X' } });
  [400, 409].includes(r.status)
    ? R.pass('Checkout with empty cart rejected', `status=${r.status}`)
    : R.fail('Checkout with empty cart rejected', `status=${r.status} ${JSON.stringify(r.json).slice(0, 150)}`);

  R.save();
  return R.tests;
};
