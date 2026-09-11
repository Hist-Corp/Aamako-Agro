'use strict';
/**
 * Audit v3 — frontend data-cms coverage vs dashboard pages.ts + product-templates.ts.
 * Standalone: writes results to cms-sync-report.json and prints a summary.
 * Exit code 0 when coverage is 100%, 1 otherwise (CI-friendly).
 */
const fs = require('fs');
const path = require('path');
const ROOT = 'C:\\Users\\poude\\Desktop\\Aamako Agro\\Aamako-Agro';

function collectFrontendKeys() {
  const dir = path.join(ROOT, 'Frontend');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.html'));
  const keys = new Set();
  const byFile = new Map();
  for (const f of files) {
    const content = fs.readFileSync(path.join(dir, f), 'utf8');
    const re = /data-cms="([^"]+)"/g;
    let m;
    while ((m = re.exec(content)) !== null) {
      keys.add(m[1]);
      if (!byFile.has(m[1])) byFile.set(m[1], []);
      byFile.get(m[1]).push(f);
    }
  }
  return { keys, byFile };
}

function collectPagesTs() {
  const src = fs.readFileSync(path.join(ROOT, 'Dashboard/apps/admin/src/config/pages.ts'), 'utf8');
  const lit = new Set();
  let m;
  const litRe = /key:\s*['"]([^'"]+)['"]/g;
  while ((m = litRe.exec(src)) !== null) lit.add(m[1]);
  const helperRe = /(?:statSection|articleCard|compareRow)\(\s*['"]([^'"]+)['"]/g;
  while ((m = helperRe.exec(src)) !== null) lit.add(m[1]);
  const prefixes = [];
  const tmplRe = /key:\s*`([^`$]+)\$\{/g;
  while ((m = tmplRe.exec(src)) !== null) prefixes.push(m[1]);
  const trustUses = (src.match(/\.\.\.trustBar\(\)/g) || []).length;
  return { lit, prefixes, trustUses };
}

function collectProductFields() {
  const src = fs.readFileSync(path.join(ROOT, 'Dashboard/apps/admin/src/config/product-templates.ts'), 'utf8');
  const keys = new Set();
  let m;
  const re = /key:\s*['"]([^'"]+)['"]/g;
  while ((m = re.exec(src)) !== null) keys.add(m[1]);
  return keys;
}

function expandPrefixes(prefixes) {
  // A prefix like "page.shop.banner" covers banner1..banner3 + sub-fields.
  const out = new Set();
  for (const p of prefixes) {
    for (let n = 1; n <= 8; n++) {
      out.add(`${p}${n}`);
      for (const s of ['image', 'btn', 'eyebrow', 'moq', 'features', 'title', 'text']) {
        out.add(`${p}${n}.${s}`);
      }
    }
  }
  return out;
}

const { keys: cmsKeys, byFile } = collectFrontendKeys();
const { lit, prefixes, trustUses } = collectPagesTs();
const productFields = collectProductFields();
const expanded = expandPrefixes(prefixes);
const covered = new Set([...lit, ...expanded]);

const missing = [...cmsKeys].sort().filter((k) => {
  if (covered.has(k)) return false;
  // product-page.* keys are per-product template data (product-template.<slug>.*),
  // plus a handful of shared product-page shell labels — neither lives in pages.ts.
  if (k.startsWith('product-page.')) return false;
  return true;
});

const report = {
  generatedAt: new Date().toISOString(),
  frontendKeys: cmsKeys.size,
  pagesLiteralKeys: lit.size,
  templatePrefixes: prefixes,
  trustBarUses: trustUses,
  productTemplateFields: [...productFields].sort(),
  missing,
  coverage: Number((((cmsKeys.size - missing.filter((k) => !k.startsWith('product-page.')).length) / cmsKeys.size) * 100).toFixed(1)),
};

fs.writeFileSync(path.join(ROOT, 'cms-sync-report.json'), JSON.stringify(report, null, 2));
console.log('Frontend keys: ' + cmsKeys.size);
console.log('pages.ts literal+helper keys: ' + lit.size);
console.log('Template prefixes: ' + prefixes.length);
console.log('trustBar() uses: ' + trustUses);
console.log('Product-template fields: ' + productFields.size);
console.log('MISSING (non product-page): ' + missing.length);
for (const k of missing) console.log('  MISS ' + k + ' [' + (byFile.get(k) || []).join(',') + ']');
console.log('Coverage: ' + report.coverage + '%');
if (missing.length > 0) process.exitCode = 1;
