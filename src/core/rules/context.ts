import { LoadedProject } from '../project';
import { Category, Finding, Fix, Severity } from '../types';

const WEIGHT: Record<Exclude<Severity, 'pass'>, number> = { error: 3, warning: 2, info: 1 };

/** Collects findings for one scan, honouring disabled rules and recording passes for the score. */
export class RuleContext {
  readonly findings: Finding[] = [];

  constructor(readonly project: LoadedProject) {}

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
