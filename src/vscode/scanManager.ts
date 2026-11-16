import * as fs from 'fs';
import * as vscode from 'vscode';
import { findSpfxProjects } from '../core/project';
import { scanProject } from '../core/scanner';
import { Finding, ScanResult } from '../core/types';
import { readConfig } from './apply';

const SEVERITY: Record<string, vscode.DiagnosticSeverity> = {
  error: vscode.DiagnosticSeverity.Error,
  warning: vscode.DiagnosticSeverity.Warning,
  info: vscode.DiagnosticSeverity.Information,
};

/** Owns the scan results for every SPFx project in the workspace and publishes diagnostics. */
export class ScanManager implements vscode.Disposable {
  private results: ScanResult[] = [];
  private readonly diagnostics = vscode.languages.createDiagnosticCollection('spfx-pretty');
  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onDidChange = this.emitter.event;

  get all(): ScanResult[] { return this.results; }

  scan(): ScanResult[] {
    const roots = (vscode.workspace.workspaceFolders ?? []).flatMap(f => findSpfxProjects(f.uri.fsPath));
    const config = readConfig();
    this.results = roots.map(r => scanProject(r, config));
    this.publish();
    vscode.commands.executeCommand('setContext', 'spfxPretty.hasProject', this.results.length > 0);
    this.emitter.fire();
    return this.results;
  }

  /** Find the finding a diagnostic came from (diagnostics carry an index back into results). */
  findingFor(file: string, range: vscode.Range, doc: vscode.TextDocument): Finding[] {
    return this.results.flatMap(r => r.findings).filter(f => {
      if (f.severity === 'pass' || f.file !== file) { return false; }
      const fr = new vscode.Range(doc.positionAt(f.offset ?? 0), doc.positionAt((f.offset ?? 0) + (f.length ?? 0)));
      return fr.intersection(range) !== undefined || fr.contains(range.start);
    });
  }

  private publish(): void {
    this.diagnostics.clear();
    const byFile = new Map<string, vscode.Diagnostic[]>();
    for (const r of this.results) {
      for (const f of r.findings) {
        if (f.severity === 'pass') { continue; }
        const range = rangeFromDisk(f);
        const d = new vscode.Diagnostic(range, f.message + (f.detail ? `\n${f.detail}` : ''), SEVERITY[f.severity]);
        d.source = 'SPFX-Pretty';
        d.code = f.ruleId;
        byFile.set(f.file, [...(byFile.get(f.file) ?? []), d]);
      }
    }
    for (const [file, list] of byFile) { this.diagnostics.set(vscode.Uri.file(file), list); }
  }

  dispose(): void { this.diagnostics.dispose(); this.emitter.dispose(); }
}

/** Convert offsets to a range using the file on disk (cached per file for this publish). */
const textCache = new Map<string, string>();
function rangeFromDisk(f: Finding): vscode.Range {
  let text = textCache.get(f.file);
  if (text === undefined) {
    try { text = fs.readFileSync(f.file, 'utf8'); } catch { text = ''; }
    textCache.set(f.file, text);
    setTimeout(() => textCache.delete(f.file), 1000);
  }
  const pos = (o: number) => {
    const before = text!.slice(0, o);
    const line = (before.match(/\n/g) ?? []).length;
    return new vscode.Position(line, o - (before.lastIndexOf('\n') + 1));
  };
  const start = f.offset ?? 0;
  return new vscode.Range(pos(start), pos(start + Math.max(f.length ?? 0, 0)));
}
