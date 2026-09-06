'use strict';
/** QA report generator — aggregates qa/results/*.json into qa/REPORT.md. */
const fs = require('fs');
const path = require('path');

const RES = path.join(__dirname, 'results');
const ART = path.join(__dirname, 'artifacts');

const files = fs.readdirSync(RES).filter((f) => f.endsWith('.json')).sort();
const suites = files.map((f) => ({ name: f.replace(/\.json$/, ''), tests: JSON.parse(fs.readFileSync(path.join(RES, f), 'utf8')) }));

const totals = { PASS: 0, FAIL: 0, WARN: 0, ERROR: 0 };
for (const s of suites) for (const t of s.tests) totals[t.status] = (totals[t.status] || 0) + 1;

let md = `# Aamako-Agro QA Report
Generated: ${new Date().toISOString()}

## Totals
| Status | Count |
|---|---|
| PASS | ${totals.PASS} |
| FAIL | ${totals.FAIL} |
| WARN | ${totals.WARN} |
| ERROR | ${totals.ERROR} |
| **Total checks** | **${suites.reduce((a, s) => a + s.tests.length, 0)}** |

## Suite summary
| Suite | PASS | FAIL | WARN/ERROR |
|---|---|---|---|
`;
for (const s of suites) {
  const c = { PASS: 0, FAIL: 0, WARN: 0, ERROR: 0 };
  for (const t of s.tests) c[t.status] = (c[t.status] || 0) + 1;
  md += `| ${s.name} | ${c.PASS} | ${c.FAIL} | ${(c.WARN || 0) + (c.ERROR || 0)} |\n`;
}

md += `\n## Failed checks\n`;
let any = false;
for (const s of suites) {
  const fails = s.tests.filter((t) => t.status === 'FAIL' || t.status === 'ERROR');
  if (fails.length) {
    any = true;
    md += `\n### ${s.name}\n`;
    for (const f of fails) md += `- **${f.name}** — ${f.detail || '(no detail)'}\n`;
  }
}
if (!any) md += `_None — all checks passed._\n`;

md += `\n## Warnings\n`;
any = false;
for (const section of suites) {
  const warns = section.tests.filter((t) => t.status === 'WARN');
  if (warns.length) {
    any = true;
    md += `\n### ${section.name}\n`;
    for (const w of warns) md += `- **${w.name}** — ${w.detail || ''}\n`;
  }
}
if (!any) md += `_None._\n`;

md += `\n## Artifacts\n`;
const shots = fs.existsSync(ART) ? fs.readdirSync(ART).sort() : [];
md += shots.length ? shots.map((s) => `- \`qa/artifacts/${s}\``).join('\n') + '\n' : `_None._\n`;

md += `\n## Notes on methodology\n- Additive harness: lives in \`qa/\`, imports nothing from app source, makes no app-code changes.\n`;
md += `- All mutating checks create \`qa-*\` records and clean up after themselves (products, content blocks, users).\n`;
md += `- The storefront is served as static HTML, so SEO/a11y checks fetch and inspect the served pages directly.\n`;

fs.writeFileSync(path.join(__dirname, 'REPORT.md'), md);
console.log('Report written: qa/REPORT.md — ' + totals.PASS + ' PASS / ' + totals.FAIL + ' FAIL / ' + totals.WARN + ' WARN / ' + totals.ERROR + ' ERROR');
