import * as fs from 'fs';
import * as path from 'path';
import { RuleContext } from './context';
import { LoadedComponent, componentName } from '../project';
import { allSources, componentSources } from '../sources';
import { FileCreate, Fix, TextEdit } from '../types';

/**
 * The About section in the property pane (logo, title, version, developer, website, packages):
 *  ABT001 web part has no About section - fix generates one and wires it in
 *  ABT002 About values (version / website / developer) drifted from package-solution.json
 */

const ABOUT_PRESENT = /PropertyPane\w*About|About(Section|Panel|Page|Group)\b|aboutGroup\s*\(|AboutGroupName/;
export const ABOUT_DIR = path.join('src', 'common', 'about');

export function aboutRules(ctx: RuleContext): void {
  const sol = ctx.project.solutionDoc?.value?.solution;
  if (!sol) { return; }
  const reported = new Set<string>();
  for (const c of ctx.project.components.filter(x => x.kind === 'WebPart')) {
    const { files } = componentSources(ctx.project, c);
    const who = componentName(c);
    if (files.some(s => ABOUT_PRESENT.test(s.text))) {
      ctx.pass('ABT001', 'Metadata', `"${who}" has an About section in the property pane`, c.manifestFile, who, 2);
      continue;
    }
    ctx.issue({
      ruleId: 'ABT001', severity: 'info', category: 'Metadata', file: c.manifestFile, component: who,
      ...c.doc.locate(['preconfiguredEntries']),
      message: `"${who}" has no About section - authors can't see the version, developer or packages when they edit it.`,
      detail: 'The generated About section shows the app icon, web part title, version, developer, website and the SPFx/React packages actually loaded (read from the runtime manifest).',
      fixes: [aboutFix(ctx, c, files, reported)],
    });
  }
  aboutDrift(ctx, sol);
}

/** ABT002 - hard-coded About values that no longer match package-solution.json. */
function aboutDrift(ctx: RuleContext, sol: any): void {
  for (const s of allSources(ctx.project.root)) {
    if (!/developer|about/i.test(s.text)) { continue; }
    const checks: [RegExp, string | undefined, string][] = [
      [/\bversion\s*:\s*['"](\d+\.\d+\.\d+\.\d+)['"]/, sol.version, 'version'],
      [/\bwebsiteUrl\s*:\s*['"]([^'"]+)['"]/, sol.developer?.websiteUrl, 'website'],
      [/\bdeveloperName\s*:\s*['"]([^'"]+)['"]|developer\s*:\s*\{\s*name\s*:\s*['"]([^'"]+)['"]/, sol.developer?.name, 'developer name'],
    ];
    for (const [re, want, label] of checks) {
      const m = re.exec(s.text);
      const have = m?.[1] ?? m?.[2];
      if (!m || !want || !have) { continue; }
      const offset = m.index + m[0].lastIndexOf(have);
      if (have === want) { ctx.pass('ABT002', 'Metadata', `About ${label} matches package-solution.json (${want})`, s.file, undefined, 1); continue; }
      ctx.issue({
        ruleId: 'ABT002', severity: 'warning', category: 'Metadata', file: s.file, offset, length: have.length,
        message: `About section shows ${label} "${have}" but package-solution.json says "${want}".`,
        fixes: [{ title: `Update to "${want}"`, safe: true, edits: [{ file: s.file, offset, length: have.length, newText: want }] }],
      });
    }
  }
}

function aboutFix(ctx: RuleContext, c: LoadedComponent, files: { file: string; text: string }[], reported: Set<string>): Fix {
  const root = ctx.project.root;
  const dir = path.join(root, ABOUT_DIR);
  const creates: FileCreate[] = [
    { file: path.join(dir, 'PropertyPaneAbout.ts'), content: PROPERTY_PANE_ABOUT, encoding: 'utf8' },
    { file: path.join(dir, 'aboutInfo.ts'), content: aboutInfoSource(ctx, dir), encoding: 'utf8' },
  ];
  // Wire it into getPropertyPaneConfiguration (own file first, then the base class)
  const host = files.find(s => /getPropertyPaneConfiguration\s*\(/.test(s.text));
  const edits: TextEdit[] = host && !reported.has(host.file) ? wireIn(host.file, host.text, dir) : [];
  if (host && edits.length) { reported.add(host.file); }
  return {
    title: edits.length ? `Add an About section (logo, version, developer, packages) to ${path.basename(host!.file)}` : 'Create the About section files (add aboutGroup(this.context.manifest) to your groups)',
    safe: false,
    edits,
    creates,
  };
}

/** Insert the import and `aboutGroup(this.context.manifest)` as the last group of the first page. */
function wireIn(file: string, text: string, aboutDir: string): TextEdit[] {
  const method = text.search(/getPropertyPaneConfiguration\s*\(/);
  const groupsAt = text.indexOf('groups', method);
  const open = groupsAt >= 0 ? text.indexOf('[', groupsAt) : -1;
  if (method < 0 || open < 0) { return []; }
  let depth = 0, close = -1;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '[') { depth++; } else if (text[i] === ']') { depth--; if (depth === 0) { close = i; break; } }
  }
  if (close < 0) { return []; }
  const before = text.slice(open + 1, close).replace(/\s+$/, '');
  const needsComma = before.length > 0 && !before.endsWith(',');
  const indent = /\n([ \t]*)[^\n]*$/.exec(text.slice(0, close))?.[1] ?? '        ';
  const insertAt = open + 1 + before.length;
  let rel = path.relative(path.dirname(file), path.join(aboutDir, 'PropertyPaneAbout')).replace(/\\/g, '/');
  if (!rel.startsWith('.')) { rel = './' + rel; }
  const lastImport = [...text.matchAll(/^import[^;]+;[ \t]*$/gm)].pop();
  const importAt = lastImport ? lastImport.index! + lastImport[0].length : 0;
  return [
    { file, offset: importAt, length: 0, newText: `\nimport { aboutGroup } from '${rel}';` },
    { file, offset: insertAt, length: 0, newText: `${needsComma ? ',' : ''}\n${indent}  aboutGroup(this.context.manifest)\n${indent}` },
  ];
}

function aboutInfoSource(ctx: RuleContext, aboutDir: string): string {
  const sol = ctx.project.solutionDoc!.value.solution;
  const name = sol.title || sol.name || '';
  const icon = ctx.project.solution?.iconFile;
  const logo = icon
    ? `// eslint-disable-next-line @typescript-eslint/no-require-imports\n  logoUrl: require('${path.relative(aboutDir, icon).replace(/\\/g, '/')}') as string,`
    : `logoUrl: '',`;
  return `// Generated by SPFX-Pretty from config/package-solution.json.
// SPFX-Pretty warns (ABT002) if these drift - re-run its quick fix rather than editing by hand.
export interface IAboutInfo {
  solutionName: string;
  version: string;
  developerName: string;
  websiteUrl: string;
  logoUrl: string;
}

export const ABOUT_INFO: IAboutInfo = {
  solutionName: ${JSON.stringify(name)},
  version: ${JSON.stringify(sol.version ?? '1.0.0.0')},
  developerName: ${JSON.stringify(sol.developer?.name ?? '')},
  websiteUrl: ${JSON.stringify(sol.developer?.websiteUrl ?? '')},
  ${logo}
};
`;
}

/** Framework-neutral (no React) property pane About field - works with React 17 and 18 alike. */
export const PROPERTY_PANE_ABOUT = `// Generated by SPFX-Pretty. A branded About section for the property pane.
import {
  IPropertyPaneCustomFieldProps,
  IPropertyPaneField,
  IPropertyPaneGroup,
  PropertyPaneFieldType
} from '@microsoft/sp-property-pane';
import { ABOUT_INFO, IAboutInfo } from './aboutInfo';

interface IManifestLike {
  alias?: string;
  preconfiguredEntries?: { title?: { default?: string } }[];
  loaderConfig?: { scriptResources?: Record<string, { type: string; version?: string }> };
}

const esc = (s: string): string =>
  s.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[ch]);

/** Packages actually loaded at runtime (from the manifest's loader config), e.g. "react @ 17.0.1". */
function runtimePackages(m: IManifestLike): string[] {
  return Object.keys(m.loaderConfig?.scriptResources ?? {})
    .filter(name => {
      const r = m.loaderConfig!.scriptResources![name];
      return r.type === 'component' && !!r.version;
    })
    .map(name => \`\${name} @ \${m.loaderConfig!.scriptResources![name].version}\`)
    .sort();
}

export function PropertyPaneAbout(manifest: unknown, info: IAboutInfo = ABOUT_INFO): IPropertyPaneField<IPropertyPaneCustomFieldProps> {
  const m = manifest as IManifestLike;
  const title = m.preconfiguredEntries?.[0]?.title?.default ?? m.alias ?? info.solutionName;
  const packages = runtimePackages(m);
  return {
    type: PropertyPaneFieldType.Custom,
    targetProperty: 'spfxPrettyAbout',
    properties: {
      key: 'spfxPrettyAbout',
      onRender: (elem: HTMLElement): void => {
        const muted = 'opacity:.75;font-size:12px';
        elem.innerHTML = \`
          <div style="display:flex;align-items:center;gap:12px">
            \${info.logoUrl ? \`<img src="\${info.logoUrl}" alt="" style="width:40px;height:40px;object-fit:contain">\` : ''}
            <div>
              <div style="font-weight:600;font-size:14px">\${esc(title)}</div>
              <div style="\${muted}">Version \${esc(info.version)}</div>
            </div>
          </div>
          <div style="margin-top:16px">
            <button type="button" data-about-toggle style="all:unset;cursor:pointer;\${muted}">+ More Details</button>
            <div data-about-details hidden style="margin-top:6px;display:flex;flex-direction:column;gap:4px;\${muted}">
              \${info.developerName ? \`<div>Developer: \${esc(info.developerName)}</div>\` : ''}
              \${info.websiteUrl ? \`<div>Website: <a href="\${esc(info.websiteUrl)}" target="_blank" rel="noopener noreferrer">\${esc(info.websiteUrl)}</a></div>\` : ''}
              \${packages.length ? \`<div>Packages:</div>\${packages.map(p => \`<div>- \${esc(p)}</div>\`).join('')}\` : ''}
            </div>
          </div>\`;
        const toggle = elem.querySelector<HTMLButtonElement>('[data-about-toggle]');
        const details = elem.querySelector<HTMLElement>('[data-about-details]');
        if (toggle && details) {
          toggle.onclick = () => {
            details.hidden = !details.hidden;
            toggle.textContent = details.hidden ? '+ More Details' : '- Less Details';
          };
        }
      },
      onDispose: (elem: HTMLElement): void => { elem.innerHTML = ''; }
    }
  };
}

/** Drop into any page: groups: [ ...yourGroups, aboutGroup(this.context.manifest) ] */
export function aboutGroup(manifest: unknown, groupName: string = 'About'): IPropertyPaneGroup {
  return { groupName, groupFields: [PropertyPaneAbout(manifest)] };
}
`;
