const fs = require('fs');
const path = 'C:/Users/poude/Desktop/Aamako Agro/Aamako-Agro/Frontend';
const files = fs.readdirSync(path).filter(f => f.endsWith('.html'));
const keys = new Set();
files.forEach(f => {
  const html = fs.readFileSync(path + '/' + f, 'utf8');
  const matches = html.matchAll(/data-cms="([^"]+)"/g);
  for (const m of matches) {
    const k = m[1];
    if (k !== 'site.trust.1' && k !== 'site.trust.2' && k !== 'site.trust.3')
      keys.add(k);
  }
});
[...keys].sort().forEach(k => console.log(k));
