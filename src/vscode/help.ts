import * as crypto from 'crypto';
import * as path from 'path';
import * as vscode from 'vscode';
import { renderFaqHtml, ruleDoc } from '../core/ruleDocs';
import { issues } from '../core/scanner';
import { Finding, ScanResult } from '../core/types';
import { applyFix } from './apply';
import { ScanManager } from './scanManager';
import { findingFromNode } from './treeView';

let faqPanel: vscode.WebviewPanel | undefined;

/** Open the FAQ, scrolled to a rule (accepts a rule id, a finding, or a tree node). */
export function openFaq(context: vscode.ExtensionContext, arg?: unknown): void {
  const id = typeof arg === 'string' ? arg : findingFromNode(arg)?.ruleId;
  if (!faqPanel) {
    faqPanel = vscode.window.createWebviewPanel('spfxPretty.faq', 'SPFX Pretty FAQ', vscode.ViewColumn.Beside, { enableScripts: true, enableFindWidget: true });
    faqPanel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'media', 'icon.png');
    faqPanel.onDidDispose(() => { faqPanel = undefined; });
  } else {
    faqPanel.reveal(vscode.ViewColumn.Beside);
  }
  faqPanel.title = id ? `FAQ: ${id}` : 'SPFX Pretty FAQ';
  faqPanel.webview.html = renderFaqHtml(id, crypto.randomBytes(16).toString('base64'), faqPanel.webview.cspSource);
}

const key = (f: Finding) => `${f.ruleId}|${f.file}|${f.component ?? ''}|${f.message}`;

/** Walk through every issue, worst first: fix / explain / open / skip / ignore, re-scanning after each change. */
export async function fixStepByStep(context: vscode.ExtensionContext, scans: ScanManager, rescan: () => ScanResult[], root?: string): Promise<void> {
  const skipped = new Set<string>();
  const attempted = new Set<string>();
  const stillThere: string[] = [];
  let done = 0;
  for (let guard = 0; guard < 500; guard++) {
    const results = rescan().filter(r => !root || r.root === root);
    const all = results.flatMap(r => issues(r));
    const todo = all.filter(f => !skipped.has(key(f)));
    if (!todo.length) {
      vscode.window.showInformationMessage(`SPFX Pretty: all done 🎉 - ${done} fixed${skipped.size ? `, ${skipped.size} skipped` : ''}. Score: ${results.map(r => `${r.score}/100`).join(', ')}${stillThere.length ? `. Still needs a manual step: ${stillThere.join(', ')}` : ''}`);
      return;
    }
    const f = todo[0];
    // A fix ran but the issue is still there (e.g. it needs a manual step) - don't offer it forever
    if (attempted.has(key(f))) { skipped.add(key(f)); stillThere.push(`${f.ruleId}${f.component ? ` (${f.component})` : ''}`); continue; }
    const doc = ruleDoc(f.ruleId);
    type Item = vscode.QuickPickItem & { act: string; fixIndex?: number };
    const sev = f.severity === 'error' ? '$(error)' : f.severity === 'warning' ? '$(warning)' : '$(info)';
    const items: Item[] = [
      ...f.fixes.map((x, i) => ({ act: 'fix', fixIndex: i, label: `$(${x.ask ? 'edit' : x.pick ? 'list-selection' : x.command ? 'file-media' : 'lightbulb'}) ${x.title}`, description: i === 0 ? 'recommended' : undefined })),
      { act: 'explain', label: '$(question) Explain & how to fix', detail: doc ? doc.fix.join('  ·  ') : undefined },
      { act: 'open', label: '$(go-to-file) Open the file', description: vscode.workspace.asRelativePath(f.file) },
      { act: 'skip', label: '$(debug-step-over) Skip for now' },
      { act: 'ignore', label: `$(eye-closed) Ignore ${f.ruleId} in this workspace` },
      { act: 'stop', label: '$(debug-stop) Stop' },
    ];
    const pick = await vscode.window.showQuickPick(items, {
      title: `Step ${done + skipped.size + 1} of ${done + skipped.size + todo.length} · ${f.ruleId}${f.component ? ` · ${f.component}` : ''}`,
      placeHolder: `${f.severity.toUpperCase()}: ${f.message}`,
      ignoreFocusOut: true,
      matchOnDetail: true,
    });
    if (!pick || pick.act === 'stop') { return; }
    switch (pick.act) {
      case 'fix': attempted.add(key(f)); if (await applyFix(f.fixes[pick.fixIndex!])) { done++; } else { skipped.add(key(f)); } break;
      case 'explain': openFaq(context, f.ruleId); break; // stay on this issue
      case 'open': await vscode.commands.executeCommand('spfxPretty.openFinding', f); skipped.add(key(f)); break;
      case 'skip': skipped.add(key(f)); break;
      case 'ignore': {
        const cfg = vscode.workspace.getConfiguration('spfxPretty');
        const list = cfg.get<string[]>('disabledRules') ?? [];
        await cfg.update('disabledRules', [...new Set([...list, f.ruleId])], vscode.ConfigurationTarget.Workspace);
        break;
      }
    }
    void sev; void path;
  }
}
