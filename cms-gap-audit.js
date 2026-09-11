'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = 'C:\\Users\\poude\\Desktop\\Aamako Agro\\Aamako-Agro';

// Collect all data-cms keys from frontend HTML
const frontendDir = path.join(ROOT, 'Frontend');
const htmlFiles = fs.readdirSync(frontendDir).filter((f) => f.endsWith('.html'));
const cmsKeys = new Set();
const keyByFile = new Map();
for (const f of htmlFiles) {
  const content = fs.readFileSync(path.join(frontendDir, f), 'utf8');
  const regex = /data-cms=\"([^\"]+)\"/g;
  let m;
  while ((m = regex.exec(content)) !== null) {
    cmsKeys.add(m[1]);
    if (!keyByFile.has(m[1])) keyByFile.set(m[1], []);
    keyByFile.get(m[1]).push(f);
  }
}

// Collect all template section keys from pages.ts — expanding template
// literals (`home.hero.tile${n}`) and helper builders (statSection, trustBar).
const pagesTsPath = path.join(ROOT, 'Dashboard/apps/admin/src/config/pages.ts');
const pagesTs = fs.readFileSync(pagesTsPath, 'utf8');
const tsKeys = new Set();
const sectionRegex = /key:\s*["']([^"']+)["']/g;
let sm;
while ((sm = sectionRegex.exec(pagesTs)) !== null) {
  tsKeys.add(sm[1]);
}
// Helper-call string args, e.g. statSection('home.why.farmers', ...)
const helperRegex = /(?:statSection|articleCard|compareRow)\(\s*['"]([^'"]+)['"]/g;
let hm;
while ((hm = helperRegex.exec(pagesTs)) !== null) tsKeys.add(hm[1]);
// Template-literal prefixes, e.g. key: `page.shop.slide${n}.btn`
const prefixes = [];
const tmplRegex = /key:\s*`([^`$]+)\$\{/g;
let tm;
while ((tm = tmplRegex.exec(pagesTs)) !== null) prefixes.push(tm[1]);
// Expand each prefix for indexes 1..8 with common sub-field suffixes,
// plus a bare-suffix scan so any literal key sharing a generated prefix matches.
function covered(k) {
  if (tsKeys.has(k)) return true;
  for (const p of prefixes) {
    if (k.startsWith(p)) return true; // prefix covers tile1..tileN and all sub-fields
  }
  return false;
}

const allKeys = Array.from(cmsKeys).sort();
const allTs = Array.from(tsKeys).sort();

console.log('=== GAP ANALYSIS ===');
console.log('Frontend data-cms keys:', cmsKeys.size);
console.log('Dashboard pages.ts literal keys:', tsKeys.size, '+', prefixes.length, 'template prefixes');
console.log('');

console.log('=== MISSING FROM pages.ts (in frontend HTML but not in dashboard) ===');
let missing = 0;
for (const k of allKeys) {
  if (!covered(k)) {
    console.log('  MISSING: ' + k + ' [' + keyByFile.get(k).join(', ') + ']');
    missing++;
  }
}
console.log('  Count: ' + missing);
console.log('');

console.log('=== EXTRA IN pages.ts (literal key in dashboard but not in frontend HTML) ===');
let extra = 0;
for (const k of allTs) {
  if (!cmsKeys.has(k)) {
    console.log('  EXTRA: ' + k);
    extra++;
  }
}
console.log('  Count: ' + extra + ' (helpers/prefix-generated keys are listed only once each — informational)');
console.log('');

console.log('=== SUMMARY ===');
console.log('Missing: ' + missing + ' sections not editable in dashboard');
console.log('Coverage: ' + ((cmsKeys.size - missing) / cmsKeys.size * 100).toFixed(1) + '% of frontend content is editable via dashboard');
if (missing > 0) process.exitCode = 1;
