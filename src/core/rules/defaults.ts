import * as fs from 'fs';
import * as path from 'path';
import { RuleContext } from './context';
import { LoadedComponent, componentName, walk } from '../project';
import { isPlaceholderDescription, splitWords, stripNoise, titleProblems, toNiceTitle } from '../titles';

/**
 * "Plain default values" - text the Yeoman generator writes that real people end up seeing:
 *  - the web part's default property values ("HelloWorld" shown on the page)
 *  - property pane strings from loc/en-us.js ("Description", "Group Name", "Description Field")
 *  - the feature description ("The feature that activates elements of the x solution.")
 *  - the .sppkg file name (ClientSolution.sppkg when zippedPackage is missing)
 *  - extension Titles and sample properties in sharepoint/assets/*.xml ("Test message" alerts!)
 */

/** Exact property-pane strings from the web part generator. */
const LOC_DEFAULTS: Record<string, { value: RegExp; what: string }> = {
  PropertyPaneDescription: { value: /^Description$/, what: 'property pane header' },
  BasicGroupName: { value: /^Group Name$/, what: 'property pane group heading' },
  DescriptionFieldLabel: { value: /^Description Field$/, what: 'property pane field label' },
};
/** Generator text in other components' loc files (ACE / extensions). */
const LOC_DEFAULT_TEXT = [
  /^SPFx Adaptive Card Extension$/i,
  /Create your SPFx Adaptive Card Extension/i,
  /^Quick view button$/i,
  /^Title Field Label$/i,
  /^Description Field Label$/i,
  /^(Command One|Command Two)$/,
];

/** Sample values the extension generators put in ClientSideComponentProperties. */
const SAMPLE_PROPS: [RegExp, string][] = [
  [/Test message/i, 'Application Customizer shows a "Test message" alert on every page'],
  [/One item is selected in the list/i, 'Command Set sample text "One item is selected in the list"'],
  [/This command is always visible/i, 'Command Set sample text "This command is always visible."'],
  [/"sampleText"\s*:\s*"Value"|&quot;sampleText&quot;:&quot;Value&quot;/i, 'Field Customizer sample text "Value"'],
];

export function defaultsRules(ctx: RuleContext): void {
  featureDescription(ctx);
  packageFileName(ctx);
  appNamePrefix(ctx);
  for (const c of ctx.project.components) {
    if (c.kind === 'WebPart' || c.kind === 'AdaptiveCardExtension') { defaultPropertyValues(ctx, c); }
    locStrings(ctx, c);
  }
  assetXml(ctx);
}

/** A raw alias/class-like name ("HelloWorld", "hello-world") rather than real text. */
function looksLikeRawName(value: string, c: LoadedComponent): boolean {
  const alias = c.alias.replace(/(WebPart|AdaptiveCardExtension)$/, '');
  const norm = (s: string) => s.replace(/[^a-z0-9]/gi, '').toLowerCase();
  return norm(value) === norm(alias) && titleProblems(value).length > 0;
}

function defaultPropertyValues(ctx: RuleContext, c: LoadedComponent): void {
  const entries: any[] = c.doc.get(['preconfiguredEntries']) ?? [];
  entries.forEach((e, i) => {
    const props = e?.properties ?? {};
    for (const [key, value] of Object.entries(props)) {
      if (typeof value !== 'string') { continue; }
      const raw = looksLikeRawName(value, c);
      const generic = /^(description|title|value|text)$/i.test(value);
      if (!raw && !generic) { continue; }
      const nice = raw ? ctx.nice(value) : '';
      ctx.issue({
        ruleId: 'DEF001', severity: 'warning', category: 'Defaults', file: c.doc.file, component: componentName(c),
        ...c.doc.locate(['preconfiguredEntries', i, 'properties', key]),
        message: `Default "${key}" is "${value}" - that's what people see the moment they add ${c.kind === 'AdaptiveCardExtension' ? 'the card to the dashboard' : 'the web part to a page'}.`,
        detail: 'preconfiguredEntries[].properties are the starting values for every new instance.',
        fixes: nice
          ? [{ title: `Set to "${nice}"`, safe: true, edits: c.doc.set(['preconfiguredEntries', i, 'properties', key], nice) }]
          : [{ title: 'Clear the default', safe: false, edits: c.doc.set(['preconfiguredEntries', i, 'properties', key], '') }],
      });
    }
  });
}

/** Parse `"Key": "Value"` pairs out of an AMD loc file, keeping value offsets. */
function locPairs(text: string): { key: string; value: string; offset: number }[] {
  const out: { key: string; value: string; offset: number }[] = [];
  const re = /["']?(\w+)["']?\s*:\s*(["'])((?:\\.|(?!\2).)*)\2/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    out.push({ key: m[1], value: m[3], offset: m.index + m[0].length - m[3].length - 1 });
  }
  return out;
}

function locStrings(ctx: RuleContext, c: LoadedComponent): void {
  const locFiles = walk(path.join(c.folder, 'loc'), f => /^en-us\.js$/i.test(f) || /^default\.js$/i.test(f));
  const who = componentName(c);
  for (const file of locFiles) {
    const text = fs.readFileSync(file, 'utf8');
    for (const p of locPairs(text)) {
      const known = LOC_DEFAULTS[p.key];
      const isDefault = known ? known.value.test(p.value) : LOC_DEFAULT_TEXT.some(re => re.test(p.value));
      if (!isDefault) { continue; }
      const fixes = [];
      if (p.key === 'PropertyPaneDescription' && c.description && !isPlaceholderDescription(c.description, c.title)) {
        fixes.push({ title: `Use the web part description "${c.description}"`, safe: false, edits: [{ file, offset: p.offset, length: p.value.length, newText: c.description.replace(/"/g, '\\"') }] });
      }
      if (p.key === 'BasicGroupName') {
        fixes.push({ title: 'Use "Settings"', safe: false, edits: [{ file, offset: p.offset, length: p.value.length, newText: 'Settings' }] });
      }
      ctx.issue({
        ruleId: 'DEF002', severity: 'warning', category: 'Defaults', file, component: who,
        offset: p.offset, length: p.value.length,
        message: `"${p.key}" is still the generator's "${p.value}"${known ? ` - the ${known.what} people see when they edit "${who}"` : ''}.`,
        detail: 'Update every locale file (loc/*.js) with wording that tells authors what to set.',
        fixes,
      });
    }
  }
}

function featureDescription(ctx: RuleContext): void {
  const doc = ctx.project.solutionDoc;
  if (!doc) { return; }
  const features: any[] = doc.get(['solution', 'features']) ?? [];
  const name: string = ctx.project.solution?.name ?? '';
  const niceName = titleProblems(name).length ? ctx.nice(name) : name;
  const short = ctx.project.solution?.shortDescription;
  features.forEach((f, i) => {
    const d: string | undefined = f?.description;
    if (!d || !/^The feature that activates elements of the .+ solution\.?$/i.test(d)) { return; }
    const better = short && !isPlaceholderDescription(short, name) ? short : `Adds ${niceName} to this site.`;
    ctx.issue({
      ruleId: 'DEF003', severity: 'info', category: 'Defaults', file: doc.file, ...doc.locate(['solution', 'features', i, 'description']),
      message: `Feature description is the generator's "${d}".`,
      fixes: [{ title: `Use "${better}"`, safe: true, edits: doc.set(['solution', 'features', i, 'description'], better) }],
    });
  });
}

function packageFileName(ctx: RuleContext): void {
  const doc = ctx.project.solutionDoc;
  if (!doc) { return; }
  const zipped: string | undefined = doc.get(['paths', 'zippedPackage']);
  const name = ctx.project.solution?.name ?? path.basename(ctx.project.root);
  const kebab = splitWords(stripNoise(name)).join('-').toLowerCase() || 'solution';
  if (!zipped) {
    ctx.issue({
      ruleId: 'DEF004', severity: 'warning', category: 'Defaults', file: doc.file, ...doc.locate(['paths']),
      message: 'No paths.zippedPackage - the file uploaded to the App Catalog will be called "ClientSolution.sppkg".',
      fixes: [{ title: `Name the package "${kebab}.sppkg"`, safe: true, edits: doc.set(['paths', 'zippedPackage'], `solution/${kebab}.sppkg`) }],
    });
  } else if (/client-side-solution|ClientSolution/i.test(path.basename(zipped))) {
    ctx.issue({
      ruleId: 'DEF004', severity: 'info', category: 'Defaults', file: doc.file, ...doc.locate(['paths', 'zippedPackage']),
      message: `Package file "${path.basename(zipped)}" is the generic name shown in the App Catalog "Name" column.`,
      fixes: [{ title: `Rename to "${kebab}.sppkg"`, safe: true, edits: doc.set(['paths', 'zippedPackage'], `solution/${kebab}.sppkg`) }],
    });
  } else {
    ctx.pass('DEF004', 'Defaults', `Package file "${path.basename(zipped)}"`, doc.file, undefined, 1);
  }
}

function appNamePrefix(ctx: RuleContext): void {
  const prefix = ctx.project.config.appNamePrefix;
  const doc = ctx.project.solutionDoc;
  const name: string | undefined = ctx.project.solution?.name;
  if (!prefix || !doc || !name) { return; }
  if (name.startsWith(prefix)) { ctx.pass('SOL014', 'Title', `App name starts with "${prefix}"`, doc.file, undefined, 1); return; }
  const base = titleProblems(name).length ? ctx.nice(name) : name;
  ctx.issue({
    ruleId: 'SOL014', severity: 'info', category: 'Title', file: doc.file, ...doc.locate(['solution', 'name']),
    message: `App name doesn't start with your prefix "${prefix}" - your apps won't sort together in the App Catalog / Site Contents.`,
    fixes: [{ title: `Rename to "${prefix}${base}"`, safe: true, edits: doc.set(['solution', 'name'], `${prefix}${base}`) }],
  });
}

/** sharepoint/assets/*.xml - extension registrations (elements.xml, ClientSideInstance.xml). */
function assetXml(ctx: RuleContext): void {
  const assets = walk(path.join(ctx.project.root, 'sharepoint', 'assets'), f => f.toLowerCase().endsWith('.xml'));
  for (const file of assets) {
    const text = fs.readFileSync(file, 'utf8');
    const isInstance = /ClientSideComponentInstance/i.test(text);
    const titleRe = /<(CustomAction|ClientSideComponentInstance)\b[^>]*?\bTitle="([^"]*)"/g;
    let m: RegExpExecArray | null;
    while ((m = titleRe.exec(text))) {
      const title = m[2];
      const problems = titleProblems(title);
      if (!problems.length) { continue; }
      const offset = m.index + m[0].length - title.length - 1;
      const nice = ctx.nice(title);
      ctx.issue({
        ruleId: 'DEF005', severity: 'info', category: 'Defaults', file, offset, length: title.length,
        message: `${m[1]} Title "${title}" ${problems.join(', ')}${isInstance ? ' - shown in the Tenant Wide Extensions list' : ' - shown in site/list custom action listings'}.`,
        fixes: [{ title: `Rename to "${nice}"`, safe: true, edits: [{ file, offset, length: title.length, newText: nice }] }],
      });
    }
    for (const [re, what] of SAMPLE_PROPS) {
      const sm = re.exec(text);
      if (!sm) { continue; }
      ctx.issue({
        ruleId: 'DEF006', severity: 'warning', category: 'Defaults', file, offset: sm.index, length: sm[0].length,
        message: `${what} - generator sample properties are still registered in ${path.basename(file)}.`,
        detail: 'Replace ClientSideComponentProperties with your real settings (or "{}"), otherwise users will see the sample text.',
      });
    }
  }
}
