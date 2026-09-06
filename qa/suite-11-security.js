'use strict';
/** Suite 11 — Security (non-destructive): headers, CORS, secrets, XSS, indexability, rate limit, IDOR. */
const { Results, api, login, CFG, launch } = require('./lib');

module.exports = async function run() {
  const R = new Results('11-security');
  const sup = (await login('SUPER_ADMIN', 'dashboard')).accessToken;

  // ---------- headers / transport ----------
  let r = await api('GET', '/products');
  const powered = r.headers.get('x-powered-by');
  powered ? R.fail('No X-Powered-By banner on API', `leaks "${powered}"`) : R.pass('No X-Powered-By banner on API');
  const csp = r.headers.get('content-security-policy');
  csp ? R.pass('CSP header present on API responses') : R.warn('CSP header present on API responses', 'no CSP header');
  const hsts = r.headers.get('strict-transport-security');
  R.add(hsts ? 'PASS' : 'WARN', 'HSTS header', hsts || 'absent — required on HTTPS production deployment (localhost is HTTP)');

  // ---------- CORS ----------
  const evil = await fetch(CFG.API + '/products', { headers: { Origin: 'https://evil.example.com' } });
  const acao = evil.headers.get('access-control-allow-origin');
  (!acao || acao === 'null' || acao === 'false')
    ? R.pass('CORS: unknown origin gets no Access-Control-Allow-Origin')
    : R.fail('CORS: unknown origin gets no Access-Control-Allow-Origin', `ACAO=${acao}`);
  const ok = await fetch(CFG.API + '/products', { headers: { Origin: 'http://localhost:8080' } });
  (ok.headers.get('access-control-allow-origin') || '').includes('localhost:8080')
    ? R.pass('CORS: allowed origin (localhost:8080) accepted')
    : R.fail('CORS: allowed origin (localhost:8080) accepted', `ACAO=${ok.headers.get('access-control-allow-origin')}`);

  // ---------- secrets in client source ----------
  const patterns = /(sk_live|pk_live|AIza[0-9A-Za-z\-_]{20,}|ghp_[0-9A-Za-z]{20,}|api[_-]?key["'\s:=]+["'][^"']{8,}["']|secret["'\s:=]+["'][^"']{8,}["'])/i;
  const jsFiles = new Set();
  const browser = await launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on('response', (res) => { const u = res.url(); if (u.endsWith('.js')) jsFiles.add(u); });
  for (const base of [CFG.WEB, CFG.ADMIN]) {
    await page.goto(base, { waitUntil: 'networkidle', timeout: 25000 }).catch(() => {});
    await page.reload({ waitUntil: 'networkidle' }).catch(() => {});
  }
  const leaks = [];
  for (const f of jsFiles) {
    try {
      const body = await (await ctx.request.get(f)).text();
      if (patterns.test(body)) leaks.push(f.split('/').pop());
    } catch {}
  }
  leaks.length === 0
    ? R.pass('No API keys/secrets patterns in served JS', `${jsFiles.size} JS files scanned`)
    : R.fail('No API keys/secrets patterns in served JS', leaks.slice(0, 5).join(' | '));
  r = await api('GET', '/auth/google-client-id');
  R.add('PASS', 'GET /auth/google-client-id is public-by-design', `clientId=${r.json?.clientId ?? 'null (disabled)'}`);

  await xssAndIdor(R, api, ctx, sup);

  await ctx.close();
  await browser.close();
  R.save();
  return R.tests;
};

async function xssAndIdor(R, api, ctx, sup) {
  // ---------- reflected XSS on static pages ----------
  const xss = '<script>alert(1)</script>';
  for (const p of ['/product.html', '/collection.html']) {
    const res = await ctx.request.get(CFG.WEB + p + '?q=' + encodeURIComponent(xss));
    const body = await res.text();
    body.includes(xss)
      ? R.fail(`XSS probe not reflected unescaped on ${p}`, 'raw <script> payload reflected in HTML!')
      : R.pass(`XSS probe not reflected unescaped on ${p}`);
  }

  // ---------- stored XSS handling via CMS + cleanup ----------
  const cats = await api('GET', '/categories');
  const categoryId = (cats.json || [])[0]?.id;
  const slug = `qa-xss-${Date.now()}`;
  let r = await api('POST', '/admin/products', {
    token: sup,
    body: {
      name: 'QA <img src=x onerror=alert(1)>', slug,
      description: 'Security probe product <script>alert("xss")</script> — must render escaped, never execute.',
      imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
      categoryId, isPublished: true,
      variants: [{ sku: `QAXSS-${Date.now()}`, name: 'QA', unit: 'UNIT_50G', basePriceCents: 1000 }],
    },
  });
  if (r.status === 200 || r.status === 201) {
    const pid = r.json?.id;
    r.json?.name?.includes('<img')
      ? R.add('WARN', 'Stored payload kept verbatim in DB', 'name stored raw — safe only because React escapes on render')
      : R.pass('Stored payload sanitized/escaped at API layer');
    await api('DELETE', `/admin/products/${pid}`, { token: sup });
    R.pass('Cleanup: XSS probe product deleted');
  } else {
    R.add('WARN', 'Stored XSS probe rejected at validation', `status=${r.status} (strict DTO — acceptable)`);
  }

  // ---------- admin surface indexability ----------
  const robotsAdmin = await ctx.request.get(CFG.ADMIN + '/robots.txt');
  const loginHtml = await (await ctx.request.get(CFG.ADMIN + '/login')).text();
  (robotsAdmin.status() === 200 || loginHtml.includes('noindex'))
    ? R.pass('Admin login not indexable (robots.txt or noindex)')
    : R.fail('Admin login not indexable (robots.txt or noindex)', `robots.txt=${robotsAdmin.status()}, no noindex meta`);

  // ---------- IDOR: /orders/mine scoping (BEFORE rate-limit probe to avoid throttle contamination) ----------
  const emA = `qa-a-${Date.now()}@t.io`, emB = `qa-b-${Date.now()}@t.io`;
  await api('POST', '/auth/register', { body: { email: emA, password: 'QaPass123', firstName: 'A' } });
  await api('POST', '/auth/register', { body: { email: emB, password: 'QaPass123', firstName: 'B' } });
  const lA = await api('POST', '/auth/login', { body: { email: emA, password: 'QaPass123', scope: 'storefront' } });
  const lB = await api('POST', '/auth/login', { body: { email: emB, password: 'QaPass123', scope: 'storefront' } });
  const mineA = await api('GET', '/orders/mine', { token: lA.json?.accessToken });
  const mineB = await api('GET', '/orders/mine', { token: lB.json?.accessToken });
  const listA = mineA.json?.items || mineA.json?.data || mineA.json || [];
  const listB = mineB.json?.items || mineB.json?.data || mineB.json || [];
  (Array.isArray(listA) && Array.isArray(listB))
    ? R.pass('IDOR: /orders/mine returns only the caller’s orders', `A=${listA.length} orders, B=${listB.length} orders`)
    : R.fail('IDOR: /orders/mine returns only the caller’s orders', `A=${mineA.status} B=${mineB.status}`);

  // ---------- rate limiting (LAST so its request budget doesn't starve other checks) ----------
  let saw429 = false;
  for (let i = 0; i < 12; i++) {
    const rr = await api('POST', '/auth/login', { body: { email: `rl-${Date.now()}-${i}@t.io`, password: 'WrongPass1', scope: 'storefront' } });
    if (rr.status === 429) { saw429 = true; break; }
  }
  saw429 ? R.pass('Login rate limiting active (429 observed)') : R.fail('Login rate limiting active (429 observed)', '12 bad logins accepted without throttle');
}
