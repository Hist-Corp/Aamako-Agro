'use strict';
const fs = require('fs');
const path = require('path');
const FRONT = 'C:\\Users\\poude\\Desktop\\Aamako Agro\\Aamako-Agro\\Frontend';
const files = [];
function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    const s = fs.statSync(p);
    if (s.isDirectory()) walk(p);
    else if (/\.(js|html)$/.test(f)) files.push(p);
  }
}
walk(FRONT);

const apiCalls = new Set();
// Match common API path patterns
const segments = '(auth|admin|cart|catalog|products|categories|content|media|orders|pricing|wholesale|support|users|tasks|notifications|sales|inventory|quotes|businesses|reports|batches|warehouses|reviews|distribution|credentials|roles|analytics|audit)';
const re = new RegExp("(['\"`])(/api/)?(" + segments + "(?:/[a-zA-Z0-9_\\-{}:.]*)*)\\1", 'g');
for (const f of files) {
  const c = fs.readFileSync(f, 'utf8');
  let m;
  while ((m = re.exec(c)) !== null) {
    if (m[3] && m[3].length > 1) apiCalls.add('/api/' + m[3].replace(/^\/+/, ''));
  }
}
const arr = Array.from(apiCalls).sort();
console.log('=== API PATHS REFERENCED IN FRONTEND (' + arr.length + ') ===');
for (const a of arr) console.log('  ' + a);