const fs = require('fs');
const path = require('path');

const frontendDir = 'Frontend';
const pages = fs.readdirSync(frontendDir).filter(f => f.endsWith('.html'));

// Collect all data-cms keys from frontend HTML
const cmsByPage = {};
for (const page of pages) {
  const html = fs.readFileSync(path.join(frontendDir, page), 'utf8');
  const keys = new Set();
  const regex = /data-cms="([^"]+)"/g;
  let m;
  while ((m = regex.exec(html)) !== null) {
    keys.add(m[1]);
  }
  cmsByPage[page] = [...keys].sort();
}

// Pages config from dashboard
const pagesConfigPath = path.join('Dashboard', 'apps', 'admin', 'src', 'config', 'pages.ts');
const pagesConfigText = fs.readFileSync(pagesConfigPath, 'utf8');

// Extract section keys from pages.ts
const sectionKeys = new Set();
const sectionRegex = /key:\s*['`]"([^'"]+)"/g;
let m;
while ((m = sectionRegex.exec(pagesConfigText)) !== null) {
  sectionKeys.add(m[1]);
}

// Extract route->slug mappings
const routeMap = {};
const routeRegex = /slug:\s*['"]([^'"]+)['"],\s*\n\s*name:\s*['"]([^'"]+)['"],\s*\n\s*route:\s*['"]([^'"]+)['"]/g;
while ((m = routeRegex.exec(pagesConfigText)) !== null) {
  routeMap[m[3]] = { slug: m[1], name: m[2] };
}

console.log('=== DASHBOARD TEMPLATE SECTIONS (pages.ts) ===');
console.log(`Total: ${sectionKeys.size} sections across ${Object.keys(routeMap).length} pages\n`);
for (const [route, info] of Object.entries(routeMap)) {
  const keys = [...sectionKeys].filter(k => k.startsWith(`${info.slug}.`) || k.startsWith(`${info.slug.replace('.html','')}.`));
  console.log(`${info.name} (${route}): ${info.slug}`);
  keys.forEach(k => console.log(`  ${k}`));
  console.log();
}

console.log('\n=== FRONTEND PAGES WITHOUT TEMPLATE SECTIONS ===');
for (const [page, keys] of Object.entries(cmsByPage)) {
  const route = '/' + page;
  if (!routeMap[route] && keys.length > 0) {
    console.log(`\n${page}: ${keys.length} data-cms elements but NO template section in pages.ts`);
    keys.forEach(k => console.log(`  ${k}`));
  }
}

console.log('\n=== FRONTEND PAGES WITH data-cms BUT NO TEMPLATE ===');
for (const [page, keys] of Object.entries(cmsByPage)) {
  if (keys.length === 0) {
    console.log(`\n${page}: NO data-cms elements (not editable via CMS)`);
  }
}

// Find keys in frontend that are NOT in pages.ts sections
console.log('\n=== FRONTEND KEYS NOT IN pages.ts ===');
for (const [page, keys] of Object.entries(cmsByPage)) {
  for (const k of keys) {
    if (!sectionKeys.has(k)) {
      console.log(`  ${page}: ${k}`);
    }
  }
}

