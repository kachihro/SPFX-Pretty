import * as fs from 'fs';
import * as path from 'path';
import { RULE_DOCS, ruleMarkdown } from '../core/ruleDocs';
// Writes docs/faq/<RULE>.md and an index - ready for the website / repo.
const dir = path.join(__dirname, '..', '..', 'docs', 'faq');
fs.mkdirSync(dir, { recursive: true });
for (const r of RULE_DOCS) { fs.writeFileSync(path.join(dir, `${r.id}.md`), ruleMarkdown(r)); }
const areas = [...new Set(RULE_DOCS.map(r => r.area))];
fs.writeFileSync(path.join(dir, 'README.md'), ['# SPFX Pretty FAQ', '', 'What each finding means and how to fix it.', '',
  ...areas.flatMap(a => [`## ${a}`, '', ...RULE_DOCS.filter(r => r.area === a).map(r => `- [${r.id}: ${r.title}](${r.id}.md)`), '']), ''].join('\n'));
console.log(`Wrote ${RULE_DOCS.length} FAQ pages to docs/faq`);
