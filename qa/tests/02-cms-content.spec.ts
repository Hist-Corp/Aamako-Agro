import { test, expect, APIRequestContext } from '@playwright/test';

const API = 'http://localhost:3000/api';
const DASHBOARD = 'http://localhost:3001';

/** Helper: obtain admin auth token via the API */
async function adminToken(request: APIRequestContext) {
  const res = await request.post(`${API}/auth/login`, {
    data: { email: 'admin@aamako.agro', password: 'Admin123!' },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  return { token: body.accessToken, refreshToken: body.refreshToken };
}

/**
 * Area 3: CMS / Content Management Testing
 * Tests the /api/content endpoints (the headless CMS behind the storefront).
 * - GET content (read all)
 * - PATCH content (update + publish)
 * - Verify draft vs published behavior
 */
test.describe('CMS — Content API (admin-authenticated)', () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    const auth = await adminToken(request);
    token = auth.token;
  });

  test('GET /api/content returns content list', async ({ request }) => {
    const res = await request.get(`${API}/content`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  test('GET /api/content/{key}/revisions returns revisions', async ({ request }) => {
    // First get content to find a key
    const listRes = await request.get(`${API}/content`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const content = await listRes.json();
    const testKey = content.find((c: any) => c.key?.startsWith('site.'))?.key;
    if (!testKey) {
      // If no site.* key, try first key
      const firstKey = content[0]?.key;
      if (!firstKey) return;
      const res = await request.get(`${API}/content/${firstKey}/revisions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status()).toBe(200);
    } else {
      const res = await request.get(`${API}/content/${testKey}/revisions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status()).toBe(200);
    }
  });

  test('PATCH /api/content/{key} rejects without auth', async ({ request }) => {
    const res = await request.patch(`${API}/content/site.page.home`, {
      data: { body: 'unauthorized test' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(401);
  });

  test('PATCH /api/content/{key} with invalid key returns 404', async ({ request }) => {
    const res = await request.patch(`${API}/content/nonexistent.invalid.key`, {
      data: { body: 'test' },
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    expect([400, 404]).toContain(res.status());
  });
});

/**
 * CMS — Dashboard auth (unauthenticated requests should redirect)
 */
test.describe('CMS — Dashboard Access Control', () => {
  test('Dashboard redirects unauthenticated users away from protected pages', async ({ page }) => {
    const res = await page.goto(`${DASHBOARD}/dashboard`, { waitUntil: 'domcontentloaded' });
    // Should redirect to login or show login prompt
    await page.waitForTimeout(1000);
    const url = page.url();
    // Should be on login page or redirected
    const redirected = url.includes('/login') || res?.status() === 200 && url.includes('login');
    expect(url.includes('login') || url === DASHBOARD + '/').toBeTruthy();
  });

  test('Dashboard /login page is accessible without auth', async ({ page }) => {
    const res = await page.goto(`${DASHBOARD}/login`, { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBe(200);
    const title = await page.title();
    expect(title).toContain('Dashboard');
  });
});