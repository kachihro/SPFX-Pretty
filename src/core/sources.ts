import * as fs from 'fs';
import * as path from 'path';
import { LoadedComponent, LoadedProject, walk } from './project';

export interface SourceFile { file: string; text: string; }

const SPFX_BASES = /^(BaseClientSideWebPart|BaseAdaptiveCardExtension|BaseApplicationCustomizer|BaseListViewCommandSet|BaseFieldCustomizer|BaseFormCustomizer|BaseSearchQueryModifier)$/;

const cache = new Map<string, SourceFile[]>();

/** Every .ts/.tsx file under src (cached per scan root; cleared by clearSourceCache). */
export function allSources(root: string): SourceFile[] {
  let list = cache.get(root);
  if (!list) {
    list = walk(path.join(root, 'src'), f => /\.tsx?$/.test(f) && !/\.d\.ts$/.test(f) && !/\.test\.tsx?$/.test(f))
      .map(file => ({ file, text: fs.readFileSync(file, 'utf8') }));
    cache.set(root, list);
  }
  return list;
}

export function clearSourceCache(): void { cache.clear(); }

/**
 * Source for a component: its own folder plus any custom base classes it extends
 * (e.g. MyTeamLinksWebPart extends PersonalWebPartBase in src/common), followed transitively.
 */
export function componentSources(project: LoadedProject, c: LoadedComponent): { files: SourceFile[]; baseChain: string[]; propsType?: string } {
  const all = allSources(project.root);
  const own = all.filter(s => s.file.startsWith(c.folder + path.sep));
  const files = [...own];
  const chain: string[] = [];
  let propsType: string | undefined;
  let current = own;
  for (let depth = 0; depth < 6; depth++) {
    const ext = current.map(s => /class\s+\w+\s+extends\s+([A-Za-z_$][\w$]*)\s*(?:<\s*([A-Za-z_$][\w$]*))?/.exec(s.text)).find(Boolean);
    if (!ext) { break; }
    chain.push(ext[1]);
    if (SPFX_BASES.test(ext[1])) { propsType = ext[2]; break; }
    const baseFile = all.find(s => new RegExp(`class\\s+${ext[1]}\\b`).test(s.text));
    if (!baseFile || files.includes(baseFile)) { break; }
    files.push(baseFile);
    current = [baseFile];
  }
  return { files, baseChain: chain, propsType };
}

/** Folders with shared code that belong to no single component (src/common, src/shared, ...). */
export function sharedSourceFiles(project: LoadedProject): SourceFile[] {
  const folders = project.components.map(c => c.folder + path.sep);
  return allSources(project.root).filter(s => !folders.some(f => s.file.startsWith(f)));
}
