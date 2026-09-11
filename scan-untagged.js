'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = 'C:\\Users\\poude\\Desktop\\Aamako Agro\\Aamako-Agro\\Frontend';
const files = ['index.html', 'shop.html', 'collection.html', 'product.html', 'journal.html', 'process.html', 'story.html', 'wholesale.html', 'cart.html'];

function isInsideCms(html, startIdx) {
  // look backwards for the nearest < (tag open), then check if within a data-cms parent
  let depth = 0;
  for (let i = startIdx; i >= 0; i--) {
    const ch = html[i];
    if (ch === '<' && html[i + 1] === '/') depth--;
    else if (ch === '>') depth++;
    // too complex; use simple approach: check if any <tag data-cms= exists before this closing > without another <
  }
  return false;
}

for (const f of files) {
  const fp = path.join(ROOT, f);
  if (!fs.existsSync(fp)) continue;
  const html = fs.readFileSync(fp, 'utf8');
  // Find headings and paragraphs
  const re = /<(h[1-6]|p|a|button|span)[^>]*data-cms[^>]*>/g;
  const tagged = [];
  let m;
  while ((m = re.exec(html)) !== null) tagged.push(m[0]);

  // Find untagged h2-h3 that look like content
  const reH = /<(h[1-3]|p)\b(?![^>]*data-cms)[^>]*>/g;
  let count = 0;
  console.log('\n=== ' + f + ': untagged h1-3/p elements ===');
  while ((m = reH.exec(html)) !== null && count < 40) {
    const tag = m[0];
    // skip if inside header/footer/trust (rough skip: check preceding 2000 chars for <header)
    const slice = html.slice(Math.max(0, m.index - 1500), m.index);
    if (/<header|mobile-drawer|<footer|trust-strip/.test(slice)) { count++; continue; }
    const contentStart = m.index + m[0].length;
    const contentEnd = html.indexOf('<', contentStart);
    const text = html.slice(contentStart, contentEnd).replace(/\s+/g, ' ').trim().slice(0, 60);
    console.log('  ' + tag.split(' ')[0].replace('<','').replace('>','') + ': "' + text + '"');
    count++;
  }
  if (count === 0) console.log('  (none found)');
}