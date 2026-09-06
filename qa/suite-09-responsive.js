'use strict';
/** Suite 09 — Responsive layout: 4 viewports, overflow, tap targets, screenshots. */
const { Results, CFG, launch, shot, sleep } = require('./lib');

const VIEWPORTS = [375, 768, 1024, 1440];
const PAGES = [CFG.WEB + '/index.html', CFG.WEB + '/collection.html', CFG.WEB + '/cart.html', CFG.ADMIN + '/login'];

module.exports = async function run() {
  const R = new Results('09-responsive');
  const browser = await launch();

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp, height: 900 } });
    for (const url of PAGES) {
      const page = await ctx.newPage();
      const label = `${url.replace(/^https?:\/\/[^/]+/, '')} @ ${vp}px`;
      try { await page.goto(url, { waitUntil: 'networkidle', timeout: 25000 }); }
      catch { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {}); }
      await sleep(600);

      // horizontal overflow check
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      overflow <= 0
        ? R.pass(`No horizontal overflow: ${label}`)
        : R.fail(`No horizontal overflow: ${label}`, `scrollWidth exceeds viewport by ${overflow}px`);

      // tap targets on mobile
      if (vp === 375) {
        const smallTargets = await page.evaluate(() => {
          const bad = [];
          for (const el of document.querySelectorAll('a, button, [role="button"], input[type="submit"]')) {
            const r = el.getBoundingClientRect();
            const visible = r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
            if (visible && (r.width < 44 || r.height < 44)) {
              bad.push(`<${el.tagName.toLowerCase()} ${[el.className].join(' ').slice(0, 30)} ${Math.round(r.width)}x${Math.round(r.height)}>`);
            }
            if (bad.length > 5) break;
          }
          return bad;
        });
        smallTargets.length === 0
          ? R.pass(`Tap targets >=44px on mobile: ${url.replace(/^https?:\/\/[^/]+/, '')}`)
          : R.fail(`Tap targets >=44px on mobile: ${url.replace(/^https?:\/\/[^/]+/, '')}`, smallTargets.join(' | '));
      }

      const name = `09-${url.replace(/^https?:\/\/(.+?)\//, '').replace(/[^a-z0-9]+/gi, '-')}-${vp}.png`;
      await shot(page, name);
      await page.close();
    }
    await ctx.close();
  }

  // element overlap probe (nav vs content) at 375px
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await ctx.newPage();
  await page.goto(CFG.WEB + '/index.html', { waitUntil: 'networkidle' }).catch(() => {});
  await sleep(500);
  const overlap = await page.evaluate(() => {
    const header = document.querySelector('header, .nav, nav');
    if (!header) return null;
    const h = header.getBoundingClientRect();
    const main = document.querySelector('main, .hero, section');
    if (!main) return null;
    const m = main.getBoundingClientRect();
    return m.top < h.bottom && h.bottom > m.top + 20 ? `header bottom=${Math.round(h.bottom)} main top=${Math.round(m.top)}` : null;
  });
  overlap ? R.warn('Mobile: header/content overlap probe', `possible overlap: ${overlap} (verify visually in artifacts)`) : R.pass('Mobile: no header/content overlap detected');
  await shot(page, '09-overlap-probe-375.png');
  await ctx.close();

  await browser.close();
  R.save();
  return R.tests;
};
