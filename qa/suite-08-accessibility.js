'use strict';
/** Suite 08 — Accessibility (axe-core, WCAG 2.1 AA) on key pages of both surfaces. */
const fs = require('fs');
const { Results, CFG, launch, shot, sleep } = require('./lib');
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

const PAGES = [
  { name: 'storefront /index.html', url: CFG.WEB + '/index.html' },
  { name: 'storefront /collection.html', url: CFG.WEB + '/collection.html' },
  { name: 'storefront /cart.html', url: CFG.WEB + '/cart.html' },
  { name: 'storefront /signin.html', url: CFG.WEB + '/signin.html' },
  { name: 'dashboard /login', url: CFG.ADMIN + '/login' },
];

module.exports = async function run() {
  const R = new Results('08-accessibility');
  const browser = await launch();

  for (const p of PAGES) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    try {
      await page.goto(p.url, { waitUntil: 'networkidle', timeout: 25000 });
    } catch { await page.goto(p.url, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {}); }
    await sleep(800);
    await page.addScriptTag({ content: AXE });
    const res = await page.evaluate(() => window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } })).catch((e) => null);
    if (!res) { R.fail(`axe-core run on ${p.name}`, 'axe failed to execute'); await ctx.close(); continue; }
    const critical = res.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    const moderate = res.violations.filter((v) => v.impact === 'moderate');
    const minor = res.violations.filter((v) => v.impact === 'minor');
    const summary = res.violations.map((v) => `${v.impact}: ${v.id} (${v.nodes.length} nodes)`).slice(0, 6).join(', ');

    if (critical.length === 0) R.pass(`A11y ${p.name}: no critical/serious WCAG 2.1 A/AA violations`, minor.length + moderate.length ? `other: ${summary}` : 'clean');
    else R.fail(`A11y ${p.name}: no critical/serious WCAG 2.1 A/AA violations`, summary, { evidence: `artifacts/08-axe-${p.name.replace(/[^a-z0-9]+/gi, '-')}.png` });
    await shot(page, `08-axe-${p.name.replace(/[^a-z0-9]+/gi, '-')}.png`);
    await ctx.close();
  }

  // keyboard navigation: tab reaches interactive elements on storefront index
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(CFG.WEB + '/index.html', { waitUntil: 'networkidle' }).catch(() => {});
  const focusables = [];
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      const cs = el ? getComputedStyle(el) : null;
      return { tag: el?.tagName, text: (el?.textContent || '').trim().slice(0, 30), outline: cs ? cs.outlineStyle !== 'none' || cs.boxShadow !== 'none' : false };
    });
    focusables.push(info);
  }
  const focusableCount = focusables.filter((f) => ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(f.tag)).length;
  focusableCount >= 5
    ? R.pass('Keyboard: Tab reaches interactive elements on storefront', `${focusableCount}/25 stops interactive`)
    : R.fail('Keyboard: Tab reaches interactive elements on storefront', `only ${focusableCount}/25 stops interactive`);
  const focusVisible = focusables.filter((f) => f.outline).length;
  focusVisible > 0
    ? R.pass('Keyboard: visible focus indicator detected', `${focusVisible} stops show outline/box-shadow`)
    : R.warn('Keyboard: visible focus indicator detected', 'no outline/box-shadow on focused elements in first 25 stops');

  await browser.close();
  R.save();
  return R.tests;
};
