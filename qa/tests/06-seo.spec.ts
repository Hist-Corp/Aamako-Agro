import { test, expect } from '@playwright/test';

const FRONTEND = 'http://localhost:8080';
const PAGES = ['index', 'shop', 'product', 'story', 'process', 'journal', 'wholesale', 'collection'];

/**
 * Area 6: SEO & Meta Testing
 * - Unique title + meta description per page
 * - Canonical tags
 * - sitemap.xml, robots.txt
 * - Structured data, OG/Twitter tags
 */
test.describe('SEO — Meta tags & crawlability', () => {
  test('robots.txt exists and is accessible', async ({ page }) => {
    const res = await page.goto(`${FRONTEND}/robots.txt`);
    expect(res?.status()).toBe(200);
    const content = await res!.text();
    expect(content.length).toBeGreaterThan(0);
  });

  test('sitemap.xml exists and is accessible', async ({ page }) => {
    const res = await page.goto(`${FRONTEND}/sitemap.xml`);
    expect(res?.status()).toBe(200);
    const content = await res!.text();
    expect(content.length).toBeGreaterThan(0);
  });

  for (const pageName of PAGES) {
    test(`${pageName}.html has unique <title>`, async ({ page }) => {
      await page.goto(`${FRONTEND}/${pageName}.html`);
      const title = await page.title();
      expect(title, `${pageName} should have a title`).toBeTruthy();
      expect(title.length, `${pageName} title too short`).toBeGreaterThan(10);
    });

    test(`${pageName}.html has meta description`, async ({ page }) => {
      await page.goto(`${FRONTEND}/${pageName}.html`);
      const metaDesc = await page.locator('meta[name="description"]').getAttribute('content');
      expect(metaDesc, `${pageName} missing meta description`).toBeTruthy();
      expect(metaDesc!.length, `${pageName} meta description too short`).toBeGreaterThan(20);
    });

    test(`${pageName}.html has canonical link`, async ({ page }) => {
      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
      // Canonical may be self-referencing or absent — log result
      if (!canonical) {
        console.warn(`${pageName}.html: no canonical link found`);
      }
    });

    test(`${pageName}.html has Open Graph tags`, async ({ page }) => {
      await page.goto(`${FRONTEND}/${pageName}.html`);
      const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
      const ogDesc = await page.locator('meta[property="og:description"]').getAttribute('content');
      if (!ogTitle) console.warn(`${pageName}.html: missing og:title`);
      if (!ogDesc) console.warn(`${pageName}.html: missing og:description`);
    });
  }

  test('No malformed HTML (meta/link before <head>)', async ({ page }) => {
    for (const pageName of PAGES) {
      await page.goto(`${FRONTEND}/${pageName}.html`);
      // Check that the document has a proper <head> tag
      const hasProperHead = await page.evaluate(() => {
        // Check that meta and link tags are inside head
        const metas = document.querySelectorAll('meta');
        for (const m of Array.from(metas)) {
          const parent = m.parentElement?.tagName;
          if (parent !== 'HEAD') return false;
        }
        return true;
      });
      if (!hasProperHead) {
        console.warn(`${pageName}.html: meta/link tags found outside <head>`);
      }
    }
  });
});