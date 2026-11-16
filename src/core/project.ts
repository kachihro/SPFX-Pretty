import * as fs from 'fs';
import * as path from 'path';
import { JsoncDoc } from './jsonc';
import { ComponentInfo, ComponentKind, DEFAULT_CONFIG, ProjectConfig, SolutionInfo } from './types';
import { BrandWords, buildBrandWords, titleProblems } from './titles';

const SKIP_DIRS = new Set(['node_modules', '.git', 'lib', 'lib-commonjs', 'lib-esm', 'dist', 'temp', 'release', 'out', '.heft']);

/** Recursively list files under dir matching a predicate (skips build output and node_modules). */
export function walk(dir: string, match: (file: string) => boolean, out: string[] = [], depth = 0): string[] {
  if (depth > 12 || !fs.existsSync(dir)) { return out; }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) { walk(path.join(dir, entry.name), match, out, depth + 1); }
    } else if (match(entry.name)) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

/** Find every SPFx project (folder with config/package-solution.json) below a workspace folder. */
export function findSpfxProjects(workspaceRoot: string): string[] {
  return walk(workspaceRoot, f => f === 'package-solution.json')
    .filter(f => path.basename(path.dirname(f)) === 'config')
    .map(f => path.dirname(path.dirname(f)))
    .sort();
}

export interface LoadedComponent extends ComponentInfo {
  doc: JsoncDoc;
}

export interface LoadedProject {
  root: string;
  spfxVersion?: string;
  packageJson?: any;
  solutionDoc?: JsoncDoc;
  solution?: SolutionInfo;
  components: LoadedComponent[];
  config: ProjectConfig;
  /** Brand spellings learnt from the developer name, component titles and settings */
  brand: BrandWords;
}

function readJsonSafe(file: string): any {
  try { return new JsoncDoc(file).value; } catch { return undefined; }
}

export function loadProject(root: string, overrides?: Partial<ProjectConfig>): LoadedProject {
  const packageJson = readJsonSafe(path.join(root, 'package.json'));
  const yo = readJsonSafe(path.join(root, '.yo-rc.json'));
  // Installed packages are the truth; .yo-rc.json only records the generator version used to scaffold
  const spfxVersion: string | undefined = packageJson?.dependencies?.['@microsoft/sp-core-library']?.replace(/^[~^]/, '')
    ?? yo?.['@microsoft/generator-sharepoint']?.version;

  // Project-level config file wins over editor settings, so the CLI and the team agree.
  const rc = readJsonSafe(path.join(root, '.spfxprettyrc.json')) ?? {};
  const config: ProjectConfig = {
    ...DEFAULT_CONFIG,
    ...overrides,
    ...rc,
    developer: { ...DEFAULT_CONFIG.developer, ...(overrides?.developer ?? {}), ...(rc.developer ?? {}) },
    disabledRules: [...(overrides?.disabledRules ?? []), ...(rc.disabledRules ?? [])],
  };

  let solutionDoc: JsoncDoc | undefined;
  let solution: SolutionInfo | undefined;
  const solFile = path.join(root, 'config', 'package-solution.json');
  if (fs.existsSync(solFile)) {
    solutionDoc = new JsoncDoc(solFile);
    const s = solutionDoc.value?.solution ?? {};
    const packageDir = path.join(root, solutionDoc.value?.paths?.packageDir ?? 'sharepoint');
    let iconFile: string | undefined;
    let iconDataUri: string | undefined;
    if (typeof s.iconPath === 'string' && s.iconPath) {
      // The packager resolves paths relative to packageDir (./sharepoint by default).
      const candidate = path.join(packageDir, s.iconPath);
      if (fs.existsSync(candidate)) {
        iconFile = candidate;
        const ext = path.extname(candidate).slice(1).toLowerCase();
        const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
        iconDataUri = `data:${mime};base64,${fs.readFileSync(candidate).toString('base64')}`;
      }
    }
    solution = {
      file: solFile,
      name: s.name,
      id: s.id,
      version: s.version,
      iconPath: s.iconPath,
      iconFile,
      iconDataUri,
      shortDescription: s.metadata?.shortDescription?.default,
      longDescription: s.metadata?.longDescription?.default,
      developerName: s.developer?.name,
      categories: Array.isArray(s.metadata?.categories) ? s.metadata.categories : [],
    };
  }

  const components: LoadedComponent[] = walk(path.join(root, 'src'), f => f.endsWith('.manifest.json'))
    .map(file => loadComponent(file))
    .filter((c): c is LoadedComponent => !!c);

  const brand = buildBrandWords([
    config.developer.name,
    solutionDoc?.value?.solution?.developer?.name,
    solutionDoc?.value?.solution?.title,
    ...((solutionDoc?.value?.solution?.features ?? []) as any[]).map(f => f?.title),
    // only learn from titles that are already nice - "HelloWorld" is not a brand
    ...components.map(c => c.title).filter(t => t && !titleProblems(t).length),
  ], config.brandWords ?? []);
  return { root, spfxVersion, packageJson, solutionDoc, solution, components, config, brand };
}

function kindOf(m: any): ComponentKind {
  switch (m?.componentType) {
    case 'WebPart': return 'WebPart';
    case 'AdaptiveCardExtension': return 'AdaptiveCardExtension';
    case 'Library': return 'Library';
    case 'Extension':
      switch (m.extensionType) {
        case 'ApplicationCustomizer': return 'ApplicationCustomizer';
        case 'ListViewCommandSet': return 'ListViewCommandSet';
        case 'FieldCustomizer': return 'FieldCustomizer';
        case 'FormCustomizer': return 'FormCustomizer';
        case 'SearchQueryModifier': return 'SearchQueryModifier';
      }
  }
  return 'Unknown';
}

function loadComponent(file: string): LoadedComponent | undefined {
  let doc: JsoncDoc;
  try { doc = new JsoncDoc(file); } catch { return undefined; }
  const m = doc.value;
  if (!m || typeof m !== 'object' || !m.id) { return undefined; }
  const entry = Array.isArray(m.preconfiguredEntries) ? m.preconfiguredEntries[0] ?? {} : {};
  const commands = m.items && typeof m.items === 'object'
    ? Object.entries<any>(m.items).map(([key, v]) => ({ key, title: v?.title?.default, iconImageUrl: v?.iconImageUrl }))
    : undefined;
  return {
    doc,
    kind: kindOf(m),
    id: m.id,
    alias: m.alias ?? path.basename(file, '.manifest.json'),
    manifestFile: file,
    title: entry.title?.default,
    description: entry.description?.default,
    group: entry.group?.default,
    groupId: entry.groupId,
    officeFabricIconFontName: entry.officeFabricIconFontName,
    iconImageUrl: entry.iconImageUrl,
    supportedHosts: Array.isArray(m.supportedHosts) ? m.supportedHosts : [],
    supportsThemeVariants: m.supportsThemeVariants,
    folder: path.dirname(file),
    commands,
  };
}

export function kindLabel(kind: ComponentKind): string {
  return ({
    WebPart: 'Web Part',
    AdaptiveCardExtension: 'Adaptive Card Extension (Viva Connections)',
    ApplicationCustomizer: 'Application Customizer',
    ListViewCommandSet: 'ListView Command Set',
    FieldCustomizer: 'Field Customizer',
    FormCustomizer: 'Form Customizer',
    SearchQueryModifier: 'Search Query Modifier',
    Library: 'Library Component',
    Unknown: 'Component',
  } as Record<ComponentKind, string>)[kind];
}

/** Display name for a component (title, or alias made nice). */
export function componentName(c: ComponentInfo): string {
  return c.title || c.alias;
}
