/**
 * Generates a theme-aware + brand-aware web part snippet tailored to a project:
 *  - onThemeChanged() pushes semanticColors into CSS variables (works with section backgrounds)
 *  - SCSS uses theme tokens + Brand Center font slots
 *  - React 18 (createRoot) or legacy ReactDom.render depending on the project's React version
 *  - FluentProvider wiring when Fluent UI v9 is installed
 */
export interface SnippetOptions {
  className: string;      // e.g. HelloWorldWebPart
  componentName: string;  // e.g. HelloWorld
  reactMajor?: number;    // undefined = no React
  fluentV9: boolean;
}

export function themingSnippet(o: SnippetOptions): string {
  const react = o.reactMajor !== undefined;
  const r18 = (o.reactMajor ?? 0) >= 18;
  const lines: string[] = [];
  lines.push(`// ============================================================================`);
  lines.push(`// SPFX-Pretty: theme + brand aware ${o.className}`);
  lines.push(`// 1) Manifest:  "supportsThemeVariants": true`);
  lines.push(`// 2) Paste the members below into ${o.className}`);
  lines.push(`// 3) Use var(--bodyText) etc. and Brand Center fonts in your .module.scss (see bottom)`);
  lines.push(`// ============================================================================`);
  lines.push('');
  lines.push(`import { IReadonlyTheme } from '@microsoft/sp-component-base';`);
  if (react && r18) { lines.push(`import { createRoot, Root } from 'react-dom/client';`); }
  lines.push('');
  lines.push(`export default class ${o.className} extends BaseClientSideWebPart<I${o.componentName}WebPartProps> {`);
  lines.push(`  private _theme: IReadonlyTheme | undefined;`);
  if (react && r18) { lines.push(`  private _root: Root | undefined;`); }
  lines.push('');
  lines.push(`  /**`);
  lines.push(`   * Called by SPFx with the theme of the section the web part sits in`);
  lines.push(`   * (None / Neutral / Soft / Strong backgrounds) - and again whenever it changes.`);
  lines.push(`   */`);
  lines.push(`  protected onThemeChanged(currentTheme: IReadonlyTheme | undefined): void {`);
  lines.push(`    if (!currentTheme) { return; }`);
  lines.push(`    this._theme = currentTheme;`);
  lines.push(`    const { semanticColors, palette } = currentTheme;`);
  lines.push(`    const set = (name: string, value: string | undefined): void => {`);
  lines.push(`      this.domElement.style.setProperty(name, value || null);`);
  lines.push(`    };`);
  lines.push(`    if (semanticColors) {`);
  lines.push(`      set('--bodyText', semanticColors.bodyText);`);
  lines.push(`      set('--bodySubtext', semanticColors.bodySubtext);`);
  lines.push(`      set('--bodyBackground', semanticColors.bodyBackground);`);
  lines.push(`      set('--bodyDivider', semanticColors.bodyDivider);`);
  lines.push(`      set('--link', semanticColors.link);`);
  lines.push(`      set('--linkHovered', semanticColors.linkHovered);`);
  lines.push(`    }`);
  lines.push(`    if (palette) {`);
  lines.push(`      set('--themePrimary', palette.themePrimary);`);
  lines.push(`      set('--themeLighter', palette.themeLighter);`);
  lines.push(`    }`);
  if (react) { lines.push(`    this.render();`); }
  lines.push(`  }`);
  lines.push('');
  if (react) {
    lines.push(`  public render(): void {`);
    lines.push(`    const element = React.createElement(${o.componentName}, {`);
    lines.push(`      theme: this._theme,`);
    lines.push(`      // ...your other props`);
    lines.push(`    });`);
    if (r18) {
      lines.push(`    // React 18: keep one root for the life of the web part`);
      lines.push(`    if (!this._root) { this._root = createRoot(this.domElement); }`);
      lines.push(`    this._root.render(element);`);
    } else {
      lines.push(`    ReactDom.render(element, this.domElement);`);
    }
    lines.push(`  }`);
    lines.push('');
    lines.push(`  protected onDispose(): void {`);
    lines.push(r18 ? `    this._root?.unmount();` : `    ReactDom.unmountComponentAtNode(this.domElement);`);
    lines.push(`  }`);
  }
  lines.push(`}`);

  if (react) {
    lines.push('');
    lines.push(`// ---------------------------------------------------------------------------`);
    lines.push(`// ${o.componentName}.tsx - props + usage`);
    lines.push(`// ---------------------------------------------------------------------------`);
    lines.push(`export interface I${o.componentName}Props {`);
    lines.push(`  theme: IReadonlyTheme | undefined;`);
    lines.push(`}`);
    if (o.fluentV9) {
      lines.push('');
      lines.push(`// Fluent UI v9: map the SharePoint (v8-shaped) theme to a v9 theme so controls use the site colours.`);
      lines.push(`import { FluentProvider, webLightTheme, Theme } from '@fluentui/react-components';`);
      lines.push(`import { createV9Theme } from '@fluentui/react-migration-v8-v9';`);
      lines.push('');
      lines.push(`export const ${o.componentName}: React.FC<I${o.componentName}Props> = ({ theme }) => {`);
      lines.push(`  const v9Theme: Theme = React.useMemo(`);
      lines.push(`    () => (theme ? createV9Theme(theme as never, webLightTheme) : webLightTheme),`);
      lines.push(`    [theme]`);
      lines.push(`  );`);
      lines.push(`  return (`);
      lines.push(`    <FluentProvider theme={v9Theme} style={{ background: 'transparent' }}>`);
      lines.push(`      <section className={styles.${lowerFirst(o.componentName)}}>...</section>`);
      lines.push(`    </FluentProvider>`);
      lines.push(`  );`);
      lines.push(`};`);
    } else {
      lines.push('');
      lines.push(`// Prefer CSS variables (set in onThemeChanged) in SCSS. If you need a colour in code:`);
      lines.push(`//   const { semanticColors } = this.props.theme ?? {};`);
      lines.push(`//   <div style={{ color: semanticColors?.bodyText }}>`);
    }
  }

  lines.push('');
  lines.push(`/* ---------------------------------------------------------------------------`);
  lines.push(`   ${o.componentName}.module.scss - theme colours + Brand Center fonts`);
  lines.push(`   --------------------------------------------------------------------------- */`);
  lines.push(`/*`);
  lines.push(`.${lowerFirst(o.componentName)} {`);
  lines.push(`  font-family: var(--fontFamilyCustomFont800, var(--fontFamilyBase));   // body text`);
  lines.push(`  color: "[theme:bodyText, default: #323130]";`);
  lines.push(`  color: var(--bodyText);`);
  lines.push('');
  lines.push(`  .title {`);
  lines.push(`    font-family: var(--fontFamilyCustomFont1300, var(--fontFamilyBase)); // "Web part title" slot`);
  lines.push(`  }`);
  lines.push(`  a {`);
  lines.push(`    font-family: var(--fontFamilyCustomFont500, var(--fontFamilyBase));  // links / labels`);
  lines.push(`    color: "[theme:link, default: #03787c]";`);
  lines.push(`    color: var(--link);`);
  lines.push(`    &:hover { color: var(--linkHovered); }`);
  lines.push(`  }`);
  lines.push(`  .card {`);
  lines.push(`    border: 1px solid var(--bodyDivider);`);
  lines.push(`    background: transparent; // let the section background show through`);
  lines.push(`  }`);
  lines.push(`}`);
  lines.push(`*/`);
  lines.push('');
  return lines.join('\n');
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}
