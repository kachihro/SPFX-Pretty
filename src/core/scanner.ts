import * as fs from 'fs';
import * as path from 'path';
import { loadProject } from './project';
import { RuleContext } from './rules/context';
import { solutionRules } from './rules/solution';
import { componentRules } from './rules/components';
import { brandingRules } from './rules/branding';
import { applyEditsToText } from './jsonc';
import { Finding, Fix, ProjectConfig, ScanResult } from './types';

export function scanProject(root: string, config?: Partial<ProjectConfig>): ScanResult {
  const project = loadProject(root, config);
  const ctx = new RuleContext(project);
  solutionRules(ctx);
  componentRules(ctx);
  brandingRules(ctx);

  const total = ctx.findings.reduce((s, f) => s + (f.weight ?? 1), 0);
  const good = ctx.findings.filter(f => f.severity === 'pass').reduce((s, f) => s + (f.weight ?? 1), 0);
  const score = total === 0 ? 100 : Math.round((good / total) * 100);

  const order = { error: 0, warning: 1, info: 2, pass: 3 };
  const findings = ctx.findings.sort((a, b) => order[a.severity] - order[b.severity] || a.ruleId.localeCompare(b.ruleId));

  return {
    root,
    spfxVersion: project.spfxVersion,
    solution: project.solution,
    components: project.components.map(({ doc, ...info }) => info),
    findings,
    score,
  };
}

export function issues(result: ScanResult): Finding[] {
  return result.findings.filter(f => f.severity !== 'pass');
}

/**
 * Apply fixes straight to disk (used by the CLI and tests; the extension uses a WorkspaceEdit instead).
 * Fixes touching the same file are applied one at a time, re-scanning in between, because each
 * fix's offsets are relative to the file as it was when scanned.
 */
export function applyFixToDisk(fix: Fix): void {
  const byFile = new Map<string, typeof fix.edits>();
  for (const e of fix.edits) { byFile.set(e.file, [...(byFile.get(e.file) ?? []), e]); }
  for (const [file, edits] of byFile) {
    fs.writeFileSync(file, applyEditsToText(fs.readFileSync(file, 'utf8'), edits));
  }
  for (const c of fix.creates ?? []) {
    fs.mkdirSync(path.dirname(c.file), { recursive: true });
    fs.writeFileSync(c.file, c.encoding === 'base64' ? Buffer.from(c.content, 'base64') : c.content);
  }
}

/** Repeatedly apply the first safe fix until none remain (bounded). Returns titles applied. */
export function applyAllSafeFixes(root: string, config?: Partial<ProjectConfig>, max = 200): string[] {
  const applied: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < max; i++) {
    const next = issues(scanProject(root, config))
      .map(f => ({ f, fix: f.fixes.find(x => x.safe) }))
      .find(x => x.fix && !seen.has(key(x.f, x.fix)));
    if (!next || !next.fix) { break; }
    seen.add(key(next.f, next.fix));
    applyFixToDisk(next.fix);
    applied.push(`${next.f.ruleId}: ${next.fix.title}`);
  }
  return applied;
}

function key(f: Finding, fix: Fix): string {
  return `${f.ruleId}|${f.file}|${f.component ?? ''}|${fix.title}`;
}
