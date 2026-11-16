import * as fs from 'fs';
import * as path from 'path';
import { RuleContext } from './context';
import { LoadedComponent, componentName, kindLabel } from '../project';
import { glyphForKind, makePngIcon, makeSvgIcon, readPngSize, suggestFluentIcon, svgDataUri } from '../icons';
import { isPlaceholderDescription, titleProblems, toNiceTitle } from '../titles';
import { Fix, TextEdit } from '../types';
import { JsoncDoc, applyEditsToText } from '../jsonc';

/** Fluent icon the Yeoman generator puts on every new web part / ACE. */
const SCAFFOLD_FLUENT_ICONS = new Set(['Page', 'Edit', 'Add']);
/** Generic product logo the ACE generator uses as the toolbox icon. */
const SCAFFOLD_IMAGE = /brand-icons\/product\/svg\/sharepoint_|sharepointlogo/i;
/** The 7 predefined modern toolbox groups (Microsoft Learn, "Predefined modern groups"). */
export const MODERN_GROUPS = [
  { name: 'Text, media, and content', id: 'cf066440-0614-43d6-98ae-0b31cf14c7c3', words: /text|media|image|video|content|news|gallery|carousel|banner|hero/i },
  { name: 'Discovery', id: '1edbd9a8-0bfb-4aa2-9afd-14b8c45dd489', words: /search|find|discover|feed|recent|links?|directory|apps?|my /i },
  { name: 'Communication and collaboration', id: '75e22ed5-fa14-4829-850a-c890608aca2d', words: /team|people|chat|comment|social|share|birthday|announce|staff|contact/i },
  { name: 'Planning and process', id: '1bc7927e-4a5e-4520-b540-71305c79c20a', words: /task|plan|process|event|calendar|leave|request|approv|form|workflow/i },
  { name: 'Business and intelligence', id: '4aca9e90-eff5-4fa1-bac7-728f5f157b66', words: /chart|report|kpi|dashboard|stat|data|bi\b|metric/i },
  { name: 'Site tools', id: '070951d7-94da-4db8-b06e-9d581f1f55b1', words: /site|nav|menu|admin|settings|tool/i },
  { name: 'Advanced', id: '5c03119e-3074-46fd-976b-c60198311f70', words: /^$/ },
] as const;
const ADVANCED_ID = '5c03119e-3074-46fd-976b-c60198311f70';

function suggestGroup(title: string): typeof MODERN_GROUPS[number] {
  return MODERN_GROUPS.find(g => g.words.test(title)) ?? MODERN_GROUPS[1];
}

/** Hosts that surface the web part in Microsoft Teams (need Teams colour/outline icons). */
const TEAMS_HOSTS = ['TeamsTab', 'TeamsPersonalApp', 'TeamsMeetingApp'];


export function componentRules(ctx: RuleContext): void {
  for (const c of ctx.project.components) {
    switch (c.kind) {
      case 'WebPart':
      case 'AdaptiveCardExtension':
        toolboxEntryRules(ctx, c);
        teamsIconRules(ctx, c);
        break;
      case 'ListViewCommandSet':
        commandSetRules(ctx, c);
        break;
      default:
        // Application/Field/Form customizers, libraries: nothing appears in a toolbox,
        // so the only visible names are the App Catalog title and feature title.
        break;
    }
  }
}

/** Build a fix that sets a generated SVG icon and removes the Fluent icon name (which would otherwise win). */
function svgIconFix(ctx: RuleContext, c: LoadedComponent, entryIndex: number, useInitials: boolean): Fix {
  const title = componentName(c);
  const svg = makeSvgIcon({ colour: ctx.project.config.brandColour, glyph: glyphForKind(c.kind), title: useInitials ? title : undefined });
  const doc = c.doc;
  const edits: TextEdit[] = doc.set(['preconfiguredEntries', entryIndex, 'iconImageUrl'], svgDataUri(svg));
  return {
    title: useInitials ? `Use a brand-coloured "${title}" initials icon (SVG)` : `Use a brand-coloured ${kindLabel(c.kind)} icon (SVG)`,
    safe: true,
    edits: chainEdits(doc.file, doc.text, edits, ['preconfiguredEntries', entryIndex, 'officeFabricIconFontName']),
  };
}

/**
 * Fixes are applied atomically, but jsonc `modify` edits are computed against the original text.
 * To also delete a property, compute the removal on the already-modified text and express the
 * whole thing as a single replace of the original document.
 */
function chainEdits(file: string, original: string, first: TextEdit[], removePath: (string | number)[]): TextEdit[] {
  const afterFirst = applyEditsToText(original, first);
  const tmp = new JsoncDoc(file, afterFirst);
  if (tmp.get(removePath) === undefined) { return first; }
  const finalText = applyEditsToText(afterFirst, tmp.set(removePath, undefined));
  return [{ file, offset: 0, length: original.length, newText: finalText }];
}

function toolboxEntryRules(ctx: RuleContext, c: LoadedComponent): void {
  const doc = c.doc;
  const entries: any[] = doc.get(['preconfiguredEntries']) ?? [];
  const label = kindLabel(c.kind);
  entries.forEach((entry, i) => {
    const title: string | undefined = entry?.title?.default;
    const who = title || c.alias;

    // ---- CMP001: toolbox title ----
    const problems = titleProblems(title);
    if (problems.length) {
      const nice = ctx.nice(title || c.alias);
      ctx.issue({
        ruleId: 'CMP001', severity: 'warning', category: 'Title', file: doc.file, component: who,
        ...doc.locate(['preconfiguredEntries', i, 'title', 'default']),
        message: `${label} toolbox title "${title ?? ''}" ${problems.join(', ')}.`,
        fixes: [{ title: `Rename to "${nice}"`, safe: true, edits: doc.set(['preconfiguredEntries', i, 'title', 'default'], nice) }],
      });
    } else {
      ctx.pass('CMP001', 'Title', `${label} title "${title}"`, doc.file, who);
    }

    // ---- CMP002: description (toolbox tooltip) ----
    const desc: string | undefined = entry?.description?.default;
    if (isPlaceholderDescription(desc, title)) {
      ctx.issue({
        ruleId: 'CMP002', severity: 'warning', category: 'Metadata', file: doc.file, component: who,
        ...doc.locate(['preconfiguredEntries', i, 'description', 'default']),
        message: `"${who}" description ${desc ? `"${desc}" looks like a placeholder` : 'is missing'} - it's the toolbox tooltip.`,
        detail: 'Write one short sentence describing what the author gets when they add it, e.g. "Shows upcoming events from a calendar list."',
        fixes: [{ title: `Write the "${who}" description...`, safe: false, edits: [], ask: { prompt: `Toolbox description for "${who}" (one sentence)`, file: doc.file, jsonPath: ['preconfiguredEntries', i, 'description', 'default'], value: isPlaceholderDescription(desc, title) ? '' : desc, placeholder: 'e.g. Shows upcoming events from a calendar list' } }],
      });
    } else {
      ctx.pass('CMP002', 'Metadata', `"${who}" has a real description`, doc.file, who, 1);
    }

    // ---- CMP003/004/005: icon ----
    const fluent: string | undefined = entry?.officeFabricIconFontName;
    const image: string | undefined = entry?.iconImageUrl;
    const fluentSuggestion = suggestFluentIcon(who, c.kind);
    const fluentFix = (): Fix => ({
      title: `Use Fluent icon "${fluentSuggestion}"`, safe: false,
      edits: doc.set(['preconfiguredEntries', i, 'officeFabricIconFontName'], fluentSuggestion),
    });
    if (fluent && image) {
      ctx.issue({
        ruleId: 'CMP004', severity: 'warning', category: 'Icon', file: doc.file, component: who,
        ...doc.locate(['preconfiguredEntries', i, 'officeFabricIconFontName']),
        message: `"${who}" sets both officeFabricIconFontName and iconImageUrl - the Fluent icon wins, so your image is ignored.`,
        fixes: [{ title: 'Remove officeFabricIconFontName (use the image)', safe: true, edits: doc.set(['preconfiguredEntries', i, 'officeFabricIconFontName'], undefined) }],
      });
    } else if (!fluent && !image) {
      ctx.issue({
        ruleId: 'CMP003', severity: 'error', category: 'Icon', file: doc.file, component: who,
        ...doc.locate(['preconfiguredEntries', i]),
        message: `"${who}" has no toolbox icon (needs officeFabricIconFontName or iconImageUrl).`,
        fixes: [svgIconFix(ctx, c, i, true), svgIconFix(ctx, c, i, false), fluentFix()],
      });
    } else if ((fluent && SCAFFOLD_FLUENT_ICONS.has(fluent)) || (!fluent && image && SCAFFOLD_IMAGE.test(image))) {
      ctx.issue({
        ruleId: 'CMP003', severity: 'warning', category: 'Icon', file: doc.file, component: who,
        ...doc.locate(['preconfiguredEntries', i, 'officeFabricIconFontName']),
        message: `"${who}" still uses the generator's default ${fluent ? `"${fluent}"` : 'SharePoint logo'} icon - it looks like every other custom ${label.toLowerCase()} in the toolbox.`,
        detail: 'Pick a brand icon so your components stand out from first-party ones. Toolbox icons render at 40x28; SVG data URIs stay sharp at any DPI.',
        fixes: [svgIconFix(ctx, c, i, true), svgIconFix(ctx, c, i, false), fluentFix()],
      });
    } else if (image && /^http:\/\//i.test(image)) {
      ctx.issue({
        ruleId: 'CMP005', severity: 'warning', category: 'Icon', file: doc.file, component: who,
        ...doc.locate(['preconfiguredEntries', i, 'iconImageUrl']),
        message: `"${who}" icon uses http:// - it will be blocked as mixed content.`,
        fixes: [svgIconFix(ctx, c, i, true)],
      });
    } else {
      ctx.pass('CMP003', 'Icon', `"${who}" has a custom toolbox icon${fluent ? ` (Fluent "${fluent}")` : ''}`, doc.file, who, 3);
    }

    // ---- CMP006: modern toolbox group ----
    // Only the 7 predefined groupIds create a section in the modern toolbox; anything else lands in "Advanced".
    // The "group" name is only used by the classic page web part picker.
    if (c.kind === 'WebPart') {
      const groupId: string | undefined = entry?.groupId;
      const groupName: string | undefined = entry?.group?.default;
      const predefined = MODERN_GROUPS.find(g => g.id === groupId?.toLowerCase());
      const wanted = ctx.project.config.toolboxGroup?.trim();
      const wantedGroup = MODERN_GROUPS.find(g => g.name.toLowerCase() === wanted?.toLowerCase());
      const moveTo = (g: typeof MODERN_GROUPS[number]): Fix => ({
        title: `Move to "${g.name}"`, safe: false,
        edits: chainSet(doc.file, doc.text, [
          [['preconfiguredEntries', i, 'groupId'], g.id],
          [['preconfiguredEntries', i, 'group'], { default: g.name }],
        ]),
      });
      const ordered = [...MODERN_GROUPS].sort((a, b) => Number(b === (wantedGroup ?? suggestGroup(who))) - Number(a === (wantedGroup ?? suggestGroup(who))));
      const company = ctx.project.config.developer.name || ctx.project.solutionDoc?.get(['solution', 'developer', 'name']) || '';
      const chooser = (current?: string): Fix => ({
        title: 'Choose toolbox group...', safe: false, edits: [],
        pick: {
          prompt: `Toolbox section for "${who}"${current ? ` (now: ${current})` : ''} - only these sections exist in the modern toolbox`,
          options: [
            ...ordered.filter(g => g.id !== ADVANCED_ID).map((g, n) => ({ label: g.name, description: n === 0 ? 'suggested' : undefined, fix: moveTo(g) })),
            { label: 'Advanced', description: 'the catch-all section', fix: moveTo(MODERN_GROUPS.find(g => g.id === ADVANCED_ID)!) },
            { label: '$(edit) Company group name (classic pages only)...', description: 'modern pages still show it under Advanced',
              fix: { title: 'Company group name', safe: false, edits: [], ask: { prompt: 'Group name for classic pages (modern toolbox ignores it)', file: doc.file, jsonPath: ['preconfiguredEntries', i, 'group', 'default'], value: groupName ?? company } } },
          ],
        },
      });
      if (!predefined) {
        ctx.issue({
          ruleId: 'CMP006', severity: 'warning', category: 'Metadata', file: doc.file, component: who,
          ...doc.locate(['preconfiguredEntries', i, 'groupId']),
          message: `"${who}" uses a custom groupId${groupName ? ` ("${groupName}")` : ''} - the modern toolbox ignores it and shows the web part under "Advanced".`,
          detail: 'Only the 7 predefined modern groups get their own toolbox section; the "group" name is only used on classic pages. Pick the closest predefined group, and use a consistent title prefix (e.g. "Kachihro …") so your web parts sit together.',
          fixes: [chooser(groupName ? `custom "${groupName}"` : undefined), ...ordered.filter(g => g.id !== ADVANCED_ID).map(moveTo)],
        });
      } else if (wantedGroup && predefined !== wantedGroup) {
        ctx.issue({
          ruleId: 'CMP006', severity: 'info', category: 'Metadata', file: doc.file, component: who,
          ...doc.locate(['preconfiguredEntries', i, 'groupId']),
          message: `"${who}" is in "${predefined.name}", not your preferred toolbox group "${wantedGroup.name}".`,
          fixes: [moveTo(wantedGroup), chooser(predefined.name)],
        });
      } else if (predefined.id === ADVANCED_ID) {
        ctx.issue({
          ruleId: 'CMP006', severity: 'info', category: 'Metadata', file: doc.file, component: who,
          ...doc.locate(['preconfiguredEntries', i, 'groupId']),
          message: `"${who}" is in "Advanced" (the catch-all) - authors browse the other groups first.`,
          detail: 'Tip: start every title with your company name (e.g. "Kachihro ...") so authors can search the toolbox for all your web parts.',
          fixes: [chooser('Advanced'), ...ordered.filter(g => g.id !== ADVANCED_ID).slice(0, 3).map(moveTo)],
        });
      } else {
        ctx.pass('CMP006', 'Metadata', `"${who}" in toolbox group "${predefined.name}"`, doc.file, who, 1);
      }
    }
  });
}

/** Apply several jsonc sets sequentially and return a single whole-document edit. */
function chainSet(file: string, original: string, sets: [(string | number)[], unknown][]): TextEdit[] {
  let text = original;
  for (const [p, v] of sets) {
    text = applyEditsToText(text, new JsoncDoc(file, text).set(p, v));
  }
  return [{ file, offset: 0, length: original.length, newText: text }];
}

function commandSetRules(ctx: RuleContext, c: LoadedComponent): void {
  const doc = c.doc;
  const items = doc.get(['items']) ?? {};
  for (const [key, item] of Object.entries<any>(items)) {
    const title: string | undefined = item?.title?.default;
    const problems = titleProblems(title);
    if (problems.length) {
      const nice = ctx.nice(title || key.replace(/^COMMAND_/, ''));
      ctx.issue({
        ruleId: 'CMD001', severity: 'warning', category: 'Title', file: doc.file, component: c.alias,
        ...doc.locate(['items', key, 'title', 'default']),
        message: `Command "${key}" label "${title ?? ''}" ${problems.join(', ')}.`,
        fixes: [{ title: `Rename to "${nice}"`, safe: true, edits: doc.set(['items', key, 'title', 'default'], nice) }],
      });
    } else if (/^Command (\d+|One|Two|Three|Four)$/i.test(title!)) {
      ctx.issue({
        ruleId: 'CMD001', severity: 'warning', category: 'Title', file: doc.file, component: c.alias,
        ...doc.locate(['items', key, 'title', 'default']),
        message: `Command label "${title}" is the generator default.`,
      });
    } else {
      ctx.pass('CMD001', 'Title', `Command "${title}"`, doc.file, c.alias, 1);
    }
    if (!item?.iconImageUrl) {
      const svg = makeSvgIcon({ colour: ctx.project.config.brandColour, glyph: 'commandset', title: title || key });
      ctx.issue({
        ruleId: 'CMD002', severity: 'info', category: 'Icon', file: doc.file, component: c.alias,
        ...doc.locate(['items', key]),
        message: `Command "${title ?? key}" has no icon - only the text shows in the command bar.`,
        detail: 'Command bar icons render at 16x16. Icons are not shown in the context menu.',
        fixes: [{ title: 'Add a brand initials icon (SVG)', safe: true, edits: doc.set(['items', key, 'iconImageUrl'], svgDataUri(svg)) }],
      });
    } else {
      ctx.pass('CMD002', 'Icon', `Command "${title ?? key}" has an icon`, doc.file, c.alias, 1);
    }
  }
}

function teamsIconRules(ctx: RuleContext, c: LoadedComponent): void {
  const teamsHosts = c.supportedHosts.filter(h => TEAMS_HOSTS.includes(h));
  if (teamsHosts.length === 0 && c.kind !== 'AdaptiveCardExtension') { return; }
  if (c.kind === 'AdaptiveCardExtension') { return; } // ACEs surface in Viva Connections, which uses the toolbox icon
  const teamsDir = path.join(ctx.project.root, 'teams');
  const colour = path.join(teamsDir, `${c.id}_color.png`);
  const outline = path.join(teamsDir, `${c.id}_outline.png`);
  const who = componentName(c);
  const glyph = glyphForKind(c.kind);
  const brand = ctx.project.config.brandColour;
  const fix: Fix = {
    title: 'Generate Teams colour (192x192) and outline (32x32) icons',
    safe: true,
    edits: [],
    creates: [
      { file: colour, content: makePngIcon({ size: 192, colour: brand, glyph, rounded: false }).toString('base64'), encoding: 'base64' },
      { file: outline, content: makePngIcon({ size: 32, colour: brand, glyph, style: 'outline' }).toString('base64'), encoding: 'base64' },
    ],
  };
  const loc = c.doc.locate(['supportedHosts']);
  const missing = [colour, outline].filter(f => !fs.existsSync(f));
  if (missing.length) {
    ctx.issue({
      ruleId: 'TMS001', severity: 'warning', category: 'Teams', file: c.doc.file, component: who, ...loc,
      message: `"${who}" is exposed to Teams (${teamsHosts.join(', ')}) but teams/${path.basename(missing[0])}${missing.length > 1 ? ' and the outline icon are' : ' is'} missing - Teams will show a generic icon.`,
      fixes: [fix],
    });
    return;
  }
  const cs = readPngSize(fs.readFileSync(colour));
  const os = readPngSize(fs.readFileSync(outline));
  if (!cs || cs.width !== 192 || cs.height !== 192 || !os || os.width !== 32 || os.height !== 32) {
    ctx.issue({
      ruleId: 'TMS002', severity: 'info', category: 'Teams', file: c.doc.file, component: who, ...loc,
      message: `"${who}" Teams icons should be 192x192 (colour) and 32x32 (outline, white on transparent); found ${cs?.width}x${cs?.height} and ${os?.width}x${os?.height}.`,
      fixes: [{ ...fix, title: 'Regenerate Teams icons at the right sizes' }],
    });
  } else {
    ctx.pass('TMS001', 'Teams', `"${who}" Teams icons present`, c.doc.file, who);
  }
}
