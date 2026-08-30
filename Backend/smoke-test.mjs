// End-to-end smoke test for Aamako Agro API
const BASE = 'http://localhost:3000/api';
let pass = 0, fail = 0;
const errors = [];

function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; errors.push(`${name} ${extra}`); console.log(`FAIL  ${name} ${extra}`); }
}

async function req(method, path, { body, token, headers = {} } = {}) {
  const h = { 'Content-Type': 'application/json', ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  let data = {};
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

// ---------- Public catalog ----------
let r = await req('GET', '/');
check('GET /api (health)', r.status === 200 && r.data.status === 'ok');

r = await req('GET', '/categories');
check('GET /categories (public)', r.status === 200 && Array.isArray(r.data));
const categoryId = r.data?.[0]?.id;

r = await req('GET', '/products?limit=5');
check('GET /products (public)', r.status === 200 && Array.isArray(r.data.items));
const allPublished = (r.data.items ?? []).every(p => p.isPublished === true);
check('GET /products only returns published products', allPublished);

// ---------- Storefront: register + login ----------
const email = `smoke_${Date.now()}@test.com`;
r = await req('POST', '/auth/register', { body: { email, password: 'Test1234!', firstName: 'Smoke', lastName: 'Tester', phone: '+9779800000001' } });
check('POST /auth/register', r.status === 200 || r.status === 201, JSON.stringify(r.data).slice(0, 200));
const custToken = r.data.accessToken;

r = await req('POST', '/auth/login', { body: { email, password: 'Test1234!', scope: 'storefront' } });
check('POST /auth/login (storefront)', r.status === 200 || r.status === 201);

r = await req('POST', '/auth/login', { body: { email: email, password: 'wrongpass1' } });
check('POST /auth/login rejects bad password', r.status === 401);

r = await req('POST', '/auth/register', { body: { email, password: 'Test1234!', firstName: 'Dup' } });
check('POST /auth/register rejects duplicate email', r.status === 409);

// ---------- Cart ----------
r = await req('GET', '/products?limit=1');
const variant = r.data.items?.[0]?.variants?.[0];
check('catalog exposes a variant', !!variant?.id);

let cartSession = 'cs-smoke-' + Date.now();
r = await req('POST', '/cart/items', { body: { variantId: variant.id, quantity: 2 }, token: custToken, headers: { 'X-Cart-Session': cartSession } });
check('POST /cart/items', r.status === 200 || r.status === 201, JSON.stringify(r.data).slice(0, 200));

r = await req('GET', '/cart', { token: custToken, headers: { 'X-Cart-Session': cartSession } });
check('GET /cart', r.status === 200 && (r.data.lines?.length ?? 0) > 0);

r = await req('PATCH', '/cart/items', { body: { variantId: variant.id, quantity: 3 }, token: custToken, headers: { 'X-Cart-Session': cartSession } });
check('PATCH /cart/items', r.status === 200 || r.status === 201, JSON.stringify(r.data).slice(0, 200));

// ---------- Checkout (idempotency header only, key NOT in body) ----------
const checkoutBody = {
  contactName: 'Smoke Tester',
  contactEmail: email,
  contactPhone: '+9779800000001',
  shippingAddress: '123 Test Street, Kathmandu',
  notes: 'smoke test order',
};
const idemKey = 'smoke-' + crypto.randomUUID();
r = await req('POST', '/orders', { body: checkoutBody, token: custToken, headers: { 'X-Cart-Session': cartSession, 'Idempotency-Key': idemKey } });
const checkoutOk = r.status === 200 || r.status === 201;
check('POST /orders (checkout, idempotencyKey NOT in body)', checkoutOk, JSON.stringify(r.data).slice(0, 300));
const orderNumber = r.data.orderNumber;
const orderId = r.data.id;

r = await req('POST', '/orders', { body: checkoutBody, token: custToken, headers: { 'X-Cart-Session': cartSession, 'Idempotency-Key': idemKey } });
check('POST /orders idempotent replay returns same order', checkoutOk && r.data.orderNumber === orderNumber, JSON.stringify(r.data).slice(0, 200));

r = await req('POST', '/orders', { body: checkoutBody, token: custToken });
check('POST /orders without Idempotency-Key â†’ 400', r.status === 400, `got ${r.status}`);

r = await req('GET', '/orders/mine', { token: custToken });
check('GET /orders/mine', r.status === 200 && Array.isArray(r.data) && r.data.some(o => o.orderNumber === orderNumber));

// ---------- Admin: login + dashboards ----------
r = await req('POST', '/auth/login', { body: { email: 'admin@aamako.agro', password: 'Admin123!' } });
check('admin login', (r.status === 200 || r.status === 201) && !!r.data.accessToken, JSON.stringify(r.data).slice(0, 200));
const adminToken = r.data.accessToken;

r = await req('GET', '/admin/orders', { token: adminToken });
check('GET /admin/orders (array, contains new order)', r.status === 200 && Array.isArray(r.data) && r.data.some(o => o.orderNumber === orderNumber), `status=${r.status}`);

r = await req('GET', '/admin/customers', { token: adminToken });
check('GET /admin/customers (array, contains new customer)', r.status === 200 && Array.isArray(r.data) && r.data.some(c => c.email === email), `status=${r.status}`);

r = await req('GET', '/admin/products', { token: adminToken });
check('GET /admin/products (array, has variants+category)', r.status === 200 && Array.isArray(r.data) && r.data.length > 0 && 'variants' in r.data[0] && 'category' in r.data[0], `status=${r.status}`);

r = await req('PATCH', `/admin/orders/${orderId}/status`, { body: { status: 'CONFIRMED' }, token: adminToken });
check('PATCH /admin/orders/:id/status PLACEDâ†’CONFIRMED', r.status === 200 && r.data.status === 'CONFIRMED', `status=${r.status} ${JSON.stringify(r.data).slice(0,150)}`);

r = await req('PATCH', `/admin/orders/${orderId}/status`, { body: { status: 'PLACED' }, token: adminToken });
check('invalid status transition â†’ 400', r.status === 400, `got ${r.status}`);

r = await req('GET', '/admin/orders');
check('admin endpoints reject anonymous (401/403)', r.status === 401 || r.status === 403, `got ${r.status}`);

r = await req('GET', '/admin/orders', { token: custToken });
check('customer token rejected on admin endpoints (403)', r.status === 403, `got ${r.status}`);

// ---------- Product create + publish flow ----------
r = await req('POST', '/auth/login', { body: { email: 'content@aamako.agro', password: 'Content123!' } });
const contentOk = (r.status === 200 || r.status === 201) && !!r.data.accessToken;
check('content manager login', contentOk, JSON.stringify(r.data).slice(0, 150));
const contentToken = r.data.accessToken;

r = await req('POST', '/auth/login', { body: { email: 'manager@aamako.agro', password: 'Manager123!' } });
const managerOk = (r.status === 200 || r.status === 201) && !!r.data.accessToken;
check('manager login', managerOk, JSON.stringify(r.data).slice(0, 150));
const managerToken = r.data.accessToken;

if (contentOk && managerOk && categoryId) {
  const prodBody = {
    name: 'Smoke Test Product ' + Date.now(),
    slug: 'smoke-test-product-' + Date.now(),
    description: 'A product created by the automated smoke test to verify the publish workflow end to end.',
    imageUrl: 'https://picsum.photos/seed/smoke/1200/1200',
    categoryId,
    variants: [{ sku: 'SMK-' + Date.now(), name: 'pack', unit: 'UNIT_50G', basePriceCents: 150000 }],
  };
  r = await req('POST', '/admin/products', { body: prodBody, token: contentToken });
  const createdOk = r.status === 200 || r.status === 201;
  check('content manager creates product (unpublished)', createdOk, JSON.stringify(r.data).slice(0, 200));
  const prodId = r.data.id;
  check('new product starts isPublished=false', createdOk && r.data.isPublished === false);

  r = await req('GET', '/products?search=' + encodeURIComponent('Smoke Test Product'));
  const searchHit = (r.data.items ?? []).some(p => p.id === prodId);
  check('unpublished product NOT on storefront', !searchHit, 'found unpublished product on public list!');

  r = await req('PATCH', `/admin/products/${prodId}`, { body: { isPublished: true }, token: managerToken });
  check('manager publishes product (PATCH isPublished=true)', r.status === 200 && r.data.isPublished === true, `status=${r.status} ${JSON.stringify(r.data).slice(0,150)}`);

  r = await req('GET', '/products?search=' + encodeURIComponent(prodBody.slug));
  check('published product NOW on storefront', (r.data.items ?? []).some(p => p.id === prodId), 'published product missing from public list');

  r = await req('GET', '/products/' + prodBody.slug);
  check('GET /products/:slug (public detail)', r.status === 200 && r.data.id === prodId, `status=${r.status}`);
}

// ---------- Wholesale + Pricing ----------
r = await req('POST', '/wholesale/inquiries', { body: { companyName: 'Smoke Biz', contactName: 'Smoke', email: email, phone: '+9779800000001', message: 'test' } });
check('POST /wholesale/inquiries', r.status === 200 || r.status === 201, `status=${r.status} ${JSON.stringify(r.data).slice(0,150)}`);

r = await req('GET', `/pricing/quote?variantId=${variant.id}&quantity=2`);
check('GET /pricing/quote', r.status === 200 && typeof r.data.items?.[0]?.unitPriceCents === 'number', `status=${r.status}`);

console.log(`\n===== RESULTS: ${pass} passed, ${fail} failed =====`);
if (errors.length) { console.log('FAILURES:'); errors.forEach(e => console.log(' - ' + e)); }

