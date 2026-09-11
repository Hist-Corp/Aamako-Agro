import { test, expect } from '@playwright/test';

/**
 * Area 4: Performance (Lighthouse)
 * Runs Lighthouse on key pages and checks performance metrics.
 * NOTE: requires chrome-launcher + lighthouse devDependencies.
 */
const lh = require('lighthouse');
const chromeLauncher = require('chrome-launcher');

test.describe('Performance — Lighthouse Scores', () => {
  const PAGES = [
    { name: 'homepage', url: 'http://localhost:8080/index.html' },
    { name: 'shop', url: 'http://localhost:8080/shop.html' },
    { name: 'product', url: 'http://localhost:8080/product.html' },
  ];

  test.describe.configure({ mode: 'serial' });

  for (const p of PAGES) {
    test(`Lighthouse ${p.name} (${p.url})`, async () => {
      const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });
      try {
        const results = await lh(p.url, { output: 'json', port: chrome.port, onlyCategories: ['performance'] });
        const json = results.lhr || results;
        const score = json.categories;
        const perf = score.performance?.score ? Math.round(score.performance.score * 100) : 0;
        const cls = json.audits['cumulative-layout-shift']?.numericValue ?? 'N/A';
        const lcp = json.audits['largest-contentful-paint']?.numericValue ?? 'N/A';
        const tbt = json.audits['total-blocking-time']?.numericValue ?? 'N/A';
        console.log(`[${p.name}] Performance: ${perf}/100, LCP: ${lcp}ms, CLS: ${cls}, TBT: ${tbt}ms`);
        expect(perf, `${p.name} performance score should be >= 50`).toBeGreaterThanOrEqual(50);
      } finally {
        await chrome.kill();
      }
    }, { timeout: 120000 });
  }
});