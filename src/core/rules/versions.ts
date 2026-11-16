import * as fs from 'fs';
import * as path from 'path';
import { RuleContext } from './context';
import { walk } from '../project';
import { JsoncDoc, applyEditsToText } from '../jsonc';
import { BUNDLED_LATEST, clean, cmp, major, minor, releaseFor, releaseNotesUrl, releasesBetween } from '../versions';
import { UpgradeAssessment, UpgradeStep } from '../types';

/** Read the project facts the version checks and the upgrade assessment need. */
function facts(ctx: RuleContext) {
  const { root, packageJson } = ctx.project;
  const pkgFile = path.join(root, 'package.json');
  const pkgDoc = fs.existsSync(pkgFile) ? new JsoncDoc(pkgFile) : undefined;
  const deps: Record<string, string> = { ...(packageJson?.dependencies ?? {}), ...(packageJson?.devDependencies ?? {}) };
  const yoFile = path.join(root, '.yo-rc.json');
  const yo = fs.existsSync(yoFile) ? new JsoncDoc(yoFile) : undefined;
  const yoVersion: string | undefined = yo?.get(['@microsoft/generator-sharepoint', 'version']);
  const environment: string | undefined = yo?.get(['@microsoft/generator-sharepoint', 'environment']);
  const spPackages = Object.entries(deps).filter(([n]) => /^@microsoft\/sp-/.test(n));
  const coreVersion = deps['@microsoft/sp-core-library'] ?? spPackages.find(([n]) => !/build|module-interfaces|eslint|heft|rig/.test(n))?.[1];
  const current = coreVersion ? clean(coreVersion) : yoVersion;
  const gulpFile = path.join(root, 'gulpfile.js');
  const gulpText = fs.existsSync(gulpFile) ? fs.readFileSync(gulpFile, 'utf8') : undefined;
  const usesGulp = !!gulpText || !!deps['gulp'] || !!deps['@microsoft/sp-build-web'] || /\bgulp\b/.test(JSON.stringify(packageJson?.scripts ?? {}));
  const gulpCustom = !!gulpText && /configureWebpack|mergeConfig|task\(|subTask|addSuppression|rig\.|build\.(lintCmd|tslintCmd|copyAssets)/.test(gulpText);
  const src = walk(path.join(root, 'src'), f => /\.tsx?$/.test(f) && !/\.d\.ts$/.test(f)).map(f => ({ f, t: fs.readFileSync(f, 'utf8') }));
  const count = (re: RegExp) => src.reduce((n, s) => n + (s.t.match(re)?.length ?? 0), 0);
  const filesWith = (re: RegExp) => src.filter(s => re.test(s.t)).map(s => path.relative(root, s.f));
  return {
    root, pkgFile, pkgDoc, deps, yoVersion, environment, spPackages, current, usesGulp, gulpCustom, gulpFile,
    reactRender: count(/ReactDOM?\.render\s*\(|\bReactDom\.render\s*\(/g),
    reactRenderFiles: filesWith(/ReactDOM?\.render\s*\(|ReactDom\.render\s*\(/),
    unmount: count(/unmountComponentAtNode/g),
    fabricImports: filesWith(/from\s+['"]office-ui-fabric-react/),
    nvmrc: ['.nvmrc', '.node-version'].map(f => path.join(root, f)).find(f => fs.existsSync(f)),
  };
}

export function versionRules(ctx: RuleContext): UpgradeAssessment | undefined {
  const f = facts(ctx);
  if (!f.current) { return undefined; }
  const latest = ctx.project.config.latestSpfxVersion || BUNDLED_LATEST;
  const pkg = f.pkgFile;
  const loc = (p: (string | number)[]) => f.pkgDoc ? f.pkgDoc.locate(p) : { offset: 0, length: 0 };
  const depPath = (name: string) => [f.pkgDoc?.get(['dependencies', name]) !== undefined ? 'dependencies' : 'devDependencies', name];
  const onPrem = !!f.environment && f.environment !== 'spo';
  const row = releaseFor(f.current);

  // ---- VER001: how far behind ----
  const gapMinor = major(latest) === major(f.current) ? minor(latest) - minor(f.current) : 99;
  const behind = cmp(f.current, latest) < 0;
  if (!behind) {
    ctx.pass('VER001', 'Versions', `SPFx ${f.current} - latest`, pkg, undefined, 3);
  } else if (onPrem) {
    ctx.issue({
      ruleId: 'VER001', severity: 'info', category: 'Versions', file: pkg, ...loc(depPath('@microsoft/sp-core-library')),
      message: `SPFx ${f.current} targets SharePoint Server (${f.environment}) - stay on the version your farm supports; SPFx ${latest} is SharePoint Online only.`,
    });
  } else {
    ctx.issue({
      ruleId: 'VER001', severity: gapMinor >= 3 ? 'error' : gapMinor >= 1 ? 'warning' : 'info', category: 'Versions', file: pkg,
      ...loc(depPath('@microsoft/sp-core-library')),
      message: gapMinor === 0
        ? `SPFx ${f.current} - patch ${latest} is available.`
        : `SPFx ${f.current} is ${gapMinor} minor version${gapMinor === 1 ? '' : 's'} behind ${latest}${f.usesGulp ? ' and still on the gulp toolchain' : ''}.`,
      detail: `Run "SPFX-Pretty: Upgrade Assessment" for the steps, or: npx -p @pnp/cli-microsoft365@latest m365 spfx project upgrade --toVersion ${latest} --output md`,
    });
  }

  // ---- VER002: mixed or pre-release @microsoft/sp-* versions ----
  const buildOnly = /^@microsoft\/(sp-build|sp-module-interfaces|sp-tslint|eslint|rush-stack|spfx-heft|spfx-web-build-rig)/;
  const runtime = f.spPackages.filter(([n]) => !buildOnly.test(n));
  const distinct = [...new Set(runtime.map(([, v]) => clean(v)))];
  if (distinct.length > 1) {
    ctx.issue({
      ruleId: 'VER002', severity: 'error', category: 'Versions', file: pkg, ...loc(['dependencies']),
      message: `@microsoft/sp-* packages are on mixed versions (${distinct.join(', ')}) - all SPFx packages must be the same version.`,
      detail: runtime.map(([n, v]) => `${n}@${v}`).join(', '),
    });
  }
  const pre = f.spPackages.filter(([, v]) => /-(rc|beta|alpha|preview)/i.test(v));
  if (pre.length) {
    ctx.issue({
      ruleId: 'VER002', severity: 'warning', category: 'Versions', file: pkg, ...loc(depPath(pre[0][0])),
      message: `Release-candidate SPFx packages (${pre.map(([n, v]) => `${n}@${v}`).slice(0, 3).join(', ')}) - move to the stable release before shipping.`,
    });
  }
  const ranged = runtime.filter(([, v]) => /^[\^~]/.test(v));
  if (ranged.length) {
    ctx.issue({
      ruleId: 'VER002', severity: 'info', category: 'Versions', file: pkg, ...loc(depPath(ranged[0][0])),
      message: `SPFx packages use version ranges (${ranged[0][0]}@${ranged[0][1]}) - pin exact versions so builds are reproducible.`,
    });
  }

  // ---- VER003: React must match exactly ----
  if (row && f.deps['react']) {
    const want = row.react;
    const have = clean(f.deps['react']);
    if (major(have) !== major(want) || (want.includes('.') && have !== want)) {
      ctx.issue({
        ruleId: 'VER003', severity: major(have) !== major(want) ? 'error' : 'warning', category: 'Versions', file: pkg, ...loc(depPath('react')),
        message: `React ${have} with SPFx ${f.current} - this SPFx version needs exactly React ${want}. Mismatches fail silently at runtime.`,
        fixes: [{ title: `Pin react and react-dom to ${want}`, safe: false, edits: chain(f, [[depPath('react'), want], [depPath('react-dom'), want]]) }],
      });
    } else if (/^[\^~]/.test(f.deps['react'])) {
      ctx.issue({
        ruleId: 'VER003', severity: 'info', category: 'Versions', file: pkg, ...loc(depPath('react')),
        message: `react uses a range (${f.deps['react']}) - pin it exactly (npm install --save-exact) so npm can't pull a newer React.`,
        fixes: [{ title: `Pin react to ${want}`, safe: true, edits: chain(f, [[depPath('react'), want], ...(f.deps['react-dom'] ? [[depPath('react-dom'), want] as [string[], string]] : [])]) }],
      });
    } else {
      ctx.pass('VER003', 'Versions', `React ${have} matches SPFx ${f.current}`, pkg, undefined, 2);
    }
  }

  // ---- VER010: React type definitions must match React's major ----
  if (f.deps['react']) {
    const rm = major(f.deps['react']);
    const pj = ctx.project.packageJson ?? {};
    const pinned = [pj.resolutions?.['@types/react'], pj.overrides?.['@types/react']].filter(Boolean) as string[];
    const typesBad = ['@types/react', '@types/react-dom'].filter(n => f.deps[n] && major(f.deps[n]) !== rm);
    const pinBad = pinned.filter(v => major(v) !== rm);
    if (typesBad.length || pinBad.length) {
      ctx.issue({
        ruleId: 'VER010', severity: 'warning', category: 'Versions', file: pkg, ...loc(depPath(typesBad[0] ?? 'react')),
        message: `React is ${clean(f.deps['react'])} but ${[...typesBad.map(n => `${n}@${f.deps[n]}`), ...pinBad.map(v => `a resolutions/overrides pin of @types/react@${v}`)].join(' and ')} - type definitions must match React ${rm}.x.`,
      });
    }
  }

  // ---- VER011: legacy render API on React 18 ----
  if (f.deps['react'] && major(f.deps['react']) >= 18 && f.reactRender + f.unmount > 0) {
    ctx.issue({
      ruleId: 'VER011', severity: 'warning', category: 'Versions', file: pkg, ...loc(depPath('react')),
      message: `React 18 is installed but ${f.reactRender} ReactDom.render / ${f.unmount} unmountComponentAtNode call(s) remain (${f.reactRenderFiles.slice(0, 3).join(', ')}) - they run in React 17 mode; switch to createRoot().render() / root.unmount().`,
      detail: 'https://learn.microsoft.com/sharepoint/dev/spfx/react-18-upgrade',
    });
  }

  // ---- VER004: TypeScript in range ----
  const ts = f.deps['typescript'] ?? f.deps['@microsoft/rush-stack-compiler-' + (Object.keys(f.deps).find(k => k.startsWith('@microsoft/rush-stack-compiler-'))?.split('-').pop() ?? '')];
  if (row && f.deps['typescript']) {
    const have = clean(f.deps['typescript']);
    const [lo, hi] = row.ts;
    const mm = (v: string) => `${major(v)}.${minor(v)}`;
    if (cmp(mm(have), lo) < 0 || cmp(mm(have), hi) > 0) {
      ctx.issue({
        ruleId: 'VER004', severity: 'warning', category: 'Versions', file: pkg, ...loc(depPath('typescript')),
        message: `TypeScript ${have} is outside the range SPFx ${f.current} supports (${lo === hi ? lo : `${lo} - ${hi}`}).`,
      });
    }
  }
  void ts;

  // ---- VER005: Node version ----
  const engines: string | undefined = ctx.project.packageJson?.engines?.node;
  const nvm = f.nvmrc ? fs.readFileSync(f.nvmrc, 'utf8').trim() : undefined;
  if (row) {
    const declared = nvm ?? engines;
    const declaredMajors = declared ? [...declared.matchAll(/(\d{1,2})(?:\.\d+)*/g)].map(m => parseInt(m[1], 10)).filter(n => n >= 4) : [];
    if (declared && declaredMajors.length && !declaredMajors.some(n => row.node.includes(n))) {
      ctx.issue({
        ruleId: 'VER005', severity: 'warning', category: 'Versions', file: f.nvmrc ?? pkg, ...(f.nvmrc ? { offset: 0, length: declared.length } : loc(['engines', 'node'])),
        message: `Node ${declared} is declared, but SPFx ${f.current} supports Node ${row.node.map(n => `v${n}`).join(', ')}.`,
      });
    } else if (!declared) {
      ctx.issue({
        ruleId: 'VER005', severity: 'info', category: 'Versions', file: pkg, ...loc(['engines']),
        message: `No Node version declared - add "engines": { "node": ">=${row.node[0]} <${row.node[row.node.length - 1] + 1}" } (or .nvmrc) so everyone builds with Node ${row.node.map(n => `v${n}`).join('/')}.`,
        fixes: f.pkgDoc ? [{ title: `Add engines.node for Node ${row.node.join('/')}`, safe: true, edits: f.pkgDoc.set(['engines', 'node'], `>=${row.node[0]} <${row.node[row.node.length - 1] + 1}`) }] : [],
      });
    }
  }

  // ---- VER006: toolchain ----
  if (f.usesGulp) {
    ctx.issue({
      ruleId: 'VER006', severity: cmp(f.current, '1.22.0') >= 0 ? 'warning' : 'info', category: 'Versions', file: fs.existsSync(f.gulpFile) ? f.gulpFile : pkg,
      message: `Gulp-based toolchain${f.gulpCustom ? ' with custom gulpfile.js tasks / webpack tweaks' : ''} - gulp is unsupported from SPFx 1.24; upgrading means migrating to Heft.`,
      detail: 'https://learn.microsoft.com/sharepoint/dev/spfx/toolchain/migrate-gulptoolchain-hefttoolchain',
    });
  }

  // ---- VER007: hosted workbench retiring ----
  const serve = path.join(f.root, 'config', 'serve.json');
  if (fs.existsSync(serve)) {
    const text = fs.readFileSync(serve, 'utf8');
    const i = text.search(/_layouts\/(15\/)?workbench\.aspx/i);
    if (i >= 0) {
      ctx.issue({
        ruleId: 'VER007', severity: 'info', category: 'Versions', file: serve, offset: i, length: 24,
        message: 'serve.json opens the SharePoint Online workbench, which retires on 01/12/2026 - debug on a real page with the developer toolbar instead.',
      });
    }
  }

  // ---- VER008: .yo-rc.json out of sync ----
  if (f.yoVersion && clean(f.yoVersion) !== f.current) {
    ctx.issue({
      ruleId: 'VER008', severity: 'info', category: 'Versions', file: path.join(f.root, '.yo-rc.json'),
      message: `.yo-rc.json says ${f.yoVersion} but packages are ${f.current} - dependencies were upgraded by hand; update .yo-rc.json so "yo" adds components with the right version.`,
    });
  }

  // ---- VER009: very old Fluent / Fabric ----
  if (f.deps['office-ui-fabric-react'] || f.fabricImports.length) {
    ctx.issue({
      ruleId: 'VER009', severity: 'warning', category: 'Versions', file: pkg, ...loc(depPath('office-ui-fabric-react')),
      message: `office-ui-fabric-react is used${f.fabricImports.length ? ` in ${f.fabricImports.length} file(s)` : ''} - it was renamed @fluentui/react years ago; plan the move as part of the upgrade.`,
    });
  }

  return assess(f, latest, onPrem);
}

function chain(f: ReturnType<typeof facts>, sets: [string[], string][]) {
  if (!f.pkgDoc) { return []; }
  let text = f.pkgDoc.text;
  for (const [p, v] of sets) { text = applyEditsToText(text, new JsoncDoc(f.pkgFile, text).set(p, v)); }
  return [{ file: f.pkgFile, offset: 0, length: f.pkgDoc.text.length, newText: text }];
}

/** Build the step-by-step upgrade plan with rough effort. */
function assess(f: ReturnType<typeof facts>, latest: string, onPrem: boolean): UpgradeAssessment {
  const current = f.current!;
  const from = releaseFor(current);
  const to = releaseFor(latest);
  const steps: UpgradeStep[] = [];
  const hops = releasesBetween(current, latest).map(r => r.version);
  const isReact = !!f.deps['react'];

  if (onPrem) {
    steps.push({ title: 'Check your SharePoint Server farm', effort: 'S', detail: `This project targets ${f.environment}. Newer SPFx versions are SharePoint Online only - only upgrade if you're moving to Online.` });
  }
  if (from && to && !to.node.some(n => from.node.includes(n))) {
    steps.push({ title: `Move developers and build agents to Node ${to.node.map(n => `v${n}`).join(' / ')}`, effort: 'S',
      detail: `Currently Node ${from.node.map(n => `v${n}`).join('/')}. Update .nvmrc / engines and the Azure DevOps NodeTool task (Node 26 LTS recommended for 1.24).` });
  }
  if (f.usesGulp && to?.toolchain === 'heft') {
    steps.push({ title: 'Migrate gulp → Heft toolchain', effort: f.gulpCustom ? 'L' : 'M',
      detail: f.gulpCustom
        ? 'gulpfile.js has custom tasks / webpack changes - move them to Heft plugins (Webpack Patch / Run Script). Update pipeline commands from gulp bundle/package-solution to heft build / heft package-solution.'
        : 'Standard gulpfile - follow the guided migration, then switch pipeline commands to npm run build (heft).',
      link: 'https://learn.microsoft.com/sharepoint/dev/spfx/toolchain/migrate-gulptoolchain-hefttoolchain' });
  }
  const reactNow = f.deps['react'] ? clean(f.deps['react']) : undefined;
  if (isReact && reactNow && to && major(reactNow) === major(to.react) && major(reactNow) >= 18 && f.reactRender + f.unmount > 0) {
    steps.push({ title: 'Finish the React 18 move: createRoot', effort: f.reactRender + f.unmount > 10 ? 'M' : 'S',
      detail: `${f.reactRender} ReactDom.render and ${f.unmount} unmountComponentAtNode call(s) left in ${f.reactRenderFiles.join(', ')}.`,
      link: 'https://learn.microsoft.com/sharepoint/dev/spfx/react-18-upgrade' });
  }
  if (isReact && reactNow && to && major(reactNow) !== major(to.react)) {
    const n = f.reactRender + f.unmount;
    steps.push({ title: `React ${reactNow} → ${to.react}${hops.length ? '' : ` (required by SPFx ${current} - not done yet)`}`, effort: n > 10 ? 'M' : 'S',
      detail: `${f.reactRender} ReactDom.render call(s) and ${f.unmount} unmountComponentAtNode call(s) to switch to createRoot(...).render() / root.unmount()${f.reactRenderFiles.length ? ` in ${f.reactRenderFiles.slice(0, 5).join(', ')}${f.reactRenderFiles.length > 5 ? '…' : ''}` : ''}. Also update @types/react(-dom) and check third-party controls (e.g. @pnp/spfx-controls-react) support React ${major(to.react)}.`,
      link: 'https://learn.microsoft.com/sharepoint/dev/spfx/react-18-upgrade' });
  }
  if (f.fabricImports.length || f.deps['office-ui-fabric-react']) {
    steps.push({ title: 'office-ui-fabric-react → @fluentui/react', effort: f.fabricImports.length > 10 ? 'M' : 'S', detail: `${f.fabricImports.length} file(s) import office-ui-fabric-react.` });
  }
  if (hops.length) {
    steps.push({ title: `Update all SPFx packages ${current} → ${latest}`, effort: 'S',
      detail: `Read the release notes for each hop: ${hops.join(', ')}. Generate a fresh ${latest} project to compare package.json, tsconfig.json, eslint config and /config files.`,
      link: releaseNotesUrl(latest) });
  }
  if (steps.length) {
    steps.push({ title: 'Test, bump versions and redeploy', effort: 'S', detail: 'Bump package-solution.json version, build with --production, upload the new .sppkg to the App Catalog and test every component on real pages (and Teams if used).' });
  }
  const weight = { S: 1, M: 3, L: 6 } as const;
  const total = steps.reduce((s, x) => s + weight[x.effort], 0);
  return {
    current,
    latest,
    toolchain: f.usesGulp ? 'gulp' : 'heft',
    hops,
    steps,
    effort: total === 0 ? 'None' : total <= 3 ? 'Small' : total <= 8 ? 'Medium' : 'Large',
    command: `npx -p @pnp/cli-microsoft365@latest m365 spfx project upgrade --toVersion ${latest} --output md > upgrade-report.md`,
    compat: {
      node: { current: from?.node ?? [], target: to?.node ?? [] },
      react: { current: f.deps['react'] ? clean(f.deps['react']) : undefined, target: to?.react },
      typescript: { current: f.deps['typescript'] ? clean(f.deps['typescript']) : undefined, target: to ? `${to.ts[0]} - ${to.ts[1]}` : undefined },
    },
  };
}
