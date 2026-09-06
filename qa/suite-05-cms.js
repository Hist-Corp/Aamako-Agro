'use strict';
/** Suite 05 — CMS: product CRUD + publish/unpublish + storefront reflection; content moderation (draft vs live). */
const { Results, api, login } = require('./lib');

module.exports = async function run() {
  const R = new Results('05-cms');
  const sup = (await login('SUPER_ADMIN', 'dashboard')).accessToken;
  const content = (await login('CONTENT_MANAGER', 'dashboard')).accessToken;
  const manager = (await login('STAFF_MANAGER', 'dashboard')).accessToken;

  // ---- categories ----
  const cats = await api('GET', '/categories');
  const categoryId = (cats.json || [])[0]?.id;
  if (!categoryId) { R.fail('Fetch category for CMS tests', JSON.stringify(cats.json).slice(0, 120)); R.save(); return R.tests; }

  // ---- product CRUD ----
  const slug = `qa-product-${Date.now()}`;
  let r = await api('POST', '/admin/products', {
    token: sup,
    body: {
      name: 'QA Test Product', slug,
      description: 'QA automated test product created by the QA harness and removed again at the end of the run.',
      imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
      categoryId,
      isPublished: false,
      variants: [{ sku: `QA-${Date.now()}`, name: 'QA 50g', unit: 'UNIT_50G', basePriceCents: 45000 }],
    },
  });
  (r.status === 200 || r.status === 201)
    ? R.pass('CMS: create product (draft) 201')
    : R.fail('CMS: create product (draft) 201', `status=${r.status} ${JSON.stringify(r.json).slice(0, 250)}`);
  const pid = r.json?.id;

  // invalid product (short description, bad url, no variants) → 400
  r = await api('POST', '/admin/products', {
    token: sup,
    body: { name: 'x', slug: 'x', description: 'too short', imageUrl: 'ftp://bad', categoryId, variants: [] },
  });
  r.status === 400 ? R.pass('CMS: invalid product payload rejected 400') : R.fail('CMS: invalid product payload rejected 400', `status=${r.status}`);

  // draft must NOT be publicly visible
  r = await api('GET', `/products/${slug}`);
  r.status === 404
    ? R.pass('CMS: draft product NOT publicly visible (404 on storefront API)')
    : R.fail('CMS: draft product NOT publicly visible (404 on storefront API)', `status=${r.status} (expected 404)`);

  // publish → now visible on public API with our description
  r = await api('PATCH', `/admin/products/${pid}`, { token: sup, body: { isPublished: true } });
  (r.status === 200) ? R.pass('CMS: publish product (PATCH isPublished)') : R.fail('CMS: publish product (PATCH isPublished)', `status=${r.status}`);
  r = await api('GET', `/products/${slug}`);
  r.status === 200 && (r.json?.description || '').includes('QA automated test product')
    ? R.pass('CMS: published product reflects on public API')
    : R.fail('CMS: published product reflects on public API', `status=${r.status}`);

  // edit title → reflected
  await api('PATCH', `/admin/products/${pid}`, { token: sup, body: { name: 'QA Test Product v2' } });
  r = await api('GET', `/products/${slug}`);
  r.json?.name === 'QA Test Product v2'
    ? R.pass('CMS: edit reflects on public API')
    : R.fail('CMS: edit reflects on public API', `name=${r.json?.name}`);

  // unpublish → hidden again
  await api('PATCH', `/admin/products/${pid}`, { token: sup, body: { isPublished: false } });
  r = await api('GET', `/products/${slug}`);
  r.status === 404
    ? R.pass('CMS: unpublish hides product from public API')
    : R.fail('CMS: unpublish hides product from public API', `status=${r.status}`);

  // only STAFF_ADMIN may delete
  r = await api('DELETE', `/admin/products/${pid}`, { token: content });
  r.status === 403 ? R.pass('CMS: CONTENT_MANAGER cannot DELETE product (403)') : R.fail('CMS: CONTENT_MANAGER cannot DELETE product (403)', `status=${r.status}`);
  r = await api('DELETE', `/admin/products/${pid}`, { token: manager });
  r.status === 403 ? R.pass('CMS: STAFF_MANAGER cannot DELETE product (403)') : R.fail('CMS: STAFF_MANAGER cannot DELETE product (403)', `status=${r.status}`);
  r = await api('DELETE', `/admin/products/${pid}`, { token: sup });
  [200, 204].includes(r.status) ? R.pass('CMS: cleanup — product deleted by ADMIN') : R.fail('CMS: cleanup — product deleted by ADMIN', `status=${r.status}`);

  await contentModeration(R, api, content, manager);
  R.save();
  return R.tests;
};

async function contentModeration(R, api, content, manager) {
  const key = `qa.cms.${Date.now()}`;
  let r = await api('POST', '/content', { token: content, body: { key, title: 'QA CMS Block', body: '<p>QA content block body</p>', isVisible: true } });
  (r.status === 200 || r.status === 201)
    ? R.pass('CMS: CONTENT_MANAGER creates content (goes to review queue)')
    : R.fail('CMS: CONTENT_MANAGER creates content (goes to review queue)', `status=${r.status} ${JSON.stringify(r.json).slice(0, 200)}`);

  // draft should not be public yet
  r = await api('GET', '/content');
  const publicList = JSON.stringify(r.json || {});
  publicList.includes(key)
    ? R.fail('CMS: unapproved content NOT publicly visible', 'key found in public content!')
    : R.pass('CMS: unapproved content NOT publicly visible');

  // approve via revisions endpoint
  const revs = await api('GET', `/content/${key}/revisions`, { token: manager });
  const rev = (revs.json?.items || revs.json || [])[0];
  if (rev?.id) {
    r = await api('POST', `/content/revisions/${rev.id}/approve`, { token: manager, body: {} });
    [200, 201].includes(r.status)
      ? R.pass('CMS: MANAGER approves revision')
      : R.fail('CMS: MANAGER approves revision', `status=${r.status} ${JSON.stringify(r.json).slice(0, 150)}`);
  } else {
    R.warn('CMS: approve revision', `no revision found for key (${revs.status})`);
  }

  // publish + verify public
  await api('POST', `/content/${key}/publish`, { token: manager, body: {} });
  r = await api('GET', '/content');
  JSON.stringify(r.json || {}).includes(key)
    ? R.pass('CMS: approved+published content IS publicly visible')
    : R.fail('CMS: approved+published content IS publicly visible', `key=${key} not in public content`);

  // cleanup
  r = await api('DELETE', `/content/${key}`, { token: manager });
  [200, 204].includes(r.status)
    ? R.pass('CMS: cleanup — content block deleted')
    : R.fail('CMS: cleanup — content block deleted', `status=${r.status}`);
}
