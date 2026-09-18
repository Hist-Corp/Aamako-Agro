'use strict';
/** Shared QA helpers: HTTP client, token cache, results recorder, Playwright utils. */
const fs = require('fs');
const path = require('path');
const CFG = require('./config');

fs.mkdirSync(CFG.ARTIFACTS, { recursive: true });
fs.mkdirSync(__dirname + '/results', { recursive: true });

/* ---------------- results recorder ---------------- */
class Results {
  constructor(suite) {
    this.suite = suite;
    this.tests = [];
  }
  add(status, name, detail, extra) {
    this.tests.push({ status, name, detail: detail || '', ...(extra || {}) });
    const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '●';
    console.log(`  ${icon} [${status}] ${name}${detail ? ' — ' + detail : ''}`);
  }
  pass(name, detail, extra) { this.add('PASS', name, detail, extra); }
  fail(name, detail, extra) { this.add('FAIL', name, detail, extra); }
  warn(name, detail, extra) { this.add('WARN', name, detail, extra); }
  save() {
    fs.writeFileSync(`${__dirname}/results/${this.suite}.json`, JSON.stringify(this.tests, null, 2));
    return this.tests;
  }
}

/* ---------------- API client ---------------- */
const LOGIN_LIMIT = 10; // POST /auth/login = 10 requests/min per IP (see qa/README.md)
const LOGIN_WINDOW_MS = 60_000;
let _loginAttempts = []; // timestamps of logins this harness has issued

/**
 * Record a login attempt. Called from api() for every POST /auth/login.
 * Conservative: attempts that came back 429 are counted too, so the harness may
 * pause slightly longer than strictly necessary — never shorter.
 */
function noteLogin() {
  const now = Date.now();
  _loginAttempts = _loginAttempts.filter((t) => now - t < LOGIN_WINDOW_MS);
  _loginAttempts.push(now);
}

/**
 * Sleep until `needed` login slots are free in the API's rolling 60s window.
 *
 * The limit counts failed attempts, so a suite that logs in as many roles can
 * push a later suite (or a browser-driven UI login the harness cannot
 * intercept) into a 429 that looks like a product bug. Call this immediately
 * before any login the harness does not issue through api() — Playwright
 * journeys in suites 06/07 — so those get a guaranteed slot.
 */
async function waitForLoginBudget(needed = 1, label = '') {
  for (let guard = 0; guard < 20; guard++) {
    const now = Date.now();
    _loginAttempts = _loginAttempts.filter((t) => now - t < LOGIN_WINDOW_MS);
    if (_loginAttempts.length + needed <= LOGIN_LIMIT) return;
    const wait = Math.max(1000, LOGIN_WINDOW_MS - (now - _loginAttempts[0]) + 1000);
    console.log(
      `  … login budget ${_loginAttempts.length}/${LOGIN_LIMIT} used${label ? ` (${label})` : ''}` +
        ` — waiting ${Math.round(wait / 1000)}s for the throttle window to roll`,
    );
    await sleep(wait);
  }
}

async function api(method, p, { token, body, headers, raw } = {}) {
  if (method === 'POST' && p === '/auth/login') noteLogin();
  const res = await fetch(CFG.API + p, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text.slice(0, 400) }; }
  return { status: res.status, json, text, headers: res.headers };
}

/* ---------------- token cache (one login per role, reused) ---------------- */
const _tokens = new Map();
async function login(role, scope = 'dashboard') {
  const key = role + ':' + scope;
  if (_tokens.has(key)) return _tokens.get(key);
  const c = CFG.CREDS[role];
  let r = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    await waitForLoginBudget(1, `${role} login`); // don't spend an attempt on a guaranteed 429
    r = await api('POST', '/auth/login', { body: { email: c.email, password: c.password, scope } });
    if (r.status === 429) { await new Promise((res) => setTimeout(res, 20000 + attempt * 15000)); continue; }
    break;
  }
  if (r.status !== 200) throw new Error(`login failed for ${role} (${scope}): ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`);
  const val = { accessToken: r.json.accessToken, refreshToken: r.json.refreshToken, user: r.json.user };
  _tokens.set(key, val);
  return val;
}

/* ---------------- Playwright ---------------- */
async function launch() {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  return browser;
}
async function shot(page, name) {
  const file = path.join(CFG.ARTIFACTS, name);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

module.exports = {
  CFG,
  Results,
  api,
  login,
  launch,
  shot,
  sleep,
  stamp,
  LOGIN_LIMIT,
  LOGIN_WINDOW_MS,
  waitForLoginBudget,
  // Record a login the harness issued outside api() (Playwright journeys in
  // suites 06/07) so later waitForLoginBudget() calls stay accurate.
  recordLogin: noteLogin,
};
