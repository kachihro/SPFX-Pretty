import * as fs from 'fs';
import * as path from 'path';
import { RuleContext } from './context';
import { LoadedComponent, componentName, walk } from '../project';
import { componentSources, sharedSourceFiles } from '../sources';
import { TextEdit } from '../types';

/**
 * Branding inside components - the modern approach is:
 *  1. Colours come from the site theme, never hard-coded:
 *       color: "[theme:bodyText, default: #323130]";   (SCSS theme tokens)
 *     and web parts opt in to section backgrounds with "supportsThemeVariants": true + ThemeProvider.
 *  2. Fonts come from SharePoint Brand Center:
 *       font-family: var(--fontFamilyCustomFont800, var(--fontFamilyBase));
 *  3. Fluent UI v9 components are wrapped in a FluentProvider with a theme mapped from SharePoint.
 */

const COLOUR_PROPS = /^(color|background|background-color|border|border-(top|right|bottom|left)(-color)?|border-color|outline|outline-color|fill|stroke|box-shadow|text-decoration-color)$/i;
const HEX_OR_RGB = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b|rgba?\([^)]*\)/g;

/** Which theme slot best fits a CSS property (safe defaults - the developer can refine). */
export function themeSlotFor(prop: string, colour: string, selector: string): string {
  const p = prop.toLowerCase();
  const c = colour.toLowerCase();
  const sel = selector.toLowerCase();
  if (/^#?(0078d4|0f6cbd|106ebe|005a9e)$/.test(c.replace('#', '')) || /button|primary|accent/.test(sel)) {
    return p.startsWith('background') ? 'themePrimary' : 'themePrimary';
  }
  if (/\ba\b|link|:hover/.test(sel) && p === 'color') { return 'link'; }
  if (p.startsWith('background')) { return 'bodyBackground'; }
  if (p.startsWith('border') || p.startsWith('outline')) { return 'bodyDivider'; }
  if (p === 'fill' || p === 'stroke') { return 'themePrimary'; }
  if (/sub|meta|caption|secondary|muted/.test(sel)) { return 'bodySubtext'; }
  return 'bodyText';
}

/** Brand Center font slot that best matches the selector. */
export function fontSlotFor(selector: string): string {
  const s = selector.toLowerCase();
  if (/\bh1\b|title|heading|header/.test(s)) { return 'CustomFont1300'; }
  if (/\bh2\b/.test(s)) { return 'CustomFont1200'; }
  if (/\bh3\b|subtitle/.test(s)) { return 'CustomFont1100'; }
  if (/\bh4\b/.test(s)) { return 'CustomFont1000'; }
  if (/button|btn|cta/.test(s)) { return 'CustomFont600'; }
  if (/link|nav|\ba\b/.test(s)) { return 'CustomFont500'; }
  if (/caption|badge|meta/.test(s)) { return 'CustomFont200'; }
  return 'CustomFont800';
}

interface ScssLine { line: string; offset: number; selector: string; inComment: boolean; }

/** Very small SCSS walker: yields each line with its absolute offset and the nearest enclosing selector. */
function scssLines(text: string): ScssLine[] {
  const out: ScssLine[] = [];
  const stack: string[] = [];
  let offset = 0;
  let inBlockComment = false;
  for (const line of text.split(/\n/)) {
    const trimmed = line.trim();
    const startsComment = trimmed.startsWith('/*');
    const commentLine = inBlockComment || startsComment || trimmed.startsWith('//');
    if (startsComment && !trimmed.includes('*/')) { inBlockComment = true; }
    else if (inBlockComment && trimmed.includes('*/')) { inBlockComment = false; }
    out.push({ line, offset, selector: stack[stack.length - 1] ?? '', inComment: commentLine });
    if (!commentLine) {
      const opens = (line.match(/\{/g) ?? []).length;
      const closes = (line.match(/\}/g) ?? []).length;
      if (opens > 0) { const sel = line.slice(0, line.indexOf('{')).trim(); for (let i = 0; i < opens; i++) { stack.push(sel || stack[stack.length - 1] || ''); } }
      for (let i = 0; i < closes; i++) { stack.pop(); }
    }
    offset += line.length + 1;
  }
  return out;
}

export function brandingRules(ctx: RuleContext): void {
  const branded = ctx.project.components.filter(c =>
    ['WebPart', 'ApplicationCustomizer', 'FormCustomizer', 'FieldCustomizer'].includes(c.kind));
  for (const c of branded) {
    if (c.kind === 'WebPart') { themeVariantRules(ctx, c); }
    styleRules(ctx, c);
  }
  sharedInlineColours(ctx);
  fluentProviderRule(ctx);
}

function sourceFiles(c: LoadedComponent, ext: RegExp): string[] {
  return walk(c.folder, f => ext.test(f));
}

function themeVariantRules(ctx: RuleContext, c: LoadedComponent): void {
  const who = componentName(c);
  const doc = c.doc;
  if (c.supportsThemeVariants !== true) {
    ctx.issue({
      ruleId: 'BRD001', severity: 'warning', category: 'Branding', file: doc.file, component: who,
      ...doc.locate(['supportsThemeVariants']),
      message: `"${who}" doesn't support theme variants - it renders a white box on coloured section backgrounds.`,
      detail: 'Set "supportsThemeVariants": true in the manifest, then consume ThemeProvider so the web part follows Neutral / Soft / Strong section backgrounds.',
      fixes: [{ title: 'Set "supportsThemeVariants": true', safe: true, edits: doc.set(['supportsThemeVariants'], true) }],
    });
    return;
  }
  const ts = componentSources(ctx.project, c).files.map(s => s.text).join('\n');
  const usesProvider = /onThemeChanged\s*\(/.test(ts) || (/ThemeProvider/.test(ts) && /themeChangedEvent|tryGetTheme/.test(ts));
  if (!usesProvider) {
    ctx.issue({
      ruleId: 'BRD002', severity: 'warning', category: 'Branding', file: doc.file, component: who,
      ...doc.locate(['supportsThemeVariants']),
      message: `"${who}" opts in to theme variants but never handles theme changes - colours won't follow the section background.`,
      detail: 'Override onThemeChanged() (or consume ThemeProvider) and push semanticColors into CSS variables. Run "SPFX Pretty: Show Theme-Aware Web Part Snippet" for code tailored to this web part.',
    });
  } else {
    ctx.pass('BRD001', 'Branding', `"${who}" follows section backgrounds (theme variants + theme change handling)`, doc.file, who, 3);
  }
}

function styleRules(ctx: RuleContext, c: LoadedComponent): void {
  const who = componentName(c);
  const scssFiles = sourceFiles(c, /\.scss$/);
  let hardColours = 0;
  let hardFonts = 0;
  let brandFontUsed = false;

  for (const file of scssFiles) {
    const text = fs.readFileSync(file, 'utf8');
    if (/--fontFamily/.test(text)) { brandFontUsed = true; }
    for (const l of scssLines(text)) {
      if (l.inComment) { continue; }
      const m = /^(\s*)([a-z-]+)\s*:\s*(.+?);?\s*$/i.exec(l.line);
      if (!m) { continue; }
      const [, indent, prop, value] = m;
      const valueOffset = l.offset + l.line.indexOf(value, indent.length + prop.length);

      // ---- BRD003: hard-coded colours ----
      if (COLOUR_PROPS.test(prop) && !/\[theme:|var\(--/.test(value)) {
        HEX_OR_RGB.lastIndex = 0;
        let hm: RegExpExecArray | null;
        while ((hm = HEX_OR_RGB.exec(value))) {
          // transparent black/white shadows work on any background - not a branding problem
          if (/shadow/i.test(prop) && /^rgba\(\s*(0\s*,\s*0\s*,\s*0|255\s*,\s*255\s*,\s*255)\s*,/i.test(hm[0])) { continue; }
          hardColours++;
          const slot = themeSlotFor(prop, hm[0], l.selector);
          const token = `"[theme:${slot}, default: ${hm[0]}]"`;
          const edits: TextEdit[] = [{ file, offset: valueOffset + hm.index, length: hm[0].length, newText: token }];
          ctx.issue({
            ruleId: 'BRD003', severity: 'warning', category: 'Branding', file, component: who,
            offset: valueOffset + hm.index, length: hm[0].length,
            message: `Hard-coded colour ${hm[0]} on ${prop}${l.selector ? ` in ${l.selector}` : ''} - won't follow the site theme or section background.`,
            detail: `Use a theme token: ${prop}: ${token}; (SPFx swaps in the current theme's "${slot}" at runtime, falling back to your colour.)`,
            fixes: [{ title: `Replace with theme token "${slot}"`, safe: true, edits }],
          });
        }
      }

      // ---- BRD004: hard-coded font families ----
      if (prop.toLowerCase() === 'font-family' && !/var\(--fontFamily|inherit|\$ms-font|\$font/i.test(value)) {
        hardFonts++;
        const slot = fontSlotFor(l.selector);
        const replacement = `var(--fontFamily${slot}, var(--fontFamilyBase))`;
        const len = value.replace(/;\s*$/, '').length;
        ctx.issue({
          ruleId: 'BRD004', severity: 'warning', category: 'Branding', file, component: who,
          offset: valueOffset, length: len,
          message: `Hard-coded font-family "${value.replace(/;\s*$/, '')}"${l.selector ? ` in ${l.selector}` : ''} - Brand Center fonts won't apply.`,
          detail: `Use the Brand Center font slot: font-family: ${replacement};`,
          fixes: [{ title: `Use Brand Center font slot ${slot}`, safe: true, edits: [{ file, offset: valueOffset, length: len, newText: replacement }] }],
        });
      }
    }
  }

  // ---- BRD005: no Brand Center font hook at all ----
  const rootScss = scssFiles.find(f => /\.module\.scss$/.test(f));
  if (rootScss && !brandFontUsed && hardFonts === 0) {
    const text = fs.readFileSync(rootScss, 'utf8');
    const firstBrace = text.search(/^[^/\n@$]*\{/m);
    const fixes = [];
    if (firstBrace >= 0) {
      const at = text.indexOf('{', firstBrace) + 1;
      const insertion = `\n  font-family: var(--fontFamilyCustomFont800, var(--fontFamilyBase));`;
      fixes.push({ title: 'Add Brand Center font to the root class', safe: true, edits: [{ file: rootScss, offset: at, length: 0, newText: insertion }] });
    }
    ctx.issue({
      ruleId: 'BRD005', severity: 'info', category: 'Branding', file: rootScss, component: who,
      offset: firstBrace >= 0 ? firstBrace : 0, length: 1,
      message: `"${who}" styles never reference a Brand Center font (--fontFamily…).`,
      detail: 'Add font-family: var(--fontFamilyCustomFont800, var(--fontFamilyBase)); to the root class (titles: CustomFont1300) so the font picked in Change the look > Font flows into the component.',
      fixes,
    });
  } else if (brandFontUsed && hardFonts === 0) {
    ctx.pass('BRD005', 'Branding', `"${who}" uses Brand Center fonts`, rootScss ?? c.manifestFile, who, 2);
  }
  if (scssFiles.length && hardColours === 0) {
    ctx.pass('BRD003', 'Branding', `"${who}" styles use theme colours (no hard-coded hex)`, scssFiles[0], who, 2);
  }

  // ---- BRD006: inline colours in TSX ----
  for (const file of sourceFiles(c, /\.tsx?$/)) {
    const text = fs.readFileSync(file, 'utf8');
    const re = /\b(color|backgroundColor|background|borderColor|fill)\s*:\s*['"`](#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))['"`]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      ctx.issue({
        ruleId: 'BRD006', severity: 'info', category: 'Branding', file, component: who,
        offset: m.index, length: m[0].length,
        message: `Inline ${m[1]} ${m[2]} - use semanticColors from the theme variant (e.g. theme.semanticColors.bodyText).`,
      });
    }
  }
}

/** BRD006 for shared code (src/common etc.) - reported once, not per component. */
function sharedInlineColours(ctx: RuleContext): void {
  for (const s of sharedSourceFiles(ctx.project)) {
    const re = /\b(color|backgroundColor|background|borderColor|fill)\s*:\s*['"`](#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))['"`]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s.text))) {
      ctx.issue({
        ruleId: 'BRD006', severity: 'info', category: 'Branding', file: s.file, component: 'shared code',
        offset: m.index, length: m[0].length,
        message: `Inline ${m[1]} ${m[2]} in shared code - use the theme (semanticColors / palette) so it works on dark section backgrounds.`,
      });
    }
  }
}

function fluentProviderRule(ctx: RuleContext): void {
  const pkg = ctx.project.packageJson;
  const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
  if (!deps['@fluentui/react-components']) { return; }
  const src = walk(path.join(ctx.project.root, 'src'), f => /\.tsx?$/.test(f));
  const hasProvider = src.some(f => /FluentProvider/.test(fs.readFileSync(f, 'utf8')));
  const pkgFile = path.join(ctx.project.root, 'package.json');
  if (!hasProvider) {
    ctx.issue({
      ruleId: 'BRD007', severity: 'warning', category: 'Branding', file: pkgFile,
      message: 'Fluent UI v9 is installed but no component is wrapped in <FluentProvider> - v9 controls will use the default Microsoft blue, not the site theme.',
      detail: 'Wrap your root component in <FluentProvider theme={…}> with a theme built from the SharePoint theme (e.g. createV9Theme from @fluentui/react-migration-v8-v9).',
    });
  } else {
    ctx.pass('BRD007', 'Branding', 'Fluent UI v9 wrapped in FluentProvider', pkgFile, undefined, 2);
  }
}
