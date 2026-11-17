import * as fs from 'fs';
import * as path from 'path';
import { DOCS_SITE } from '../core/site';
// The repo is private, so GitHub image links don't load on the installed extension page.
// Build a copy of README.md for the VSIX with the images embedded (and relative links pointed at GitHub).
const root = path.join(__dirname, '..', '..');
const GITHUB = 'https://github.com/kachihro/SPFX-Pretty/blob/main/';
let md = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
md = md.replace(/!\[([^\]]*)\]\((media\/[^)]+)\)/g, (_m, alt: string, rel: string) => {
  // Marketplace needs public HTTPS images: use the website's copy once DOCS_SITE is set
  if (DOCS_SITE) { return `![${alt}](${DOCS_SITE.replace(/\/$/, '')}/assets/${path.basename(rel)})`; }
  // prefer a small JPEG twin (media/x-small.jpg) to keep the VSIX light
  const small = rel.replace(/\.png$/i, '-small.jpg');
  const file = fs.existsSync(path.join(root, small)) ? small : rel;
  const mime = /\.jpe?g$/i.test(file) ? 'image/jpeg' : 'image/png';
  return `![${alt}](data:${mime};base64,${fs.readFileSync(path.join(root, file)).toString('base64')})`;
});
// Relative links: to the public website once it's live (the GitHub repo is private), else GitHub
const site = DOCS_SITE.replace(/\/$/, '');
const toSite = (rel: string) => rel === 'docs/RULES.md' ? `${site}/settings.html`
  : rel === 'docs/faq/README.md' ? `${site}/faq/index.html`
  : /^docs\/faq\/([A-Z]{3}\d{3})\.md$/.test(rel) ? `${site}/faq/${rel.slice(9, 15)}.html`
  : `${site}/guide.html`;
md = md.replace(/\]\((?!https?:|data:|#)([^)]+)\)/g, (_m, rel: string) => `](${site ? toSite(rel) : GITHUB + rel})`);
// Marketplace build (MARKETPLACE=1) before the website is live: the Marketplace only accepts public HTTPS
// images and visitors can't open the private repo - so drop the photo and the GitHub links for now.
if (process.env.MARKETPLACE && !DOCS_SITE) {
  md = md.replace(/\n!\[[^\]]*\]\(data:[^)]+\)\n/g, '\n');
  md = md.replace(/\nMore: \[FAQ for every rule\][^\n]*\n/, '\nIn VS Code, right-click any finding and choose **Explain & How to Fix** for help with every rule.\n');
  if (/data:/i.test(md)) { throw new Error('Marketplace README still has an embedded image'); }
}
// The GitHub repo is private - never link to it from the Marketplace page
if (process.env.MARKETPLACE) {
  md = md.replace(/\nSource and issues: \[github\.com\/kachihro\/SPFX-Pretty\]\([^)]*\)/, '\nQuestions or ideas: [kachihro.com](https://www.kachihro.com) · Help: [how to fix every finding](' + (DOCS_SITE ? DOCS_SITE.replace(/\/$/, '') + '/faq/index.html' : 'https://www.kachihro.com') + ')');
  if (/github\.com\/kachihro/i.test(md)) { throw new Error('Marketplace README still links to the private GitHub repo'); }
}
fs.mkdirSync(path.join(root, 'build'), { recursive: true });
fs.writeFileSync(path.join(root, 'build', 'README.md'), md);
console.log('build/README.md written for the VSIX');
