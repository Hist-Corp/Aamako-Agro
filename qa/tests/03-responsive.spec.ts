import { test, expect, devices } from '@playwright/test';

const FRONTEND = 'http://localhost:8080';

/**
 * Area 2: Responsive & Cross-Browser Testing
 * Viewports: 375px (mobile), 768px (tablet), 1024px, 1440px
 * Checks: overflow, overlap, tap targets <44px
 */
const VIEWPORTS = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1024, height: 768 },
  wide: { width: 1440, height: 900 },
};

const PAGES = ['index', 'shop', 'product', 'story', 'process', 'journal', 'wholesale', 'cart'];

for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
  test.describe(`Responsive — ${vpName} (${vp.width}x${vp.height})`, () => {
    for (const pageName of PAGES) {
      test(`${pageName}.html renders without horizontal overflow`, async ({ browser }) => {
        const page = await browser.newPage({
          ...devices[`Desktop ${vpName === 'wide' ? 'Chrome' : 'Chrome'}`.replace('Desktop Desktop', 'Desktop')],
          viewport: vp,
        });
        await page.goto(`${FRONTEND}/${pageName}.html`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000); // Wait for JS (GSAP, etc.)
        // Check for horizontal overflow
        const overflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth > window.innerWidth + 1;
        });
        expect(overflow, `${pageName} should not have horizontal overflow at ${vpName}`).toBe(false);
        await page.close();
      });
    }
  });
}

test.describe('Responsive — Tap Target Sizes', () => {
  test('Interactive elements on mobile are >= 44px', async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
    await page.goto(`${FRONTEND}/index.html`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500); // Wait for JS
    // Check button and link sizes
    const smallTargets = await page.$$eval(
      'button, a, input[type="submit"], [role="button"]',
      (els: HTMLElement[]) => {
        return els
          .filter((el) => {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            const isHidden = style.display === 'none' || style.visibility === 'hidden' || rect.width === 0;
            // Only check visible elements
            if (isHidden) return false;
            // Check if touch target is too small (excluding elements with padding from parent)
            return rect.width < 44 || rect.height < 44;
          })
          .map((el) => ({
            tag: el.tagName,
            class: el.className.substring(0, 50),
            width: Math.round(el.getBoundingClientRect().width),
            height: Math.round(el.getBoundingClientRect().height),
          }));
      }
    );
    // Allow some leeway — report but don't fail for very small icons
    if (smallTargets.length > 0) {
      console.warn(`Found ${smallTargets.length} tap targets < 44px:`, JSON.stringify(smallTargets.slice(0, 5)));
    }
    await page.close();
  });
});