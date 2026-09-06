'use strict';
/** Suite 10 — Performance: page weight, timings, slow requests, unoptimized images. */
const { Results, CFG, launch, sleep } = require('./lib');

const PAGES = [
  { name: 'storefront index', url: CFG.WEB + '/index.html' },
  { name: 'storefront collection', url: CFG.WEB + '/collection.html' },
  { name: 'dashboard login', url: CFG.ADMIN + '/login' },
];

module.exports = async function run() {
  const R = new Results('10-performance');
  const browser = await launch();

  for (const p of PAGES) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    let bytes = 0; let count = 0; const slow = []; const noDims = [];
    page.on('response', async (res) => {
      try { const h = res.headers(); bytes += Number(h['content-length'] || 0); } catch {}
      count++;
      const t = res.request().timing && res.request().timing().responseTime;
      if (t && t > 1000) slow.push(`${res.url().split('/').pop().slice(0, 40)} (${Math.round(t)}ms)`);
    });
    const t0 = Date.now();
    try { await page.goto(p.url, { waitUntil: 'networkidle', timeout: 30000 }); }
    catch { await page.goto(p.url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}); }
    const loadMs = Date.now() - t0;
    const nav = await page.evaluate(() => {
      const n = performance.getEntriesByType('navigation')[0];
      const paint = performance.getEntriesByType('paint').find((e) => e.name === 'first-contentful-paint');
      return { dcl: Math.round(n?.domContentLoadedEventEnd || 0), load: Math.round(n?.loadEventEnd || 0), fcp: Math.round(paint?.startTime || 0) };
    });

    loadMs < 5000
      ? R.pass(`Load time OK: ${p.name}`, `${loadMs}ms (DCL=${nav.dcl}ms FCP~${nav.fcp}ms)`)
      : R.fail(`Load time OK: ${p.name}`, `${loadMs}ms (>5s)`);
    R.add(bytes < 3_000_000 ? 'PASS' : 'WARN', `Page weight: ${p.name}`, `${(bytes / 1024).toFixed(0)} KB across ${count} requests${bytes >= 3_000_000 ? ' (heavy >3MB)' : ''}`);
    slow.length === 0
      ? R.pass(`No requests >1s: ${p.name}`)
      : R.fail(`No requests >1s: ${p.name}`, slow.slice(0, 5).join(' | '));

    // images: natural size vs rendered (unoptimized) + lazy attribute
    const imgs = await page.evaluate(() => [...document.querySelectorAll('img')].slice(0, 30).map((i) => ({
      src: (i.currentSrc || i.src || '').split('/').pop().slice(0, 50),
      nw: i.naturalWidth, rw: Math.round(i.getBoundingClientRect().width),
      alt: i.alt, loading: i.loading,
    })));
    const oversized = imgs.filter((i) => i.nw > 0 && i.rw > 0 && i.nw > i.rw * 2);
    oversized.length === 0
      ? R.pass(`No images >2x rendered size: ${p.name}`, `${imgs.length} imgs checked`)
      : R.fail(`No images >2x rendered size: ${p.name}`, oversized.slice(0, 4).map((i) => `${i.src} nat=${i.nw} rendered=${i.rw}`).join(' | '));
    const noAlt = imgs.filter((i) => i.src && !i.alt);
    noAlt.length === 0
      ? R.pass(`All images have alt text: ${p.name}`)
      : R.fail(`All images have alt text: ${p.name}`, noAlt.slice(0, 4).map((i) => i.src).join(' | '));
    await ctx.close();
  }

  await browser.close();
  R.save();
  return R.tests;
};
