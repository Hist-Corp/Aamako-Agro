'use strict';
/** QA runner — executes all suites sequentially, prints summary, exits non-zero on failures. */
const suites = [
  ['01-api-functional', () => require('./suite-01-api-functional')()],
  ['02-auth',           () => require('./suite-02-auth')()],
  ['03-rbac',           () => require('./suite-03-rbac')()],
  ['04-checkout',       () => require('./suite-04-checkout')()],
  ['05-cms',            () => require('./suite-05-cms')()],
  ['06-ui-storefront',  () => require('./suite-06-ui-storefront')()],
  ['07-ui-dashboard',   () => require('./suite-07-ui-dashboard')()],
  ['08-accessibility',  () => require('./suite-08-accessibility')()],
  ['09-responsive',     () => require('./suite-09-responsive')()],
  ['10-performance',    () => require('./suite-10-performance')()],
  ['11-security',       () => require('./suite-11-security')()],
  ['12-seo',            () => require('./suite-12-seo')()],
];

(async () => {
  const t0 = Date.now();
  const only = process.argv.slice(2).map((s) => s.toLowerCase());
  const selected = only.length
    ? suites.filter(([name]) => only.some((a) => name.startsWith(a) || name.includes(a)))
    : suites;
  if (selected.length === 0) {
    console.error('No suites match filter: ' + only.join(', '));
    process.exitCode = 1;
    return;
  }
  console.log('Aamako-Agro QA Harness' + (only.length ? '  [suites: ' + selected.map(([n]) => n).join(', ') + ']' : ''));
  console.log('API=' + require('./config').API + '  WEB=' + require('./config').WEB + '  ADMIN=' + require('./config').ADMIN);
  const all = [];
  for (const [name, fn] of selected) {
    const before = all.length;
    console.log('\n--- ' + name + ' ---');
    try { all.push(...(await fn())); } catch (e) { console.error('  crashed: ' + e.message); all.push({ suite: name, status: 'ERROR', name: 'Suite crashed', detail: e.message }); }
    const suiteTests = all.slice(before);
    const p = suiteTests.filter((t) => t.status === 'PASS').length;
    const f = suiteTests.filter((t) => t.status === 'FAIL' || t.status === 'ERROR').length;
    console.log('  ' + p + ' passed, ' + f + ' failed');
    await new Promise((res) => setTimeout(res, 5000)); // breathing room for login throttle window
  }

  const totals = { PASS: 0, FAIL: 0, WARN: 0, ERROR: 0 };
  for (const t of all) totals[t.status] = (totals[t.status] || 0) + 1;

  console.log('\n==========================================');
  console.log('  SUMMARY: ' + all.length + ' checks | PASS ' + totals.PASS + ' | FAIL ' + totals.FAIL + ' | WARN ' + totals.WARN + ' | ERROR ' + totals.ERROR);
  console.log('  Duration: ' + Math.round((Date.now() - t0) / 1000) + 's');
  console.log('==========================================');
  const fails = all.filter((t) => t.status === 'FAIL' || t.status === 'ERROR');
  if (fails.length) {
    console.log('\nFAILURES:');
    for (const f of fails) console.log('  [' + f.status + '] ' + f.name + ' -- ' + (f.detail || ''));
  }
  const warns = all.filter((t) => t.status === 'WARN');
  if (warns.length) {
    console.log('\nWARNINGS:');
    for (const w of warns) console.log('  [WARN] ' + w.name + ' -- ' + (w.detail || ''));
  }
  process.exitCode = fails.length ? 1 : 0;
})();
