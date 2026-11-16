import * as path from 'path';
import * as vscode from 'vscode';
import { Category, Finding, ScanResult } from '../core/types';
import { ScanManager } from './scanManager';

type Node =
  | { type: 'project'; result: ScanResult }
  | { type: 'category'; result: ScanResult; category: Category; items: Finding[] }
  | { type: 'passes'; result: ScanResult; items: Finding[] }
  | { type: 'finding'; result: ScanResult; finding: Finding };

const CATS: Category[] = ['Title', 'Icon', 'Metadata', 'Branding', 'Teams'];
const CAT_ICON: Record<Category, string> = { Title: 'symbol-text', Icon: 'symbol-color', Metadata: 'info', Branding: 'paintcan', Teams: 'organization' };

export class FindingsTree implements vscode.TreeDataProvider<Node> {
  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.emitter.event;

  constructor(private readonly scans: ScanManager) {
    scans.onDidChange(() => this.emitter.fire());
  }

  getChildren(node?: Node): Node[] {
    if (!node) { return this.scans.all.map(result => ({ type: 'project', result })); }
    if (node.type === 'project') {
      const issues = node.result.findings.filter(f => f.severity !== 'pass');
      const cats: Node[] = CATS
        .map(category => ({ type: 'category' as const, result: node.result, category, items: issues.filter(f => f.category === category) }))
        .filter(n => n.items.length);
      const passes = node.result.findings.filter(f => f.severity === 'pass');
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
        const n = node.result.findings.filter(f => f.severity !== 'pass').length;
        const item = new vscode.TreeItem(node.result.solution?.name ?? path.basename(node.result.root), vscode.TreeItemCollapsibleState.Expanded);
        item.description = `${node.result.score}/100 nice${n ? ` · ${n} to polish` : ' · lovely!'}`;
        item.iconPath = new vscode.ThemeIcon('package');
        item.tooltip = node.result.root;
        item.command = { command: 'spfxPretty.showReport', title: 'Show report' };
        return item;
      }
      case 'category': {
        const item = new vscode.TreeItem(node.category, vscode.TreeItemCollapsibleState.Expanded);
        item.description = `${node.items.length}`;
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
        item.contextValue = f.fixes.length ? 'finding.fixable' : 'finding';
        item.command = { command: 'spfxPretty.openFinding', title: 'Open', arguments: [f] };
        return item;
      }
    }
  }
}

export function findingFromNode(node: unknown): Finding | undefined {
  return (node as Node)?.type === 'finding' ? (node as { finding: Finding }).finding : (node as Finding)?.ruleId ? node as Finding : undefined;
}
