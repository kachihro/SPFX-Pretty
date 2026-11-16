import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { JsoncDoc, applyEditsToText } from '../core/jsonc';
import { companyIconSet } from '../core/imageTools';
import { loadProject } from '../core/project';
import { APP_ICON_RELATIVE } from '../core/rules/solution';
import { ScanResult, TextEdit, FileCreate } from '../core/types';
import { upgradeMarkdown } from '../core/upgradeMarkdown';
import { applyFix, readConfig } from './apply';
import { ScanManager } from './scanManager';

type Picker = (results: ScanResult[]) => Promise<ScanResult | undefined>;

export function registerExtraCommands(context: vscode.ExtensionContext, scans: ScanManager, rescan: () => ScanResult[], pickProject: Picker): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('spfxPretty.uploadCompanyLogo', async () => {
      const result = await pickProject(scans.all.length ? scans.all : rescan());
      if (!result) { return; }
      await uploadCompanyLogo(context, result.root);
      rescan();
    }),

    vscode.commands.registerCommand('spfxPretty.upgradeAssessment', async () => {
      const results = scans.all.length ? scans.all : rescan();
      if (!results.length) { vscode.window.showInformationMessage('SPFX-Pretty: no SPFx project found.'); return; }
      const doc = await vscode.workspace.openTextDocument({ language: 'markdown', content: upgradeMarkdown(results) });
      await vscode.window.showTextDocument(doc, { preview: false });
      const withSteps = results.filter(r => r.upgrade?.steps.length);
      if (!withSteps.length) { return; }
      const run = 'Run detailed CLI report';
      if (await vscode.window.showInformationMessage('SPFX-Pretty: want the file-by-file upgrade report from CLI for Microsoft 365? (runs npx in a terminal)', run) === run) {
        const r = withSteps.length === 1 ? withSteps[0] : await pickProject(withSteps);
        if (!r?.upgrade) { return; }
        const term = vscode.window.createTerminal({ name: 'SPFx upgrade report', cwd: r.root });
        term.show();
        term.sendText(r.upgrade.command, false); // not executed until the user presses Enter
      }
    }),
  );
}

/** Pick a PNG logo and turn it into the App Catalog icon, Teams icons and (optionally) toolbox icons. */
async function uploadCompanyLogo(context: vscode.ExtensionContext, root: string): Promise<void> {
  const cfg = vscode.workspace.getConfiguration('spfxPretty');
  const remembered = cfg.get<string>('companyIcon');
  const useRemembered = remembered && fs.existsSync(remembered) ? `Use my saved logo (${path.basename(remembered)})` : undefined;
  const choice = useRemembered
    ? await vscode.window.showQuickPick([useRemembered, 'Choose a different logo...'], { title: 'Company logo' })
    : 'Choose a different logo...';
  if (!choice) { return; }
  let logoFile = choice === useRemembered ? remembered! : undefined;
  if (!logoFile) {
    const picked = await vscode.window.showOpenDialog({ title: 'Choose your company logo (square PNG, 96x96 or bigger)', canSelectMany: false, filters: { 'PNG image': ['png'] } });
    if (!picked?.length) { return; }
    logoFile = picked[0].fsPath;
  }

  let icons: ReturnType<typeof companyIconSet>;
  try { icons = companyIconSet(fs.readFileSync(logoFile)); }
  catch (e) { vscode.window.showErrorMessage(`SPFX-Pretty: ${(e as Error).message}`); return; }

  const project = loadProject(root, readConfig());
  const teamsParts = project.components.filter(c => c.supportedHosts.some(h => /^Teams/.test(h)));
  const webParts = project.components.filter(c => c.kind === 'WebPart' || c.kind === 'AdaptiveCardExtension');
  type Opt = vscode.QuickPickItem & { key: string };
  const opts: Opt[] = [
    { key: 'app', label: 'App Catalog / Add an app / Site Contents icon', description: '96x96', picked: true },
    ...(teamsParts.length ? [{ key: 'teams', label: `Teams icons for ${teamsParts.length} web part(s)`, description: '192x192 colour + 32x32 outline', picked: true }] : []),
    ...(webParts.length ? [{ key: 'toolbox', label: `Toolbox icon for all ${webParts.length} web part(s)`, description: 'replaces their individual icons - usually better left distinct', picked: false }] : []),
    { key: 'remember', label: 'Remember this logo for all my SPFx projects', picked: true },
  ];
  const chosen = await vscode.window.showQuickPick(opts, { canPickMany: true, title: `Use ${path.basename(logoFile)} for...` });
  if (!chosen?.length) { return; }
  const has = (k: string) => chosen.some(o => o.key === k);

  const creates: FileCreate[] = [];
  const edits: TextEdit[] = [];
  const b64 = (b: Buffer) => b.toString('base64');
  if (has('app') && project.solutionDoc) {
    const packageDir = path.join(root, project.solutionDoc.get(['paths', 'packageDir']) ?? 'sharepoint');
    // Always our own images/AppIcon.png - never overwrite a source asset the iconPath may point at
    creates.push({ file: path.join(packageDir, APP_ICON_RELATIVE), content: b64(icons.app96), encoding: 'base64' });
    if (project.solution?.iconPath !== APP_ICON_RELATIVE) { edits.push(...project.solutionDoc.set(['solution', 'iconPath'], APP_ICON_RELATIVE)); }
  }
  if (has('teams')) {
    for (const c of teamsParts) {
      creates.push({ file: path.join(root, 'teams', `${c.id}_color.png`), content: b64(icons.teamsColour192), encoding: 'base64' });
      creates.push({ file: path.join(root, 'teams', `${c.id}_outline.png`), content: b64(icons.teamsOutline32), encoding: 'base64' });
    }
  }
  if (has('toolbox')) {
    const uri = `data:image/png;base64,${b64(icons.toolbox64)}`;
    for (const c of webParts) {
      let text = c.doc.text;
      const entries: unknown[] = c.doc.get(['preconfiguredEntries']) ?? [];
      entries.forEach((_, i) => {
        text = applyEditsToText(text, new JsoncDoc(c.manifestFile, text).set(['preconfiguredEntries', i, 'iconImageUrl'], uri));
        text = applyEditsToText(text, new JsoncDoc(c.manifestFile, text).set(['preconfiguredEntries', i, 'officeFabricIconFontName'], undefined));
      });
      edits.push({ file: c.manifestFile, offset: 0, length: c.doc.text.length, newText: text });
    }
  }
  if (await applyFix({ title: 'Company logo', safe: true, edits, creates })) {
    if (has('remember')) {
      const store = vscode.Uri.joinPath(context.globalStorageUri, 'company-logo.png');
      await vscode.workspace.fs.createDirectory(context.globalStorageUri);
      if (path.resolve(logoFile) !== store.fsPath) { await vscode.workspace.fs.copy(vscode.Uri.file(logoFile), store, { overwrite: true }); }
      await cfg.update('companyIcon', store.fsPath, vscode.ConfigurationTarget.Global);
    }
    vscode.window.showInformationMessage(`SPFX-Pretty: company logo applied 🎨 (${creates.length} icon file${creates.length === 1 ? '' : 's'})`, 'Show preview')
      .then(p => p && vscode.commands.executeCommand('spfxPretty.showReport'));
  }
}
