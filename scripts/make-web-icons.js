// Favicons, app icons and the social share card for www.spfxpretty.com (media/web/).
//   node scripts/make-web-icons.js   (needs Playwright + Chromium and Python Pillow for the .ico)
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..'), out = path.join(root, 'media', 'web');
fs.mkdirSync(out, { recursive: true });
const full = fs.readFileSync(path.join(root, 'media', 'icon-source.svg'), 'utf8');
// Tiny sizes: no "SPFX" text (unreadable at 16px) - a bigger wand and sparkles on the gradient
const small = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2A8BD8"/><stop offset=".55" stop-color="#7B3FE4"/><stop offset="1" stop-color="#15287F"/></linearGradient></defs>
<rect width="24" height="24" rx="5" fill="url(#g)"/>
<g fill="none" stroke="#fff" stroke-linecap="round"><path d="M5.5 18.5l9-9" stroke-width="2.6"/><path d="M14 10l2.2-2.2" stroke-width="3.6"/></g>
<path d="M17.6 3.2l.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8z" fill="#fff"/><path d="M8 3.6l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5z" fill="#fff"/><path d="M18.6 12.4l.45 1.15 1.15.45-1.15.45-.45 1.15-.45-1.15-1.15-.45 1.15-.45z" fill="#fff"/></svg>`;
fs.writeFileSync(path.join(out, 'favicon.svg'), small);
const OG = `<!doctype html><html><head><style>
*{box-sizing:border-box}body{margin:0;width:1200px;height:630px;font-family:"Segoe UI",Inter,system-ui,sans-serif;color:#fff;
background:radial-gradient(900px 500px at 85% 0%,rgba(123,63,228,.55),transparent 60%),radial-gradient(700px 500px at 0% 100%,rgba(42,139,216,.45),transparent 60%),#0f1424;display:flex;flex-direction:column;padding:64px 72px}
.top{display:flex;align-items:center;gap:34px}.top svg{width:150px;height:150px;border-radius:32px;box-shadow:0 18px 50px rgba(0,0,0,.45)}
h1{margin:0;font-size:92px;line-height:1;font-weight:800;letter-spacing:-1.5px}p.t{margin:12px 0 0;font-size:34px;color:#c9d3ff;font-weight:500}
.ba{margin-top:52px;display:flex;align-items:center;gap:22px;font-size:30px}
.b{font-family:Consolas,monospace;color:#ff9a9a;text-decoration:line-through;text-decoration-thickness:3px;background:rgba(255,80,80,.12);padding:8px 16px;border-radius:10px}
.a{font-weight:700;background:rgba(84,176,84,.18);color:#9ff0a8;padding:8px 18px;border-radius:10px}.arrow{color:#9aa4b2}
.chips{margin-top:auto;display:flex;gap:12px;flex-wrap:wrap}.chips span{font-size:22px;padding:8px 16px;border-radius:999px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18)}
.url{position:absolute;right:72px;top:72px;font-size:24px;color:#9aa4b2}
</style></head><body><div class="url">www.spfxpretty.com</div>
<div class="top">${full.replace('width="128" height="128"', '')}<div><h1>SPFX Pretty</h1><p class="t">Cut + polish your SPFx apps before you deploy</p></div></div>
<div class="ba"><span class="b">project-client-side-solution</span><span class="arrow">→</span><span class="a">Kachihro Project</span></div>
<div class="chips"><span>🏷️ Nice names</span><span>🎨 Company icons</span><span>🧰 Toolbox</span><span>🧹 Leftover defaults</span><span>🔢 SPFx upgrades</span><span>Free VS Code extension</span></div>
</body></html>`;
(async () => {
  const b = await chromium.launch();
  const png = async (svg, size, file) => {
    const p = await b.newPage({ viewport: { width: size, height: size } });
    await p.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
    await p.screenshot({ path: path.join(out, file), omitBackground: true }); await p.close();
  };
  for (const s of [16, 32]) { await png(small, s, `favicon-${s}.png`); }
  for (const s of [48, 96, 180, 192, 512]) { await png(full, s, s === 180 ? 'apple-touch-icon.png' : `icon-${s}.png`); }
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await p.setContent(OG); await p.waitForTimeout(300); await p.screenshot({ path: path.join(out, 'og-image.png') });
  await b.close();
  execFileSync('python3', ['-c', `from PIL import Image
d='${out}'
imgs=[Image.open(d+'/favicon-16.png'),Image.open(d+'/favicon-32.png'),Image.open(d+'/icon-48.png')]
imgs[2].save(d+'/favicon.ico',sizes=[(16,16),(32,32),(48,48)],append_images=imgs[:2])`]);
  console.log('Web icons written to media/web/');
})();
