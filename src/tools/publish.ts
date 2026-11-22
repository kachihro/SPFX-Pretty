import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { DOCS_SITE } from '../core/site';
// npm run publish-marketplace: safety checks, then `vsce publish` of the VSIX that `npm run package` built.
// Auth: GitHub Actions uses trusted publishing (`npm run publish-marketplace -- --oidc`, no token);
// from your own machine, run `npx vsce login kachihro` once. Extra arguments are passed on to vsce publish.
const root = path.join(__dirname, '..', '..');
const { version, name, publisher } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const fail = (m: string) => { console.error(`\nNot published: ${m}\n`); process.exit(1); };
if (!DOCS_SITE) { fail('set DOCS_SITE in src/core/site.ts to the live website first - the Marketplace needs public HTTPS images.'); }
const readme = fs.readFileSync(path.join(root, 'build', 'README.md'), 'utf8');
if (/\]\(data:/.test(readme)) { fail('build/README.md still embeds images (data: URLs) - the Marketplace rejects them.'); }
const vsix = path.join(root, `${name}-${version}.vsix`);
if (!fs.existsSync(vsix)) { fail(`${path.basename(vsix)} not found`); }
console.log(`Publishing ${publisher}.${name} ${version} to the VS Code Marketplace...`);
const extra = process.argv.slice(2).filter(a => /^--[a-z-]+$/.test(a)).join(' ');
execSync(`npx vsce publish -i "${vsix}" ${extra}`.trim(), { stdio: 'inherit', cwd: root });
console.log(`\nPublished. Listing: https://marketplace.visualstudio.com/items?itemName=${publisher}.${name}`);
