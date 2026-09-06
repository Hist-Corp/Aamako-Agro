'use strict';
/** Suite 03 — RBAC matrix: every seeded role × key endpoints + hierarchy enforcement. */
const { Results, api, login, CFG } = require('./lib');

const ROLES = Object.keys(CFG.CREDS);
// allowed = roles that must get a NON-403 response; everyone else must get 403.
const ENDPOINTS = [
  { m: 'GET',  p: '/admin/overview',                allowed: ['STAFF_SUPPORT', 'CONTENT_MANAGER', 'STAFF_MANAGER', 'STAFF_SALES', 'STAFF_ADMIN', 'SUPER_ADMIN'], name: 'GET /admin/overview (STAFF_READ)' },
  { m: 'GET',  p: '/admin/users',                   allowed: ['STAFF_SALES', 'STAFF_MANAGER', 'STAFF_ADMIN', 'SUPER_ADMIN'], name: 'GET /admin/users (USER_MANAGEMENT)' },
  { m: 'POST', p: '/admin/users', body: { email: 'x@x.io' }, allowed: ['STAFF_SALES', 'STAFF_MANAGER', 'STAFF_ADMIN', 'SUPER_ADMIN'], name: 'POST /admin/users (USER_CREATION) — probe w/ invalid body' },
  { m: 'DELETE', p: '/admin/users/nonexistent-id',  allowed: ['STAFF_ADMIN', 'SUPER_ADMIN'], name: 'DELETE /admin/users/:id (ADMIN/SUPER only)' },
  { m: 'GET',  p: '/admin/products',                allowed: ['STAFF_ADMIN', 'STAFF_MANAGER', 'CONTENT_MANAGER', 'SUPER_ADMIN'], name: 'GET /admin/products (catalog adminList)' },
  { m: 'POST', p: '/admin/products', body: {},       allowed: ['STAFF_ADMIN', 'STAFF_MANAGER', 'CONTENT_MANAGER', 'SUPER_ADMIN'], name: 'POST /admin/products (catalog write) — probe w/ invalid body' },
  { m: 'GET',  p: '/admin/orders',                     allowed: ['STAFF_SALES', 'STAFF_SUPPORT', 'STAFF_MANAGER', 'STAFF_ADMIN', 'SUPER_ADMIN'], name: 'GET /admin/orders (staff order list)' },
  { m: 'POST', p: '/orders', body: {}, headers: { 'Idempotency-Key': 'qa-rbac-probe' }, allowed: ['RETAIL_CUSTOMER', 'WHOLESALE_CUSTOMER'], name: 'POST /orders (checkout) — customers must pass role gate' },
  { m: 'GET',  p: '/admin/support/tickets',         allowed: ['STAFF_SUPPORT', 'STAFF_MANAGER', 'STAFF_ADMIN', 'SUPER_ADMIN'], name: 'GET /admin/support/tickets' },
  { m: 'GET',  p: '/admin/wholesale/inquiries',     allowed: ['STAFF_SUPPORT', 'STAFF_MANAGER', 'STAFF_ADMIN', 'SUPER_ADMIN'], name: 'GET /admin/wholesale/inquiries' },
  { m: 'GET',  p: '/content/manage',                allowed: ['CONTENT_MANAGER', 'STAFF_MANAGER', 'STAFF_ADMIN', 'SUPER_ADMIN'], name: 'GET /content/manage (CONTENT_EDITORS)' },
  { m: 'GET',  p: '/admin/rbac/permissions',        allowed: ['STAFF_MANAGER', 'STAFF_ADMIN', 'SUPER_ADMIN'], name: 'GET /admin/rbac/permissions' },
  { m: 'GET',  p: '/notifications',                 allowed: ['STAFF_SALES', 'STAFF_SUPPORT', 'CONTENT_MANAGER', 'STAFF_MANAGER', 'STAFF_ADMIN', 'SUPER_ADMIN'], name: 'GET /notifications (DASHBOARD_ROLES)' },
  { m: 'GET',  p: '/admin/customers',               allowed: ['STAFF_SALES', 'STAFF_SUPPORT', 'STAFF_MANAGER', 'STAFF_ADMIN', 'SUPER_ADMIN'], name: 'GET /admin/customers (CUSTOMER_VIEW)' },
  { m: 'GET',  p: '/users/wholesale-accounts',      allowed: ['STAFF_MANAGER', 'STAFF_ADMIN', 'SUPER_ADMIN'], name: 'GET /users/wholesale-accounts' },
  { m: 'GET',  p: '/tasks',                         allowed: ['STAFF_SALES', 'STAFF_SUPPORT', 'CONTENT_MANAGER', 'STAFF_MANAGER', 'STAFF_ADMIN', 'SUPER_ADMIN'], name: 'GET /tasks' },
  { m: 'GET',  p: '/admin/reports/sales',           allowed: ['STAFF_SUPPORT', 'CONTENT_MANAGER', 'STAFF_MANAGER', 'STAFF_SALES', 'STAFF_ADMIN', 'SUPER_ADMIN'], name: 'GET /admin/reports/sales' },
  { m: 'GET',  p: '/auth/me',                       allowed: ROLES, name: 'GET /auth/me (any authenticated role)' },
];

module.exports = async function run() {
  const R = new Results('03-rbac');

  // pre-login every role once (avoids login rate limit; tokens cached)
  const tokens = {};
  for (const role of ROLES) {
    try {
      const scope = role.includes('CUSTOMER') ? 'storefront' : 'dashboard';
      tokens[role] = (await login(role, scope)).accessToken;
    } catch (e) {
      R.fail(`Pre-test login for role ${role}`, e.message);
    }
  }
  await rbacMatrix(R, api, tokens, ROLES, ENDPOINTS);
  await hierarchy(R, api, tokens);
  R.save();
  return R.tests;
};

async function rbacMatrix(R, api, tokens, ROLES, ENDPOINTS) {
  let matrixFails = 0;
  for (const ep of ENDPOINTS) {
    const bad = [];
    for (const role of ROLES) {
      const expectedAllowed = ep.allowed.includes(role);
      const r = await api(ep.m, ep.p, { token: tokens[role], body: ep.body, headers: ep.headers });
      const ok = expectedAllowed ? r.status !== 401 && r.status !== 403 : r.status === 403;
      if (!ok) {
        bad.push(`${role}:${r.status}(expected ${expectedAllowed ? 'non-403' : '403'})`);
        matrixFails++;
      }
    }
    if (bad.length === 0) R.pass(`RBAC: ${ep.name}`, `allowed=${ep.allowed.join(',')}`);
    else R.fail(`RBAC: ${ep.name}`, `violations → ${bad.join(' | ')}`);
  }

  // unauthenticated access to every staff endpoint → 401
  let unauthFails = 0;
  for (const ep of ENDPOINTS.filter((e) => e.p !== '/auth/me')) {
    const r = await api(ep.m, ep.p, { body: ep.body, headers: ep.headers });
    if (r.status !== 401) { unauthFails++; R.fail(`Unauthenticated ${ep.m} ${ep.p} → 401`, `got ${r.status}`); }
  }
  if (unauthFails === 0) R.pass('All staff endpoints reject unauthenticated requests with 401', `${ENDPOINTS.length - 1} endpoints checked`);
}

async function hierarchy(R, api, tokens) {
  const sup = tokens['SUPER_ADMIN'];
  const qaEmail = `qa-hier-${Date.now()}@aamako.test`;

  // 1. SUPER_ADMIN creates a STAFF_SUPPORT qa user
  let r = await api('POST', '/admin/users', { token: sup, body: { email: qaEmail, password: 'Hier1234', firstName: 'Qa', role: 'STAFF_SUPPORT' } });
  if (r.status === 201 || r.status === 200) {
    R.pass('Hierarchy: SUPER_ADMIN can create STAFF_SUPPORT user');
    const qaId = r.json?.id;

    // 2. STAFF_ADMIN cannot create another STAFF_ADMIN (rank)
    r = await api('POST', '/admin/users', {
      token: tokens['STAFF_ADMIN'],
      body: { email: `qa-admin-${Date.now()}@aamako.test`, password: 'Hier1234', firstName: 'Qa', role: 'STAFF_ADMIN' },
    });
    r.status === 403
      ? R.pass('Hierarchy: STAFF_ADMIN cannot create another STAFF_ADMIN (403)')
      : R.fail('Hierarchy: STAFF_ADMIN cannot create another STAFF_ADMIN (403)', `status=${r.status} ${JSON.stringify(r.json).slice(0, 150)}`);

    // 3. STAFF_SALES cannot create STAFF_ADMIN (forbidden target)
    r = await api('POST', '/admin/users', {
      token: tokens['STAFF_SALES'],
      body: { email: `qa-admin2-${Date.now()}@aamako.test`, password: 'Hier1234', firstName: 'Qa', role: 'STAFF_ADMIN' },
    });
    r.status === 403
      ? R.pass('Hierarchy: STAFF_SALES cannot create STAFF_ADMIN (403)')
      : R.fail('Hierarchy: STAFF_SALES cannot create STAFF_ADMIN (403)', `status=${r.status}`);

    // 4. STAFF_ADMIN cannot modify SUPER_ADMIN (outranks fails)
    const users = await api('GET', '/admin/users', { token: sup });
    const superUser = (users.json || []).find((u) => u.role === 'SUPER_ADMIN');
    if (superUser) {
      r = await api('PATCH', `/admin/users/${superUser.id}/credentials`, { token: tokens['STAFF_ADMIN'], body: { firstName: 'Hacked' } });
      r.status === 403
        ? R.pass('Hierarchy: STAFF_ADMIN cannot modify SUPER_ADMIN (403)')
        : R.fail('Hierarchy: STAFF_ADMIN cannot modify SUPER_ADMIN (403)', `status=${r.status} ${JSON.stringify(r.json).slice(0, 150)}`);
    }

    // 5. STAFF_MANAGER cannot delete; ADMIN can delete the qa user (cleanup)
    if (qaId) {
      r = await api('DELETE', `/admin/users/${qaId}`, { token: tokens['STAFF_MANAGER'] });
      r.status === 403
        ? R.pass('Hierarchy: STAFF_MANAGER cannot DELETE users (403)')
        : R.fail('Hierarchy: STAFF_MANAGER cannot DELETE users (403)', `status=${r.status}`);
      r = await api('DELETE', `/admin/users/${qaId}`, { token: tokens['STAFF_ADMIN'] });
      [200, 204].includes(r.status)
        ? R.pass('Cleanup: STAFF_ADMIN deleted qa test user')
        : R.fail('Cleanup: STAFF_ADMIN deleted qa test user', `status=${r.status}`);
    }
  } else {
    R.fail('Hierarchy: SUPER_ADMIN can create STAFF_SUPPORT user', `status=${r.status} ${JSON.stringify(r.json).slice(0, 150)}`);
  }

  // 6. SUPER_ADMIN bypass contract
  r = await api('GET', '/admin/products', { token: sup });
  r.status === 200 ? R.pass('SUPER_ADMIN bypasses role list (guard contract)') : R.fail('SUPER_ADMIN bypasses role list (guard contract)', `status=${r.status}`);
}
