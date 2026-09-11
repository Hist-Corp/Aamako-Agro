'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = 'C:\\Users\\poude\\Desktop\\Aamako Agro\\Aamako-Agro';

const frontendDir = path.join(ROOT, 'Frontend');
const htmlFiles = fs.readdirSync(frontendDir).filter((f) => f.endsWith('.html'));
const cmsKeys = new Set();
const keyByFile = new Map();
for (const f of htmlFiles) {
  const content = fs.readFileSync(path.join(frontendDir, f), 'utf8');
  const regex = /data-cms="([^"]+)"/g;
  let m;
  while ((m = regex.exec(content)) !== null) {
    cmsKeys.add(m[1]);
    if (!keyByFile.has(m[1])) keyByFile.set(m[1], []);
    keyByFile.get(m[1]).push(f);
  }
}

const prodTplPath = path.join(ROOT, 'Dashboard/apps/admin/src/config/product-templates.ts');
const prodTpl = fs.readFileSync(prodTplPath, 'utf8');
const fieldRe = /key:\s*['"]([^'"]+)['"]/g;
const fieldKeys = new Set();
let fm;
while ((fm = fieldRe.exec(prodTpl)) !== null) { fieldKeys.add(fm[1]); }
console.log('Product-template fields: ' + JSON.stringify([...fieldKeys].sort()));

const pagesTsPath = path.join(ROOT, 'Dashboard/apps/admin/src/config/pages.ts');
const pagesTs = fs.readFileSync(pagesTsPath, 'utf8');

// Literal keys
const litKeys = new Set();
const litRe = /key:\s*['"]([^'"]+)['"]/g;
let lm;
while ((lm = litRe.exec(pagesTs)) !== null) { litKeys.add(lm[1]); }

// Helper-call string args
const helperRe = /(?:statSection|articleCard|compareRow)\(\s*['"]([^'"]+)['"]/g;
let hm;
while ((hm = helperRe.exec(pagesTs)) !== null) { litKeys.add(hm[1]); }

// Template-literal prefixes like key: `page.journal.faq.q${n}`
const tmplPrefixes = [];
const tmplRe = /key:\s*`([^`$]+)\$\{/g;
let tm;
while ((tm = tmplRe.exec(pagesTs)) !== null) { tmplPrefixes.push(tm[1]); }

// Trust bar check
const trustUses = (pagesTs.match(/\.\.\.trustBar\(\)/g) || []).length;

function covered(k) {
  if (litKeys.has(k)) return true;
  for (const p of tmplPrefixes) {
    const esc = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp('^' + esc + '\\d+$').test(k)) return true;
    if (new RegExp('^' + esc + '\\d+\\.image$').test(k)) return true;
    if (new RegExp('^' + esc + '\\d+\\.(btn|eyebrow|moq|features|title|text)$').test(k)) return true;
  }
  return false;
}

const missing = [...cmsKeys].sort().filter((k) => !covered(k));
console.log('Frontend keys: ' + cmsKeys.size);
console.log('Literal+helper keys: ' + litKeys.size);
console.log('trustBar() uses: ' + trustUses);
console.log('MISSING COUNT: ' + missing.length);
for (const k of missing) { console.log('  MISS ' + k + ' [' + keyByFile.get(k).join(',') + ']'); }
