import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
// Installs the VSIX that `npm run package` just built into your VS Code (used by `npm run install-local`).
const root = path.join(__dirname, '..', '..');
const { version, name } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const vsix = path.join(root, `${name}-${version}.vsix`);
if (!fs.existsSync(vsix)) { console.error(`Not found: ${vsix} - run npm run package first`); process.exit(1); }
execSync(`code --install-extension "${vsix}" --force`, { stdio: 'inherit' });
console.log(`\nInstalled ${name} ${version}. Restart VS Code (or run "Developer: Reload Window") to use it.`);
