'use strict';
/** Suite 02 — Auth flows: register, login, scope separation, refresh, logout, profile. */
const { Results, api, login, CFG } = require('./lib');

module.exports = async function run() {
  const R = new Results('02-auth');
  const email = `qa-${Date.now()}@aamako.test`;

  // register (default = retail customer)
  let r = await api('POST', '/auth/register', { body: { email, password: 'QaPass123', firstName: 'Qa', lastName: 'Tester' } });
  r.status === 201 || r.status === 200
    ? R.pass('POST /auth/register creates account', `email=${email}`)
    : R.fail('POST /auth/register creates account', `status=${r.status} ${JSON.stringify(r.json).slice(0, 200)}`);

  // duplicate register
  r = await api('POST', '/auth/register', { body: { email, password: 'QaPass123', firstName: 'Qa' } });
  [400, 409].includes(r.status)
    ? R.pass('Duplicate registration rejected (409/400)', `status=${r.status}`)
    : R.fail('Duplicate registration rejected (409/400)', `status=${r.status}`);

  // weak password
  r = await api('POST', '/auth/register', { body: { email: `w${Date.now()}@t.io`, password: 'short', firstName: 'W' } });
  r.status === 400 ? R.pass('Weak password rejected with 400')
    : R.fail('Weak password rejected with 400', `status=${r.status}`);

  // login with wrong password
  r = await api('POST', '/auth/login', { body: { email, password: 'WrongPass1', scope: 'storefront' } });
  r.status === 401 ? R.pass('Login with wrong password → 401')
    : R.fail('Login with wrong password → 401', `status=${r.status}`);

  // storefront scope login for the new retail user
  r = await api('POST', '/auth/login', { body: { email, password: 'QaPass123', scope: 'storefront' } });
  r.status === 200 ? R.pass('Storefront login for retail user 200')
    : R.fail('Storefront login for retail user 200', `status=${r.status} ${JSON.stringify(r.json).slice(0, 150)}`);
  const rt = r.json?.refreshToken;
  const at = r.json?.accessToken;

  // surface separation: staff on storefront must fail
  r = await api('POST', '/auth/login', { body: { ...CFG.CREDS.SUPER_ADMIN, scope: 'storefront' } });
  r.status === 403 || r.status === 401
    ? R.pass('Staff account blocked from storefront login (surface separation)', `status=${r.status}`)
    : R.fail('Staff account blocked from storefront login (surface separation)', `status=${r.status}`);

  // customer on dashboard scope must fail
  r = await api('POST', '/auth/login', { body: { email, password: 'QaPass123', scope: 'dashboard' } });
  r.status === 403 || r.status === 401
    ? R.pass('Customer account blocked from dashboard login (surface separation)', `status=${r.status}`)
    : R.fail('Customer account blocked from dashboard login (surface separation)', `status=${r.status}`);

  // /auth/me with the new token
  r = await api('GET', '/auth/me', { token: at });
  (r.status === 200 && r.json?.email === email)
    ? R.pass('GET /auth/me returns profile')
    : R.fail('GET /auth/me returns profile', `status=${r.status} body=${JSON.stringify(r.json).slice(0, 150)}`);
  r.json?.passwordHash !== undefined
    ? R.fail('GET /auth/me does not leak passwordHash', 'passwordHash present in response!')
    : R.pass('GET /auth/me does not leak passwordHash');

  // refresh rotates tokens
  r = await api('POST', '/auth/refresh', { body: { refreshToken: rt } });
  r.status === 200 && r.json?.accessToken
    ? R.pass('POST /auth/refresh issues new tokens')
    : R.fail('POST /auth/refresh issues new tokens', `status=${r.status}`);
  const rt2 = r.json?.refreshToken;

  // old refresh token must be revoked (rotation)
  r = await api('POST', '/auth/refresh', { body: { refreshToken: rt } });
  r.status === 401 || r.status === 403
    ? R.pass('Old refresh token revoked after rotation', `status=${r.status}`)
    : R.fail('Old refresh token revoked after rotation', `status=${r.status}`);

  // logout invalidates session
  r = await api('POST', '/auth/logout', { body: { refreshToken: rt2 } });
  r.status === 200 || r.status === 201 ? R.pass('POST /auth/logout 200') : R.fail('POST /auth/logout 200', `status=${r.status}`);
  r = await api('POST', '/auth/refresh', { body: { refreshToken: rt2 } });
  [401, 403].includes(r.status)
    ? R.pass('Refresh token unusable after logout')
    : R.fail('Refresh token unusable after logout', `status=${r.status}`);

  // access token expired/garbage -> 401 on protected route
  r = await api('GET', '/auth/me', { token: 'garbage.token.value' });
  r.status === 401 ? R.pass('Garbage bearer token → 401') : R.fail('Garbage bearer token → 401', `status=${r.status}`);

  R.save();
  return R.tests;
};
