import * as crypto from 'crypto';
import * as path from 'path';
import * as vscode from 'vscode';
import { JsoncDoc, applyEditsToText } from './core/jsonc';
import { glyphForKind, makePngIcon, makeSvgIcon, svgDataUri } from './core/icons';
import { componentName, kindLabel, loadProject } from './core/project';
import { renderReportHtml, sectionMatcher } from './core/reportHtml';
import { issues, scanProject } from './core/scanner';
import { themingSnippet } from './core/snippets';
import { titleProblems, toNiceTitle } from './core/titles';
import { Finding, Fix, ScanResult } from './core/types';
import { applyFix, readConfig, setLatestOnline } from './vscode/apply';
import { registerExtraCommands } from './vscode/extraCommands';
import { fetchLatestSpfxVersion } from './core/versions';
import { ScanManager } from './vscode/scanManager';
import { FILTER_LABEL, FindingsTree, SeverityFilter, categoryFromNode, findingFromNode } from './vscode/treeView';

let panel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const scans = new ScanManager();
  const tree = new FindingsTree(scans);
  const view = vscode.window.createTreeView('spfxPretty.findings', { treeDataProvider: tree, showCollapseAll: true });
  context.subscriptions.push(scans, view);
  // Clicking the SPFX Pretty icon on the activity bar opens the report straight away
  view.onDidChangeVisibility(e => {
    if (e.visible && !panel && scans.all.length && vscode.workspace.getConfiguration('spfxPretty').get('showReportAfterScan', true)) {
      vscode.commands.executeCommand('spfxPretty.showReport');
    }
  });
  // Badge on the SPFX Pretty activity bar icon: errors + warnings across all projects
  scans.onDidChange(() => {
    const all = scans.all.flatMap(r => r.findings);
    const errors = all.filter(f => f.severity === 'error').length;
    const warnings = all.filter(f => f.severity === 'warning').length;
    view.badge = errors + warnings ? { value: errors + warnings, tooltip: `SPFX Pretty: ${errors} error${errors === 1 ? '' : 's'}, ${warnings} warning${warnings === 1 ? '' : 's'}` } : undefined;
  });

  // ---- Severity filter for the tree (remembered per workspace) ----
  const applyFilter = (f: SeverityFilter) => {
    tree.filter = f;
    view.description = f === 'all' ? undefined : FILTER_LABEL[f];
    vscode.commands.executeCommand('setContext', 'spfxPretty.filtered', f !== 'all');
    context.workspaceState.update('spfxPretty.filter', f);
    tree.refresh();
  };
  applyFilter(context.workspaceState.get<SeverityFilter>('spfxPretty.filter') ?? 'all');
  const pickFilter = async () => {
    const items: (vscode.QuickPickItem & { f: SeverityFilter })[] = [
      { f: 'all', label: '$(list-flat) All', description: 'errors, warnings, info and what already looks nice' },
      { f: 'warnings', label: '$(warning) Errors + warnings', description: 'hide info and passes' },
      { f: 'errors', label: '$(error) Errors only', description: 'just the must-fix items' },
    ];
    items.forEach(i => { i.picked = i.f === tree.filter; if (i.f === tree.filter) { i.label += '  $(check)'; } });
    const pick = await vscode.window.showQuickPick(items, { title: 'SPFX Pretty: show which findings?' });
    if (pick) { applyFilter(pick.f); }
  };
  context.subscriptions.push(
    vscode.commands.registerCommand('spfxPretty.filter', pickFilter),
    vscode.commands.registerCommand('spfxPretty.filterActive', pickFilter),
    vscode.commands.registerCommand('spfxPretty.filterErrors', () => applyFilter('errors')),
    vscode.commands.registerCommand('spfxPretty.filterWarnings', () => applyFilter('warnings')),
    vscode.commands.registerCommand('spfxPretty.filterAll', () => applyFilter('all')),
  );

  const rescan = (): ScanResult[] => {
    const r = scans.scan();
    if (panel) { refreshPanel(scans); }
    return r;
  };

  // ---- Quick fixes in the editor (lightbulb) ----
  context.subscriptions.push(vscode.languages.registerCodeActionsProvider(
    [{ pattern: '**/*.json' }, { language: 'jsonc' }, { language: 'json' }, { language: 'scss' }, { language: 'typescript' }, { language: 'typescriptreact' }],
    {
      provideCodeActions(doc, range) {
        if (doc.isDirty) { return []; }
        return scans.findingFor(doc.uri.fsPath, range, doc).flatMap(f => f.fixes.map((fix, i) => {
          const a = new vscode.CodeAction(`SPFX Pretty: ${fix.title}`, vscode.CodeActionKind.QuickFix);
          a.command = { command: 'spfxPretty.applyFix', title: fix.title, arguments: [f, i] };
          a.isPreferred = i === 0;
          a.diagnostics = vscode.languages.getDiagnostics(doc.uri).filter(d => d.source === 'SPFX Pretty' && d.code === f.ruleId && d.range.intersection(range));
          return a;
        }));
      },
    },
    { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] },
  ));

  const run = async (fix: Fix | undefined): Promise<void> => {
    if (fix && await applyFix(fix)) { rescan(); }
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('spfxPretty.scan', async () => {
      const results = rescan();
      if (!results.length) {
        vscode.window.showInformationMessage('SPFX Pretty: no SPFx project found (looking for config/package-solution.json).');
        return;
      }
      const n = results.reduce((s, r) => s + issues(r).length, 0);
      const summary = `SPFX Pretty: ${results.map(r => `${r.solution?.name ?? path.basename(r.root)} ${r.score}/100`).join(', ')}${n ? ` - ${n} thing${n === 1 ? '' : 's'} to polish ✨` : ' - everything looks lovely! 🎉'}`;
      if (vscode.workspace.getConfiguration('spfxPretty').get('showReportAfterScan', true)) {
        await vscode.commands.executeCommand('spfxPretty.showReport');
        vscode.window.setStatusBarMessage(summary, 6000);
      } else {
        vscode.window.showInformationMessage(summary, 'Show report').then(p => p && vscode.commands.executeCommand('spfxPretty.showReport'));
      }
    }),

    vscode.commands.registerCommand('spfxPretty.applyFix', async (node: unknown, fixIndex?: number) => {
      const f = findingFromNode(node);
      if (!f || !f.fixes.length) { return; }
      let fix = f.fixes[fixIndex ?? -1];
      if (!fix && f.fixes.length > 1) {
        const pick = await vscode.window.showQuickPick(f.fixes.map(x => ({ label: x.title, fix: x })), { title: f.message });
        fix = pick?.fix as Fix;
      }
      await run(fix ?? f.fixes[0]);
    }),

    vscode.commands.registerCommand('spfxPretty.fixCategory', async (node: unknown) => {
      const cat = categoryFromNode(node);
      if (!cat) { return; }
      await vscode.workspace.saveAll(false);
      const n = await applySafeFixes(scans, f => f.category === cat.category && f.file.startsWith(cat.root));
      rescan();
      vscode.window.showInformationMessage(`SPFX Pretty: applied ${n} ${cat.category} fix${n === 1 ? '' : 'es'} ✨${n ? '' : ' - the rest need a human touch (right-click an item for its options)'}`);
    }),

    vscode.commands.registerCommand('spfxPretty.ignoreRule', async (node: unknown) => {
      const f = findingFromNode(node);
      if (!f) { return; }
      const cfg = vscode.workspace.getConfiguration('spfxPretty');
      const list = cfg.get<string[]>('disabledRules') ?? [];
      if (!list.includes(f.ruleId)) { await cfg.update('disabledRules', [...list, f.ruleId], vscode.ConfigurationTarget.Workspace); }
      rescan();
      vscode.window.showInformationMessage(`SPFX Pretty: ignoring ${f.ruleId} in this workspace (undo in Settings > SPFX Pretty > Disabled Rules).`);
    }),

    vscode.commands.registerCommand('spfxPretty.howToFix', async (node: unknown) => {
      const f = findingFromNode(node);
      if (!f) { return; }
      const open = 'Open the file';
      const pick = await vscode.window.showInformationMessage(`${f.ruleId}: ${f.message}`, { modal: true, detail: `${f.detail ?? 'This one needs your judgement - SPFX Pretty can\'t safely change it automatically.'}\n\nFile: ${vscode.workspace.asRelativePath(f.file)}` }, open);
      if (pick === open) { await vscode.commands.executeCommand('spfxPretty.openFinding', f); }
    }),

    vscode.commands.registerCommand('spfxPretty.copyMessage', async (node: unknown) => {
      const f = findingFromNode(node);
      if (f) { await vscode.env.clipboard.writeText(`${f.ruleId}: ${f.message}${f.detail ? `\n${f.detail}` : ''}\n${f.file}`); }
    }),

    vscode.commands.registerCommand('spfxPretty.openFinding', async (arg: unknown) => {
      const f = findingFromNode(arg);
      if (!f) { return; }
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(f.file));
      const start = doc.positionAt(f.offset ?? 0);
      const end = doc.positionAt((f.offset ?? 0) + (f.length ?? 0));
      await vscode.window.showTextDocument(doc, { selection: new vscode.Range(start, end), preview: true });
    }),

    vscode.commands.registerCommand('spfxPretty.showReport', () => {
      const results = scans.all.length ? scans.all : rescan();
      if (!results.length) { vscode.window.showInformationMessage('SPFX Pretty: no SPFx project found.'); return; }
      if (panel) { panel.reveal(); refreshPanel(scans); return; }
      panel = vscode.window.createWebviewPanel('spfxPretty.report', 'SPFX Pretty', vscode.ViewColumn.Active, { enableScripts: true, retainContextWhenHidden: true });
      panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'media', 'icon.png');
      panel.onDidDispose(() => { panel = undefined; });
      panel.webview.onDidReceiveMessage(async (msg: { type: string; idx: number; fix?: number; section?: string }) => {
        const r = currentResult(scans);
        if (msg.type === 'fixSection' && r) {
          await vscode.workspace.saveAll(false);
          const match = sectionMatcher(msg.section ?? 'checks');
          const n = await applySafeFixes(scans, f => f.file.startsWith(r.root) && match(f));
          rescan();
          refreshPanel(scans);
          vscode.window.setStatusBarMessage(`SPFX Pretty: applied ${n} fix${n === 1 ? '' : 'es'} ✨`, 5000);
          return;
        }
        const f = r?.findings[msg.idx];
        if (!f) { return; }
        if (msg.type === 'open') { await vscode.commands.executeCommand('spfxPretty.openFinding', f); }
        if (msg.type === 'fix') { await run(f.fixes[msg.fix ?? 0]); refreshPanel(scans); }
      });
      refreshPanel(scans);
    }),

    vscode.commands.registerCommand('spfxPretty.fixAll', async () => {
      const results = scans.all.length ? scans.all : rescan();
      const safe = results.flatMap(r => issues(r)).filter(f => f.fixes.some(x => x.safe));
      if (!safe.length) { vscode.window.showInformationMessage('SPFX Pretty: no automatic fixes left - the rest need a human touch (descriptions etc.).'); return; }
      const go = 'Apply all';
      const detail = safe.slice(0, 15).map(f => `• ${f.fixes.find(x => x.safe)!.title}`).join('\n') + (safe.length > 15 ? `\n…and ${safe.length - 15} more` : '');
      if (await vscode.window.showInformationMessage(`Apply ${safe.length} safe fix${safe.length === 1 ? '' : 'es'}?`, { modal: true, detail }, go) !== go) { return; }
      await vscode.workspace.saveAll(false);
      const applied = await applySafeFixes(scans, () => true);
      rescan();
      const score = scans.all.map(r => `${r.score}/100`).join(', ');
      vscode.window.showInformationMessage(`SPFX Pretty: applied ${applied} fix${applied === 1 ? '' : 'es'} - niceness now ${score} ✨`, 'Show report')
        .then(p => p && vscode.commands.executeCommand('spfxPretty.showReport'));
    }),

    vscode.commands.registerCommand('spfxPretty.makeTitlesNice', async () => {
      const root = await pickProject(scans.all.length ? scans.all : rescan());
      if (!root) { return; }
      await makeTitlesNice(root);
      rescan();
    }),

    vscode.commands.registerCommand('spfxPretty.generateIcons', async () => {
      const root = await pickProject(scans.all.length ? scans.all : rescan());
      if (!root) { return; }
      const cfg = vscode.workspace.getConfiguration('spfxPretty');
      const colour = await vscode.window.showInputBox({
        title: 'Brand colour for generated icons',
        value: cfg.get<string>('brandColour') ?? '#0F6CBD',
        validateInput: v => /^#[0-9a-fA-F]{6}$/.test(v) ? undefined : 'Use a hex colour like #0F6CBD',
      });
      if (!colour) { return; }
      if (colour !== cfg.get('brandColour')) { await cfg.update('brandColour', colour, vscode.ConfigurationTarget.Workspace); }
      await generateIcons(root.root, colour);
      rescan();
    }),

    vscode.commands.registerCommand('spfxPretty.themingSnippet', async () => {
      const root = await pickProject(scans.all.length ? scans.all : rescan());
      if (!root) { return; }
      const project = loadProject(root.root, readConfig());
      const webparts = project.components.filter(c => c.kind === 'WebPart');
      if (!webparts.length) { vscode.window.showInformationMessage('SPFX Pretty: no web parts in this project.'); return; }
      const pick = webparts.length === 1 ? { c: webparts[0] } : await vscode.window.showQuickPick(
        webparts.map(c => ({ label: componentName(c), description: c.alias, c })), { title: 'Which web part?' });
      if (!pick) { return; }
      const alias = pick.c.alias.endsWith('WebPart') ? pick.c.alias : `${pick.c.alias}WebPart`;
      const deps = { ...(project.packageJson?.dependencies ?? {}), ...(project.packageJson?.devDependencies ?? {}) };
      const reactMajor = deps.react ? parseInt(String(deps.react).replace(/^[^\d]*/, ''), 10) : undefined;
      const content = themingSnippet({
        className: alias,
        componentName: alias.replace(/WebPart$/, ''),
        reactMajor: Number.isNaN(reactMajor) ? undefined : reactMajor,
        fluentV9: !!deps['@fluentui/react-components'],
      });
      const doc = await vscode.workspace.openTextDocument({ language: 'typescript', content });
      await vscode.window.showTextDocument(doc, { preview: false });
    }),
  );

  // ---- Keep results fresh ----
  const watcher = vscode.workspace.onDidSaveTextDocument(doc => {
    if (!vscode.workspace.getConfiguration('spfxPretty').get('scanOnSave', true)) { return; }
    if (/(package-solution\.json|\.manifest\.json|\.scss|\.tsx?|package\.json|\.spfxprettyrc\.json)$/.test(doc.fileName)) { debounce(rescan); }
  });
  const cfgWatch = vscode.workspace.onDidChangeConfiguration(e => { if (e.affectsConfiguration('spfxPretty')) { debounce(rescan); } });
  context.subscriptions.push(watcher, cfgWatch);

  registerExtraCommands(context, scans, rescan, pickProject);

  // Ask npm for the latest SPFx version (only the package name is sent); fall back to the bundled table.
  if (vscode.workspace.getConfiguration('spfxPretty').get('checkLatestOnline', true)) {
    fetchLatestSpfxVersion().then(v => { if (v) { setLatestOnline(v); rescan(); } });
  }
  rescan();
}

export function deactivate(): void { /* nothing to clean up */ }

/** Apply safe fixes one at a time (rescanning between, as offsets shift) for findings matching `which`. */
async function applySafeFixes(scans: ScanManager, which: (f: Finding) => boolean): Promise<number> {
  const tried = new Set<string>();
  let applied = 0;
  for (let i = 0; i < 300; i++) {
    const next = scans.all.flatMap(r => issues(r)).filter(which)
      .map(f => ({ f, fix: f.fixes.find(x => x.safe) }))
      .find(x => x.fix && !tried.has(sig(x.f, x.fix)));
    if (!next?.fix) { break; }
    tried.add(sig(next.f, next.fix));
    if (await applyFix(next.fix)) { applied++; }
    scans.scan();
  }
  return applied;
}
const sig = (f: Finding, fix: Fix) => `${f.ruleId}|${f.file}|${f.component ?? ''}|${fix.title}`;

let timer: NodeJS.Timeout | undefined;
function debounce(fn: () => void): void {
  if (timer) { clearTimeout(timer); }
  timer = setTimeout(fn, 400);
}

let panelRoot: string | undefined;
function currentResult(scans: ScanManager): ScanResult | undefined {
  return scans.all.find(r => r.root === panelRoot) ?? scans.all[0];
}

function refreshPanel(scans: ScanManager): void {
  if (!panel) { return; }
  const r = currentResult(scans);
  if (!r) { return; }
  panelRoot = r.root;
  const nonce = crypto.randomBytes(16).toString('base64');
  panel.title = `SPFX Pretty: ${r.solution?.name ?? path.basename(r.root)}`;
  panel.webview.html = renderReportHtml(r, { interactive: true, nonce, cspSource: panel.webview.cspSource });
}

export async function pickProject(results: ScanResult[]): Promise<ScanResult | undefined> {
  if (results.length <= 1) {
    if (!results.length) { vscode.window.showInformationMessage('SPFX Pretty: no SPFx project found.'); }
    return results[0];
  }
  const pick = await vscode.window.showQuickPick(results.map(r => ({ label: r.solution?.name ?? path.basename(r.root), description: vscode.workspace.asRelativePath(r.root), r })), { title: 'Which SPFx project?' });
  return pick?.r;
}

/** Walk through every user-visible title, suggesting a nice version for each. */
async function makeTitlesNice(result: ScanResult): Promise<void> {
  const project = loadProject(result.root, readConfig());
  type Item = vscode.QuickPickItem & { file: string; path: (string | number)[]; current: string; suggestion: string };
  const items: Item[] = [];
  const add = (label: string, file: string, p: (string | number)[], current: string | undefined) => {
    const cur = current ?? '';
    const suggestion = toNiceTitle(cur || label);
    const problems = titleProblems(cur);
    items.push({ label: `${cur || '(empty)'}  →  ${suggestion}`, description: label, detail: problems.length ? `⚠ ${problems.join(', ')}` : '✓ already nice', picked: problems.length > 0, file, path: p, current: cur, suggestion });
  };
  if (project.solutionDoc) { add('App Catalog title (solution.name)', project.solutionDoc.file, ['solution', 'name'], project.solution?.name); }
  for (const c of project.components) {
    (c.doc.get(['preconfiguredEntries']) ?? []).forEach((e: any, i: number) =>
      add(`${kindLabel(c.kind)} toolbox title`, c.manifestFile, ['preconfiguredEntries', i, 'title', 'default'], e?.title?.default));
    for (const cmd of c.commands ?? []) { add(`Command ${cmd.key}`, c.manifestFile, ['items', cmd.key, 'title', 'default'], cmd.title); }
  }
  const chosen = await vscode.window.showQuickPick(items, { canPickMany: true, title: 'Make titles nice - pick the ones to rename (you can tweak each one next)', matchOnDetail: true });
  if (!chosen?.length) { return; }
  let changed = 0;
  for (const item of chosen) {
    const value = await vscode.window.showInputBox({ title: item.description, prompt: `Currently "${item.current}"`, value: item.suggestion, validateInput: v => v.trim() ? undefined : 'A title is needed' });
    if (value === undefined) { break; }
    if (value === item.current) { continue; }
    const doc = new JsoncDoc(item.file); // re-read: earlier renames may have changed the file
    if (await applyFix({ title: 'Rename', safe: true, edits: doc.set(item.path, value.trim()) })) { changed++; }
  }
  vscode.window.showInformationMessage(`SPFX Pretty: renamed ${changed} title${changed === 1 ? '' : 's'} ✨`);
}

/** Offer every icon fix (sppkg, toolbox, commands, Teams) and apply the chosen ones. */
async function generateIcons(root: string, colour: string): Promise<void> {
  const config = { ...readConfig(), brandColour: colour };
  const iconFindings = issues(scanProject(root, config)).filter(f => f.fixes.length && (f.category === 'Icon' || f.category === 'Teams'));
  const project = loadProject(root, config);

  // Each item builds its fix lazily from the files on disk, so several edits to one manifest stay correct.
  type Item = vscode.QuickPickItem & { make: () => Fix | undefined };
  const sameFinding = (a: Finding) => () => issues(scanProject(root, config))
    .find(b => b.ruleId === a.ruleId && b.file === a.file && b.component === a.component && b.message === a.message)?.fixes[0];
  const items: Item[] = iconFindings.map(f => ({ label: f.fixes[0].title, description: f.component ?? 'Solution', detail: f.message, picked: true, make: sameFinding(f) }));

  const appIcon = project.solution?.iconFile;
  if (appIcon && !iconFindings.some(f => f.ruleId.startsWith('SOL01'))) {
    items.push({ label: 'Regenerate App Catalog icon (96x96)', description: 'Solution', detail: path.relative(root, appIcon), picked: false,
      make: () => ({ title: 'Regenerate', safe: true, edits: [], creates: [{ file: appIcon, content: makePngIcon({ size: 96, colour, glyph: 'package' }).toString('base64'), encoding: 'base64' }] }) });
  }
  for (const c of project.components.filter(x => x.kind === 'WebPart' || x.kind === 'AdaptiveCardExtension')) {
    if (iconFindings.some(f => f.file === c.manifestFile && f.category === 'Icon')) { continue; }
    (c.doc.get(['preconfiguredEntries']) ?? []).forEach((e: any, i: number) => {
      const title: string = e?.title?.default ?? c.alias;
      items.push({
        label: 'Replace toolbox icon with brand initials icon', description: title, picked: false,
        detail: `${kindLabel(c.kind)} - currently ${e?.officeFabricIconFontName ? `Fluent "${e.officeFabricIconFontName}"` : 'custom image'}`,
        make: () => {
          const original = new JsoncDoc(c.manifestFile);
          const svg = svgDataUri(makeSvgIcon({ colour, glyph: glyphForKind(c.kind), title }));
          let text = applyEditsToText(original.text, original.set(['preconfiguredEntries', i, 'iconImageUrl'], svg));
          text = applyEditsToText(text, new JsoncDoc(c.manifestFile, text).set(['preconfiguredEntries', i, 'officeFabricIconFontName'], undefined));
          return { title: 'Replace icon', safe: true, edits: [{ file: c.manifestFile, offset: 0, length: original.text.length, newText: text }] };
        },
      });
    });
  }
  if (!items.length) { vscode.window.showInformationMessage('SPFX Pretty: every icon is already in place 🎨'); return; }
  const chosen = await vscode.window.showQuickPick(items, { canPickMany: true, title: `Generate icons in ${colour}`, matchOnDescription: true });
  if (!chosen?.length) { return; }
  let n = 0;
  for (const item of chosen) {
    const fix = item.make();
    if (fix && await applyFix(fix)) { n++; }
  }
  vscode.window.showInformationMessage(`SPFX Pretty: generated ${n} icon set${n === 1 ? '' : 's'} 🎨`, 'Show preview')
    .then(p => p && vscode.commands.executeCommand('spfxPretty.showReport'));
}
