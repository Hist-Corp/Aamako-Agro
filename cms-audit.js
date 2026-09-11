'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = 'C:\\Users\\poude\\Desktop\\Aamako Agro\\Aamako-Agro\\Frontend';

// Collect all data-cms keys from frontend HTML
const htmlFiles = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'));
const keys = new Set();
const keyByFile = new Map();
for (const f of htmlFiles) {
  const content = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const regex = /data-cms="([^"]+)"/g;
  let m;
  while ((m = regex.exec(content)) !== null) {
    keys.add(m[1]);
    if (!keyByFile.has(m[1])) keyByFile.set(m[1], []);
    keyByFile.get(m[1]).push(f);
  }
}

const all = Array.from(keys).sort();
console.log('=== TOTAL UNIQUE data-cms KEYS: ' + all.length + ' ===\n');

// Print all keys grouped by prefix with their files
const byPrefix = new Map();
for (const k of all) {
  const prefix = k.split('.')[0];
  if (!byPrefix.has(prefix)) byPrefix.set(prefix, []);
  byPrefix.get(prefix).push(k);
}
for (const [prefix, ks] of Array.from(byPrefix.entries()).sort()) {
  console.log('\n--- ' + prefix + ' ---');
  for (const k of ks) {
    console.log('  ' + k + '  [' + keyByFile.get(k).join(', ') + ']');
  }
}