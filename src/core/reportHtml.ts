import * as path from 'path';
import { componentName, kindLabel } from './project';
import { Category, ComponentInfo, Finding, ScanResult, Surface } from './types';

export interface ReportOptions {
  /** Adds "Fix" / "Open" buttons that post messages to the VS Code extension. */
  interactive: boolean;
  /** Content-Security-Policy nonce for the inline script (webview). */
  nonce?: string;
  cspSource?: string;
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const CATEGORY_ORDER: Category[] = ['Title', 'Icon', 'Defaults', 'Properties', 'Metadata', 'Teams', 'Branding'];
const CATEGORY_BLURB: Record<Category, string> = {
  Title: 'The names people read in the App Catalog, Site Contents, the toolbox and the command bar',
  Icon: 'App icon (App Catalog, Add an app, Site Contents), toolbox icons and command icons',
  Defaults: 'Generator text that is still showing: default property values, property pane labels, sample alerts, package file name',
  Properties: 'Web part properties that are declared but unused, leftover manifest defaults, property pane typos, unused loc strings',
  Metadata: 'Descriptions, developer details, categories and screenshots on the app details page',
  Teams: 'Icons Teams needs when a web part is used as a tab or personal app',
  Branding: 'Theme colours, section backgrounds and Brand Center fonts inside your components',
};

interface Ctx { r: ScanResult; opts: ReportOptions; }

function idx(c: Ctx, f: Finding): number { return c.r.findings.indexOf(f); }

function fixButton(c: Ctx, f: Finding | undefined, label?: string): string {
  if (!f || !f.fixes.length) { return ''; }
  if (!c.opts.interactive) { return `<span class="hint">Fix: ${esc(f.fixes[0].title)}</span>`; }
  return `<button class="fix" data-idx="${idx(c, f)}" data-fix="0">${esc(label ?? f.fixes[0].title)}</button>`;
}

/** Suggested value from a fix title like 'Rename solution to "Hello World"'. */
function suggestion(f: Finding | undefined): string | undefined {
  return f?.fixes[0] ? /"([^"]+)"/.exec(f.fixes[0].title)?.[1] : undefined;
}

function surfaceIssues(c: Ctx, s: Surface): Finding[] {
  return c.r.findings.filter(f => f.severity !== 'pass' && f.surfaces?.includes(s));
}

function appIcon(c: Ctx, size: number): string {
  const s = c.r.solution;
  return s?.iconDataUri
    ? `<img class="appicon" style="width:${size}px;height:${size}px" src="${esc(s.iconDataUri)}" alt="">`
    : `<span class="appicon placeholder" style="width:${size}px;height:${size}px" title="No iconPath - SharePoint shows a generic icon">?</span>`;
}

function issueNote(c: Ctx, s: Surface): string {
  const list = surfaceIssues(c, s);
  if (!list.length) { return `<div class="note ok">&#x2714; Looks nice here</div>`; }
  return `<div class="note bad">${list.length} thing${list.length === 1 ? '' : 's'} people will notice here</div>`;
}

/** The three places the app itself appears. */
function appSurfaces(c: Ctx): string {
  const s = c.r.solution;
  const nameIssue = c.r.findings.find(f => (f.ruleId === 'SOL001' || f.ruleId === 'SOL014') && f.severity !== 'pass');
  const iconIssue = c.r.findings.find(f => /^SOL01[012]$/.test(f.ruleId) && f.severity !== 'pass');
  const fileIssue = c.r.findings.find(f => f.ruleId === 'DEF004' && f.severity !== 'pass');
  const descIssue = c.r.findings.find(f => f.ruleId === 'SOL005' && f.severity !== 'pass');
  const name = s?.name ?? '(no name)';
  const nameCell = `<span class="${nameIssue ? 'ugly' : ''}">${esc(name)}</span>`;
  const better = suggestion(nameIssue);
  const fixRow = (nameIssue || iconIssue)
    ? `<div class="suggest">${better ? `Suggested name: <b>${esc(better)}</b> ` : ''}${fixButton(c, nameIssue, 'Rename')}${fixButton(c, iconIssue, 'Add brand icon')}</div>`
    : '';
  const hidden = c.r.preview.skipFeatureDeployment;
  const hiddenNote = hidden
    ? '<div class="note info">skipFeatureDeployment is true: when deployed to all sites the app is <b>not</b> listed in "Add an app" or Site Contents. If an admin unticks "add to all sites", it shows here.</div>'
    : '';

  return `<div class="surfaces">
  <div class="panel"><div class="ph">App Catalog <span class="sub">Apps for SharePoint</span></div>
    <table class="sp"><thead><tr><th></th><th>Title</th><th>Name</th><th>Version</th></tr></thead>
    <tbody><tr><td>${appIcon(c, 24)}</td><td>${nameCell}</td><td class="${fileIssue ? 'ugly' : ''}">${esc(c.r.preview.packageFile)}</td><td>${esc(s?.version ?? '')}</td></tr></tbody></table>
    ${issueNote(c, 'App Catalog')}
  </div>
  <div class="panel"><div class="ph">Add an app <span class="sub">From your organisation</span></div>
    <div class="tile${hidden ? ' dim' : ''}">${appIcon(c, 64)}<div class="tname">${nameCell}</div><div class="tdesc ${descIssue ? 'ugly' : ''}">${esc(s?.shortDescription ?? 'No description')}</div><div class="link">App details</div></div>
    ${issueNote(c, 'Add an app')}
  </div>
  <div class="panel"><div class="ph">Site Contents <span class="sub">after it's added to a site</span></div>
    <table class="sp${hidden ? ' dim' : ''}"><thead><tr><th></th><th>Name</th><th>Type</th></tr></thead>
    <tbody><tr><td>${appIcon(c, 24)}</td><td>${nameCell}</td><td>App</td></tr></tbody></table>
    ${issueNote(c, 'Site Contents')}
  </div>
  </div>${fixRow}${hiddenNote}`;
}

function toolboxIcon(comp: ComponentInfo): string {
  if (comp.iconImageUrl && !comp.officeFabricIconFontName && /^(data:|https:)/.test(comp.iconImageUrl)) {
    return `<img class="tbx-img" src="${esc(comp.iconImageUrl)}" alt="">`;
  }
  if (comp.officeFabricIconFontName) {
    return `<span class="tbx-font${comp.officeFabricIconFontName === 'Page' ? ' ugly-b' : ''}" title="Fluent icon">${esc(comp.officeFabricIconFontName)}</span>`;
  }
  return '<span class="tbx-font ugly-b">?</span>';
}

function toolbox(c: Ctx): string {
  const list = c.r.components.filter(x => x.kind === 'WebPart' || x.kind === 'AdaptiveCardExtension');
  if (!list.length) { return ''; }
  const items = list.map(comp => {
    const titleIssue = c.r.findings.find(f => f.ruleId === 'CMP001' && f.severity !== 'pass' && f.file === comp.manifestFile);
    const better = suggestion(titleIssue);
    return `<div class="tbx-item" title="${esc(comp.description ?? '')}">${toolboxIcon(comp)}
      <div class="${titleIssue ? 'ugly' : ''}">${esc(componentName(comp))}</div>
      ${better ? `<div class="kind">→ ${esc(better)}</div>` : `<div class="kind">${esc(comp.group ?? kindLabel(comp.kind))}</div>`}</div>`;
  }).join('');
  return `<h2>Toolbox <span class="sub">when someone adds a web part</span></h2><div class="panel"><div class="tbx">${items}</div>${issueNote(c, 'Toolbox')}</div>`;
}

function propertyPanes(c: Ctx): string {
  const panes = c.r.preview.propertyPanes.filter(p => p.header !== undefined || p.group !== undefined || p.label !== undefined || Object.keys(p.defaults).length);
  if (!panes.length) { return ''; }
  const isDef = (v: string | undefined, d: RegExp) => v !== undefined && d.test(v);
  const card = (p: typeof panes[number]) => {
    const props = Object.entries(p.defaults);
    return `<div class="panel pp"><div class="ph">${esc(p.component)}</div>
      ${p.header !== undefined ? `<div class="pp-h ${isDef(p.header, /^Description$/) ? 'ugly' : ''}">${esc(p.header)}</div>` : ''}
      ${p.group !== undefined ? `<div class="pp-g ${isDef(p.group, /^Group Name$/) ? 'ugly' : ''}">${esc(p.group)}</div>` : ''}
      ${p.label !== undefined ? `<div class="pp-l ${isDef(p.label, /^Description Field$/) ? 'ugly' : ''}">${esc(p.label)}</div>` : ''}
      ${props.map(([k, v]) => `<div class="pp-in" title="Default value of ${esc(k)}">${esc(v) || '&nbsp;'}</div>`).join('')}
    </div>`;
  };
  return `<h2>Property pane <span class="sub">what authors see when they edit the web part</span></h2><div class="surfaces">${panes.map(card).join('')}</div>`;
}

function findingRow(c: Ctx, f: Finding): string {
  const rel = path.relative(c.r.root, f.file).replace(/\\/g, '/');
  const badge = { error: '&#x2716;', warning: '&#x26A0;', info: '&#x2139;', pass: '&#x2714;' }[f.severity];
  const i = idx(c, f);
  const buttons = c.opts.interactive
    ? `${f.fixes.map((x, n) => `<button class="fix" data-idx="${i}" data-fix="${n}">${esc(x.title)}</button>`).join('')}<button class="open" data-idx="${i}">Open</button>`
    : f.fixes.length ? `<span class="hint">Fix: ${esc(f.fixes[0].title)}</span>` : '';
  return `<li class="f ${f.severity}"><span class="sev">${badge}</span><div class="body">
    <div class="msg">${esc(f.message)}</div>
    ${f.detail ? `<div class="detail">${esc(f.detail)}</div>` : ''}
    <div class="where">${(f.surfaces ?? []).map(s => `<span class="chip">${esc(s)}</span>`).join('')}<span>${esc(rel)}${f.component ? ` &middot; ${esc(f.component)}` : ''}</span> <code class="rule">${esc(f.ruleId)}</code></div>
    ${f.severity !== 'pass' ? `<div class="actions">${buttons}</div>` : ''}
  </div></li>`;
}

export function renderReportHtml(r: ScanResult, opts: ReportOptions): string {
  const c: Ctx = { r, opts };
  const issues = r.findings.filter(f => f.severity !== 'pass');
  const passes = r.findings.filter(f => f.severity === 'pass');
  const others = r.components.filter(x => x.kind !== 'WebPart' && x.kind !== 'AdaptiveCardExtension');
  const scoreColour = r.score >= 85 ? 'var(--good)' : r.score >= 60 ? 'var(--warn)' : 'var(--bad)';

  const checks = CATEGORY_ORDER.map(cat => {
    const list = issues.filter(f => f.category === cat);
    const ok = passes.filter(f => f.category === cat);
    if (!list.length && !ok.length) { return ''; }
    return `<section class="cat"><h3>${esc(cat)} <span class="count">${list.length ? `${list.length} to polish` : 'all nice'}</span></h3>
      <p class="blurb">${esc(CATEGORY_BLURB[cat])}</p>
      <ul>${list.map(f => findingRow(c, f)).join('')}</ul>
      ${ok.length ? `<details><summary>${ok.length} looking nice</summary><ul>${ok.map(f => findingRow(c, f)).join('')}</ul></details>` : ''}
    </section>`;
  }).join('');

  const csp = opts.cspSource !== undefined
    ? `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${opts.cspSource} data: https:; style-src 'unsafe-inline'; script-src 'nonce-${opts.nonce}';">`
    : '';

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">${csp}
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SPFX-Pretty Report</title>
<style>
:root{--bg:#f5f5f5;--card:#fff;--text:#242424;--sub:#616161;--line:#e0e0e0;--good:#107c10;--warn:#bc4b09;--bad:#c50f1f;--info:#0f6cbd;--accent:#0f6cbd;--uglybg:#fde7e9;--sp:#fff;--sptext:#242424}
@media (prefers-color-scheme: dark){:root:not(.vscode-light){--bg:#1f1f1f;--card:#2b2b2b;--text:#f0f0f0;--sub:#b0b0b0;--line:#3d3d3d;--good:#54b054;--warn:#f7a35c;--bad:#f1707b;--info:#62abf5;--accent:#62abf5;--uglybg:#4a1f23}}
body.vscode-dark,body.vscode-high-contrast{--bg:#1f1f1f;--card:#2b2b2b;--text:#f0f0f0;--sub:#b0b0b0;--line:#3d3d3d;--good:#54b054;--warn:#f7a35c;--bad:#f1707b;--info:#62abf5;--accent:#62abf5;--uglybg:#4a1f23}
*{box-sizing:border-box}
body{margin:0;padding:24px 16px;background:var(--bg);color:var(--text);font:14px/1.45 "Segoe UI",system-ui,-apple-system,sans-serif}
.wrap{max-width:1080px;margin:0 auto}
h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:28px 0 10px}h3{font-size:15px;margin:0 0 2px;display:flex;gap:8px;align-items:baseline}
.sub{color:var(--sub);font-weight:400;font-size:12.5px}
.top{display:flex;gap:20px;align-items:center;flex-wrap:wrap}
.score{width:92px;height:92px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(${scoreColour} ${r.score * 3.6}deg,var(--line) 0);flex:none}
.score span{width:74px;height:74px;border-radius:50%;background:var(--bg);display:grid;place-items:center;font-size:24px;font-weight:600}
.surfaces{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}
.panel{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:14px;min-width:0}
.ph{font-weight:600;margin-bottom:10px}
/* the mock SharePoint surfaces stay light, like the real thing */
table.sp{width:100%;border-collapse:collapse;background:var(--sp);color:var(--sptext);border:1px solid #e1dfdd;border-radius:4px;font-size:13px}
table.sp th{font-weight:600;text-align:left;padding:6px 8px;border-bottom:1px solid #e1dfdd;color:#605e5c;font-size:12px}
table.sp th:first-child{width:40px}
table.sp td{padding:8px;vertical-align:middle;word-break:break-word}
.tile{background:var(--sp);color:var(--sptext);border:1px solid #e1dfdd;border-radius:4px;padding:16px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:6px;max-width:220px;margin:0 auto}
.tname{font-weight:600;word-break:break-word}.tdesc{font-size:12px;color:#605e5c}.link{font-size:12px;color:#0f6cbd}
.dim{opacity:.55}
.appicon{border-radius:6px;display:inline-grid;place-items:center;vertical-align:middle}
.appicon.placeholder{background:#edebe9;color:#a19f9d;font-weight:600;outline:2px dashed var(--bad);outline-offset:1px}
.ugly{background:var(--uglybg);color:var(--bad);border-radius:3px;padding:0 3px;text-decoration:wavy underline var(--bad);text-underline-offset:3px}
table.sp .ugly,.tile .ugly,.tile .tdesc.ugly{background:#fde7e9;color:#a4262c}
.ugly-b{border-color:var(--bad)!important;color:var(--bad)!important}
.note{font-size:12px;margin-top:8px}.note.ok{color:var(--good)}.note.bad{color:var(--bad)}.note.info{color:var(--sub);margin-top:10px}
.suggest{margin-top:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.tbx{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px}
.tbx-item{display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 6px;border-radius:6px;border:1px solid var(--line);text-align:center;font-size:12.5px;min-width:0;word-break:break-word}
.tbx-img{width:40px;height:28px;object-fit:contain}
.tbx-font{min-width:40px;height:28px;display:grid;place-items:center;padding:0 4px;border:1px dashed var(--sub);border-radius:4px;font-size:10px;color:var(--sub)}
.kind{font-size:11px;color:var(--sub)}
.pp .pp-h{font-size:13px;margin-bottom:10px;display:inline-block}.pp .pp-g{font-weight:600;margin:6px 0;display:inline-block}
.pp .pp-l{font-size:12.5px;margin:6px 0 4px;display:block;width:fit-content}
.pp-in{border:1px solid var(--sub);border-radius:3px;padding:4px 8px;font-size:13px;min-height:28px;margin-bottom:6px}
.cat{margin:18px 0}.blurb{margin:0 0 8px;color:var(--sub);font-size:12.5px}
.count{font-size:12px;font-weight:400;color:var(--sub)}
ul{list-style:none;margin:0;padding:0}
.f{display:flex;gap:10px;padding:10px 12px;background:var(--card);border:1px solid var(--line);border-left-width:4px;border-radius:6px;margin-bottom:6px}
.f.error{border-left-color:var(--bad)}.f.warning{border-left-color:var(--warn)}.f.info{border-left-color:var(--info)}.f.pass{border-left-color:var(--good)}
.sev{width:18px;flex:none;text-align:center}.f.error .sev{color:var(--bad)}.f.warning .sev{color:var(--warn)}.f.info .sev{color:var(--info)}.f.pass .sev{color:var(--good)}
.body{min-width:0;flex:1}.msg{word-break:break-word}.detail{color:var(--sub);font-size:12.5px;margin-top:3px}
.where{color:var(--sub);font-size:12px;margin-top:4px;word-break:break-all;display:flex;flex-wrap:wrap;gap:4px;align-items:center}
.chip{display:inline-block;padding:0 7px;border-radius:999px;background:var(--line);color:var(--text);font-size:11px;white-space:nowrap}
.rule{font-size:11px;color:var(--sub);background:transparent}
.actions{margin-top:6px;display:flex;gap:6px;flex-wrap:wrap}
button{font:inherit;font-size:12px;padding:3px 10px;border-radius:4px;border:1px solid var(--accent);background:var(--accent);color:#fff;cursor:pointer}
button.open{background:transparent;color:var(--accent)}
.hint{font-size:12px;color:var(--sub)}
details summary{cursor:pointer;color:var(--sub);margin:6px 0}
</style></head><body><div class="wrap">
<div class="top">
  <div class="score" title="Niceness score"><span>${r.score}</span></div>
  <div><h1>${esc(r.solution?.name ?? path.basename(r.root))}</h1>
  <div class="sub">SPFx ${esc(r.spfxVersion ?? '?')} &middot; ${r.components.length} component${r.components.length === 1 ? '' : 's'} &middot; ${issues.length} thing${issues.length === 1 ? '' : 's'} to polish &middot; ${passes.length} looking nice</div></div>
</div>

<h2>Where people see your app</h2>
${appSurfaces(c)}
${toolbox(c)}
${propertyPanes(c)}
${others.length ? `<h2>Other components</h2><div class="panel">${others.map(x => `<div style="margin:4px 0"><b>${esc(componentName(x))}</b> <span class="kind">${esc(kindLabel(x.kind))}</span>${x.commands?.length ? `<div class="sub">Commands: ${x.commands.map(k => esc(k.title ?? k.key)).join(', ')}</div>` : ''}</div>`).join('')}</div>` : ''}

<h2>Checks</h2>
${checks || '<p>Nothing to check - is this an SPFx project?</p>'}
</div>
${opts.interactive ? `<script nonce="${opts.nonce}">
const vscode = acquireVsCodeApi();
document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.classList.contains('fix')) { b.disabled = true; b.textContent = 'Applying...'; vscode.postMessage({ type: 'fix', idx: +b.dataset.idx, fix: +b.dataset.fix }); }
  if (b.classList.contains('open')) { vscode.postMessage({ type: 'open', idx: +b.dataset.idx }); }
});
</script>` : ''}
</body></html>`;
}
