import * as fs from 'fs';
import * as path from 'path';
// The repo is private, so GitHub image links don't load on the installed extension page.
// Build a copy of README.md for the VSIX with the images embedded (and relative links pointed at GitHub).
const root = path.join(__dirname, '..', '..');
const GITHUB = 'https://github.com/kachihro/SPFX-Pretty/blob/main/';
let md = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
md = md.replace(/!\[([^\]]*)\]\((media\/[^)]+)\)/g, (_m, alt: string, rel: string) => {
  // prefer a small JPEG twin (media/x-small.jpg) to keep the VSIX light
  const small = rel.replace(/\.png$/i, '-small.jpg');
  const file = fs.existsSync(path.join(root, small)) ? small : rel;
  const mime = /\.jpe?g$/i.test(file) ? 'image/jpeg' : 'image/png';
  return `![${alt}](data:${mime};base64,${fs.readFileSync(path.join(root, file)).toString('base64')})`;
});
md = md.replace(/\]\((?!https?:|data:|#)([^)]+)\)/g, (_m, rel: string) => `](${GITHUB}${rel})`);
fs.mkdirSync(path.join(root, 'build'), { recursive: true });
fs.writeFileSync(path.join(root, 'build', 'README.md'), md);
console.log('build/README.md written for the VSIX');
