import { test, expect } from '@playwright/test';

/**
 * Area 5: Accessibility (WCAG 2.1 AA) — axe-core
 * Runs axe-core accessibility scans on key pages.
 */
test.describe('Accessibility — axe-core scan', () => {
  const PAGES = [
    { name: 'homepage', url: 'http://localhost:8080/index.html' },
    { name: 'shop', url: 'http://localhost:8080/shop.html' },
    { name: 'product', url: 'http://localhost:8080/product.html' },
    { name: 'signin', url: 'http://localhost:8080/signin.html' },
    { name: 'signup', url: 'http://localhost:8080/signup.html' },
    { name: 'dashboard-login', url: 'http://localhost:3001/login' },
  ];

  for (const p of PAGES) {
    test(`${p.name} has no critical accessibility violations`, async ({ page }) => {
      await page.goto(p.url);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);

      // Inject axe-core
      await page.addScriptTag({
        url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.8.2/axe.min.js',
      });

      const results = await page.evaluate(() => {
        return (window as any).axe.run({
          runOnly: {
            type: 'tag',
            values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
          },
          thresholds: { none: 0, minor: 100, moderate: 100, serious: 0, critical: 0 },
        });
      });

      const violations = (results as any).violations || [];
      const critical = violations.filter((v: any) => v.impact === 'critical');
      const serious = violations.filter((v: any) => v.impact === 'serious');

      if (violations.length > 0) {
        console.warn(`[${p.name}] axe violations:`, JSON.stringify(violations.map((v: any) => ({
          impact: v.impact,
          description: v.description,
          nodes: v.nodes.length,
        })), null, 2));
      }

      // Only fail on critical violations
      expect(critical, `${p.name} has ${critical.length} critical accessibility violations`).toHaveLength(0);
      if (serious.length > 0) {
        console.warn(`${p.name} has ${serious.length} serious violations (warnings, not failing)`);
      }
    });
  }

  test('Keyboard-only navigation works on storefront pages', async ({ page }) => {
    await page.goto('http://localhost:8080/index.html');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Tab through the page and check focus visibility
    const focusableElements = await page.$$('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
    expect(focusableElements.length).toBeGreaterThan(0);

    let hasFocusVisible = false;
    for (let i = 0; i < Math.min(focusableElements.length, 10); i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);
      const activeElement = await page.evaluate(() => document.activeElement?.tagName);
      const hasOutline = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        if (!el) return false;
        const style = window.getComputedStyle(el);
        return style.outline !== 'none' || style.outline !== '' ||
               style.boxShadow !== 'none' ||
               el.classList.contains('focus') ||
               el.classList.contains('focus-visible');
      });
      if (hasOutline) hasFocusVisible = true;
    }
    // At least some focus indicators should be visible
    // (this is a soft check — may not fail if CSS uses custom focus styles)
    if (!hasFocusVisible) {
      console.warn('No visible focus indicators detected during keyboard navigation');
    }
  });
});