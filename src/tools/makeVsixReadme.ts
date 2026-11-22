import * as fs from 'fs';
import * as path from 'path';
import { DOCS_SITE } from '../core/site';
// Build a copy of README.md for the VSIX: images and relative links in README.md only work on GitHub,
// so point them at public HTTPS URLs (the website's copies, or GitHub) for the Marketplace / installed page.
const root = path.join(__dirname, '..', '..');
const GITHUB = 'https://github.com/kachihro/SPFX-Pretty/blob/main/';
let md = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
md = md.replace(/!\[([^\]]*)\]\((media\/[^)]+)\)/g, (_m, alt: string, rel: string) => {
  // Marketplace needs public HTTPS images: use the website's copy when DOCS_SITE is set
  if (DOCS_SITE) { return `![${alt}](${DOCS_SITE.replace(/\/$/, '')}/assets/${rel.replace(/^media\//, '')})`; }
  // No website: embed the image (a small JPEG twin media/x-small.jpg if there is one, to keep the VSIX light)
  const small = rel.replace(/\.png$/i, '-small.jpg');
  const file = fs.existsSync(path.join(root, small)) ? small : rel;
  const mime = /\.jpe?g$/i.test(file) ? 'image/jpeg' : 'image/png';
  return `![${alt}](data:${mime};base64,${fs.readFileSync(path.join(root, file)).toString('base64')})`;
});
// Relative links: help pages go to the website (nicer than raw Markdown), everything else to GitHub
const site = DOCS_SITE.replace(/\/$/, '');
const toSite = (rel: string): string | undefined => rel === 'docs/RULES.md' ? `${site}/settings.html`
  : rel === 'docs/faq/README.md' ? `${site}/faq/index.html`
  : /^docs\/faq\/([A-Z]{3}\d{3})\.md$/.test(rel) ? `${site}/faq/${rel.slice(9, 15)}.html`
  : undefined;
md = md.replace(/\]\((?!https?:|data:|#)([^)]+)\)/g, (_m, rel: string) => `](${(site && toSite(rel)) || GITHUB + rel})`);
// The Marketplace only accepts public HTTPS images - no embedded (data:) ones
if (process.env.MARKETPLACE && /\]\(data:/i.test(md)) { throw new Error('Marketplace README has an embedded image - set DOCS_SITE in src/core/site.ts'); }
fs.mkdirSync(path.join(root, 'build'), { recursive: true });
fs.writeFileSync(path.join(root, 'build', 'README.md'), md);
console.log('build/README.md written for the VSIX');
