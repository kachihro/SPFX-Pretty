import * as path from 'path';
import { componentName, kindLabel } from './project';
import { MODERN_GROUPS } from './rules/components';
import { Category, ComponentInfo, Finding, ScanResult, Surface } from './types';

export interface ReportOptions {
  /** Adds "Fix" / "Open" buttons that post messages to the VS Code extension. */
  interactive: boolean;
  /** Content-Security-Policy nonce for the inline script (webview). */
  nonce?: string;
  cspSource?: string;
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const CATEGORY_ORDER: Category[] = ['Title', 'Icon', 'Defaults', 'Properties', 'Versions', 'Metadata', 'Teams', 'Branding'];
const CATEGORY_BLURB: Record<Category, string> = {
  Title: 'The names people read in the App Catalog, Site Contents, the toolbox and the command bar',
  Icon: 'App icon (App Catalog, Add an app, Site Contents), toolbox icons and command icons',
  Defaults: 'Generator text that is still showing: default property values, property pane labels, sample alerts, package file name',
  Properties: 'Web part properties that are declared but unused, leftover manifest defaults, property pane typos, unused loc strings',
  Versions: 'SPFx, React, TypeScript and Node versions, toolchain, and what an upgrade involves',
  Metadata: 'Descriptions, developer details, categories and screenshots on the app details page',
  Teams: 'Icons Teams needs when a web part is used as a tab or personal app',
  Branding: 'Theme colours, section backgrounds and Brand Center fonts inside your components',
};

interface Ctx { r: ScanResult; opts: ReportOptions; }

/** Approximation of the generic teal "no icon" app tile SharePoint shows. */
const DEFAULT_APP_ICON = '<svg viewBox="0 0 48 48" width="100%" height="100%"><rect width="48" height="48" fill="#03787c"/><path d="M27 9l11 6.3v12.6L27 34.2 16 27.9V15.3z" fill="#fff" opacity=".9"/><path d="M17 26.5l6 3.5v7l-6 3.5-6-3.5v-7z" fill="#fff" stroke="#03787c" stroke-width="1.5"/></svg>';

function idx(c: Ctx, f: Finding): number { return c.r.findings.indexOf(f); }

/** Suggested value from a fix title like 'Rename solution to "Hello World"'. */
function suggestion(f: Finding | undefined): string | undefined {
  return f?.fixes[0] ? /"([^"]+)"/.exec(f.fixes[0].title)?.[1] : undefined;
}

function surfaceIssues(c: Ctx, s: Surface): Finding[] {
  return c.r.findings.filter(f => f.severity !== 'pass' && f.surfaces?.includes(s));
}

/** Small fix buttons (first fix of each finding) shown inside a preview panel. */
function actions(c: Ctx, list: Finding[], max = 6): string {
  const withFix = list.filter(f => f.severity !== 'pass' && f.fixes.length);
  const manual = list.filter(f => f.severity !== 'pass' && !f.fixes.length).length;
  if (!withFix.length && !manual) { return ''; }
  if (!c.opts.interactive) {
    return withFix.length ? `<div class="acts">${withFix.slice(0, max).map(f => `<span class="hint">Fix: ${esc(f.fixes[0].title)}</span>`).join('')}</div>` : '';
  }
  const btns = withFix.slice(0, max).map(f =>
    `<button class="fix mini ${f.severity}" data-idx="${idx(c, f)}" data-fix="0" title="${esc(f.message)}">${esc(f.fixes[0].title)}</button>`).join('');
  const more = withFix.length > max ? `<span class="hint">+${withFix.length - max} more in All checks</span>` : '';
  const hand = manual ? `<span class="hint">${manual} need${manual === 1 ? 's' : ''} a human touch - see All checks</span>` : '';
  return `<div class="acts">${btns}${more}${hand}</div>`;
}

/** Which findings belong to each report section (used for counts and "Fix all"). */
export function sectionMatcher(id: string): (f: Finding) => boolean {
  const on = (...s: Surface[]) => (f: Finding) => !!f.surfaces?.some(x => s.includes(x));
  switch (id) {
    case 'where': return on('App Catalog', 'Add an app', 'Site Contents');
    case 'toolbox': return on('Toolbox');
    case 'pane': return on('Property pane', 'Web part on page');
    case 'versions': return f => f.category === 'Versions';
    default: return () => true;
  }
}

function appIcon(c: Ctx, size: number): string {
  const s = c.r.solution;
  return s?.iconDataUri
    ? `<img class="appicon" style="width:${size}px;height:${size}px" src="${esc(s.iconDataUri)}" alt="">`
    : `<span class="appicon placeholder" style="width:${size}px;height:${size}px" title="No iconPath - SharePoint shows its generic app icon">${DEFAULT_APP_ICON}</span>`;
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
  const whereIssues = c.r.findings.filter(f => f.severity !== 'pass' && sectionMatcher('where')(f));
  const fixRow = `${better ? `<div class="suggest">Suggested name: <b>${esc(better)}</b></div>` : ''}${actions(c, whereIssues, 8)}`;
  const hidden = c.r.preview.skipFeatureDeployment;
  const hiddenNote = hidden
    ? '<div class="note info">skipFeatureDeployment is true: when deployed to all sites the app is <b>not</b> listed in "Add an app" or Site Contents. If an admin unticks "add to all sites", it shows here.</div>'
    : '';

  return `<div class="surfaces">
  <div class="panel"><div class="ph">App Catalog <span class="sub">Apps for SharePoint</span></div>
    <table class="sp"><thead><tr><th></th><th>Title</th><th>Name</th><th>Version</th></tr></thead>
    <tbody><tr><td>${appIcon(c, 24)}</td><td>${nameCell}</td><td class="${fileIssue ? 'ugly' : ''}">${esc(c.r.preview.packageFile.replace(/\.sppkg$/i, ''))}</td><td>${esc(s?.version ?? '')}</td></tr></tbody></table>
    ${issueNote(c, 'App Catalog')}
  </div>
  <div class="panel"><div class="ph">Add an app <span class="sub">From your organisation</span></div>
    <div class="tile${hidden ? ' dim' : ''}">${appIcon(c, 64)}<div class="tname">${nameCell}</div><div class="tdesc">My organization</div><div class="addbtn">Add</div></div>
    <div class="tdesc2 ${descIssue ? 'ugly' : ''}" title="Short description (app details)">${esc(s?.shortDescription ?? 'No description')}</div>
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

/** The modern toolbox section the component really appears in. */
function effectiveGroup(comp: ComponentInfo): string {
  if (comp.kind !== 'WebPart') { return kindLabel(comp.kind); }
  const g = MODERN_GROUPS.find(x => x.id === comp.groupId?.toLowerCase());
  return g ? g.name : `Advanced${comp.group ? ` (custom "${comp.group}" ignored)` : ''}`;
}

function toolbox(c: Ctx): string {
  const list = c.r.components.filter(x => x.kind === 'WebPart' || x.kind === 'AdaptiveCardExtension');
  if (!list.length) { return ''; }
  const items = list.map(comp => {
    const titleIssue = c.r.findings.find(f => f.ruleId === 'CMP001' && f.severity !== 'pass' && f.file === comp.manifestFile);
    const better = suggestion(titleIssue);
    return `<div class="tbx-item" title="${esc(comp.description ?? '')}">${toolboxIcon(comp)}
      <div class="${titleIssue ? 'ugly' : ''}">${esc(componentName(comp))}</div>
      ${better ? `<div class="kind">→ ${esc(better)}</div>` : ''}<div class="kind">${esc(effectiveGroup(comp))}</div>
      ${actions(c, c.r.findings.filter(f => f.file === comp.manifestFile && sectionMatcher('toolbox')(f)), 3)}</div>`;
  }).join('');
  return `<div class="panel"><div class="tbx">${items}</div>${issueNote(c, 'Toolbox')}</div>`;
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
      ${props.length ? `<div class="pp-note">Default values when the web part is added:</div>` : ''}
      ${props.map(([k, v]) => `<label class="pp-k">${esc(k)}</label><div class="pp-in ${v ? '' : 'empty'}">${v ? esc(v) : '(empty)'}</div>`).join('')}
      ${c.r.findings.some(f => f.ruleId === 'ABT001' && f.severity !== 'pass' && f.component === p.component) ? '<div class="pp-about-missing">No About section (version, developer, packages)</div>' : ''}
      ${actions(c, c.r.findings.filter(f => f.component === p.component && (sectionMatcher('pane')(f) || f.ruleId === 'ABT001')), 4)}
    </div>`;
  };
  return `<div class="surfaces">${panes.map(card).join('')}</div>`;
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

function upgradeSection(c: Ctx): string {
  const u = c.r.upgrade;
  if (!u) { return ''; }
  const upToDate = !u.hops.length;
  const chip = (e: string) => `<span class="effort e${e}">${e === 'S' ? 'Small' : e === 'M' ? 'Medium' : 'Large'}</span>`;
  const row = (label: string, cur: string | undefined, target: string | undefined, ok: boolean) =>
    `<tr><td>${esc(label)}</td><td class="${ok ? '' : 'bad'}">${esc(cur ?? '-')}</td><td>${esc(target ?? '-')}</td><td>${ok ? '&#x2714;' : '&#x26A0;'}</td></tr>`;
  const nodeOk = !u.compat.node.target.length || u.compat.node.current.some(n => u.compat.node.target.includes(n));
  const reactOk = !u.compat.react.current || u.compat.react.current === u.compat.react.target;
  const verIssues = c.r.findings.filter(f => f.category === 'Versions' && f.severity !== 'pass');
  return `<div class="surfaces">
    <div class="panel">
      <div class="ph">SPFx ${esc(u.current)} ${upToDate ? '<span class="ok">&#x2714; latest</span>' : `&rarr; ${esc(u.latest)}`}</div>
      <div class="sub">${esc(u.toolchain === 'gulp' ? 'Gulp toolchain (legacy)' : 'Heft toolchain')}${upToDate ? '' : ` &middot; ${u.hops.length} release${u.hops.length === 1 ? '' : 's'} behind &middot; overall effort: <b>${esc(u.effort)}</b>`}</div>
      <table class="compat"><thead><tr><th></th><th>Project</th><th>${upToDate ? 'Needed' : esc(u.latest)}</th><th></th></tr></thead><tbody>
        ${row('React', u.compat.react.current, u.compat.react.target, reactOk)}
        ${row('Node', u.compat.node.current.map(n => 'v' + n).join(', '), u.compat.node.target.map(n => 'v' + n).join(', '), nodeOk)}
        ${row('TypeScript', u.compat.typescript.current, u.compat.typescript.target, true)}
      </tbody></table>
      ${verIssues.length ? `<div class="note bad">${verIssues.length} version issue${verIssues.length === 1 ? '' : 's'}</div>${actions(c, verIssues, 4)}` : '<div class="note ok">&#x2714; Versions line up</div>'}
    </div>
    ${u.steps.length ? `<div class="panel"><div class="ph">Upgrade plan</div><ol class="steps">${u.steps.map(st => `<li>${chip(st.effort)} <b>${esc(st.title)}</b><div class="sub">${esc(st.detail)}${st.link ? ` <a href="${esc(st.link)}">Docs</a>` : ''}</div></li>`).join('')}</ol>
      <div class="sub" style="margin-top:8px">Detailed file-by-file report (CLI for Microsoft 365):</div><code class="cmd">${esc(u.command)}</code></div>` : ''}
  </div>`;
}

/** A coloured section panel with a header bar, subtitle and an issue count badge. */
function section(id: string, title: string, sub: string, colour: string, inner: string, count?: number, safeFixes = 0, interactive = false): string {
  if (!inner.trim()) { return ''; }
  const fixAll = interactive && safeFixes ? `<button class="fixsec" data-sec="${id}" title="Apply the safe fixes in this section">&#x2728; Fix all (${safeFixes})</button>` : '';
  const badge = count === undefined ? '' : count ? `<span class="sbadge">${count} to polish</span>` : '<span class="sbadge ok">&#x2714; all nice</span>';
  return `<section class="sec" id="${id}" style="--c:${colour}">
    <div class="sh"><div><span class="st">${esc(title)}</span> <span class="ss">${esc(sub)}</span></div><div class="shr">${fixAll}${badge}</div></div>
    <div class="sb">${inner}</div>
  </section>`;
}

const SEV_RANK = { error: 3, warning: 2, info: 1, pass: 0 } as const;

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
    const worst = list.reduce((m, f) => Math.max(m, SEV_RANK[f.severity]), 0);
    const colour = worst === 3 ? 'var(--bad)' : worst === 2 ? 'var(--warn)' : worst === 1 ? 'var(--info)' : 'var(--good)';
    return `<section class="cat" style="--c:${colour}"><h3>${esc(cat)} <span class="count">${list.length ? `${list.length} to polish` : '&#x2714; all nice'}</span></h3>
      <p class="blurb">${esc(CATEGORY_BLURB[cat])}</p>
      <ul>${list.map(f => findingRow(c, f)).join('')}</ul>
      ${ok.length ? `<details><summary>${ok.length} looking nice</summary><ul>${ok.map(f => findingRow(c, f)).join('')}</ul></details>` : ''}
    </section>`;
  }).join('');
  const nav: [string, string, number | undefined][] = [
    ['where', 'Where people see it', issues.filter(sectionMatcher('where')).length],
    ['toolbox', 'Toolbox', issues.filter(sectionMatcher('toolbox')).length],
    ['pane', 'Property pane', issues.filter(sectionMatcher('pane')).length],
    ['versions', 'Version & upgrade', issues.filter(sectionMatcher('versions')).length],
    ['checks', 'All checks', issues.length],
  ];
  const safe = (id: string) => issues.filter(sectionMatcher(id)).filter(f => f.fixes.some(x => x.safe)).length;
  const ia = opts.interactive;

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
.tile{align-items:flex-start;text-align:left}.tname{font-weight:600;font-size:16px;word-break:break-word}.tdesc{font-size:12px;color:#605e5c}.addbtn{border:1px solid #8a8886;border-radius:4px;padding:4px 18px;font-size:13px;margin-top:6px}.tdesc2{font-size:12px;color:var(--sub);margin:8px auto 0;max-width:220px}
.dim{opacity:.55}
.appicon{border-radius:6px;display:inline-grid;place-items:center;vertical-align:middle}
.appicon.placeholder{overflow:hidden;outline:2px dashed var(--bad);outline-offset:2px}
.ugly{background:var(--uglybg);color:var(--bad);border-radius:3px;padding:0 3px;text-decoration:wavy underline var(--bad);text-underline-offset:3px}
table.sp .ugly,.tile .ugly,.tile .tdesc.ugly{background:#fde7e9;color:#a4262c}
.ugly-b{border-color:var(--bad)!important;color:var(--bad)!important}
.note{font-size:12px;margin-top:8px}.note.ok{color:var(--good)}.note.bad{color:var(--bad)}.note.info{color:var(--sub);margin-top:10px}
.suggest{margin-top:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.tbx{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px}
.tbx-item{display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 6px;border-radius:6px;border:1px solid var(--line);text-align:center;font-size:12.5px;min-width:0;word-break:break-word}
.tbx-img{width:40px;height:28px;object-fit:contain}
.tbx-font{min-width:40px;height:28px;display:grid;place-items:center;padding:0 4px;border:1px dashed var(--sub);border-radius:4px;font-size:10px;color:var(--sub)}
.kind{font-size:11px;color:var(--sub)}
.pp .pp-h{font-size:13px;margin-bottom:10px;display:inline-block}.pp .pp-g{font-weight:600;margin:6px 0;display:inline-block}
.pp .pp-l{font-size:12.5px;margin:6px 0 4px;display:block;width:fit-content}
.pp-in{border:1px solid var(--sub);border-radius:3px;padding:4px 8px;font-size:13px;min-height:28px;margin-bottom:6px}
table.compat{width:100%;border-collapse:collapse;margin-top:10px;font-size:13px}table.compat td,table.compat th{padding:5px 6px;border-bottom:1px solid var(--line);text-align:left}table.compat td.bad{color:var(--bad);font-weight:600}
.ok{color:var(--good);font-size:13px;font-weight:400}
ol.steps{margin:0;padding-left:20px}ol.steps li{margin-bottom:10px}
.effort{display:inline-block;font-size:11px;padding:0 7px;border-radius:999px;color:#fff}.eS{background:var(--good)}.eM{background:var(--warn)}.eL{background:var(--bad)}
code.cmd{display:block;font-size:11.5px;padding:8px;background:var(--bg);border:1px solid var(--line);border-radius:4px;word-break:break-all;white-space:pre-wrap;margin-top:4px}
html{scroll-behavior:smooth}
.jump{position:sticky;top:0;z-index:5;display:flex;flex-wrap:wrap;gap:6px;padding:10px 0;margin:8px 0 0;background:var(--bg)}
.jump a{font-size:12.5px;text-decoration:none;color:var(--text);border:1px solid var(--line);background:var(--card);border-radius:999px;padding:3px 12px}
.jump a b{color:var(--bad);font-weight:600;margin-left:2px}
.sec{margin:20px 0;border-radius:10px;border:1px solid color-mix(in srgb,var(--c) 45%,var(--line));background:color-mix(in srgb,var(--c) 7%,var(--bg));overflow:hidden;scroll-margin-top:52px}
.sh{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 16px;background:var(--c);color:#fff}
.st{font-size:16px;font-weight:600}.ss{font-size:12.5px;opacity:.85;margin-left:4px}
.sbadge{font-size:12px;background:rgba(0,0,0,.25);border-radius:999px;padding:2px 10px;white-space:nowrap}
.sbadge.ok{background:rgba(255,255,255,.22)}
.sb{padding:14px 16px}
.shr{display:flex;gap:8px;align-items:center}
button.fixsec{background:#fff;color:var(--c);border:none;font-weight:600;border-radius:999px;padding:3px 12px}
button.fixsec:hover{filter:brightness(.92)}
.acts{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px;align-items:center}
.tbx-item .acts{justify-content:center}
button.mini{font-size:11px;padding:2px 8px;border-radius:999px;text-align:left;max-width:100%;white-space:normal;line-height:1.35}
button.mini.error{background:var(--bad);border-color:var(--bad)}button.mini.warning{background:var(--warn);border-color:var(--warn)}
button:disabled{opacity:.6;cursor:default}
.cat{margin:0 0 14px;padding:12px 14px;border-radius:8px;border-left:5px solid var(--c);background:color-mix(in srgb,var(--c) 6%,var(--card))}
.cat:last-child{margin-bottom:0}
.cat h3 .count{color:var(--c)}
.pp-note{font-size:12px;color:var(--sub);margin:10px 0 4px}
.pp-k{display:block;font-size:12px;color:var(--sub);margin:6px 0 2px;font-family:Consolas,monospace}
.pp-in.empty{color:var(--sub);font-style:italic}
.pp-about-missing{margin-top:10px;font-size:12px;border:1px dashed var(--warn);color:var(--warn);border-radius:4px;padding:6px 8px}.blurb{margin:0 0 8px;color:var(--sub);font-size:12.5px}
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
  <div class="sub">SPFx ${esc(r.upgrade?.current ?? r.spfxVersion ?? '?')} &middot; ${r.components.length} component${r.components.length === 1 ? '' : 's'} &middot; ${issues.length} thing${issues.length === 1 ? '' : 's'} to polish &middot; ${passes.length} looking nice</div></div>
</div>

<nav class="jump">${nav.map(([id, label, n]) => `<a href="#${id}">${esc(label)}${n ? ` <b>${n}</b>` : ''}</a>`).join('')}</nav>

${section('where', 'Where people see your app', 'App Catalog, Add an app and Site Contents', '#0f6cbd', appSurfaces(c), nav[0][2], safe('where'), ia)}
${section('toolbox', 'Toolbox', 'when someone adds a web part', '#8764b8', toolbox(c), nav[1][2], safe('toolbox'), ia)}
${section('pane', 'Property pane', 'what authors see when they edit the web part', '#038387', propertyPanes(c), nav[2][2], safe('pane'), ia)}
${section('versions', 'Version & upgrade', 'SPFx, React, Node, TypeScript and what an upgrade involves', '#ca5010', upgradeSection(c), nav[3][2], safe('versions'), ia)}
${others.length ? section('others', 'Other components', 'extensions and libraries', '#5c5c5c', `<div class="panel">${others.map(x => `<div style="margin:4px 0"><b>${esc(componentName(x))}</b> <span class="kind">${esc(kindLabel(x.kind))}</span>${x.commands?.length ? `<div class="sub">Commands: ${x.commands.map(k => esc(k.title ?? k.key)).join(', ')}</div>` : ''}</div>`).join('')}</div>`) : ''}
${section('checks', 'All checks', 'grouped by area - right-click items in the SPFX-Pretty panel for more fixes', '#616161', checks || '<p>Nothing to check - is this an SPFx project?</p>', nav[4][2], safe('checks'), ia)}
</div>
${opts.interactive ? `<script nonce="${opts.nonce}">
const vscode = acquireVsCodeApi();
document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.classList.contains('fix')) { b.disabled = true; b.textContent = 'Applying...'; vscode.postMessage({ type: 'fix', idx: +b.dataset.idx, fix: +b.dataset.fix }); }
  if (b.classList.contains('open')) { vscode.postMessage({ type: 'open', idx: +b.dataset.idx }); }
  if (b.classList.contains('fixsec')) { b.disabled = true; b.textContent = 'Fixing...'; vscode.postMessage({ type: 'fixSection', section: b.dataset.sec }); }
});
</script>` : ''}
</body></html>`;
}
