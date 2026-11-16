import * as vscode from 'vscode';
import { Fix, ProjectConfig } from '../core/types';

/** Latest SPFx version fetched from npm at activation (undefined = use the bundled table). */
let latestOnline: string | undefined;
export function setLatestOnline(v: string | undefined): void { latestOnline = v; }

/** Read SPFX Pretty settings (a project's .spfxprettyrc.json is layered on top by the core loader). */
export function readConfig(): Partial<ProjectConfig> {
  const c = vscode.workspace.getConfiguration('spfxPretty');
  return {
    brandColour: c.get<string>('brandColour') || '#0F6CBD',
    toolboxGroup: c.get<string>('toolboxGroup') || '',
    appNamePrefix: c.get<string>('appNamePrefix') || '',
    companyIcon: c.get<string>('companyIcon') || undefined,
    brandWords: c.get<string[]>('brandWords') || [],
    latestSpfxVersion: latestOnline,
    disabledRules: c.get<string[]>('disabledRules') || [],
    developer: {
      name: c.get<string>('developer.name') || '',
      websiteUrl: c.get<string>('developer.websiteUrl') || '',
      privacyUrl: c.get<string>('developer.privacyUrl') || '',
      termsOfUseUrl: c.get<string>('developer.termsOfUseUrl') || '',
      mpnId: c.get<string>('developer.mpnId') || '',
    },
  };
}

/**
 * Apply a fix through VS Code so it is undoable, then save the touched files
 * (the scanner reads from disk, so saving keeps everything in sync).
 * Returns false if a target file has unsaved changes (offsets would be stale).
 */
export async function applyFix(fix: Fix): Promise<boolean> {
  const files = [...new Set(fix.edits.map(e => e.file))];
  const docs = await Promise.all(files.map(f => vscode.workspace.openTextDocument(vscode.Uri.file(f))));
  const dirty = docs.filter(d => d.isDirty);
  if (dirty.length) {
    const save = 'Save and retry';
    const pick = await vscode.window.showWarningMessage(
      `SPFX Pretty: ${dirty.map(d => vscode.workspace.asRelativePath(d.uri)).join(', ')} has unsaved changes. Save first so the fix lands in the right spot.`, save);
    if (pick === save) { await Promise.all(dirty.map(d => d.save())); }
    return false;
  }

  for (const c of fix.creates ?? []) {
    const bytes = c.encoding === 'base64' ? Buffer.from(c.content, 'base64') : Buffer.from(c.content, 'utf8');
    await vscode.workspace.fs.writeFile(vscode.Uri.file(c.file), bytes);
  }

  if (fix.edits.length) {
    const we = new vscode.WorkspaceEdit();
    for (const doc of docs) {
      for (const e of fix.edits.filter(x => x.file === doc.uri.fsPath)) {
        we.replace(doc.uri, new vscode.Range(doc.positionAt(e.offset), doc.positionAt(e.offset + e.length)), e.newText);
      }
    }
    const ok = await vscode.workspace.applyEdit(we);
    if (!ok) { return false; }
    await Promise.all(docs.map(d => d.save()));
  }
  return true;
}
