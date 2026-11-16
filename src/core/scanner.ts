import * as fs from 'fs';
import * as path from 'path';
import { loadProject } from './project';
import { RuleContext } from './rules/context';
import { clearSourceCache } from './sources';
import { solutionRules } from './rules/solution';
import { componentRules } from './rules/components';
import { brandingRules } from './rules/branding';
import { defaultsRules } from './rules/defaults';
import { propertyRules } from './rules/properties';
import { versionRules } from './rules/versions';
import { aboutRules } from './rules/about';
import { applyEditsToText } from './jsonc';
import { Finding, Fix, PreviewData, ProjectConfig, ScanResult, Surface } from './types';

const CATALOG: Surface[] = ['App Catalog', 'Add an app', 'Site Contents'];
/** Where people see what each rule is about. */
export const RULE_SURFACES: Record<string, Surface[]> = {
  SOL001: CATALOG, SOL002: CATALOG, SOL010: CATALOG, SOL011: CATALOG, SOL012: CATALOG, SOL014: CATALOG,
  SOL003: ['Site features'], DEF003: ['Site features'],
  SOL004: ['App Catalog'], SOL005: ['App Catalog', 'Add an app'], SOL006: ['App Catalog'], SOL007: ['App Catalog'], SOL008: ['App Catalog'], SOL013: ['App Catalog'],
  DEF004: ['App Catalog'],
  CMP001: ['Toolbox'], CMP002: ['Toolbox'], CMP003: ['Toolbox'], CMP004: ['Toolbox'], CMP005: ['Toolbox'], CMP006: ['Toolbox'],
  CMD001: ['Command bar'], CMD002: ['Command bar'],
  DEF001: ['Web part on page'], DEF002: ['Property pane'], DEF005: ['Tenant Wide Extensions'], DEF006: ['Web part on page'],
  TMS001: ['Teams'], TMS002: ['Teams'],
  VER001: ['App Catalog'], VER003: ['Property pane'], VER011: ['Web part on page'],
  ABT001: ['Property pane'], ABT002: ['Property pane'],
  PRP001: ['Property pane'], PRP002: ['Web part on page'], PRP003: ['Property pane'], PRP004: ['Property pane'],
};

export function scanProject(root: string, config?: Partial<ProjectConfig>): ScanResult {
  clearSourceCache();
  const project = loadProject(root, config);
  const ctx = new RuleContext(project);
  solutionRules(ctx);
  componentRules(ctx);
  defaultsRules(ctx);
  propertyRules(ctx);
  const upgrade = versionRules(ctx);
  aboutRules(ctx);
  brandingRules(ctx);
  for (const f of ctx.findings) { f.surfaces = RULE_SURFACES[f.ruleId]; }

  const total = ctx.findings.reduce((s, f) => s + (f.weight ?? 1), 0);
  const good = ctx.findings.filter(f => f.severity === 'pass').reduce((s, f) => s + (f.weight ?? 1), 0);
  const score = total === 0 ? 100 : Math.round((good / total) * 100);

  const order = { error: 0, warning: 1, info: 2, pass: 3 };
  const catOrder = { Title: 0, Icon: 1, Defaults: 2, Properties: 3, Versions: 4, Metadata: 5, Teams: 6, Branding: 7 };
  const findings = ctx.findings.sort((a, b) => order[a.severity] - order[b.severity] || catOrder[a.category] - catOrder[b.category] || a.ruleId.localeCompare(b.ruleId));

  const zipped: string | undefined = project.solutionDoc?.get(['paths', 'zippedPackage']);
  const preview: PreviewData = {
    packageFile: zipped ? path.basename(zipped) : 'ClientSolution.sppkg',
    skipFeatureDeployment: project.solutionDoc?.get(['solution', 'skipFeatureDeployment']) === true,
    propertyPanes: project.components.filter(c => c.kind === 'WebPart').map(c => {
      const loc = path.join(c.folder, 'loc', 'en-us.js');
      const text = fs.existsSync(loc) ? fs.readFileSync(loc, 'utf8') : '';
      const val = (k: string) => new RegExp(`["']?${k}["']?\\s*:\\s*["']([^"']*)["']`).exec(text)?.[1];
      return {
        component: c.title || c.alias,
        header: val('PropertyPaneDescription'),
        group: val('BasicGroupName'),
        label: val('DescriptionFieldLabel'),
        defaults: Object.fromEntries(Object.entries<any>(c.doc.get(['preconfiguredEntries', 0, 'properties']) ?? {}).filter(([, v]) => typeof v === 'string')),
      };
    }),
  };

  return {
    upgrade,
    preview,
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
