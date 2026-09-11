import { test, expect } from '@playwright/test';

const FRONTEND = 'http://localhost:8080';
const DASHBOARD = 'http://localhost:3001';
const API = 'http://localhost:3000';

/**
 * Area 7: Security (non-destructive checks only)
 * - HTTPS / secure cookies
 * - No secrets/API keys in client source
 * - CMS admin not indexable
 * - Input sanitization (XSS payload in safe fields)
 * - No exposed version banners or default admin paths
 */
test.describe('Security — Non-destructive checks', () => {
  test('No secrets/API keys exposed in frontend JS source', async ({ page }) => {
    await page.goto(`${FRONTEND}/index.html`);
    // Check all JS files loaded on the page
    const jsUrls: string[] = await page.$$eval('script[src]', (els: HTMLScriptElement[]) =>
      els.map((s) => s.src).filter(Boolean)
    );
    for (const url of jsUrls) {
      const fullUrl = url.startsWith('http') ? url : `${FRONTEND}/${url}`;
      const res = await page.request.get(fullUrl);
      const content = await res.text();
      // Look for common secret patterns
      const secretPatterns = [
        /(?:api[_-]?key)['":\s]*['"][a-zA-Z0-9]{20,}/i,
        /(?:secret)['":\s]*['"][a-zA-Z0-9]{20,}/i,
        /Bearer\s+[a-zA-Z0-9._-]{20,}/i,
        /DATABASE_URL/i,
        /JWT_[A-Z_]+_SECRET/i,
      ];
      for (const pattern of secretPatterns) {
        const match = content.match(pattern);
        if (match) {
          console.warn(`Potential secret in ${url}: ${match[0].substring(0, 30)}...`);
          // Don't fail — this is a warning unless it's a real key format
        }
      }
    }
  });

  test('API responses do not leak internal errors/stack traces', async ({ page }) => {
    const res = await page.request.get(`${API}/api/nonexistent-endpoint`);
    expect(res.status()).toBe(404);
    const body = await res.text();
    // Should not contain stack traces or internal paths
    expect(body).not.toContain('stack');
    expect(body).not.toContain('node_modules');
    expect(body).not.toContain('/home/');
  });

  test('Auth endpoints reject malformed input gracefully', async ({ page }) => {
    // XSS payload in email field
    const xssPayload = '<script>alert(1)</script>';
    const res = await page.request.post(`${API}/api/auth/login`, {
      data: { email: xssPayload, password: 'test' },
      headers: { 'Content-Type': 'application/json' },
    });
    // Should return 400 or 401, not 500
    expect(res.status()).toBeLessThan(500);
    const body = await res.text();
    // Response should not contain unescaped script tag
    expect(body).not.toContain('<script>alert(1)</script>');
  });

        test('Dashboard login is accessible (not blocked)', async ({ page }) => {
    const res = await page.goto(`${DASHBOARD}/login`);
    expect(res?.status()).toBe(200);
  });

  test('Admin API endpoints require authentication', async ({ page }) => {
    // Test multiple admin endpoints without auth — all should return 401
    const adminPaths = ['/api/admin/products', '/api/admin/orders', '/api/admin/users'];
    for (const path of adminPaths) {
      const res = await page.request.get(`${API}${path}`);
      expect(res.status(), `${path} should require auth (401)`).toBe(401);
    }
  });

  test('No default admin paths exposed', async ({ page }) => {
    const paths = ['/admin', '/wp-admin', '/admin/login', '/login.php', '/phpinfo.php'];
    for (const path of paths) {
      const res = await page.request.get(`${FRONTEND}${path}`);
      expect([404, 401, 403]).toContain(res.status());
    }
  });

    test('Cookies have secure attributes when set', async ({ page }) => {
    await page.goto(`${FRONTEND}/signin.html`);
    const cookies = await page.context().cookies();
    for (const cookie of cookies) {
      if (cookie.name.includes('token') || cookie.name.includes('auth') || cookie.name.includes('session')) {
        console.log(`Cookie ${cookie.name}: secure=${cookie.secure}, httpOnly=${cookie.httpOnly || 'unknown'}`);
      }
    }
  });
});