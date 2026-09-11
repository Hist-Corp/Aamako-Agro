const fs = require('fs');
const path = require('path');

// 1. Extract all data-cms keys from frontend HTML files
const frontendDir = 'Frontend';
const htmlFiles = fs.readdirSync(frontendDir).filter(f => f.endsWith('.html'));
const frontendCmsKeys = new Set();
const frontendCmsDetails = {};

for (const file of htmlFiles) {
  const content = fs.readFileSync(path.join(frontendDir, file), 'utf8');
  const regex = /data-cms="([^"]+)"/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const key = match[1];
    frontendCmsKeys.add(key);
    if (!frontendCmsDetails[key]) {
      frontendCmsDetails[key] = { files: [], count: 0 };
    }
    frontendCmsDetails[key].files.push(file);
    frontendCmsDetails[key].count++;
  }
}

// 2. Extract template sections from pages.ts
const pagesTs = fs.readFileSync('Dashboard/apps/admin/src/config/pages.ts', 'utf8');
const templateKeyRegex = /key: '([^']+)'/g;
const templateKeys = new Set();
let m;
while ((m = templateKeyRegex.exec(pagesTs)) !== null) {
  templateKeys.add(m[1]);
}

// 3. Find gaps
const frontendOnly = [];
const sortedFrontend = Array.from(frontendCmsKeys).sort();
for (const key of sortedFrontend) {
  if (!templateKeys.has(key)) {
    frontendOnly.push(key);
  }
}

console.log('=== FRONTEND data-cms KEYS (' + frontendCmsKeys.size + ' unique) ===');
for (const key of sortedFrontend) {
  const details = frontendCmsDetails[key];
  const inTemplate = templateKeys.has(key) ? '✓ template' : '✗ MISSING';
  console.log((inTemplate === '✗ MISSING' ? '>>> ' : '    ') + key + ' [' + details.count + 'x in ' + details.files.join(', ') + '] ' + inTemplate);
}

console.log('\n=== TEMPLATE SECTION KEYS (' + templateKeys.size + ' unique) ===');
for (const key of Array.from(templateKeys).sort()) {
  const inFrontend = frontendCmsKeys.has(key) ? '✓ frontend' : '✗ NO frontend';
  console.log((inFrontend === '✗ NO frontend' ? '>>> ' : '    ') + key + ' ' + inFrontend);
}

console.log('\n=== GAPS: Frontend elements WITHOUT template sections ===');
for (const key of frontendOnly) {
  console.log('  MISSING: ' + key + ' (' + frontendCmsDetails[key].count + 'x in ' + frontendCmsDetails[key].files.join(', ') + ')');
}

const templateOnly = Array.from(templateKeys).filter(k => !frontendCmsKeys.has(k));
if (templateOnly.length > 0) {
  console.log('\n=== GAPS: Template sections WITHOUT frontend elements ===');
  for (const key of templateOnly) {
    console.log('  ORPHAN: ' + key);
  }
}
