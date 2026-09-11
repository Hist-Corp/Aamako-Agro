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

const calls = new Set();
for (const f of files) {
  const c = fs.readFileSync(f, 'utf8');
  const lines = c.split('\n');
  for (const line of lines) {
    // Match strings starting with / that look like endpoints after request('/...', API_BASE+'/...', fetch(API+'
    const m = line.match(/(?:request)\('([^']+)'/);
    if (m) calls.add('/' + m[1].replace(/^\/+/, ''));
    const m2 = line.match(/API_BASE\s*\+\s*'([^']+)'/);
    if (m2) calls.add('/' + m2[1].replace(/^\/+/, ''));
    const m3 = line.match(/(?:fetch|post|get|put|patch|delete)\(\s*'(?!http)([^']+)'/);
    if (m3) calls.add('/' + m3[1].replace(/^\/+/, ''));
  }
}

const arr = Array.from(calls).sort();
console.log('=== FRONTEND API ENDPOINTS (' + arr.length + ') ===');
for (const a of arr) console.log('  ' + a);