import * as fs from 'fs';
import * as path from 'path';
import { RULE_DOCS, RuleDoc } from '../core/ruleDocs';

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

const esc = (s: string) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
/** `code` and **bold** in short help strings */
const inline = (s: string) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
const AUTO: Record<RuleDoc['auto'], [string, string]> = { yes: ['Auto-fix', 'yes'], partly: ['Guided fix', 'partly'], no: ['Needs you', 'no'] };
const areas = [...new Set(RULE_DOCS.map(r => r.area))];

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
.tip{border-left:4px solid var(--violet);background:var(--chip);padding:12px 16px;border-radius:0 10px 10px 0;margin:16px 0}
.crumb{font-size:14px;color:var(--sub);margin-top:22px}
footer.site{margin-top:70px;border-top:1px solid var(--line);padding:26px 0 40px;color:var(--sub);font-size:14px}
footer.site .foot3{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:18px}
.foot-ver{justify-self:start}.foot-links{justify-self:end}
.footer-kachihro{display:inline-flex;align-items:center;gap:8px;color:var(--sub)!important;text-decoration:none!important;font-weight:500}
.footer-kachihro:hover span{color:var(--blue)}.footer-kachihro-icon{width:20px;height:20px;flex:none}
@media(max-width:600px){footer.site .foot3{grid-template-columns:1fr;justify-items:center;text-align:center}.foot-ver,.foot-links{justify-self:center}}
.fig{margin:16px 0 22px}.fig a{display:block;border-radius:12px;overflow:hidden;border:1px solid var(--line);box-shadow:0 10px 30px rgba(21,40,127,.14);background:#1f1f1f;cursor:zoom-in}
.fig img{width:100%;display:block;transition:transform .25s}.fig a:hover img{transform:scale(1.015)}
.fig figcaption{font-size:14px;color:var(--sub);margin-top:8px}
.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:18px;margin:20px 0}.gallery .fig{margin:0}
.gallery .fig a{aspect-ratio:16/10}.gallery .fig img{height:100%;object-fit:cover;object-position:top left}
.cards.eight{grid-template-columns:repeat(auto-fit,minmax(230px,1fr))}.card .ic{font-size:22px}
.lbx{position:fixed;inset:0;z-index:50;background:rgba(10,12,20,.92);display:flex;align-items:center;justify-content:center;padding:24px}
.lbx[hidden]{display:none}.lbx figure{margin:0;max-width:min(1400px,92vw);text-align:center}
.lbx img{max-width:100%;max-height:82vh;border-radius:10px;box-shadow:0 20px 60px rgba(0,0,0,.6)}
.lbx figcaption{color:#e8ecf3;margin-top:12px;font-size:15px}
.lbx button{position:absolute;background:rgba(255,255,255,.12);color:#fff;border:none;border-radius:50%;width:46px;height:46px;font-size:28px;line-height:1;cursor:pointer}
.lbx button:hover{background:rgba(255,255,255,.25)}.lbx-x{top:18px;right:18px}.lbx-p{left:18px;top:50%;transform:translateY(-50%)}.lbx-n{right:18px;top:50%;transform:translateY(-50%)}
@media(max-width:760px){nav.main{display:none}header.top .wrap{justify-content:space-between}.lbx-p,.lbx-n{display:none}}
`;

function page(file: string, title: string, active: string, body: string, depth = 0): void {
  const up = depth ? '../'.repeat(depth) : '';
  const nav = [['index.html', 'Home'], ['guide.html', 'How to use'], ['faq/index.html', 'How to fix'], ['settings.html', 'Settings & CLI']]
    .map(([href, label]) => `<a href="${up}${href}" class="${label === active ? 'on' : ''}">${label}</a>`).join('');
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} - SPFX Pretty</title><meta name="description" content="SPFX Pretty for VS Code: nice names, icons and versions for SharePoint Framework apps.">
<link rel="icon" href="${up}assets/icon.png"><link rel="stylesheet" href="${up}assets/site.css"></head><body>
<header class="top"><div class="wrap"><a class="brand" href="${up}index.html"><img src="${up}assets/icon.png" alt="">SPFX Pretty</a><nav class="main">${nav}</nav></div></header>
<main class="wrap">${body}</main>
<footer class="site"><div class="wrap foot3">
  <span class="foot-ver">SPFX Pretty ${esc(pkg.version)}</span>
  <a class="footer-kachihro" href="${KACHIHRO}" target="_blank" rel="noopener noreferrer"><svg class="footer-kachihro-icon" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="footer-kachihro-gradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#7c5cff"></stop><stop offset="100%" stop-color="#3ba7ff"></stop></linearGradient></defs><polygon points="12,2 22,9 12,22 2,9" fill="url(#footer-kachihro-gradient)"></polygon></svg><span>&copy; ${new Date().getFullYear()} Kachihro</span></a>
  <span class="foot-links"><a href="${up}faq/index.html">How to fix</a></span>
</div></footer>
<script src="${up}assets/lightbox.js" defer></script>
</body></html>`;
  const target = path.join(out, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, html);
}

// ---------- assets ----------
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'assets'), { recursive: true });
fs.writeFileSync(path.join(out, 'assets', 'site.css'), CSS);
fs.copyFileSync(path.join(root, 'media', 'icon.png'), path.join(out, 'assets', 'icon.png'));
fs.copyFileSync(path.join(root, 'media', 'before-after.png'), path.join(out, 'assets', 'before-after.png'));
fs.mkdirSync(path.join(out, 'assets', 'screens'), { recursive: true });
for (const f of Object.keys(SHOTS)) { fs.copyFileSync(path.join(root, 'media', 'screens', f), path.join(out, 'assets', 'screens', f)); }
fs.writeFileSync(path.join(out, 'assets', 'lightbox.js'), LIGHTBOX_JS);

// ---------- home ----------
const ruleCount = RULE_DOCS.length;
page('index.html', 'Nice names, icons and versions for SPFx apps', 'Home', `
<section class="hero">
  <h1>Make your SPFx apps look <span class="grad">professional.</span></h1>
  <p class="lead">SPFX Pretty is a free VS Code extension that checks your SharePoint Framework project and fixes what people actually see - the App Catalog, Site Contents, the web part toolbox, the property pane and Teams.</p>
  <div class="cta"><a class="btn" href="${MARKETPLACE}">Install from the Marketplace</a><a class="btn alt" href="guide.html">See how it works</a></div>
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
<div class="tip">Every finding links to a page explaining <a href="faq/index.html">how to fix it</a> - ${ruleCount} rules in all.</div>`);

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
${r.before || r.after ? `<div class="ba"${r.before && r.after ? '' : ' style="grid-template-columns:1fr"'}>${r.before ? `<div class="before"><div class="lbl">BEFORE</div><pre><code>${esc(r.before)}</code></pre></div>` : ''}${r.after ? `<div class="after"><div class="lbl">${r.before ? 'AFTER' : 'EXAMPLE'}</div><pre><code>${esc(r.after)}</code></pre></div>` : ''}</div>` : ''}
<div class="tip">In VS Code: right-click the finding → <b>${r.auto === 'no' ? 'Explain &amp; How to Fix' : 'Apply Fix…'}</b>, or use <b>▶ Fix step by step</b> in the report.${r.learnMore ? ` More: <a href="${esc(r.learnMore)}">Microsoft Learn</a>.` : ''}</div>
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
<pre><code>{
  "brandColour": "#2A6FDB",
  "appNamePrefix": "Kachihro ",
  "brandWords": ["Kachihro"],
  "toolboxGroup": "Discovery",
  "companyIcon": "sharepoint/assets/kachihro-logo.png",
  "developer": { "name": "Kachihro", "websiteUrl": "https://&lt;your-website&gt;/" },
  "disabledRules": ["SOL008"]
}</code></pre>
<h2 id="cli">Command line (pipelines)</h2>
<pre><code>node out/cli.js . --min-score 70 --fail-on error --html report.html --upgrade-md upgrade.md</code></pre>
<table><tr><th>Option</th><th>What it does</th></tr>
<tr><td><code>--fix</code></td><td>Apply all safe fixes</td></tr><tr><td><code>--html &lt;file&gt;</code></td><td>Write the report as HTML (publish it as a build artifact)</td></tr>
<tr><td><code>--upgrade-md &lt;file&gt;</code></td><td>Write the upgrade assessment</td></tr><tr><td><code>--json</code></td><td>Machine-readable output</td></tr>
<tr><td><code>--company-icon &lt;png&gt;</code></td><td>Use this logo for icon fixes</td></tr><tr><td><code>--online</code> / <code>--latest &lt;ver&gt;</code></td><td>Compare with the latest SPFx from npm, or a given version</td></tr>
<tr><td><code>--min-score &lt;n&gt;</code>, <code>--fail-on error|warning|info</code></td><td>Fail the build below a score or at a severity</td></tr></table>`);

// ---------- hosting ----------
fs.writeFileSync(path.join(out, 'staticwebapp.config.json'), JSON.stringify({ navigationFallback: { rewrite: '/index.html', exclude: ['/assets/*', '/faq/*'] }, responseOverrides: { 404: { rewrite: '/index.html' } } }, null, 2));
page('404.html', 'Not found', '', `<section class="hero"><h1>Page not found</h1><p class="lead">Try <a href="faq/index.html">How to fix</a> or the <a href="index.html">home page</a>.</p></section>`);
console.log(`Website written to site/ - ${RULE_DOCS.length} how-to-fix pages + home, guide, settings`);
