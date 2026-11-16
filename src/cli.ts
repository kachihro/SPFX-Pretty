#!/usr/bin/env node
/**
 * SPFX-Pretty CLI - run the same checks in Azure DevOps / GitHub pipelines.
 *
 *   npx spfx-pretty [projectDir] [--fix] [--json] [--html report.html] [--upgrade-md upgrade.md]
 *                   [--company-icon logo.png] [--online | --latest 1.24.1] [--min-score 80] [--fail-on warning|error]
 */
import * as path from 'path';
import { findSpfxProjects } from './core/project';
import { applyAllSafeFixes, issues, scanProject } from './core/scanner';
import { ScanResult } from './core/types';
import { renderReportHtml } from './core/reportHtml';
import * as fs from 'fs';
import { upgradeMarkdown } from './core/upgradeMarkdown';
import { fetchLatestSpfxVersion } from './core/versions';
import { ProjectConfig } from './core/types';

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(n);
const opt = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const dir = path.resolve(args.find((a, i) => !a.startsWith('--') && !['--min-score', '--fail-on', '--html', '--upgrade-md', '--company-icon', '--latest'].includes(args[i - 1])) ?? '.');
const minScore = Number(opt('--min-score') ?? 0);
const failOn = opt('--fail-on') ?? 'error';

const icons: Record<string, string> = { error: 'x', warning: '!', info: 'i', pass: 'v' };
const projects = findSpfxProjects(dir);
if (projects.length === 0) {
  console.error(`No SPFx project (config/package-solution.json) found under ${dir}`);
  process.exit(2);
}

(async () => {
const config: Partial<ProjectConfig> = {};
if (opt('--company-icon')) { config.companyIcon = path.resolve(opt('--company-icon')!); }
if (opt('--latest')) { config.latestSpfxVersion = opt('--latest'); }
else if (flag('--online')) { config.latestSpfxVersion = await fetchLatestSpfxVersion(); }
let failed = false;
const results: ScanResult[] = [];
for (const root of projects) {
  if (flag('--fix')) {
    const applied = applyAllSafeFixes(root, config);
    if (!flag('--json')) { applied.forEach(a => console.log(`  fixed  ${a}`)); }
  }
  const r = scanProject(root, config);
  results.push(r);
  const list = issues(r);
  if (!flag('--json')) {
    console.log(`\n${r.solution?.name ?? path.basename(root)}  (${path.relative(process.cwd(), root) || '.'})  SPFx ${r.spfxVersion ?? '?'}`);
    console.log(`Niceness score: ${r.score}/100${r.upgrade ? `   |   SPFx ${r.upgrade.current} -> latest ${r.upgrade.latest}: ${r.upgrade.hops.length ? `${r.upgrade.effort} upgrade` : r.upgrade.steps.length ? `on latest, ${r.upgrade.effort.toLowerCase()} follow-up work` : 'up to date'}` : ''}\n`);
    for (const f of list) {
      console.log(`  [${icons[f.severity]}] ${f.ruleId} ${f.category.padEnd(8)} ${f.message}`);
      console.log(`        ${path.relative(root, f.file)}${f.fixes.length ? `  (fix: ${f.fixes[0].title})` : ''}`);
    }
    if (!list.length) { console.log('  Everything looks lovely!'); }
  }
  const rank = { error: 3, warning: 2, info: 1, pass: 0 } as const;
  const threshold = rank[failOn as keyof typeof rank] ?? 3;
  if (list.some(f => rank[f.severity] >= threshold) || r.score < minScore) { failed = true; }
}
if (flag('--json')) { console.log(JSON.stringify(results, null, 2)); }
const htmlOut = opt('--html');
if (htmlOut) {
  // One file per project when there are several (report.html, report-2.html, ...)
  results.forEach((r, i) => {
    const file = i === 0 ? htmlOut : htmlOut.replace(/(\.html?)?$/, `-${i + 1}.html`);
    fs.writeFileSync(file, renderReportHtml(r, { interactive: false }));
    if (!flag('--json')) { console.log(`\nReport written to ${file}`); }
  });
}
const mdOut = opt('--upgrade-md');
if (mdOut) {
  fs.writeFileSync(mdOut, upgradeMarkdown(results));
  if (!flag('--json')) { console.log(`Upgrade assessment written to ${mdOut}`); }
}
process.exit(failed ? 1 : 0);
})();
