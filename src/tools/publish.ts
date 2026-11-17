import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { DOCS_SITE } from '../core/site';
// npm run publish-marketplace: safety checks, then `vsce publish` of the VSIX that `npm run package` built.
// Auth: run `npx vsce login kachihro` once, or set VSCE_PAT (CI).
const root = path.join(__dirname, '..', '..');
const { version, name, publisher } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const fail = (m: string) => { console.error(`\nNot published: ${m}\n`); process.exit(1); };
if (!DOCS_SITE) { fail('set DOCS_SITE in src/core/site.ts to the live website first - the Marketplace needs public HTTPS images and links (the GitHub repo is private).'); }
const readme = fs.readFileSync(path.join(root, 'build', 'README.md'), 'utf8');
if (/\]\(data:/.test(readme)) { fail('build/README.md still embeds images (data: URLs) - the Marketplace rejects them.'); }
if (/github\.com\/kachihro\/SPFX-Pretty/i.test(readme)) { fail('build/README.md links to the private GitHub repo - visitors could not open them.'); }
const vsix = path.join(root, `${name}-${version}.vsix`);
if (!fs.existsSync(vsix)) { fail(`${path.basename(vsix)} not found`); }
console.log(`Publishing ${publisher}.${name} ${version} to the VS Code Marketplace...`);
execSync(`npx vsce publish -i "${vsix}"`, { stdio: 'inherit', cwd: root });
console.log(`\nPublished. Listing: https://marketplace.visualstudio.com/items?itemName=${publisher}.${name}`);
