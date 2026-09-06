'use strict';
/** Suite 07 — Admin dashboard UI (CMS): login, pages render per role. */
const { Results, CFG, launch, shot, sleep } = require('./lib');

module.exports = async function run() {
  const R = new Results('07-ui-dashboard');
  const browser = await launch();

  // ---- SUPER_ADMIN journey ----
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const loginErrors = [];
  page.on('response', (res) => { if (res.status() >= 400 && res.url().includes('/api/')) loginErrors.push(`${res.status()} ${res.url()}`); });

  await page.goto(CFG.ADMIN + '/login', { waitUntil: 'networkidle' });
  await shot(page, '07-admin-login.png');

  await page.fill('input[type="email"], input[name="email"]', 'admin@aamako.agro');
  await page.fill('input[type="password"], input[name="password"]', 'Admin123!');
  const loginResp = page.waitForResponse((res) => res.url().includes('/auth/login'), { timeout: 10000 }).catch(() => null);
  await page.click('button[type="submit"], button:has-text("Sign")').catch(() => {});
  const resp = await loginResp;
  resp && resp.status() === 200
    ? R.pass('Dashboard UI: SUPER_ADMIN login 200')
    : R.fail('Dashboard UI: SUPER_ADMIN login 200', `status=${resp ? resp.status() : 'no request'}`);
  await sleep(2500);
  await shot(page, '07-admin-dashboard.png');
  const url1 = page.url();
  url1.includes('dashboard') || !url1.includes('login')
    ? R.pass('Dashboard UI: redirected into app after login', `url=${url1}`)
    : R.fail('Dashboard UI: redirected into app after login', `still on ${url1}`);

  for (const path of ['/dashboard', '/products', '/orders', '/users', '/content', '/settings']) {
    const r = await ctx.request.get(CFG.ADMIN + path).catch(() => null);
    if (!r) { R.warn(`Dashboard page /${path}`, 'request failed'); continue; }
    r.status() === 200 ? R.pass(`Dashboard page /${path} renders 200`) : R.fail(`Dashboard page /${path} renders 200`, `status=${r.status()}`);
  }
  await page.goto(CFG.ADMIN + '/products', { waitUntil: 'networkidle' }).catch(() => {});
  await sleep(1500);
  await shot(page, '07-admin-products.png');
  const severes = loginErrors.filter((e) => e.startsWith('5'));
  severes.length === 0 ? R.pass('No 5xx API calls while browsing dashboard') : R.fail('No 5xx API calls while browsing dashboard', severes.slice(0, 5).join(' | '));

  // ---- low-privilege role: STAFF_SUPPORT must NOT see user management data ----
  const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p2 = await ctx2.newPage();
  await p2.goto(CFG.ADMIN + '/login', { waitUntil: 'networkidle' });
  await p2.fill('input[type="email"], input[name="email"]', 'support@aamako.agro');
  await p2.fill('input[type="password"], input[name="password"]', 'Support123!');
  await p2.click('button[type="submit"], button:has-text("Sign")').catch(() => {});
  await sleep(2500);
  const usersBlocked = await p2.evaluate(async () => {
    const t = localStorage.getItem('access_token') || localStorage.getItem('accessToken') || localStorage.getItem('token');
    const r = await fetch('/api/admin/users', { headers: t ? { Authorization: 'Bearer ' + t } : {} });
    return r.status;
  });
  usersBlocked === 403
    ? R.pass('Dashboard UI: STAFF_SUPPORT gets 403 from /admin/users (server-enforced)')
    : R.fail('Dashboard UI: STAFF_SUPPORT gets 403 from /admin/users (server-enforced)', `status=${usersBlocked}`);
  await shot(p2, '07-admin-support-role.png');

  // ---- customer must not reach the dashboard app at all (retry on throttle) ----
  const ctx3 = await browser.newContext();
  const p3 = await ctx3.newPage();
  let custStatus = 0;
  for (let i = 0; i < 3 && custStatus !== 200 && custStatus !== 403 && custStatus !== 401; i++) {
    await p3.goto(CFG.ADMIN + '/login', { waitUntil: 'networkidle' });
    await p3.fill('input[type="email"], input[name="email"]', 'customer@aamako.agro');
    await p3.fill('input[type="password"], input[name="password"]', 'Customer123!');
    const custLogin = p3.waitForResponse((res) => res.url().includes('/auth/login'), { timeout: 10000 }).catch(() => null);
    await p3.click('button[type="submit"], button:has-text("Sign")').catch(() => {});
    const cresp = await custLogin;
    custStatus = cresp ? cresp.status() : 0;
    if (custStatus === 429) await sleep(20000);
  }
  (custStatus === 403 || custStatus === 401)
    ? R.pass('Dashboard UI: customer login rejected at the door', `status=${custStatus}`)
    : R.fail('Dashboard UI: customer login rejected at the door', `status=${custStatus} (server issues dashboard tokens to customers — see suite 02)`);

  await browser.close();
  R.save();
  return R.tests;
};
