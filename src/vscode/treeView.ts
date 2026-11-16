import * as path from 'path';
import * as vscode from 'vscode';
import { Category, Finding, ScanResult } from '../core/types';
import { ScanManager } from './scanManager';

type Node =
  | { type: 'project'; result: ScanResult }
  | { type: 'category'; result: ScanResult; category: Category; items: Finding[] }
  | { type: 'passes'; result: ScanResult; items: Finding[] }
  | { type: 'finding'; result: ScanResult; finding: Finding };

const CATS: Category[] = ['Title', 'Icon', 'Defaults', 'Properties', 'Versions', 'Metadata', 'Teams', 'Branding'];
const CAT_ICON: Record<Category, string> = { Title: 'symbol-text', Icon: 'symbol-color', Defaults: 'symbol-constant', Properties: 'symbol-property', Versions: 'versions', Metadata: 'info', Branding: 'paintcan', Teams: 'organization' };

/** What the tree shows: everything, warnings and errors, or errors only. */
export type SeverityFilter = 'all' | 'warnings' | 'errors';
export const FILTER_LABEL: Record<SeverityFilter, string> = { all: 'All', warnings: 'Errors + warnings', errors: 'Errors only' };

export class FindingsTree implements vscode.TreeDataProvider<Node> {
  /** Current severity filter (persisted per workspace by the extension). */
  filter: SeverityFilter = 'all';

  private visible(f: Finding): boolean {
    if (f.severity === 'pass') { return this.filter === 'all'; }
    if (this.filter === 'errors') { return f.severity === 'error'; }
    if (this.filter === 'warnings') { return f.severity !== 'info'; }
    return true;
  }

  refresh(): void { this.emitter.fire(); }

  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.emitter.event;

  constructor(private readonly scans: ScanManager) {
    scans.onDidChange(() => this.emitter.fire());
  }

  getChildren(node?: Node): Node[] {
    if (!node) { return this.scans.all.map(result => ({ type: 'project', result })); }
    if (node.type === 'project') {
      const issues = node.result.findings.filter(f => f.severity !== 'pass' && this.visible(f));
      const cats: Node[] = CATS
        .map(category => ({ type: 'category' as const, result: node.result, category, items: issues.filter(f => f.category === category) }))
        .filter(n => n.items.length);
      const passes = node.result.findings.filter(f => f.severity === 'pass' && this.visible(f));
      return passes.length ? [...cats, { type: 'passes', result: node.result, items: passes }] : cats;
    }
    if (node.type === 'category' || node.type === 'passes') {
      return node.items.map(finding => ({ type: 'finding', result: node.result, finding }));
    }
    return [];
  }

  getTreeItem(node: Node): vscode.TreeItem {
    switch (node.type) {
      case 'project': {
        const all = node.result.findings.filter(f => f.severity !== 'pass');
        const n = all.length;
        const shown = all.filter(f => this.visible(f)).length;
        const item = new vscode.TreeItem(node.result.solution?.name ?? path.basename(node.result.root), vscode.TreeItemCollapsibleState.Expanded);
        const errors = all.filter(f => f.severity === 'error').length, warnings = all.filter(f => f.severity === 'warning').length;
        item.description = `${node.result.score}/100 nice${n ? ` · ${errors} error${errors === 1 ? '' : 's'}, ${warnings} warning${warnings === 1 ? '' : 's'}, ${n - errors - warnings} info` : ' · lovely!'}${this.filter !== 'all' ? ` · showing ${shown} (${FILTER_LABEL[this.filter].toLowerCase()})` : ''}`;
        item.iconPath = new vscode.ThemeIcon('package');
        item.tooltip = node.result.root;
        item.command = { command: 'spfxPretty.showReport', title: 'Show report' };
        return item;
      }
      case 'category': {
        const item = new vscode.TreeItem(node.category, vscode.TreeItemCollapsibleState.Expanded);
        const safe = node.items.filter(f => f.fixes.some(x => x.safe)).length;
        item.description = `${node.items.length}${safe ? ` · ${safe} auto-fixable` : ''}`;
        item.contextValue = safe ? 'category.fixable' : 'category';
        item.iconPath = new vscode.ThemeIcon(CAT_ICON[node.category]);
        return item;
      }
      case 'passes': {
        const item = new vscode.TreeItem('Looking nice', vscode.TreeItemCollapsibleState.Collapsed);
        item.description = `${node.items.length}`;
        item.iconPath = new vscode.ThemeIcon('pass', new vscode.ThemeColor('testing.iconPassed'));
        return item;
      }
      case 'finding': {
        const f = node.finding;
        const item = new vscode.TreeItem(f.message, vscode.TreeItemCollapsibleState.None);
        item.description = f.severity === 'pass' ? '' : f.ruleId;
        item.tooltip = new vscode.MarkdownString(`**${f.ruleId}** ${f.message}${f.detail ? `\n\n${f.detail}` : ''}${f.fixes.length ? `\n\n💡 ${f.fixes.map(x => x.title).join('  \n💡 ')}` : ''}`);
        item.iconPath = f.severity === 'pass' ? new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'))
          : f.severity === 'error' ? new vscode.ThemeIcon('error', new vscode.ThemeColor('problemsErrorIcon.foreground'))
          : f.severity === 'warning' ? new vscode.ThemeIcon('warning', new vscode.ThemeColor('problemsWarningIcon.foreground'))
          : new vscode.ThemeIcon('info', new vscode.ThemeColor('problemsInfoIcon.foreground'));
        item.contextValue = f.severity === 'pass' ? 'pass' : f.fixes.length ? 'finding.fixable' : 'finding';
        item.command = { command: 'spfxPretty.openFinding', title: 'Open', arguments: [f] };
        return item;
      }
    }
  }
}

export function categoryFromNode(node: unknown): { root: string; category: Category } | undefined {
  const n = node as Node;
  return n?.type === 'category' ? { root: n.result.root, category: n.category } : undefined;
}

export function findingFromNode(node: unknown): Finding | undefined {
  return (node as Node)?.type === 'finding' ? (node as { finding: Finding }).finding : (node as Finding)?.ruleId ? node as Finding : undefined;
}
