import { LoadedProject } from '../project';
import { Category, Finding, Fix, Severity } from '../types';
import { toNiceTitle } from '../titles';

const WEIGHT: Record<Exclude<Severity, 'pass'>, number> = { error: 3, warning: 2, info: 1 };

/** Collects findings for one scan, honouring disabled rules and recording passes for the score. */
export class RuleContext {
  readonly findings: Finding[] = [];

  constructor(readonly project: LoadedProject) {}

  /** Nice title using the project's brand spellings ("kachihro-x" -> "Kachihro X"). */
  nice(raw: string): string { return toNiceTitle(raw, this.project.brand); }

  enabled(ruleId: string): boolean {
    return !this.project.config.disabledRules.includes(ruleId);
  }

  issue(f: Omit<Finding, 'fixes' | 'weight'> & { fixes?: Fix[] }): void {
    if (!this.enabled(f.ruleId)) { return; }
    this.findings.push({ ...f, fixes: f.fixes ?? [], weight: WEIGHT[f.severity as Exclude<Severity, 'pass'>] ?? 1 });
  }

  /** Record that a check passed - shows as a green tick in the report and counts toward the score. */
  pass(ruleId: string, category: Category, message: string, file: string, component?: string, weight = 2): void {
    if (!this.enabled(ruleId)) { return; }
    this.findings.push({ ruleId, severity: 'pass', category, message, file, component, fixes: [], weight });
  }
}
