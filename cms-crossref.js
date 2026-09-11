'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = 'C:\\Users\\poude\\Desktop\\Aamako Agro\\Aamako-Agro';
const Frontend = path.join(ROOT, 'Frontend');
const pagesConfig = fs.readFileSync(path.join(ROOT, 'Dashboard', 'apps', 'admin', 'src', 'config', 'pages.ts'), 'utf8');

// 1. Collect all frontend data-cms keys
const keys = new Set();
const htmlFiles = fs.readdirSync(Frontend).filter((f) => f.endsWith('.html'));
for (const f of htmlFiles) {
  const content = fs.readFileSync(path.join(Frontend, f), 'utf8');
  const re = /data-cms="([^"]+)"/g;
  let m;
  while ((m = re.exec(content)) !== null) keys.add(m[1]);
}

// 2. Collect template section keys
const templateSpecific = new Set(); // exact literal keys
const regexExact = /key:\s*['"]([^'"]+)['"]/g;
let m;
while ((m = regexExact.exec(pagesConfig)) !== null) templateSpecific.add(m[1]);

// 2b. statSection helper keys
const regexStat = /statSection\(\s*['"]([^'"]+)['"]/g;
while ((m = regexStat.exec(pagesConfig)) !== null) templateSpecific.add(m[1]);

// 2c. Pattern keys `...${n}...`
const regexPattern = /key:\s*`([^`]+)`/g;
const patternStrings = [];
while ((m = regexPattern.exec(pagesConfig)) !== null) {
  if (m[1].includes('${')) patternStrings.push(m[1]);
}

// Expand patterns to concrete numbers and add to template set
const templateKeys = new Set(templateSpecific);
function expandPat(pat, n) {
  // handles ${...} by replacing with n
  return pat.replace(/\$\{[^}]+\}/g, String(n));
}
for (const pat of patternStrings) {
  for (let n = 1; n <= 30; n++) {
    let expanded = expandPat(pat, n);
    if (frontendHas(keys, expanded)) templateKeys.add(expanded);
  }
}

function frontendHas(keySet, k) {
  return keySet.has(k);
}

// Determine missing keys
const missing = [];
for (const k of Array.from(keys).sort()) {
  let covered = templateKeys.has(k);
  // child of a template key
  if (!covered) {
    for (const tk of templateKeys) if (k.startsWith(tk + '.')) { covered = true; break; }
  }
  // parent of a template key (aggregate)
  if (!covered) {
    for (const tk of templateKeys) if (tk.startsWith(k + '.')) { covered = true; break; }
  }
  if (!covered) missing.push(k);
}

console.log('=== GENUINELY MISSING (frontend key has no template section) ===\n');
for (const k of missing) console.log('  ' + k);
console.log('\nTotal: ' + missing.length);