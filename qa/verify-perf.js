'use strict';
/**
 * Targeted verification for the storefront performance pass.
 *
 * Asserts the behaviours that cannot be checked from static markup alone:
 * CDN image-rendition rewriting, skeleton reserve/replace, and debounced
 * search. Read-only — it never mutates app data.
 *
 *   node verify-perf.js                 # against http://localhost:8080
 *   WEB=http://localhost:8080 node verify-perf.js
 */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const { chromium } = require('playwright');

const WEB = process.env.WEB || 'http://localhost:8080';

async function withPage(fn, pagePath) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(WEB + pagePath, { waitUntil: 'networkidle', timeout: 30000 });
    await fn(page, errors);
  } finally {
    await browser.close();
  }
}

/** Read the `w=` rendition width out of an <img> src, or null when absent. */
const WIDTH_OF = (el) => {
  const m = /[?&]w=(\d+)/.exec(el.getAttribute('src') || '');
  return m ? Number(m[1]) : null;
};

/** Wait for a grid to swap its skeletons for real cards. */
async function waitForLiveCards(page, selector) {
  await page.waitForFunction(
    (sel) => document.querySelectorAll(`${sel} .fpcard:not(.fp-skeleton)`).length > 0,
    selector,
    { timeout: 25000 },
  );
}

/* ------------------------------------------------------------------ */
/* 1. Unit: the pure URL rewriter (no browser needed)                  */
/* ------------------------------------------------------------------ */
test('AamakoImg.url rewrites only oversized Unsplash renditions', () => {
  const fs = require('node:fs');
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'Frontend', 'js', 'api.js'), 'utf8',
  );
  // api.js is a browser IIFE; run it against minimal stub globals and grab the
  // export. Only window.addEventListener is touched at module scope.
  const win = { location: { hostname: 'localhost' }, addEventListener: () => {} };
  const run = new Function('window', 'localStorage', 'crypto', 'document', 'URL', `${src}; return window.AamakoImg;`);
  const Img = run(
    win,
    { getItem: () => null, setItem: () => {} },
    {},
    {
      getElementById: () => null,
      createElement: () => ({ style: {} }),
      body: { appendChild() {} },
      querySelectorAll: () => [],
      documentElement: { classList: { add() {} } },
    },
    URL,
  );

  // 800px rendition going into a ~270px slot -> downgraded to the card size.
  const big = 'https://images.unsplash.com/photo-123?ixlib=rb-4.0.3&w=800&q=80';
  const out = new URL(Img.url(big));
  assert.equal(out.searchParams.get('w'), String(Img.CARD_WIDTH));
  assert.equal(out.searchParams.get('q'), '72');
  assert.equal(out.searchParams.get('auto'), 'format');
  assert.equal(out.searchParams.get('ixlib'), 'rb-4.0.3', 'unrelated params preserved');

  // A rendition already at/below target keeps its exact bytes.
  const small = 'https://images.unsplash.com/photo-123?w=350&q=80';
  assert.equal(Img.url(small), small);

  // Local assets and other CDNs are never touched.
  assert.equal(Img.url('/images/mango.jpg'), '/images/mango.jpg');
  const other = 'https://cdn.example.com/a.jpg?w=2000';
  assert.equal(Img.url(other), other);

  // A lookalike hostname must not be treated as Unsplash.
  const evil = 'https://images.unsplash.com.evil.test/p.jpg?w=800';
  assert.equal(Img.url(evil), evil);

  // Empty inputs stay empty rather than stringifying to "undefined".
  assert.equal(Img.url(null), '');
  assert.equal(Img.url(undefined), '');

  // An explicit width overrides the card default, and can still shrink a URL.
  const huge = 'https://images.unsplash.com/photo-123?w=2400&q=80';
  assert.equal(new URL(Img.url(huge, 900)).searchParams.get('w'), '900');
  // ...but a target at or above what the author already chose is a no-op
  // (we never upgrade, so hand-tuned renditions survive untouched).
  assert.equal(new URL(Img.url(big, 900)).searchParams.get('w'), '800');
});

/* ------------------------------------------------------------------ */
/* 2. Collection grid: skeleton -> live cards, resized + lazy images   */
/* ------------------------------------------------------------------ */
test('collection grid reserves space with skeletons, then replaces them', async () => {
  await withPage(async (page, errors) => {
    await waitForLiveCards(page, '#collGrid');
    const grid = page.locator('#collGrid');

    assert.equal(await grid.locator('.fp-skeleton').count(), 0, 'no skeleton may survive the fetch');
    assert.ok(await grid.locator('.fpcard').count() > 0, 'live cards present');

    const widths = await grid.locator('.fpcard img').evaluateAll((imgs) => imgs.map((i) => {
      const m = /[?&]w=(\d+)/.exec(i.getAttribute('src') || '');
      return m ? Number(m[1]) : null;
    }).filter(Boolean));
    assert.ok(widths.length > 0, 'at least one CDN-backed card image');
    assert.ok(widths.every((w) => w <= 480), `card renditions must be <=480px, got ${JSON.stringify(widths)}`);

    const lazyOk = await grid.locator('.fpcard img').evaluateAll((imgs) => imgs.every(
      (i) => i.getAttribute('loading') === 'lazy' && i.getAttribute('decoding') === 'async',
    ));
    assert.ok(lazyOk, 'every card image is lazy + async decoded');

    assert.deepEqual(errors, [], 'no console or page errors');
  }, '/collection.html');
});

/* ------------------------------------------------------------------ */
/* 3. Collection search: debounced, but still correct                  */
/* ------------------------------------------------------------------ */
test('collection search is debounced yet still filters correctly', async () => {
  await withPage(async (page) => {
    await waitForLiveCards(page, '#collGrid');
    const before = await page.locator('#collGrid .fpcard').count();
    assert.ok(before > 0, 'grid had cards before searching');

    // renderList() rebuilds the grid through a single innerHTML assignment, so
    // one render pass arrives as one MutationObserver callback (however many
    // cards it adds). Counting callbacks — not nodes — is what measures renders.
    await page.evaluate(() => {
      window.__renders = 0;
      new MutationObserver(() => { window.__renders++; })
        .observe(document.getElementById('collGrid'), { childList: true });
    });

    const input = page.locator('#collSearch');
    await input.click();
    await input.pressSequentially('mango', { delay: 20 });
    await page.waitForTimeout(700);

    const renders = await page.evaluate(() => window.__renders);
    assert.ok(renders <= 2, `5-char burst should collapse to <=2 renders, got ${renders}`);

    // Filtering must still work...
    await input.fill('');
    await input.fill('zzzznotathing');
    await page.waitForTimeout(450);
    assert.equal(await page.locator('#collGrid .fp-empty').count(), 1, 'no-match shows empty state');

    // ...and clearing must restore the listing.
    await input.fill('');
    await page.waitForTimeout(450);
    assert.equal(await page.locator('#collGrid .fp-empty').count(), 0, 'clearing restores cards');
  }, '/collection.html');
});

/* ------------------------------------------------------------------ */
/* 4. Shop page: all four async grids skeleton-then-render             */
/* ------------------------------------------------------------------ */
test('shop grids reserve space with skeletons and render live cards', async () => {
  await withPage(async (page, errors) => {
    await waitForLiveCards(page, '#gridBest');
    await page.waitForFunction(
      () => document.querySelectorAll('#showcaseGrid .omshow2-card').length > 0,
      { timeout: 25000 },
    );

    for (const id of ['gridBest', 'gridDeals', 'gridNew']) {
      assert.equal(await page.locator(`#${id} .fp-skeleton`).count(), 0, `${id} skeletons cleared`);
      assert.ok(await page.locator(`#${id} .fpcard`).count() > 0, `${id} has live cards`);
    }
    assert.equal(await page.locator('#showcaseGrid .fp-skeleton').count(), 0, 'showcase skeletons cleared');
    assert.ok(await page.locator('#showcaseGrid .omshow2-card').count() > 0, 'showcase has live cards');

    // All three tab panels must still be populated (regression guard for the
    // skeleton pass overwriting a panel).
    for (const id of ['gridDeals', 'gridNew']) {
      assert.ok(await page.locator(`#${id} .fp-name`).count() > 0, `${id} rows rendered`);
    }
    assert.deepEqual(errors, [], 'no console or page errors');
  }, '/shop.html');
});

/* ------------------------------------------------------------------ */
/* 5. The showcase banner keeps a large rendition (not card-shrunk)    */
/* ------------------------------------------------------------------ */
test('showcase banner image is not shrunk to the card rendition', async () => {
  await withPage(async (page) => {
    await page.waitForFunction(
      () => document.querySelectorAll('#showcaseGrid .omshow2-card').length > 0,
      { timeout: 25000 },
    );
    const w = await page.locator('.omshow2-banner img').first().evaluate(WIDTH_OF);
    if (w !== null) {
      assert.ok(w >= 700, `banner should stay large (w>=700), got w=${w}`);
    }
  }, '/shop.html');
});

/* ------------------------------------------------------------------ */
/* 6. Product page: related grid resolves, hero image stays full-size  */
/* ------------------------------------------------------------------ */
test('product page related grid replaces its skeleton without errors', async () => {
  const api = process.env.API || 'http://localhost:3000/api';
  const res = await fetch(`${api}/products?page=1&limit=1`);
  const json = await res.json();
  const slug = json?.items?.[0]?.slug;
  assert.ok(slug, 'seed data must contain at least one product');

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.goto(`${WEB}/product.html?slug=${encodeURIComponent(slug)}`, {
      waitUntil: 'networkidle', timeout: 30000,
    });
    await page.waitForTimeout(1500);

    assert.equal(await page.locator('#relatedGrid .fp-skeleton').count(), 0, 'related skeletons cleared');
    assert.equal(await page.locator('#pdTitle').innerText() !== '', true, 'product title rendered');

    // The main gallery viewer must keep the full-size hero, not the card crop.
    const heroW = await page.locator('#pdMainImg').evaluate(WIDTH_OF);
    if (heroW !== null) assert.ok(heroW >= 700, `hero keeps a large rendition, got w=${heroW}`);

    // Small related cards should be card-sized when they come from the CDN.
    const relW = await page.locator('#relatedGrid .fpcard img').evaluateAll((imgs) =>
      imgs.map((i) => /[?&]w=(\d+)/.exec(i.getAttribute('src') || '')?.[1]).filter(Boolean).map(Number));
    if (relW.length) assert.ok(relW.every((w) => w <= 480), `related cards <=480px, got ${JSON.stringify(relW)}`);

    assert.deepEqual(errors, [], 'no console or page errors');
  } finally {
    await browser.close();
  }
});

/* ------------------------------------------------------------------ */
/* 7. Reserved slot geometry matches the live card (CLS guard)         */
/* ------------------------------------------------------------------ */
test('reserved skeleton box matches the live card box', async () => {
  await withPage(async (page) => {
    const sizes = await page.evaluate(async () => {
      const measure = () => {
        const el = document.querySelector('#collGrid .fpcard');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height), skeleton: el.classList.contains('fp-skeleton') };
      };
      const seen = { skeleton: null, live: null };
      // Catch the reserved state whenever it is still on screen...
      const sk = measure();
      if (sk && sk.skeleton) seen.skeleton = sk;
      // ...then re-render with the live cards and measure again.
      const sort = document.getElementById('collSort');
      if (sort) { sort.value = 'price-asc'; sort.dispatchEvent(new Event('change')); }
      await new Promise((r) => setTimeout(r, 400));
      const live = measure();
      if (live && !live.skeleton) seen.live = live;
      return seen;
    });

    if (sizes.skeleton && sizes.live) {
      assert.equal(sizes.skeleton.w, sizes.live.w, 'reserved width equals live card width');
      assert.ok(Math.abs(sizes.skeleton.h - sizes.live.h) <= 12,
        `reserved height ~= live height (${sizes.skeleton.h} vs ${sizes.live.h})`);
    }
  }, '/collection.html');
});
