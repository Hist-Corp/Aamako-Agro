'use strict';
/** QA runner — executes all suites sequentially, prints summary, exits non-zero on failures. */
const fs = require('fs');
const path = require('path');

// --- single-instance guard ---------------------------------------------------
// The API throttles POST /auth/login to 10 requests/minute per IP. Two harness
// runs sharing one backend (or one backend shared with manual logins) burn that
// budget and produce cascading 429 failures that look like product bugs — e.g.
// suite 02's *first* login 429ing. Refuse to start a second concurrent run.
const LOCK = path.join(__dirname, '.runner.lock');
function acquireLock() {
  try {
    const prev = JSON.parse(fs.readFileSync(LOCK, 'utf8'));
    if (prev && prev.pid && prev.pid !== process.pid) {
      let alive = true;
      try {
        process.kill(prev.pid, 0); // signal 0 = liveness probe, does not kill
      } catch {
        alive = false; // stale lock left by a killed/crashed run
      }
      if (alive) {
        console.error(
          `\nA QA run is already in progress (pid ${prev.pid}, started ${prev.startedAt}).\n` +
            'Refusing to start a second harness: concurrent runs exhaust the API login\n' +
            'throttle (10/min per IP) and report false 429 failures.\n' +
            `Wait for it to finish, or delete ${LOCK} if it is stale.`,
        );
        process.exit(1);
      }
    }
  } catch {
    /* no lock file yet (or unreadable) — fall through and take it */
  }
  fs.writeFileSync(LOCK, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
  const release = () => {
    try {
      fs.unlinkSync(LOCK);
    } catch {
      /* already gone */
    }
  };
  process.on('exit', release);
  process.on('SIGINT', () => {
    release();
    process.exit(130);
  });
  process.on('SIGTERM', () => {
    release();
    process.exit(143);
  });
}
acquireLock();

// Extra cooldown (ms) after a suite, on top of the default 5s breathing room.
// POST /auth/login is capped at 10 attempts/min per IP, and the limiter's
// 60s window is rolling — suite 02 spends 4 logins and suite 03 immediately
// needs 8 more for its role matrix, so without a full-window pause suite 03
// burns its retry backoff. Waiting out the window once here keeps the rest of
// the run deterministic (suites 04+ reuse lib.login()'s token cache).
const COOLDOWN_AFTER = {
  '02-auth': 60_000,
};
const DEFAULT_GAP_MS = 5_000;

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
    // breathing room so the login-throttle window can roll (see COOLDOWN_AFTER)
    const gap = COOLDOWN_AFTER[name] ?? DEFAULT_GAP_MS;
    if (gap > DEFAULT_GAP_MS) console.log(`  … cooling down ${Math.round(gap / 1000)}s to clear the login throttle window`);
    await new Promise((res) => setTimeout(res, gap));
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
