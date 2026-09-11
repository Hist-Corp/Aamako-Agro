import { test, expect } from '@playwright/test';

const FRONTEND = 'http://localhost:8080';
const DASHBOARD = 'http://localhost:3001';
const API = 'http://localhost:3000/api';
const PAGES = ['index', 'shop', 'product', 'cart', 'signin', 'signup', 'account', 'orders', 'profile', 'story', 'process', 'journal', 'wholesale', 'collection'];

/**
 * Area 1: Functional Front-End Testing
 * - Every nav link resolves (no 404/500)
 * - Forms: valid + invalid data, validation, error messages
 * - API endpoints return correct data
 */
test.describe('Frontend — Page Accessibility (no 404/500)', () => {
  for (const page of PAGES) {
    test(`${page}.html returns 200`, async ({ page: p }) => {
      const res = await p.goto(`${FRONTEND}/${page}.html`);
      expect(res).not.toBeNull();
      expect(res!.status()).toBeLessThan(400);
      const title = await p.title();
      expect(title.length).toBeGreaterThan(0);
    });
  }
});

test.describe('Frontend — Navigation Links Resolve', () => {
  test('Homepage nav links all resolve', async ({ page: p }) => {
    await p.goto(`${FRONTEND}/index.html`);
    const links = await p.$$eval('a[href$=".html"]', (els: HTMLAnchorElement[]) =>
      els.map((a) => a.getAttribute('href') || '').filter(Boolean)
    );
    expect(links.length).toBeGreaterThan(0);
    const uniqueLinks = [...new Set(links)];
        for (const href of uniqueLinks) {
      const fullUrl = href.startsWith('http') ? href : `${FRONTEND}/${href}`;
      const res = await p.request.get(fullUrl);
      expect(res.status(), `Link ${href} should resolve`).toBeLessThan(400);
    }
  });
});

test.describe('Frontend — API Endpoint Status', () => {
  test('Public API endpoints return valid responses', async ({ page: p }) => {
    const endpoints = [
      { path: '/products', expectStatus: 200 },
      { path: '/categories', expectStatus: 200 },
      { path: '/content', expectStatus: 200 },
      { path: '/pricing/quote', expectStatus: 200 },
      { path: '/auth/google-client-id', expectStatus: 200 },
      { path: '/auth/login', expectStatus: 401, method: 'POST', data: { email: 'nobody@x.com', password: 'x' } },
      { path: '/auth/register', expectStatus: 400, method: 'POST', data: {} },
      { path: '/support/tickets', expectStatus: 400, method: 'POST', data: {} },
    ];
    for (const ep of endpoints) {
      const opts: any = { method: ep.method || 'GET' };
      if (ep.data) {
        opts.data = JSON.stringify(ep.data);
        opts.headers = { 'Content-Type': 'application/json' };
      }
      const res = await p.request.fetch(`${API}${ep.path}`, opts);
      expect(res.status(), `${ep.path} should return ${ep.expectStatus}`).toBe(ep.expectStatus);
      const body = await res.text();
      expect(body.length, `${ep.path} should have a response body`).toBeGreaterThan(0);
    }
  });
});

test.describe('Frontend — Auth Form Validation', () => {
  test('Login form rejects invalid credentials', async ({ page: p }) => {
    await p.goto(`${FRONTEND}/signin.html`);
    const emailInput = p.locator('input[type="email"], input[name="email"], input[id*="email"]').first();
    const passInput = p.locator('input[type="password"], input[name="password"], input[id*="password"]').first();
    if (await emailInput.count() > 0) {
      await emailInput.fill('invalid@test.com');
    }
    if (await passInput.count() > 0) {
      await passInput.fill('wrongpassword123');
    }
    await p.click('button[type="submit"]');
    await p.waitForTimeout(2000);
    // Should either show error or remain on signin page
    expect(p.url()).toContain('signin');
  });

  test('Signup form shows validation for empty fields', async ({ page: p }) => {
    await p.goto(`${FRONTEND}/signup.html`);
    await p.click('button[type="submit"]');
    await p.waitForTimeout(1000);
    // Browser-native validation should prevent submission
    expect(p.url()).toContain('signup');
  });
});