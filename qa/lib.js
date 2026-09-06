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
async function api(method, p, { token, body, headers, raw } = {}) {
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

module.exports = { CFG, Results, api, login, launch, shot, sleep, stamp };
