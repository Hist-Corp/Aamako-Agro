'use strict';
/** Suite 12 — SEO: titles, meta, canonical, OG, robots/sitemap, structured data. */
const { Results, CFG } = require('./lib');

const PAGES = ['index.html', 'collection.html', 'cart.html', 'signin.html', 'journal.html', 'process.html'];

module.exports = async function run() {
  const R = new Results('12-seo');
  const titles = new Set();
  const noDesc = []; const noCanonical = []; const noOg = []; const noTwitter = [];

  for (const p of PAGES) {
    let body;
    try { body = await (await fetch(CFG.WEB + '/' + p)).text(); }
    catch { R.fail(`SEO: fetch /${p}`, 'unreachable'); continue; }
    const title = body.match(/<title>([^<]*)<\/title>/)?.[1]?.trim();
    if (title) titles.add(title.toLowerCase()); else noDesc.push(`${p} (no <title>)`);
    if (!/name=["']description["']/i.test(body)) noDesc.push(p);
    if (!/rel=["']canonical["']/i.test(body)) noCanonical.push(p);
    if (!/property=["']og:title["']/i.test(body) || !/property=["']og:description["']/i.test(body)) noOg.push(p);
    if (!/name=["']twitter:card["']/i.test(body)) noTwitter.push(p);
  }

  titles.size === PAGES.length
    ? R.pass('SEO: unique <title> per page', `${titles.size}/${PAGES.length} unique`)
    : R.fail('SEO: unique <title> per page', `only ${titles.size}/${PAGES.length} unique — duplicates: ${[...titles].join(' | ').slice(0, 200)}`);
  noDesc.length === 0 ? R.pass('SEO: meta description present on all pages') : R.fail('SEO: meta description present on all pages', noDesc.join(', '));
  noCanonical.length === 0 ? R.pass('SEO: canonical tag present on all pages') : R.fail('SEO: canonical tag present on all pages', noCanonical.join(', '));
  noOg.length === 0 ? R.pass('SEO: Open Graph (og:title/og:description) present') : R.fail('SEO: Open Graph (og:title/og:description) present', noOg.join(', '));
  noTwitter.length === 0 ? R.pass('SEO: twitter:card present on all pages') : R.add('WARN', 'SEO: twitter:card present on all pages', 'missing on: ' + noTwitter.join(', '));

  // robots.txt + sitemap.xml on storefront
  const robots = await fetch(CFG.WEB + '/robots.txt');
  robots.status === 200 ? R.pass('Storefront robots.txt present (200)') : R.fail('Storefront robots.txt present (200)', `status=${robots.status}`);
  const sitemap = await fetch(CFG.WEB + '/sitemap.xml');
  let smOk = sitemap.status === 200;
  if (smOk) { const t = await sitemap.text(); smOk = t.includes('<urlset') || t.includes('<?xml'); }
  smOk ? R.pass('Storefront sitemap.xml present and well-formed') : R.fail('Storefront sitemap.xml present and well-formed', `status=${sitemap.status}`);

  // structured data on homepage
  const idx = await (await fetch(CFG.WEB + '/index.html')).text();
  /application\/ld\+json/i.test(idx)
    ? R.pass('Structured data (JSON-LD) on homepage')
    : R.fail('Structured data (JSON-LD) on homepage', 'no ld+json block found');

  // og:image resolution
  const ogImg = idx.match(/property=["']og:image["'].*?content=["']([^"']+)["']/i) || idx.match(/content=["']([^"']+)["'].*?property=["']og:image["']/i);
  if (ogImg) {
    const u = ogImg[1].startsWith('http') ? ogImg[1] : CFG.WEB + ogImg[1];
    const res = await fetch(u);
    res.status === 200 ? R.pass('og:image resolves (200)') : R.fail('og:image resolves (200)', `${u} → ${res.status}`);
  } else R.fail('og:image resolves (200)', 'no og:image on homepage');

  R.save();
  return R.tests;
};
