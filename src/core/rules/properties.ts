import * as fs from 'fs';
import * as path from 'path';
import { RuleContext } from './context';
import { LoadedComponent, componentName, walk } from '../project';

/**
 * Web part / ACE / extension properties that are declared but not used (or used but never settable):
 *  PRP001 declared in the props interface but never read or edited
 *  PRP002 default in the manifest (preconfiguredEntries.properties) for a property the code doesn't know
 *  PRP003 property pane field that targets a property missing from the props interface (typo?)
 *  PRP004 localised string declared in mystrings.d.ts but never used
 */

import { SourceFile, allSources, componentSources } from '../sources';
import { TextEdit } from '../types';

/** Find `interface IName { a: string; b?: number; }` and return member names with offsets. */
function interfaceMembers(src: SourceFile[], name: string): { file: string; members: { name: string; offset: number }[]; offset: number } | undefined {
  for (const s of src) {
    const m = new RegExp(`interface\\s+${name}\\b[^{]*\\{`).exec(s.text);
    if (!m) { continue; }
    let depth = 1, i = m.index + m[0].length;
    const start = i;
    while (i < s.text.length && depth > 0) { if (s.text[i] === '{') { depth++; } else if (s.text[i] === '}') { depth--; } i++; }
    const body = s.text.slice(start, i - 1);
    const members: { name: string; offset: number }[] = [];
    // only top-level members (depth 0 inside the body)
    let d = 0;
    const re = /(?:^|[;,\n{])\s*(?:readonly\s+)?["']?([A-Za-z_$][\w$]*)["']?\??\s*:/g;
    let mm: RegExpExecArray | null;
    let last = 0;
    while ((mm = re.exec(body))) {
      for (let k = last; k < mm.index; k++) { if (body[k] === '{') { d++; } else if (body[k] === '}') { d--; } }
      last = mm.index;
      if (d === 0) { members.push({ name: mm[1], offset: start + mm.index + mm[0].indexOf(mm[1]) }); }
    }
    return { file: s.file, members, offset: m.index };
  }
  return undefined;
}

/** Property names read or written anywhere in the component source. */
function usedProperties(src: SourceFile[]): Set<string> {
  const used = new Set<string>();
  for (const s of src) {
    const t = s.text;
    for (const m of t.matchAll(/\bproperties\s*(?:\?\.|\.)\s*([A-Za-z_$][\w$]*)/g)) { used.add(m[1]); }
    for (const m of t.matchAll(/\bproperties\s*\[\s*['"]([^'"]+)['"]\s*\]/g)) { used.add(m[1]); }
    for (const m of t.matchAll(/\{([^{}]+)\}\s*=\s*this\.properties\b/g)) {
      m[1].split(',').map(x => x.split(':')[0].trim()).filter(Boolean).forEach(x => used.add(x.replace(/^\.\.\./, '')));
    }
    // property pane fields: PropertyPaneTextField('name', ...) / PropertyFieldXxx('name', ...) / targetProperty: 'name'
    for (const m of t.matchAll(/\bProperty(?:Pane|Field)\w*\s*\(\s*['"]([^'"]+)['"]/g)) { used.add(m[1]); }
    for (const m of t.matchAll(/\btargetProperty\s*:\s*['"]([^'"]+)['"]/g)) { used.add(m[1]); }
  }
  return used;
}

function paneTargets(src: SourceFile[]): { name: string; file: string; offset: number }[] {
  const out: { name: string; file: string; offset: number }[] = [];
  for (const s of src) {
    for (const m of s.text.matchAll(/\b(Property(?:Pane|Field)\w*)\s*\(\s*['"]([^'"]+)['"]/g)) {
      if (DISPLAY_ONLY.test(m[1])) { continue; }
      out.push({ name: m[2], file: s.file, offset: m.index! + m[0].lastIndexOf(m[2]) });
    }
  }
  return out;
}

/** Property pane fields that only display something - their key isn't a real property. */
const DISPLAY_ONLY = /(Label|Link|HorizontalRule|About|Heading|Header|Info|Markdown|Separator|Spacer|Description|Image|Logo|Version|Help|Message)\w*$/;

const BASE_CLASS = /extends\s+(?:BaseClientSideWebPart|BaseAdaptiveCardExtension|BaseApplicationCustomizer|BaseListViewCommandSet|BaseFieldCustomizer|BaseFormCustomizer)\s*<\s*([A-Za-z_$][\w$]*)/;

export function propertyRules(ctx: RuleContext): void {
  const reported = new Set<string>();
  for (const c of ctx.project.components) {
    if (c.kind === 'Library' || c.kind === 'Unknown') { continue; }
    const { files, propsType } = componentSources(ctx.project, c);
    if (!files.length) { continue; }
    checkProps(ctx, c, files, propsType, reported);
    checkLocStrings(ctx, path.join(c.folder, 'loc'), files, componentName(c));
  }
  // Shared loc folders (e.g. src/common/loc) are used by every component
  const compFolders = ctx.project.components.map(c => c.folder + path.sep);
  const sharedLoc = [...new Set(walk(path.join(ctx.project.root, 'src'), f => /\.d\.ts$/.test(f))
    .map(f => path.dirname(f)).filter(d => path.basename(d) === 'loc' && !compFolders.some(cf => (d + path.sep).startsWith(cf))))];
  for (const dir of sharedLoc) { checkLocStrings(ctx, dir, allSources(ctx.project.root), 'shared'); }
}

function checkProps(ctx: RuleContext, c: LoadedComponent, src: SourceFile[], propsType: string | undefined, reported: Set<string>): void {
  const who = componentName(c);
  const base = propsType ?? src.map(s => BASE_CLASS.exec(s.text)?.[1]).find(Boolean);
  if (!base) { return; }
  const iface = interfaceMembers(src, base);
  // Everything except the interface declaration itself counts as usage.
  const usageSrc = src.map(s => s.file === iface?.file ? { ...s, text: s.text.replace(new RegExp(`interface\\s+${base}\\b[^{]*\\{[\\s\\S]*?\\n\\}`), '') } : s);
  const used = usedProperties(usageSrc);
  const declared = new Set(iface?.members.map(m => m.name) ?? []);
  const defaults: Record<string, unknown> = c.doc.get(['preconfiguredEntries', 0, 'properties']) ?? {};
  let problems = 0;

  if (iface) {
    for (const m of iface.members) {
      if (used.has(m.name)) { continue; }
      problems++;
      if (reported.has(`${iface.file}:${m.offset}`)) { continue; }
      reported.add(`${iface.file}:${m.offset}`);
      const ifaceText = src.find(s => s.file === iface.file)?.text ?? fs.readFileSync(iface.file, 'utf8');
      const removeMember = removeLine(iface.file, ifaceText, m.offset);
      const removeDefault = m.name in defaults ? c.doc.set(['preconfiguredEntries', 0, 'properties', m.name], undefined) : [];
      const fixes = [{
        title: `Remove "${m.name}" from ${base}${removeDefault.length ? ' and the manifest defaults' : ''}`, safe: false,
        edits: [...removeMember, ...removeDefault],
      }];
      ctx.issue({
        ruleId: 'PRP001', severity: 'warning', category: 'Properties', file: iface.file, component: who,
        offset: m.offset, length: m.name.length,
        message: `Property "${m.name}" is declared in ${base} but never read or shown in the property pane.`,
        detail: 'Unused properties still get saved with every instance of the web part on every page. Remove it from the interface (and the manifest defaults), or wire it up.',
        fixes,
      });
    }
  }

  for (const key of Object.keys(defaults)) {
    if (declared.has(key) || used.has(key)) { continue; }
    problems++;
    ctx.issue({
      ruleId: 'PRP002', severity: 'warning', category: 'Properties', file: c.doc.file, component: who,
      ...c.doc.locate(['preconfiguredEntries', 0, 'properties', key]),
      message: `Manifest default "${key}" isn't a property the ${base ?? 'code'} knows about - leftover from an old version or the generator?`,
      fixes: [{ title: `Remove "${key}" from the manifest defaults`, safe: false, edits: c.doc.set(['preconfiguredEntries', 0, 'properties', key], undefined) }],
    });
  }

  if (iface) {
    for (const t of paneTargets(src)) {
      // nested targets like "tile.size" are valid when the root ("tile") is declared; skip non-identifiers like "_"
      if (!/^[A-Za-z$][\w$]*(\.[\w$]+)*$/.test(t.name)) { continue; }
      if (declared.has(t.name) || declared.has(t.name.split('.')[0])) { continue; }
      problems++;
      if (reported.has(`${t.file}:${t.offset}`)) { continue; }
      reported.add(`${t.file}:${t.offset}`);
      ctx.issue({
        ruleId: 'PRP003', severity: 'warning', category: 'Properties', file: t.file, component: who,
        offset: t.offset, length: t.name.length,
        message: `Property pane field targets "${t.name}", which isn't in ${base} - typo, or missing from the interface?`,
      });
    }
  }
  if (!problems && iface) {
    ctx.pass('PRP001', 'Properties', `"${who}" properties are all used (${iface.members.length})`, iface.file, who, 2);
  }
}

function checkLocStrings(ctx: RuleContext, locDir: string, src: SourceFile[], who: string): void {
  const dts = walk(locDir, f => /\.d\.ts$/.test(f))[0];
  if (!dts) { return; }
  const text = fs.readFileSync(dts, 'utf8');
  const iface = /interface\s+(\w+)/.exec(text)?.[1];
  if (!iface) { return; }
  const members = interfaceMembers([{ file: dts, text }], iface)?.members ?? [];
  // `import * as strings from 'HelloWorldWebPartStrings'` - usage is strings.Key (any alias)
  const aliases = new Set(['strings']);
  for (const s of src) { for (const m of s.text.matchAll(/import\s+\*\s+as\s+(\w+)\s+from\s+['"][^'"]*Strings['"]/g)) { aliases.add(m[1]); } }
  const all = src.map(s => s.text).join('\n');
  const locJs = walk(path.dirname(dts), f => /\.js$/i.test(f)).map(file => ({ file, text: fs.readFileSync(file, 'utf8') }));
  const unused = members.filter(m => ![...aliases].some(a => new RegExp(`\\b${a}\\s*(?:\\?\\.|\\.)\\s*${m.name}\\b|\\b${a}\\s*\\[\\s*['"]${m.name}['"]`).test(all)));
  for (const m of unused) {
    ctx.issue({
      ruleId: 'PRP004', severity: 'info', category: 'Properties', file: dts, component: who,
      offset: m.offset, length: m.name.length,
      message: `Localised string "${m.name}" is never used - remove it from ${path.basename(dts)} and every loc/*.js file.`,
      fixes: [{ title: `Remove "${m.name}" from ${path.basename(dts)} and ${locJs.length} loc file${locJs.length === 1 ? '' : 's'}`, safe: false,
        edits: [
          ...removeLine(dts, text, m.offset),
          ...locJs.flatMap(js => { const i = new RegExp(`["']?${m.name}["']?\\s*:`).exec(js.text)?.index; return i === undefined ? [] : removeLine(js.file, js.text, i); }),
        ] }],
    });
  }
}

/** Edit that deletes the whole line containing `offset` (including its line break). */
function removeLine(file: string, text: string, offset: number): TextEdit[] {
  const start = text.lastIndexOf('\n', offset - 1) + 1;
  let end = text.indexOf('\n', offset);
  end = end < 0 ? text.length : end + 1;
  return [{ file, offset: start, length: end - start, newText: '' }];
}
