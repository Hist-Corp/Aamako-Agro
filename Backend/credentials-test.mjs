// Live test of the Admin/Super-Admin credentials administration flow
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
  let data = {}; try { data = await res.json(); } catch {}
  return { status: res.status, data };
}
const login = async (email, password) =>
  (await req('POST', '/auth/login', { body: { email, password } }));

// admin (STAFF_ADMIN) and manager (STAFF_MANAGER)
const adminT = (await login('admin@aamako.agro', 'Admin123!')).data.accessToken;
const mgrT = (await login('manager@aamako.agro', 'Manager123!')).data.accessToken;
check('admin + manager logins', !!adminT && !!mgrT);

// create a temp staff user to administer
const email = `credtest_${Date.now()}@test.com`;
const OLD_PW = 'OldPass123!';
const NEW_PW = 'NewPass456!';
let r = await req('POST', '/admin/users', {
  body: { email, password: OLD_PW, firstName: 'Cred', lastName: 'Tester', role: 'STAFF_SALES' },
  token: adminT,
});
check('admin creates staff user', r.status === 200 || r.status === 201, JSON.stringify(r.data).slice(0, 150));
const userId = r.data.id;

// target can log in with old password; capture their refresh token
const oldLogin = await login(email, OLD_PW);
check('user logs in with OLD password before change', oldLogin.status === 200, `got ${oldLogin.status}`);
const oldRefresh = oldLogin.data.refreshToken;

// NON-admin cannot edit credentials
r = await req('PATCH', `/admin/users/${userId}/credentials`, { body: { password: 'Hacked123!' }, token: mgrT });
check('manager (non-admin) denied → 403', r.status === 403, `got ${r.status}`);

// admin edits self → blocked
const adminId = ((await req('GET', '/admin/users', { token: adminT })).data.find(u => u.email === 'admin@aamako.agro')).id;
r = await req('PATCH', `/admin/users/${adminId}/credentials`, { body: { firstName: 'X' }, token: adminT });
check('admin editing own account via this endpoint → 400', r.status === 400, `got ${r.status}`);

// admin changes password + profile of the staff user
r = await req('PATCH', `/admin/users/${userId}/credentials`, {
  body: { firstName: 'Cred2', phone: '+9779811111111', password: NEW_PW },
  token: adminT,
});
check('admin updates credentials + password', r.status === 200 && r.data.passwordChanged === true, `status=${r.status} ${JSON.stringify(r.data).slice(0,150)}`);

// OLD password must now be REJECTED by the database
r = await login(email, OLD_PW);
check('login with OLD password → 401 (rejected by DB hash)', r.status === 401, `got ${r.status}`);

// NEW password works
r = await login(email, NEW_PW);
check('login with NEW password → 200', r.status === 200, `got ${r.status}`);

// the user's pre-change session must be revoked
r = await req('POST', '/auth/refresh', { body: { refreshToken: oldRefresh } });
check('user pre-change refresh token revoked', r.status === 401, `got ${r.status}`);

// profile fields updated
r = await req('GET', '/admin/users', { token: adminT });
const u = r.data.find(x => x.id === userId);
check('profile fields updated in DB', u && u.firstName === 'Cred2' && u.phone === '+9779811111111', JSON.stringify(u).slice(0,150));

// email change + duplicate email guard
r = await req('PATCH', `/admin/users/${userId}/credentials`, { body: { email: 'manager@aamako.agro' }, token: adminT });
check('changing email to an existing one → 409', r.status === 409, `got ${r.status}`);
const newEmail = `credtest2_${Date.now()}@test.com`;
r = await req('PATCH', `/admin/users/${userId}/credentials`, { body: { email: newEmail }, token: adminT });
check('email change allowed to free address', r.status === 200, `got ${r.status}`);
r = await login(newEmail, NEW_PW);
check('login with new email + new password', r.status === 200, `got ${r.status}`);

console.log(`\n===== RESULTS: ${pass} passed, ${fail} failed =====`);
if (errors.length) { console.log('FAILURES:'); errors.forEach(e => console.log(' - ' + e)); }
