import * as fs from 'fs';
import * as path from 'path';
import { RULE_DOCS, RuleDoc } from '../core/ruleDocs';
import { SNIPPET_CSS, highlightJson, snippetHtml } from '../core/codeFormat';
import { learnLinks } from '../core/learnLinks';
import { DOCS_SITE } from '../core/site';
const PAGES: string[] = [];

// ---------- SEO: a real title + description per page (Google shows these), structured data, icons ----------
const SITE_NAME = 'SPFX Pretty';
const DEFAULT_DESC = 'Free, open-source VS Code extension that polishes SharePoint Framework (SPFx) apps before you deploy: nice App Catalog names, company icons, a tidy toolbox and SPFx upgrades.';
const META: Record<string, { title: string; desc: string }> = {
  'index.html': { title: 'SPFX Pretty - Polish your SPFx apps before you deploy', desc: DEFAULT_DESC },
  'guide.html': { title: 'How to use SPFX Pretty in VS Code', desc: 'Scan an SPFx project, read the report, preview every fix and apply it, or go through each issue with Fix step by step. A quick guide to SPFX Pretty.' },
  'faq/index.html': { title: 'How to fix SPFx App Catalog, toolbox and version issues', desc: `What each of the ${RULE_DOCS.length} SPFX Pretty checks means and how to fix it: App Catalog names and icons, toolbox titles, unused properties, theming and SPFx versions.` },
  'settings.html': { title: 'SPFX Pretty settings, commands and CLI', desc: 'Every SPFX Pretty setting, VS Code command and CLI option: brand words, company icon, developer details, disabled rules and running the checks in a pipeline.' },
};
const clip = (t: string, n = 158) => (t.length <= n ? t : t.slice(0, t.lastIndexOf(' ', n - 1)) + '…');
function pageMeta(file: string, fallbackTitle: string): { title: string; desc: string; ld: object[] } {
  const url = `${DOCS_SITE}/${file === 'index.html' ? '' : file}`;
  const crumbs = (items: [string, string][]) => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })) });
  const rule = /^faq\/([A-Z]+\d+)\.html$/.exec(file);
  if (rule) {
    const r = RULE_DOCS.find(x => x.id === rule[1])!;
    return {
      title: `${r.title} - how to fix (${r.id})`,
      desc: (() => { const full = `${r.why} How to fix it in your SPFx project${r.auto === 'yes' ? ', with a one-click fix in VS Code' : ''}.`; return full.length <= 158 ? full : clip(r.why); })(),
      ld: [crumbs([['Home', DOCS_SITE + '/'], ['How to fix', DOCS_SITE + '/faq/index.html'], [r.title, url]]),
        { '@context': 'https://schema.org', '@type': 'TechArticle', headline: `${r.title} (${r.id})`, description: r.why, url, about: 'SharePoint Framework (SPFx)', publisher: { '@type': 'Organization', name: 'Kachihro', url: KACHIHRO } }],
    };
  }
  const m = META[file] ?? { title: fallbackTitle, desc: DEFAULT_DESC };
  const ld: object[] = [];
  if (file === 'index.html') {
    ld.push({ '@context': 'https://schema.org', '@type': 'WebSite', name: SITE_NAME, alternateName: ['SPFx Pretty', 'spfxpretty'], url: DOCS_SITE + '/' },
      { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: SITE_NAME, description: DEFAULT_DESC, url: DOCS_SITE + '/', downloadUrl: MARKETPLACE, image: `${DOCS_SITE}/icon-512.png`, screenshot: `${DOCS_SITE}/assets/before-after.png`,
        applicationCategory: 'DeveloperApplication', applicationSubCategory: 'VS Code extension', operatingSystem: 'Windows, macOS, Linux (Visual Studio Code)', softwareVersion: pkg.version,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'AUD' }, license: 'https://opensource.org/licenses/MIT', sameAs: [GITHUB, MARKETPLACE], publisher: { '@type': 'Organization', name: 'Kachihro', url: KACHIHRO, logo: `${DOCS_SITE}/icon-512.png` } });
  } else if (file !== '404.html') {
    ld.push(crumbs([['Home', DOCS_SITE + '/'], [fallbackTitle, url]]));
  }
  return { ...m, ld };
}

/**
 * Builds the SPFX Pretty help website into ./site (static HTML - host on Azure Static Web Apps,
 * Azure Storage static website, or anywhere). Run: npm run site
 *
 * Every "how to fix" page is generated from RULE_DOCS, and the settings / commands pages from
 * package.json, so the site always matches the extension.
 */
const root = path.join(__dirname, '..', '..');
const out = path.join(root, 'site');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const KACHIHRO = 'https://www.kachihro.com';
const MARKETPLACE = `https://marketplace.visualstudio.com/items?itemName=${pkg.publisher}.${pkg.name}`;
const EXT_ID = `${pkg.publisher}.${pkg.name}`;
const GITHUB = 'https://github.com/kachihro/SPFX-Pretty';
const KOFI = 'https://ko-fi.com/kachihro';

const esc = (s: string) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
/** `code` and **bold** in short help strings */
const inline = (s: string) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
const AUTO: Record<RuleDoc['auto'], [string, string]> = { yes: ['Auto-fix', 'yes'], partly: ['Guided fix', 'partly'], no: ['Needs you', 'no'] };
const areas = [...new Set(RULE_DOCS.map(r => r.area))];
const RC_EXAMPLE = {
  brandColour: '#2A6FDB',
  appNamePrefix: 'Kachihro ',
  brandWords: ['Kachihro'],
  toolboxGroup: 'Discovery',
  companyIcon: 'sharepoint/assets/kachihro-logo.png',
  developer: { name: 'Kachihro', websiteUrl: 'https://<your-website>/' },
  disabledRules: ['SOL008'],
};

/** Screenshots in media/screens (made by scripts/make-screens.js). `mock` = drawn in VS Code's style. */
const SHOTS: Record<string, { caption: string; mock?: boolean }> = {
  'report.png': { caption: 'The report: your app as the App Catalog, "Add an app" and Site Contents show it' },
  'toolbox.png': { caption: 'Toolbox tiles - expand an issue for the explanation, the exact change, and Apply / Ignore' },
  'property-pane.png': { caption: 'Property pane: the labels and default values authors see' },
  'upgrade.png': { caption: 'Version & upgrade: React / Node / TypeScript vs the latest SPFx, and a step-by-step plan with effort' },
  'step-by-step.png': { caption: 'Fix step by step: every issue, worst first - fix, explain, open, skip or ignore', mock: true },
  'preview-apply.png': { caption: 'Nothing changes until you click Apply - you see exactly what will change first', mock: true },
  'panel.png': { caption: 'The findings panel: badge on the SPFX icon, filter, and the fix next to every finding', mock: true },
  'faq.png': { caption: 'Help for every rule, right inside VS Code' },
  'icons.png': { caption: 'One company logo becomes every icon SharePoint and Teams need' },
};
const fig = (file: string, up = '', cls = '') => {
  const s = SHOTS[file];
  const cap = `${s.caption}${s.mock ? ' (illustration)' : ''}`;
  return `<figure class="fig ${cls}"><a class="lb" href="${up}assets/screens/${file}" data-caption="${esc(cap)}"><img src="${up}assets/screens/${file}" alt="${esc(s.caption)}" loading="lazy"></a><figcaption>${esc(cap)}</figcaption></figure>`;
};
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

/** Click any .lb link to view the image large: captions, arrows / keys, swipe, Esc or click outside to close. */
const MENU_JS = `(() => {
  const h = document.querySelector('header.top'), b = h && h.querySelector('button.burger');
  if (!b) { return; }
  const set = open => { h.classList.toggle('open', open); b.setAttribute('aria-expanded', String(open)); b.setAttribute('aria-label', open ? 'Close menu' : 'Open menu'); };
  b.addEventListener('click', e => { e.stopPropagation(); set(!h.classList.contains('open')); });
  h.querySelectorAll('nav.main a').forEach(a => a.addEventListener('click', () => set(false)));
  document.addEventListener('click', e => { if (!h.contains(e.target)) { set(false); } });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && h.classList.contains('open')) { set(false); b.focus(); } });
  matchMedia('(min-width:761px)').addEventListener('change', e => { if (e.matches) { set(false); } });
})();
`;
const LIGHTBOX_JS = `(() => {
  const links = [...document.querySelectorAll('a.lb')];
  if (!links.length) return;
  const box = document.createElement('div');
  box.className = 'lbx'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.hidden = true;
  box.innerHTML = '<button class="lbx-x" aria-label="Close">&times;</button><button class="lbx-p" aria-label="Previous">&#8249;</button>'
    + '<figure><img alt=""><figcaption></figcaption></figure><button class="lbx-n" aria-label="Next">&#8250;</button>';
  document.body.appendChild(box);
  const img = box.querySelector('img'), cap = box.querySelector('figcaption');
  let i = 0, lastFocus = null, x0 = null;
  const show = n => { i = (n + links.length) % links.length; img.src = links[i].href; img.alt = links[i].dataset.caption || ''; cap.textContent = (links[i].dataset.caption || '') + '  ·  ' + (i + 1) + ' / ' + links.length; };
  const open = n => { lastFocus = document.activeElement; show(n); box.hidden = false; document.body.style.overflow = 'hidden'; box.querySelector('.lbx-x').focus(); };
  const close = () => { box.hidden = true; document.body.style.overflow = ''; if (lastFocus) lastFocus.focus(); };
  links.forEach((a, n) => a.addEventListener('click', e => { e.preventDefault(); open(n); }));
  box.addEventListener('click', e => { if (e.target === box || e.target.closest('.lbx-x')) close(); else if (e.target.closest('.lbx-p')) show(i - 1); else if (e.target.closest('.lbx-n')) show(i + 1); });
  document.addEventListener('keydown', e => { if (box.hidden) return; if (e.key === 'Escape') close(); if (e.key === 'ArrowLeft') show(i - 1); if (e.key === 'ArrowRight') show(i + 1); });
  box.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  box.addEventListener('touchend', e => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) show(i + (dx < 0 ? 1 : -1)); x0 = null; });
})();`;

const CSS = `
:root{--bg:#f6f7f9;--card:#fff;--text:#3d4757;--head:#4a5568;--sub:#6b7686;--line:#e3e7ee;--blue:#2A6FDB;--sky:#2A8BD8;--violet:#7B3FE4;--navy:#15287F;--good:#107c10;--warn:#bc4b09;--chip:#eef3fc;--code:#f1f3f7}
@media (prefers-color-scheme:dark){:root{--bg:#12151c;--card:#1b2029;--text:#d7dce4;--head:#eef1f6;--sub:#9aa4b2;--line:#2b3240;--chip:#1f2a3d;--code:#232a36;--good:#54b054;--warn:#f7a35c}}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.65 Inter,"Segoe UI",system-ui,-apple-system,sans-serif}
a{color:var(--blue);text-decoration:none}a:hover{text-decoration:underline}
.wrap{max-width:1080px;margin:0 auto;padding:0 20px}
header.top{position:sticky;top:0;z-index:5;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
header.top .wrap{display:flex;align-items:center;gap:22px;height:64px}
.brand{display:flex;align-items:center;gap:10px;font-weight:700;font-size:19px;color:var(--head)}.brand img{width:30px;height:30px;border-radius:7px}
nav.main{display:flex;gap:4px;flex-wrap:wrap;margin-left:auto}
nav.main a{color:var(--text);padding:6px 12px;border-radius:999px;font-size:15px}nav.main a.on,nav.main a:hover{background:var(--chip);color:var(--blue);text-decoration:none}
.btn{display:inline-block;background:var(--blue);color:#fff!important;padding:11px 22px;border-radius:8px;font-weight:600;text-decoration:none!important}
.btn.alt{background:var(--card);color:var(--head)!important;border:1px solid var(--line)}
.hero{padding:64px 0 36px}.hero h1{font-size:clamp(34px,5.4vw,58px);line-height:1.08;margin:0 0 18px;color:var(--head);letter-spacing:-.02em}
.grad{background:linear-gradient(90deg,var(--sky),var(--blue) 35%,var(--violet) 70%,var(--navy));-webkit-background-clip:text;background-clip:text;color:transparent}
.lead{font-size:19px;max-width:720px;color:var(--sub)}.cta{display:flex;gap:12px;flex-wrap:wrap;margin:26px 0}
.shot{border-radius:14px;overflow:hidden;border:1px solid var(--line);box-shadow:0 18px 50px rgba(21,40,127,.18);background:#141821}.shot img{width:100%;display:block}
.kicker{color:var(--blue);font-weight:700;letter-spacing:.12em;font-size:13px;text-transform:uppercase;margin:56px 0 6px}
h2{font-size:30px;color:var(--head);margin:0 0 14px;letter-spacing:-.01em}h3{color:var(--head);margin:28px 0 8px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin:22px 0}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:20px 20px 16px;position:relative;overflow:hidden}
.card::before{content:"";position:absolute;inset:0 0 auto 0;height:4px;background:linear-gradient(90deg,var(--sky),var(--blue),var(--violet),var(--navy))}
.card h3{margin:4px 0 6px;font-size:18px}.card p{margin:0;color:var(--sub);font-size:15px}
.steps{counter-reset:s;list-style:none;padding:0}.steps>li{counter-increment:s;position:relative;padding:0 0 18px 52px}
.steps>li::before{content:counter(s);position:absolute;left:0;top:0;width:34px;height:34px;border-radius:50%;background:var(--blue);color:#fff;font-weight:700;display:grid;place-items:center}
.steps b{color:var(--head)}
code{background:var(--code);border-radius:5px;padding:1px 6px;font-size:.9em}
pre{background:var(--code);border:1px solid var(--line);border-radius:8px;padding:12px 14px;overflow:auto;font-size:14px;line-height:1.5}pre code{background:none;padding:0}
table{width:100%;border-collapse:collapse;margin:12px 0;font-size:15px;background:var(--card);border-radius:10px;overflow:hidden}
th,td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--head);background:var(--chip);font-size:14px}
.badge{display:inline-block;font-size:12px;font-weight:600;border-radius:999px;padding:2px 10px;border:1px solid}
.badge.yes{color:var(--good);border-color:var(--good)}.badge.partly{color:var(--blue);border-color:var(--blue)}.badge.no{color:var(--warn);border-color:var(--warn)}
.area{margin:30px 0 8px;padding:8px 14px;border-radius:8px;color:#fff;background:linear-gradient(90deg,var(--sky),var(--blue) 35%,var(--violet) 75%,var(--navy));font-size:17px}
.rules{list-style:none;padding:0;margin:0;display:grid;gap:8px}
.rules a{display:flex;gap:12px;align-items:center;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 14px;color:var(--text)}
.rules a:hover{border-color:var(--blue);text-decoration:none}.rules code{flex:none}.rules .badge{margin-left:auto;flex:none}
.search{width:100%;padding:12px 16px;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--text);font:inherit;margin:8px 0 4px}
.rule-head{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:40px 0 4px}.rule-head code{font-size:15px}
.rule h1{font-size:34px;color:var(--head);margin:6px 0 18px;line-height:1.2}
.box{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:18px 22px;margin:16px 0}
.box h2{font-size:19px;margin:0 0 8px}.box ol{margin:0;padding-left:22px}.box li{margin:6px 0}
.ba{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:700px){.ba{grid-template-columns:1fr}}
.ba .lbl{font-size:13px;font-weight:700;letter-spacing:.06em;margin-bottom:4px}.ba .before .lbl{color:var(--warn)}.ba .after .lbl{color:var(--good)}
.pager{display:flex;justify-content:space-between;gap:12px;margin:30px 0}.pager a{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 14px;max-width:48%}
.box.learn h2{display:flex;align-items:center;gap:10px}.box.learn ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.box.learn li{display:flex;justify-content:space-between;gap:12px;align-items:baseline;flex-wrap:wrap;padding:10px 12px;border:1px solid var(--line);border-radius:10px}
.box.learn li:hover{border-color:var(--accent,#2A6FDB)}.box.learn a{font-weight:500;text-decoration:none}.box.learn .ext{margin-left:6px;font-size:.85em}.box.learn .host{font-size:12px;color:var(--sub,#6b7280)}
.tip{border-left:4px solid var(--violet);background:var(--chip);padding:12px 16px;border-radius:0 10px 10px 0;margin:16px 0}
.crumb{font-size:14px;color:var(--sub);margin-top:22px}
footer.site{margin-top:70px;border-top:1px solid var(--line);padding:26px 0 40px;color:var(--sub);font-size:14px}
footer.site .foot3{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:18px}
.foot-ver{justify-self:start}.foot-links{justify-self:end;display:flex;flex-wrap:wrap;gap:6px 16px;justify-content:flex-end}
.footer-kachihro{display:inline-flex;align-items:center;gap:8px;color:var(--sub)!important;text-decoration:none!important;font-weight:500}
.footer-kachihro:hover span{color:var(--blue)}.footer-kachihro-icon{width:20px;height:20px;flex:none}
@media(max-width:600px){footer.site .foot3{grid-template-columns:1fr;justify-items:center;text-align:center}.foot-ver,.foot-links{justify-self:center}.foot-links{justify-content:center}}
.fig{margin:16px 0 22px}.fig a{display:block;border-radius:12px;overflow:hidden;border:1px solid var(--line);box-shadow:0 10px 30px rgba(21,40,127,.14);background:#1f1f1f;cursor:zoom-in}
.fig img{width:100%;display:block;transition:transform .25s}.fig a:hover img{transform:scale(1.015)}
.fig figcaption{font-size:14px;color:var(--sub);margin-top:8px}
.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:18px;margin:20px 0}.gallery .fig{margin:0}
.gallery .fig a{aspect-ratio:16/10}.gallery .fig img{height:100%;object-fit:cover;object-position:top left}
.cards.four{grid-template-columns:repeat(2,1fr)}@media(min-width:1000px){.cards.four{grid-template-columns:repeat(4,1fr)}}@media(max-width:600px){.cards.four{grid-template-columns:1fr}}
.cards.eight{grid-template-columns:repeat(auto-fit,minmax(230px,1fr))}.card .ic{font-size:22px}
.lbx{position:fixed;inset:0;z-index:50;background:rgba(10,12,20,.92);display:flex;align-items:center;justify-content:center;padding:24px}
.lbx[hidden]{display:none}.lbx figure{margin:0;max-width:min(1400px,92vw);text-align:center}
.lbx img{max-width:100%;max-height:82vh;border-radius:10px;box-shadow:0 20px 60px rgba(0,0,0,.6)}
.lbx figcaption{color:#e8ecf3;margin-top:12px;font-size:15px}
.lbx button{position:absolute;background:rgba(255,255,255,.12);color:#fff;border:none;border-radius:50%;width:46px;height:46px;font-size:28px;line-height:1;cursor:pointer}
.lbx button:hover{background:rgba(255,255,255,.25)}.lbx-x{top:18px;right:18px}.lbx-p{left:18px;top:50%;transform:translateY(-50%)}.lbx-n{right:18px;top:50%;transform:translateY(-50%)}
${SNIPPET_CSS}
pre code{font-family:Consolas,"Cascadia Code","SFMono-Regular",monospace}
button.burger{display:none}
@media(max-width:760px){
  header.top .wrap{position:relative}
  button.burger{display:inline-flex;flex-direction:column;justify-content:center;gap:5px;margin-left:auto;width:44px;height:44px;padding:0 11px;border:1px solid var(--line);border-radius:10px;background:var(--card);cursor:pointer}
  button.burger span{display:block;height:2px;border-radius:2px;background:var(--head);transition:transform .2s,opacity .2s}
  header.top.open button.burger span:nth-child(1){transform:translateY(7px) rotate(45deg)}
  header.top.open button.burger span:nth-child(2){opacity:0}
  header.top.open button.burger span:nth-child(3){transform:translateY(-7px) rotate(-45deg)}
  .js nav.main{display:none}
  nav.main{margin:0;position:absolute;top:100%;left:0;right:0;flex-direction:column;gap:2px;padding:8px 16px 14px;background:var(--bg);border-bottom:1px solid var(--line);box-shadow:0 12px 24px rgba(0,0,0,.12)}
  header.top.open nav.main{display:flex}
  nav.main a{font-size:17px;padding:12px 14px;border-radius:10px}
  html:not(.js) nav.main{position:static;flex-direction:row;flex-wrap:wrap;box-shadow:none;border:0;padding:0 0 8px}
  html:not(.js) header.top .wrap{flex-wrap:wrap;height:auto}
  html:not(.js) button.burger{display:none}
  .lbx-p,.lbx-n{display:none}
}
@media(max-width:600px){
  h2{font-size:25px}h2 code{font-size:.72em;overflow-wrap:anywhere}
  table{font-size:14px}td,th{overflow-wrap:anywhere;word-break:normal}td code,th code{overflow-wrap:anywhere;white-space:normal}
  .rules a{flex-wrap:wrap;row-gap:6px}.rules a span{min-width:0;overflow-wrap:anywhere}.rules .badge{margin-left:0}
}
`;

function page(file: string, title: string, active: string, body: string, depth = 0): void {
  const up = depth ? '../'.repeat(depth) : '';
  const nav = [['index.html', 'Home'], ['guide.html', 'How to use'], ['faq/index.html', 'How to fix'], ['settings.html', 'Settings & CLI']]
    .map(([href, label]) => `<a href="${up}${href}" class="${label === active ? 'on' : ''}"${label === active ? ' aria-current="page"' : ''}>${esc(label)}</a>`).join('');
  const meta = pageMeta(file, title);
  const pageUrl = `${DOCS_SITE}/${file === 'index.html' ? '' : file}`;
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><script>document.documentElement.classList.add('js')</script><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(meta.title)}${/SPFX Pretty/.test(meta.title) ? '' : ' | SPFX Pretty'}</title><meta name="description" content="${esc(meta.desc)}">
<link rel="canonical" href="${pageUrl}">
<meta property="og:type" content="${file === 'index.html' ? 'website' : 'article'}"><meta property="og:site_name" content="SPFX Pretty"><meta property="og:title" content="${esc(meta.title)}"><meta property="og:description" content="${esc(meta.desc)}"><meta property="og:url" content="${pageUrl}">
<meta property="og:image" content="${DOCS_SITE}/og-image.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="SPFX Pretty - cut + polish your SPFx apps before you deploy">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(meta.title)}"><meta name="twitter:description" content="${esc(meta.desc)}"><meta name="twitter:image" content="${DOCS_SITE}/og-image.png">
<link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="icon" href="/icon-192.png" type="image/png" sizes="192x192"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="manifest" href="/site.webmanifest"><meta name="theme-color" content="#2A6FDB">
${meta.ld.map(o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`).join('')}
<link rel="stylesheet" href="${up}assets/site.css"></head><body>
<header class="top"><div class="wrap"><a class="brand" href="${up}index.html"><img src="${up}assets/icon.png" alt="">SPFX Pretty</a><button class="burger" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="site-nav"><span></span><span></span><span></span></button><nav class="main" id="site-nav" aria-label="Main">${nav}</nav></div></header>
<main class="wrap">${body}</main>
<footer class="site"><div class="wrap foot3">
  <span class="foot-ver">SPFX Pretty ${esc(pkg.version)}</span>
  <a class="footer-kachihro" href="${KACHIHRO}" target="_blank" rel="noopener noreferrer"><svg class="footer-kachihro-icon" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="footer-kachihro-gradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#7c5cff"></stop><stop offset="100%" stop-color="#3ba7ff"></stop></linearGradient></defs><polygon points="12,2 22,9 12,22 2,9" fill="url(#footer-kachihro-gradient)"></polygon></svg><span>&copy; ${new Date().getFullYear()} Kachihro</span></a>
  <span class="foot-links"><a href="${up}faq/index.html">How to fix</a><a href="${GITHUB}" target="_blank" rel="noopener noreferrer">GitHub</a><a href="${GITHUB}/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">MIT licence</a><a href="${KOFI}" target="_blank" rel="noopener noreferrer">☕ Ko-fi</a></span>
</div></footer>
<script src="${up}assets/lightbox.js" defer></script><script src="${up}assets/menu.js" defer></script>
</body></html>`;
  if (file !== '404.html') { PAGES.push(file); }
  const target = path.join(out, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, html);
}

// ---------- assets ----------
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'assets'), { recursive: true });
fs.writeFileSync(path.join(out, 'assets', 'site.css'), CSS);
fs.copyFileSync(path.join(root, 'media', 'icon.png'), path.join(out, 'assets', 'icon.png'));
// favicons, app icons and the social share card live at the site root (Google looks for /favicon.ico)
for (const f of fs.readdirSync(path.join(root, 'media', 'web'))) { fs.copyFileSync(path.join(root, 'media', 'web', f), path.join(out, f)); }
fs.writeFileSync(path.join(out, 'site.webmanifest'), JSON.stringify({ name: 'SPFX Pretty', short_name: 'SPFX Pretty', description: DEFAULT_DESC, start_url: '/', display: 'browser', background_color: '#f6f7f9', theme_color: '#2A6FDB',
  icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }] }, null, 2));
fs.copyFileSync(path.join(root, 'media', 'before-after.png'), path.join(out, 'assets', 'before-after.png'));
fs.mkdirSync(path.join(out, 'assets', 'screens'), { recursive: true });
for (const f of Object.keys(SHOTS)) { fs.copyFileSync(path.join(root, 'media', 'screens', f), path.join(out, 'assets', 'screens', f)); }
fs.writeFileSync(path.join(out, 'assets', 'lightbox.js'), LIGHTBOX_JS);
fs.writeFileSync(path.join(out, 'assets', 'menu.js'), MENU_JS);

// ---------- home ----------
const ruleCount = RULE_DOCS.length;
page('index.html', 'Nice names, icons and versions for SPFx apps', 'Home', `
<section class="hero">
  <h1>Make your SPFx apps look <span class="grad">professional.</span></h1>
  <p class="lead">SPFX Pretty is a free, open-source VS Code extension that checks your SharePoint Framework project and fixes what people actually see - the App Catalog, Site Contents, the web part toolbox, the property pane and Teams.</p>
  <div class="cta"><a class="btn" href="${MARKETPLACE}">Install from the Marketplace</a><a class="btn alt" href="guide.html">See how it works</a><a class="btn alt" href="${GITHUB}" target="_blank" rel="noopener noreferrer">View on GitHub</a></div>
</section>
<div class="shot"><a class="lb" href="assets/before-after.png" data-caption="Before: 7/100 - the generator's name and a generic icon. After SPFX Pretty: 51/100 - a real name, your icon and a description." style="cursor:zoom-in"><img src="assets/before-after.png" alt="Before: project-client-side-solution with a generic icon, 7/100. After SPFX Pretty: Kachihro Project with a company icon, 51/100."></a></div>

<p class="kicker">What it does</p><h2>No more <code>project-client-side-solution</code></h2>
<div class="cards eight">
  <div class="card"><h3>🏷️ Nice names</h3><p>App, toolbox and command titles that read like products - with your brand spelled right.</p></div>
  <div class="card"><h3>🎨 Your icons</h3><p>Upload your company logo once - App Catalog, Site Contents, Teams and toolbox icons, done.</p></div>
  <div class="card"><h3>▶ Fix step by step</h3><p>Every issue, worst first. Fix, explain, open the file, skip or ignore - one at a time.</p></div>
  <div class="card"><h3>👀 See before you apply</h3><p>Every fix shows the exact lines it will change. Nothing is touched until you click Apply.</p></div>
  <div class="card"><h3>🧹 Leftover defaults</h3><p>"Description Field", "Test message" alerts, default property values and other generator text.</p></div>
  <div class="card"><h3>🧩 Unused properties</h3><p>Properties nobody reads, leftover manifest defaults, property pane typos and dead loc strings.</p></div>
  <div class="card"><h3>🔢 Versions &amp; upgrades</h3><p>React / Node / SPFx mismatches, the gulp → Heft move, and an upgrade plan with effort.</p></div>
  <div class="card"><h3>📚 Help for every rule</h3><p>${RULE_DOCS.length} rules, each with why it matters and exactly how to fix it - in VS Code and here.</p></div>
</div>

<p class="kicker">See it in action</p><h2>Screenshots</h2>
<p class="sub">Click any picture to see it full size.</p>
<div class="gallery">${Object.keys(SHOTS).map(f => fig(f)).join('')}</div>

<p class="kicker">How it works</p><h2>Three steps</h2>
<ol class="steps">
  <li><b>Install SPFX Pretty</b> from the VS Code Marketplace, then <b>open your SPFx project</b> and click the <b>SPFX</b> icon on the left.</li>
  <li><b>The report opens</b> - it shows your app the way the App Catalog, "Add an app" and Site Contents show it, with every issue underlined.</li>
  <li><b>Click ▶ Fix step by step</b> - fix, explain, skip or ignore each issue. Most are one click; the rest tell you exactly what to do.</li>
</ol>
<div class="tip">Every finding links to a page explaining <a href="faq/index.html">how to fix it</a> - ${ruleCount} rules in all.</div>

<p class="kicker">Open source</p>
<div class="cards four">
  <div class="card"><h3>📖 MIT licence</h3><p>Free for personal and commercial work. Read the code, fork it, change it - see the <a href="${GITHUB}/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">licence</a>.</p></div>
  <div class="card"><h3>🐙 On GitHub</h3><p>Source, releases and the full history at <a href="${GITHUB}" target="_blank" rel="noopener noreferrer">github.com/kachihro/SPFX-Pretty</a>.</p></div>
  <div class="card"><h3>💡 Issues &amp; ideas</h3><p>Found a bug or want a new rule? <a href="${GITHUB}/issues" target="_blank" rel="noopener noreferrer">Open an issue</a> - pull requests are welcome too.</p></div>
  <div class="card"><h3>☕ Support</h3><p>If SPFX Pretty saved you some time, you can <a href="${KOFI}" target="_blank" rel="noopener noreferrer">buy me a coffee on Ko-fi</a>. Thank you!</p></div>
</div>`);

// ---------- guide ----------
page('guide.html', 'How to use', 'How to use', `
<p class="crumb"><a href="index.html">Home</a> › How to use</p>
<h1 class="grad" style="font-size:40px;margin:6px 0 18px">How to use SPFX Pretty</h1>

<h2 id="install">Install</h2>
<ol class="steps">
  <li><b>Open VS Code</b> and go to <b>Extensions</b> (<code>Ctrl+Shift+X</code>).</li>
  <li><b>Search for SPFX Pretty</b> and click <b>Install</b> - or open it <a href="${MARKETPLACE}">on the Marketplace</a>.</li>
  <li><b>Open an SPFx project.</b> The SPFX icon appears on the Activity Bar (left edge).</li>
</ol>
<p>Or from a terminal: <code>code --install-extension ${EXT_ID}</code></p>
<p><b>Updates</b> arrive automatically through VS Code, like any other extension.</p>

<h2 id="report">The report</h2>
<p>Open an SPFx project (a folder with <code>config/package-solution.json</code>) and click the SPFX icon - the report opens straight away. It is grouped into sections you can fold:</p>
<table><tr><th>Section</th><th>What you see</th></tr>
<tr><td><b>Where people see your app</b></td><td>Your app as the App Catalog, "Add an app" and Site Contents show it - name, icon, description.</td></tr>
<tr><td><b>Toolbox</b></td><td>Each web part tile with its title, icon and the toolbox section it really lands in.</td></tr>
<tr><td><b>Property pane</b></td><td>The labels and default values authors see when they edit the web part.</td></tr>
<tr><td><b>Version &amp; upgrade</b></td><td>SPFx, React, Node and TypeScript versions, and an upgrade plan with effort.</td></tr>
<tr><td><b>All checks</b></td><td>Every finding, grouped by area, with fix buttons and <b>? Explain</b>.</td></tr></table>
<p>Each section header has <b>✨ Fix all</b> for its safe fixes, and a count of things to polish.</p>
${fig('report.png')}${fig('toolbox.png')}${fig('property-pane.png')}

<h2 id="step-by-step">Fix step by step</h2>
<p>Click <b>▶ Fix step by step</b> at the top of the report (or the ▶ on the panel). It walks through every issue, worst first. For each one you can:</p>
<ul><li><b>Apply the recommended fix</b> - or another option where there are several</li><li><b>Explain &amp; how to fix</b> - opens the help for that rule</li><li><b>Open the file</b> at the right line</li><li><b>Skip</b> or <b>Ignore the rule</b> for this workspace</li></ul>
<p>It re-scans after every change, so knock-on issues (like the About version going stale after a version bump) are picked up too.</p>
${fig('step-by-step.png')}
<h3>Nothing changes without you seeing it</h3><p>Every fix first shows what it will change - the file, the lines before and after, any files it creates - and waits for <b>Apply</b>. <b>✨ Fix all</b> lists every change first.</p>
${fig('preview-apply.png')}

<h2 id="logo">Your company logo</h2>
<p>Run <b>SPFX Pretty: Upload Company Logo</b> (or click <b>🖼 Upload company icon</b> on the icon finding). Pick a square PNG and it becomes:</p>
<ul><li>the 96x96 App Catalog / "Add an app" / Site Contents icon</li><li>the Teams colour (192x192) and outline (32x32) icons</li><li>optionally, the toolbox icon for every web part</li></ul>
<p>It is remembered for every project. A brand-colour placeholder icon is flagged until you upload a real one.</p>
${fig('icons.png')}

<h2 id="panel">The findings panel</h2>
<ul>
<li><b>Filter</b> (funnel icon): All / Errors + warnings / Errors only.</li>
<li><b>Each row</b> shows its fix, e.g. <code>SOL005 · ✍ Write the short description…</code>.</li>
<li><b>Right-click</b> any finding: Apply Fix, Explain &amp; How to Fix, Open, Copy Message, Ignore This Rule.</li>
<li><b>Where it lives:</b> Activity Bar, Explorer sidebar or both - setting <code>spfxPretty.location</code>. Lost it? Run <b>SPFX Pretty: Show Findings Panel</b>.</li></ul>
${fig('panel.png')}

<h2 id="upgrade">Version check &amp; upgrade assessment</h2>
<p>Run <b>SPFX Pretty: Version Check &amp; Upgrade Assessment</b> for a Markdown plan you can paste into a work item: current vs latest SPFx, React / Node / TypeScript, each step with Small / Medium / Large effort, and the CLI for Microsoft 365 command for the file-by-file report.</p>
${fig('upgrade.png')}

<h2 id="pipeline">In a pipeline</h2>
<p>The same checks run from the command line - see <a href="settings.html#cli">Settings &amp; CLI</a>.</p>`);

// ---------- how to fix: index + one page per rule ----------
page('faq/index.html', 'How to fix', 'How to fix', `
<p class="crumb"><a href="../index.html">Home</a> › How to fix</p>
<h1 class="grad" style="font-size:40px;margin:6px 0 6px">How to fix</h1>
<p class="lead">What each finding means and exactly how to fix it. In VS Code, right-click any finding and choose <b>Explain &amp; How to Fix</b>.</p>
${fig('faq.png', '../')}
<input class="search" id="q" placeholder="Search - e.g. icon, toolbox, React, SOL008" autofocus>
${areas.map(a => `<section data-area><h2 class="area" id="${slug(a)}">${esc(a)}</h2><ul class="rules">${RULE_DOCS.filter(r => r.area === a).map(r =>
  `<li data-text="${esc((r.id + ' ' + r.title + ' ' + r.why).toLowerCase())}"><a href="${r.id}.html"><code>${r.id}</code><span>${esc(r.title)}</span><span class="badge ${AUTO[r.auto][1]}">${AUTO[r.auto][0]}</span></a></li>`).join('')}</ul></section>`).join('')}
<script>
const q=document.getElementById('q');q.addEventListener('input',()=>{const t=q.value.toLowerCase().trim();
document.querySelectorAll('.rules li').forEach(li=>{li.style.display=!t||li.dataset.text.includes(t)?'':'none';});
document.querySelectorAll('section[data-area]').forEach(s=>{s.style.display=[...s.querySelectorAll('li')].some(li=>li.style.display!=='none')?'':'none';});});
</script>`, 1);

RULE_DOCS.forEach((r, i) => {
  const prev = RULE_DOCS[i - 1], next = RULE_DOCS[i + 1];
  page(`faq/${r.id}.html`, `${r.id}: ${r.title}`, 'How to fix', `
<article class="rule">
<p class="crumb"><a href="../index.html">Home</a> › <a href="index.html">How to fix</a> › <a href="index.html#${slug(r.area)}">${esc(r.area)}</a></p>
<div class="rule-head"><code>${r.id}</code><span class="badge ${AUTO[r.auto][1]}">${AUTO[r.auto][0]}</span></div>
<h1>${esc(r.title)}</h1>
<div class="box"><h2>Why it matters</h2><p>${inline(r.why)}</p></div>
${r.where ? `<div class="box"><h2>Where</h2><p><code>${esc(r.where)}</code></p></div>` : ''}
<div class="box"><h2>How to fix</h2><ol>${r.fix.map(f => `<li>${inline(f)}</li>`).join('')}</ol></div>
${r.before || r.after ? `<div class="ba"${r.before && r.after ? '' : ' style="grid-template-columns:1fr"'}>${r.before ? `<div class="before"><div class="lbl">BEFORE</div><pre><code>${snippetHtml(r.before)}</code></pre></div>` : ''}${r.after ? `<div class="after"><div class="lbl">${r.before ? 'AFTER' : 'EXAMPLE'}</div><pre><code>${snippetHtml(r.after)}</code></pre></div>` : ''}</div>` : ''}
${learnLinks(r.id, r.learnMore).length ? `<div class="box learn"><h2><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><rect x="2" y="2" width="9.5" height="9.5" fill="#F25022"/><rect x="12.5" y="2" width="9.5" height="9.5" fill="#7FBA00"/><rect x="2" y="12.5" width="9.5" height="9.5" fill="#00A4EF"/><rect x="12.5" y="12.5" width="9.5" height="9.5" fill="#FFB900"/></svg>Microsoft articles</h2><ul>${learnLinks(r.id, r.learnMore).map(l => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.title)}<span class="ext" aria-hidden="true">↗</span></a><span class="host">learn.microsoft.com</span></li>`).join('')}</ul></div>` : ''}
<div class="tip">In VS Code: right-click the finding → <b>${r.auto === 'no' ? 'Explain &amp; How to Fix' : 'Apply Fix…'}</b>, or use <b>▶ Fix step by step</b> in the report.</div>
<nav class="pager">${prev ? `<a href="${prev.id}.html">← ${prev.id} ${esc(prev.title)}</a>` : '<span></span>'}${next ? `<a href="${next.id}.html" style="text-align:right">${next.id} ${esc(next.title)} →</a>` : ''}</nav>
</article>`, 1);
});

// ---------- settings & CLI (from package.json) ----------
const props = pkg.contributes.configuration.properties as Record<string, { type: string; default: unknown; description: string; enum?: string[] }>;
const commands = (pkg.contributes.commands as { command: string; title: string }[]).filter(c => !/^spfxPretty\.(applyFix|openFinding|filterActive|copyMessage|ignoreRule|fixCategory)$/.test(c.command));
page('settings.html', 'Settings & CLI', 'Settings & CLI', `
<p class="crumb"><a href="index.html">Home</a> › Settings &amp; CLI</p>
<h1 class="grad" style="font-size:40px;margin:6px 0 18px">Settings &amp; CLI</h1>
<h2 id="commands">Commands</h2><p>Press <code>Ctrl+Shift+P</code> and type <b>SPFX Pretty</b>.</p>
<table><tr><th>Command</th></tr>${commands.map(c => `<tr><td><b>SPFX Pretty: ${esc(c.title)}</b></td></tr>`).join('')}</table>
<h2 id="settings">Settings</h2><p>File › Preferences › Settings, search <b>SPFX Pretty</b>.</p>
<table><tr><th>Setting</th><th>Default</th><th>What it does</th></tr>${Object.entries(props).map(([k, v]) =>
  `<tr><td><code>${esc(k)}</code></td><td><code>${esc(JSON.stringify(v.default))}</code></td><td>${inline(v.description)}${v.enum ? `<br><small>Options: ${v.enum.filter(Boolean).map(e => `<code>${esc(e)}</code>`).join(' ')}</small>` : ''}</td></tr>`).join('')}</table>
<h2 id="rc">Per-project settings: <code>.spfxprettyrc.json</code></h2><p>Commit this to the project so the whole team (and the pipeline) agree:</p>
<pre><code>${highlightJson(JSON.stringify(RC_EXAMPLE, null, 2))}</code></pre>
<h2 id="cli">Command line (pipelines)</h2>
<pre><code>node out/cli.js . --min-score 70 --fail-on error --html report.html --upgrade-md upgrade.md</code></pre>
<table><tr><th>Option</th><th>What it does</th></tr>
<tr><td><code>--fix</code></td><td>Apply all safe fixes</td></tr><tr><td><code>--html &lt;file&gt;</code></td><td>Write the report as HTML (publish it as a build artifact)</td></tr>
<tr><td><code>--upgrade-md &lt;file&gt;</code></td><td>Write the upgrade assessment</td></tr><tr><td><code>--json</code></td><td>Machine-readable output</td></tr>
<tr><td><code>--company-icon &lt;png&gt;</code></td><td>Use this logo for icon fixes</td></tr><tr><td><code>--online</code> / <code>--latest &lt;ver&gt;</code></td><td>Compare with the latest SPFx from npm, or a given version</td></tr>
<tr><td><code>--min-score &lt;n&gt;</code>, <code>--fail-on error|warning|info</code></td><td>Fail the build below a score or at a severity</td></tr></table>`);

// ---------- hosting ----------
fs.writeFileSync(path.join(out, 'staticwebapp.config.json'), JSON.stringify({ navigationFallback: { rewrite: '/index.html', exclude: ['/assets/*', '/faq/*', '/sitemap.xml', '/robots.txt', '/*.{png,ico,svg,webmanifest}'] }, responseOverrides: { 404: { rewrite: '/index.html' } }, mimeTypes: { '.webmanifest': 'application/manifest+json' } }, null, 2));
page('404.html', 'Not found', '', `<section class="hero"><h1>Page not found</h1><p class="lead">Try <a href="faq/index.html">How to fix</a> or the <a href="index.html">home page</a>.</p></section>`);
const today = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path.join(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${PAGES.map(f => `  <url><loc>${DOCS_SITE}/${f === 'index.html' ? '' : f}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`);
fs.writeFileSync(path.join(out, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${DOCS_SITE}/sitemap.xml\n`);
console.log(`Website written to site/ - ${RULE_DOCS.length} how-to-fix pages + home, guide, settings`);
