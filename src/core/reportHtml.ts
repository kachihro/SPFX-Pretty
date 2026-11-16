import * as path from 'path';
import { componentName, kindLabel } from './project';
import { Category, ComponentInfo, Finding, ScanResult } from './types';

export interface ReportOptions {
  /** Adds "Fix" / "Open" buttons that post messages to the VS Code extension. */
  interactive: boolean;
  /** Content-Security-Policy nonce for the inline script (webview). */
  nonce?: string;
  cspSource?: string;
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const CATEGORY_ORDER: Category[] = ['Title', 'Icon', 'Metadata', 'Branding', 'Teams'];
const CATEGORY_BLURB: Record<Category, string> = {
  Title: 'What people read in the App Catalog, toolbox and command bar',
  Icon: '.sppkg icon, toolbox icons and command icons',
  Metadata: 'Descriptions, developer details, categories, screenshots',
  Branding: 'Theme colours, section backgrounds and Brand Center fonts inside your components',
  Teams: 'Icons Teams needs when a web part is surfaced as a tab or personal app',
};

function iconFor(c: ComponentInfo): string {
  if (c.iconImageUrl && !c.officeFabricIconFontName && /^(data:|https:)/.test(c.iconImageUrl)) {
    return `<img class="tbx-img" src="${esc(c.iconImageUrl)}" alt="">`;
  }
  if (c.officeFabricIconFontName) {
    return `<span class="tbx-font" title="Fluent icon: ${esc(c.officeFabricIconFontName)}">${esc(c.officeFabricIconFontName)}</span>`;
  }
  return '<span class="tbx-font missing">?</span>';
}

function findingRow(f: Finding, root: string, idx: number, opts: ReportOptions): string {
  const rel = path.relative(root, f.file).replace(/\\/g, '/');
  const sev = f.severity;
  const badge = { error: '&#x2716;', warning: '&#x26A0;', info: '&#x2139;', pass: '&#x2714;' }[sev];
  const buttons = opts.interactive
    ? `${f.fixes.map((x, i) => `<button class="fix" data-idx="${idx}" data-fix="${i}">${esc(x.title)}</button>`).join('')}<button class="open" data-idx="${idx}">Open</button>`
    : f.fixes.length ? `<span class="hint">Fix: ${esc(f.fixes[0].title)}</span>` : '';
  return `<li class="f ${sev}"><span class="sev">${badge}</span><div class="body">
    <div class="msg">${esc(f.message)} <code class="rule">${esc(f.ruleId)}</code></div>
    ${f.detail ? `<div class="detail">${esc(f.detail)}</div>` : ''}
    <div class="where">${esc(rel)}${f.component ? ` &middot; ${esc(f.component)}` : ''}</div>
    ${sev !== 'pass' ? `<div class="actions">${buttons}</div>` : ''}
  </div></li>`;
}

export function renderReportHtml(r: ScanResult, opts: ReportOptions): string {
  const s = r.solution;
  const issues = r.findings.filter(f => f.severity !== 'pass');
  const passes = r.findings.filter(f => f.severity === 'pass');
  const toolbox = r.components.filter(c => c.kind === 'WebPart' || c.kind === 'AdaptiveCardExtension');
  const others = r.components.filter(c => !toolbox.includes(c));
  const scoreColour = r.score >= 85 ? 'var(--good)' : r.score >= 60 ? 'var(--warn)' : 'var(--bad)';
  const indexOf = (f: Finding) => r.findings.indexOf(f);

  const byCategory = CATEGORY_ORDER.map(cat => {
    const list = issues.filter(f => f.category === cat);
    const ok = passes.filter(f => f.category === cat);
    if (!list.length && !ok.length) { return ''; }
    return `<section class="cat"><h3>${esc(cat)} <span class="count">${list.length ? `${list.length} to polish` : 'all nice'}</span></h3>
      <p class="blurb">${esc(CATEGORY_BLURB[cat])}</p>
      <ul>${list.map(f => findingRow(f, r.root, indexOf(f), opts)).join('')}</ul>
      ${ok.length ? `<details><summary>${ok.length} looking nice</summary><ul>${ok.map(f => findingRow(f, r.root, indexOf(f), opts)).join('')}</ul></details>` : ''}
    </section>`;
  }).join('');

  const csp = opts.cspSource !== undefined
    ? `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${opts.cspSource} data: https:; style-src 'unsafe-inline'; script-src 'nonce-${opts.nonce}';">`
    : '';

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">${csp}
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SPFX-Pretty Report</title>
<style>
:root{--bg:#f5f5f5;--card:#fff;--text:#242424;--sub:#616161;--line:#e0e0e0;--good:#107c10;--warn:#bc4b09;--bad:#c50f1f;--info:#0f6cbd;--accent:#0f6cbd}
@media (prefers-color-scheme: dark){:root:not(.vscode-light){--bg:#1f1f1f;--card:#2b2b2b;--text:#f0f0f0;--sub:#b0b0b0;--line:#3d3d3d;--good:#54b054;--warn:#f7a35c;--bad:#f1707b;--info:#62abf5;--accent:#62abf5}}
body.vscode-dark,body.vscode-high-contrast{--bg:#1f1f1f;--card:#2b2b2b;--text:#f0f0f0;--sub:#b0b0b0;--line:#3d3d3d;--good:#54b054;--warn:#f7a35c;--bad:#f1707b;--info:#62abf5;--accent:#62abf5}
*{box-sizing:border-box}
body{margin:0;padding:24px 16px;background:var(--bg);color:var(--text);font:14px/1.45 "Segoe UI",system-ui,-apple-system,sans-serif}
.wrap{max-width:1040px;margin:0 auto}
h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:28px 0 10px}h3{font-size:15px;margin:0 0 2px;display:flex;gap:8px;align-items:baseline}
.sub{color:var(--sub)}
.top{display:flex;gap:20px;align-items:center;flex-wrap:wrap}
.score{width:92px;height:92px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(${scoreColour} ${r.score * 3.6}deg,var(--line) 0);flex:none}
.score span{width:74px;height:74px;border-radius:50%;background:var(--bg);display:grid;place-items:center;font-size:24px;font-weight:600}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}
.card{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:16px}
.app{display:flex;gap:14px;align-items:flex-start}
.app img,.app .noicon{width:64px;height:64px;border-radius:12px;flex:none}
.noicon{display:grid;place-items:center;background:var(--line);color:var(--sub);font-size:11px;text-align:center}
.app .t{font-weight:600;font-size:16px}
.kv{display:grid;grid-template-columns:auto 1fr;gap:2px 12px;margin-top:10px;font-size:12.5px}.kv dt{color:var(--sub)}.kv dd{margin:0;word-break:break-word}
.tbx{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:8px}
.tbx-item{display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 6px;border-radius:6px;border:1px solid var(--line);text-align:center;font-size:12.5px}
.tbx-img{width:40px;height:28px;object-fit:contain}
.tbx-font{min-width:40px;height:28px;display:grid;place-items:center;padding:0 4px;border:1px dashed var(--sub);border-radius:4px;font-size:10px;color:var(--sub)}
.tbx-font.missing{border-color:var(--bad);color:var(--bad)}
.kind{font-size:11px;color:var(--sub)}
.cat{margin:18px 0}.blurb{margin:0 0 8px;color:var(--sub);font-size:12.5px}
.count{font-size:12px;font-weight:400;color:var(--sub)}
ul{list-style:none;margin:0;padding:0}
.f{display:flex;gap:10px;padding:10px 12px;background:var(--card);border:1px solid var(--line);border-left-width:4px;border-radius:6px;margin-bottom:6px}
.f.error{border-left-color:var(--bad)}.f.warning{border-left-color:var(--warn)}.f.info{border-left-color:var(--info)}.f.pass{border-left-color:var(--good)}
.sev{width:18px;flex:none;text-align:center}.f.error .sev{color:var(--bad)}.f.warning .sev{color:var(--warn)}.f.info .sev{color:var(--info)}.f.pass .sev{color:var(--good)}
.body{min-width:0;flex:1}.msg{word-break:break-word}.detail{color:var(--sub);font-size:12.5px;margin-top:3px}.where{color:var(--sub);font-size:12px;margin-top:3px;word-break:break-all}
.rule{font-size:11px;color:var(--sub);background:transparent}
.actions{margin-top:6px;display:flex;gap:6px;flex-wrap:wrap}
button{font:inherit;font-size:12px;padding:3px 10px;border-radius:4px;border:1px solid var(--accent);background:var(--accent);color:#fff;cursor:pointer}
button.open{background:transparent;color:var(--accent)}
.hint{font-size:12px;color:var(--sub)}
details summary{cursor:pointer;color:var(--sub);margin:6px 0}
.pill{display:inline-block;padding:1px 8px;border-radius:999px;border:1px solid var(--line);font-size:12px;color:var(--sub);margin:2px 4px 0 0}
</style></head><body><div class="wrap">
<div class="top">
  <div class="score" title="Niceness score"><span>${r.score}</span></div>
  <div><h1>${esc(s?.name ?? path.basename(r.root))}</h1>
  <div class="sub">SPFx ${esc(r.spfxVersion ?? '?')} &middot; ${r.components.length} component${r.components.length === 1 ? '' : 's'} &middot; ${issues.length} thing${issues.length === 1 ? '' : 's'} to polish &middot; ${passes.length} looking nice</div></div>
</div>

<h2>App Catalog preview</h2>
<div class="grid">
  <div class="card"><div class="app">
    ${s?.iconDataUri ? `<img src="${esc(s.iconDataUri)}" alt="">` : '<div class="noicon">no icon</div>'}
    <div><div class="t">${esc(s?.name ?? '(no name)')}</div>
    <div class="sub">${esc(s?.shortDescription ?? 'No short description')}</div>
    <div>${s?.categories.map(c => `<span class="pill">${esc(c)}</span>`).join('') ?? ''}</div></div>
  </div>
  <dl class="kv"><dt>Version</dt><dd>${esc(s?.version ?? '-')}</dd><dt>Developer</dt><dd>${esc(s?.developerName || '-')}</dd><dt>Icon</dt><dd>${esc(s?.iconPath ?? '-')}</dd></dl></div>
  <div class="card"><div class="sub" style="margin-bottom:6px">Long description</div><div>${esc(s?.longDescription ?? '-')}</div></div>
</div>

${toolbox.length ? `<h2>Toolbox preview</h2><div class="card"><div class="tbx">${toolbox.map(c => `<div class="tbx-item" title="${esc(c.description ?? '')}">${iconFor(c)}<div>${esc(componentName(c))}</div><div class="kind">${esc(c.group ?? kindLabel(c.kind))}</div></div>`).join('')}</div>
<p class="sub" style="font-size:12px;margin:8px 0 0">Fluent font icons are shown by name; images render at the toolbox size of 40x28.</p></div>` : ''}

${others.length ? `<h2>Other components</h2><div class="card">${others.map(c => `<div style="margin:4px 0"><b>${esc(componentName(c))}</b> <span class="kind">${esc(kindLabel(c.kind))}</span>${c.commands?.length ? `<div class="sub" style="font-size:12.5px">Commands: ${c.commands.map(x => esc(x.title ?? x.key)).join(', ')}</div>` : ''}</div>`).join('')}</div>` : ''}

<h2>Checks</h2>
${byCategory || '<p>Nothing to check - is this an SPFx project?</p>'}
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
