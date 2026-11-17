import { ruleUrl } from './site';
import { SNIPPET_CSS, formatSnippet, snippetHtml } from './codeFormat';
import { learnLinks } from './learnLinks';
const fence = (src: string) => (formatSnippet(src).lang === 'json' ? 'json' : /:\s*[^;]+;/.test(src) ? 'scss' : /="/.test(src) ? 'xml' : '');
/**
 * Help for every rule: what it means, why it matters, and how to fix it.
 * Drives the "Explain & How to Fix" page in the editor and docs/faq/*.md for the website.
 */
export interface RuleDoc {
  id: string;
  area: 'App Catalog' | 'Icons' | 'Toolbox' | 'Command sets' | 'Teams' | 'Defaults' | 'Properties' | 'Versions' | 'About' | 'Branding';
  title: string;
  why: string;
  fix: string[];
  /** Optional before/after (shown as code) */
  before?: string;
  after?: string;
  /** Where the value lives */
  where?: string;
  auto: 'yes' | 'partly' | 'no';
  learnMore?: string;
}

const L = 'https://learn.microsoft.com/sharepoint/dev/spfx/';

export const RULE_DOCS: RuleDoc[] = [
  // ---------------- App Catalog ----------------
  { id: 'SOL001', area: 'App Catalog', title: 'App name is not a nice title', auto: 'yes',
    why: 'solution.name is the title people read in the App Catalog, "Add an app" and Site Contents. A package-style name like "project-client-side-solution" looks unfinished.',
    where: 'config/package-solution.json → solution.name',
    fix: ['Click the fix to rename it to the suggested title, or type your own.', 'Rebuild (heft package-solution --production) and upload the new .sppkg over the old one.', 'It is safe: SharePoint tracks the app by solution.id, not the name.'],
    before: '"name": "project-client-side-solution"', after: '"name": "Kachihro Project"' },
  { id: 'SOL002', area: 'App Catalog', title: 'solution.title is not a nice title', auto: 'yes',
    why: 'The optional title should read like a product name, the same as solution.name.', where: 'config/package-solution.json → solution.title',
    fix: ['Apply the suggested title, or remove "title" and rely on "name".'] },
  { id: 'SOL003', area: 'App Catalog', title: 'Feature title is the generator default', auto: 'yes',
    why: 'Site owners see feature titles in Site settings → Manage site features. "my-app Feature" looks unfinished.',
    where: 'config/package-solution.json → solution.features[].title', fix: ['Apply the suggested "<App name> Feature", or write your own.'] },
  { id: 'SOL004', area: 'App Catalog', title: 'Developer details are missing', auto: 'partly',
    why: 'The App Catalog app details page shows the developer, website, privacy and terms links. Teams and Viva Connections require them.',
    where: 'config/package-solution.json → solution.developer',
    fix: ['Set your details once in Settings → SPFX Pretty → Developer (or developer in .spfxprettyrc.json).', 'Then click the fix - it fills every project the same way.'],
    after: '"developer": { "name": "Kachihro", "websiteUrl": "https://…", "privacyUrl": "https://…", "termsOfUseUrl": "https://…", "mpnId": "Undefined-1.24.1" }' },
  { id: 'SOL005', area: 'App Catalog', title: 'Short description missing or a placeholder', auto: 'partly',
    why: 'Shown under the app title in the App Catalog and "Add an app". The generator writes "my-app description".',
    where: 'config/package-solution.json → solution.metadata.shortDescription.default',
    fix: ['Click "Write the short description…" and type one friendly sentence.', 'Say what it does for the user, not how it is built.'],
    before: '"default": "project description"', after: '"default": "Quick links to the tools your team uses every day."' },
  { id: 'SOL006', area: 'App Catalog', title: 'Long description missing, a placeholder, or the same as the short one', auto: 'partly',
    why: 'Shown on the app details page. Admins read it to decide whether to deploy the app.',
    where: 'config/package-solution.json → solution.metadata.longDescription.default',
    fix: ['Click "Write the long description…".', 'Cover: what it does, who it is for, any setup (lists, permissions) and who to contact.'] },
  { id: 'SOL007', area: 'App Catalog', title: 'No categories', auto: 'partly',
    why: 'Categories help people filter apps in the App Catalog.', where: 'config/package-solution.json → solution.metadata.categories',
    fix: ['Click "Add categories…" and enter a comma-separated list, e.g. "Productivity, Content management".'] },
  { id: 'SOL008', area: 'App Catalog', title: 'No screenshots on the app details page', auto: 'no',
    why: 'A screenshot shows admins and site owners what they are adding before they deploy it.',
    where: 'config/package-solution.json → solution.metadata.screenshotPaths (files in ./sharepoint)',
    fix: ['Take 1-5 screenshots of the web part on a real page (PNG/JPG, around 1366x768).', 'Save them in sharepoint/images/, e.g. sharepoint/images/screenshot1.png.', 'List them in package-solution.json (paths relative to ./sharepoint).', 'Rebuild and upload the .sppkg.', 'Not needed? Right-click → Ignore This Rule.'],
    after: '"screenshotPaths": ["images/screenshot1.png", "images/screenshot2.png"]' },
  { id: 'SOL010', area: 'Icons', title: 'No app icon', auto: 'yes',
    why: 'Without solution.iconPath the App Catalog, "Add an app" and Site Contents show a generic placeholder, so your app looks like everyone else\'s.',
    where: 'config/package-solution.json → solution.iconPath (relative to ./sharepoint)',
    fix: ['Click "Upload company icon (96x96)…" and pick a square PNG - it is resized, saved as sharepoint/images/AppIcon.png and wired up for you.', 'Or run "SPFX Pretty: Upload Company Logo" once and it is remembered for every project.', 'Rebuild and upload the .sppkg.'],
    after: '"iconPath": "images/AppIcon.png"' },
  { id: 'SOL011', area: 'Icons', title: 'App icon file not found', auto: 'yes',
    why: 'iconPath points at a file that is not in ./sharepoint, so packaging fails or no icon shows.',
    fix: ['iconPath is relative to ./sharepoint - move the file there, or', 'click the fix to upload/generate an icon at that path.'] },
  { id: 'SOL012', area: 'Icons', title: 'App icon is the wrong format or size', auto: 'yes',
    why: 'The App Catalog expects a square PNG; 96x96 looks crisp.', fix: ['Upload a square PNG of at least 96x96 - SPFX Pretty resizes it.'] },
  { id: 'SOL013', area: 'App Catalog', title: 'Solution version and package.json version differ', auto: 'partly',
    why: 'The App Catalog shows the solution version, while web parts (manifest "version": "*") report the package.json version. Mismatched numbers confuse support.',
    fix: ['Bump the lower one so they match (SPFX Pretty never suggests a downgrade).', 'Bump package-solution.json version every release so SharePoint sees an update.'] },
  { id: 'SOL014', area: 'App Catalog', title: 'App name does not start with your prefix', auto: 'yes',
    why: 'A common prefix (e.g. "Kachihro - ") keeps all your organisation\'s apps together in the App Catalog and Site Contents.',
    fix: ['Apply the fix, or change the prefix in Settings → SPFX Pretty → App Name Prefix.'] },
  { id: 'SOL015', area: 'Icons', title: 'App icon is the generated placeholder', auto: 'partly',
    why: 'The brand-colour icon SPFX Pretty generates is a stop-gap. Your company icon is far more recognisable.',
    fix: ['Click "Upload company icon (96x96)…" and choose your logo PNG.'] },

  // ---------------- Toolbox ----------------
  { id: 'CMP001', area: 'Toolbox', title: 'Toolbox title is not nice', auto: 'yes',
    why: 'This is the name authors see in the web part toolbox. "HelloWorld" or "team-news-web-part" looks unfinished.',
    where: '<WebPart>.manifest.json → preconfiguredEntries[].title.default', fix: ['Apply the suggested title, or type your own.', 'Tip: start with your company name (e.g. "Kachihro News") so authors can search for all your web parts.'],
    before: '"title": { "default": "HelloWorld" }', after: '"title": { "default": "Kachihro Hello World" }' },
  { id: 'CMP002', area: 'Toolbox', title: 'Toolbox description is a placeholder', auto: 'partly',
    why: 'Shown as the tooltip in the toolbox. "HelloWorld description" does not help anyone choose.',
    where: '<WebPart>.manifest.json → preconfiguredEntries[].description.default', fix: ['Click "Write the description…" and type one sentence about what authors get.'] },
  { id: 'CMP003', area: 'Toolbox', title: 'No toolbox icon, or still the default', auto: 'yes',
    why: 'Every new web part uses the "Page" icon, so yours look like every other custom web part.',
    fix: ['Pick a brand-coloured SVG icon (initials or a type glyph), or', 'choose a Fluent icon name (officeFabricIconFontName), e.g. "News", "People", "Calendar".'] },
  { id: 'CMP004', area: 'Toolbox', title: 'Both officeFabricIconFontName and iconImageUrl are set', auto: 'yes',
    why: 'SharePoint uses the Fluent icon when both are set, so your image is silently ignored.', fix: ['Click the fix to remove officeFabricIconFontName and keep your image.'] },
  { id: 'CMP005', area: 'Toolbox', title: 'Toolbox icon uses http://', auto: 'yes',
    why: 'Browsers block http images on https pages (mixed content).', fix: ['Use https, or let SPFX Pretty embed an SVG icon.'] },
  { id: 'CMP006', area: 'Toolbox', title: 'Web part is in the wrong toolbox group', auto: 'partly',
    why: 'The modern toolbox only has 7 sections. Any other groupId (e.g. a company "Personal" group) falls back to "Advanced", where authors look last.',
    where: '<WebPart>.manifest.json → preconfiguredEntries[].groupId',
    fix: ['Click "Choose toolbox group…" and pick the closest section (Discovery, Communication and collaboration, …).', 'A company group name only shows on classic pages - use a title prefix ("Kachihro …") to keep your web parts together.'],
    learnMore: L + 'web-parts/guidance/simplify-adding-web-parts-with-preconfigured-entries' },
  { id: 'CMD001', area: 'Command sets', title: 'Command label is not nice', auto: 'yes',
    why: 'Shown in the list command bar and context menu. "Command One" is the generator default.', fix: ['Apply the suggested label, or write a verb phrase like "Approve request".'] },
  { id: 'CMD002', area: 'Command sets', title: 'Command has no icon', auto: 'yes',
    why: 'Without an icon only text shows in the command bar (icons show at 16x16; not in context menus).', fix: ['Click the fix to add a brand initials SVG icon.'] },
  { id: 'TMS001', area: 'Teams', title: 'Teams icons missing', auto: 'yes',
    why: 'Web parts exposed as Teams tabs or personal apps need teams/{componentId}_color.png (192x192) and _outline.png (32x32), or Teams shows a generic icon.',
    fix: ['Click the fix (or Upload Company Logo) to create both files from your logo.'] },
  { id: 'TMS002', area: 'Teams', title: 'Teams icons are the wrong size', auto: 'yes',
    why: 'Teams needs a 192x192 colour icon and a 32x32 white-on-transparent outline icon.', fix: ['Regenerate them with the fix.'] },

  // ---------------- Defaults ----------------
  { id: 'DEF001', area: 'Defaults', title: 'Default property value is a raw name', auto: 'yes',
    why: 'preconfiguredEntries.properties are the values every new web part starts with - "HelloWorld" shows on the page straight away.',
    fix: ['Apply the suggested value, or set a sensible default in the manifest.'], before: '"description": "HelloWorld"', after: '"description": "Hello World"' },
  { id: 'DEF002', area: 'Defaults', title: 'Property pane text is the generator default', auto: 'partly',
    why: 'Authors editing the web part see "Description", "Group Name" and "Description Field" - they say nothing about your settings.',
    where: 'src/webparts/<name>/loc/en-us.js (and every other locale file)',
    fix: ['Rename the header, group and field labels to describe your settings, e.g. "Choose which links to show".', 'Update every loc/*.js file, not just en-us.'] },
  { id: 'DEF003', area: 'Defaults', title: 'Feature description is the generator default', auto: 'yes',
    why: 'Shown in Manage site features.', fix: ['Apply the suggested description.'] },
  { id: 'DEF004', area: 'Defaults', title: 'Package file name is generic', auto: 'yes',
    why: 'Without paths.zippedPackage the file uploaded to the App Catalog is "ClientSolution.sppkg" - the Name column shows that.',
    fix: ['Apply the fix to name it after your app, e.g. solution/kachihro-project.sppkg.'] },
  { id: 'DEF005', area: 'Defaults', title: 'Extension Title is not nice', auto: 'yes',
    why: 'Shown in the Tenant Wide Extensions list and custom action listings.', where: 'sharepoint/assets/elements.xml, ClientSideInstance.xml',
    fix: ['Apply the suggested title.'] },
  { id: 'DEF006', area: 'Defaults', title: 'Generator sample properties are still registered', auto: 'no',
    why: 'The Application Customizer generator registers testMessage "Test message" - users get an alert on every page.',
    where: 'sharepoint/assets/elements.xml and ClientSideInstance.xml → ClientSideComponentProperties',
    fix: ['Replace ClientSideComponentProperties with your real settings, or "{}".', 'Remove the Dialog.alert sample code from the extension.'],
    before: 'ClientSideComponentProperties="{&quot;testMessage&quot;:&quot;Test message&quot;}"', after: 'ClientSideComponentProperties="{}"' },

  // ---------------- Properties ----------------
  { id: 'PRP001', area: 'Properties', title: 'Property declared but never used', auto: 'partly',
    why: 'Unused properties are still saved with every instance on every page, and confuse whoever maintains the code.',
    fix: ['If it is truly unused: Apply Fix removes it from the props interface (and the manifest defaults).', 'If it should be used: read it in render() or add a property pane field for it.'] },
  { id: 'PRP002', area: 'Properties', title: 'Manifest default for an unknown property', auto: 'partly',
    why: 'A leftover from an earlier version - it is saved on every new instance for nothing.', fix: ['Remove it from preconfiguredEntries.properties, or add it back to the props interface.'] },
  { id: 'PRP003', area: 'Properties', title: 'Property pane field targets a missing property', auto: 'no',
    why: 'Usually a typo - the field saves to a property the code never reads.',
    fix: ['Correct the name in PropertyPaneXxx(\'name\', …) or add the property to the props interface.', 'Nested targets like "tile.size" are fine when "tile" is declared.'] },
  { id: 'PRP004', area: 'Properties', title: 'Localised string is never used', auto: 'partly',
    why: 'Dead strings make translation work bigger than it needs to be.', fix: ['Apply Fix removes it from mystrings.d.ts and every loc/*.js file.'] },

  // ---------------- Versions ----------------
  { id: 'VER001', area: 'Versions', title: 'Behind the latest SPFx', auto: 'no',
    why: 'Older versions miss fixes, security updates and new features; very old ones use the unsupported gulp toolchain.',
    fix: ['Run "SPFX Pretty: Version Check & Upgrade Assessment" for a step-by-step plan with effort.', 'For file-by-file changes: npx -p @pnp/cli-microsoft365@latest m365 spfx project upgrade --toVersion <latest> --output md'],
    learnMore: L + 'compatibility' },
  { id: 'VER002', area: 'Versions', title: 'SPFx packages on mixed, pre-release or ranged versions', auto: 'no',
    why: 'All @microsoft/sp-* packages must be exactly the same version. Ranges (^) and release candidates cause hard-to-trace build problems.',
    fix: ['Set every @microsoft/sp-* package to the same exact version (no ^ or ~).', 'npm install, then rebuild.'] },
  { id: 'VER003', area: 'Versions', title: 'React version does not match SPFx', auto: 'partly',
    why: 'Each SPFx version supports exactly one React version (SPFx 1.24 → React 18.3.1). A mismatch can fail silently at runtime.',
    fix: ['npm install react@<version> react-dom@<version> --save-exact', 'For React 18: switch ReactDom.render to createRoot(...).render() and unmountComponentAtNode to root.unmount().', 'Update @types/react and @types/react-dom to the same major.'],
    learnMore: L + 'react-18-upgrade' },
  { id: 'VER004', area: 'Versions', title: 'TypeScript outside the supported range', auto: 'no',
    why: 'The SPFx build only supports certain TypeScript versions.', fix: ['Install a TypeScript version inside the range shown.'] },
  { id: 'VER005', area: 'Versions', title: 'Node version not declared or unsupported', auto: 'partly',
    why: 'Without engines.node or .nvmrc people build with whatever Node they have, causing "works on my machine" problems.',
    fix: ['Apply the fix to add engines.node, or add a .nvmrc file.', 'Match the Azure DevOps NodeTool task to the same version.'] },
  { id: 'VER006', area: 'Versions', title: 'Gulp toolchain', auto: 'no',
    why: 'Gulp is unsupported from SPFx 1.24 - upgrading means migrating to Heft (gulpfile customisations move to Heft plugins).',
    fix: ['Follow Microsoft\'s gulp → Heft migration guide.', 'Change pipeline commands from gulp bundle/package-solution to npm run build.'],
    learnMore: L + 'toolchain/migrate-gulptoolchain-hefttoolchain' },
  { id: 'VER007', area: 'Versions', title: 'serve.json uses the SharePoint Online workbench', auto: 'no',
    why: 'The hosted workbench retires on 01/12/2026.', fix: ['Debug on a real page with the developer toolbar instead, and update initialPage in config/serve.json.'] },
  { id: 'VER008', area: 'Versions', title: '.yo-rc.json version differs from the packages', auto: 'no',
    why: 'Dependencies were upgraded by hand; "yo @microsoft/sharepoint" would add new components with the old version.',
    fix: ['Update "version" in .yo-rc.json to match @microsoft/sp-core-library.'] },
  { id: 'VER009', area: 'Versions', title: 'office-ui-fabric-react still used', auto: 'no',
    why: 'It was renamed @fluentui/react years ago.', fix: ['Change imports to @fluentui/react and swap the dependency, or remove it if nothing imports it.'] },
  { id: 'VER010', area: 'Versions', title: '@types/react does not match React', auto: 'no',
    why: 'Type definitions for a different React major give misleading errors (or hide real ones).', fix: ['Install @types/react and @types/react-dom for the same major, and update any resolutions/overrides pin.'] },
  { id: 'VER011', area: 'Versions', title: 'Legacy ReactDom.render on React 18', auto: 'no',
    why: 'ReactDom.render runs React 18 in React 17 mode - you miss concurrent features and get console warnings.',
    fix: ['Create one root per web part: this._root = createRoot(this.domElement); this._root.render(element);', 'In onDispose: this._root?.unmount();'], learnMore: L + 'react-18-upgrade' },

  // ---------------- About ----------------
  { id: 'ABT001', area: 'About', title: 'No About section in the property pane', auto: 'partly',
    why: 'Authors and support staff can\'t see the version, developer or loaded packages when something goes wrong.',
    fix: ['Apply Fix adds src/common/about/ (logo, title, version, developer, website, runtime packages) and wires aboutGroup(this.context.manifest) into the property pane.'] },
  { id: 'ABT002', area: 'About', title: 'About section values are out of date', auto: 'yes',
    why: 'The version / website / developer hard-coded in the About section no longer matches package-solution.json.', fix: ['Apply the fix to sync it.'] },

  // ---------------- Branding ----------------
  { id: 'BRD001', area: 'Branding', title: 'No theme variant support', auto: 'yes',
    why: 'Without supportsThemeVariants the web part renders a white box on coloured section backgrounds.', fix: ['Set "supportsThemeVariants": true, then handle theme changes (BRD002).'] },
  { id: 'BRD002', area: 'Branding', title: 'Theme changes not handled', auto: 'no',
    why: 'The web part opts in to section backgrounds but never reads the theme, so colours stay fixed.',
    fix: ['Override onThemeChanged() and push semanticColors into CSS variables.', 'Run "SPFX Pretty: Show Theme-Aware Web Part Snippet" for code tailored to your web part.'] },
  { id: 'BRD003', area: 'Branding', title: 'Hard-coded colour in SCSS', auto: 'yes',
    why: 'Fixed colours ignore the site theme and section backgrounds.', fix: ['Apply the fix to use a theme token.'],
    before: 'color: #0078d4;', after: 'color: "[theme:themePrimary, default: #0078d4]";' },
  { id: 'BRD004', area: 'Branding', title: 'Hard-coded font-family', auto: 'yes',
    why: 'Brand Center fonts chosen in Change the look won\'t apply.', fix: ['Apply the fix to use a Brand Center font slot.'],
    after: 'font-family: var(--fontFamilyCustomFont800, var(--fontFamilyBase));' },
  { id: 'BRD005', area: 'Branding', title: 'No Brand Center font used', auto: 'yes',
    why: 'The component never picks up the site\'s brand font.', fix: ['Apply the fix to add a Brand Center font to the root class.'] },
  { id: 'BRD006', area: 'Branding', title: 'Inline colour in TSX', auto: 'no',
    why: 'Inline colours ignore the theme (especially dark section backgrounds).', fix: ['Use semanticColors from the theme (e.g. theme.semanticColors.bodyText) or a CSS variable.'] },
  { id: 'BRD007', area: 'Branding', title: 'Fluent UI v9 without FluentProvider', auto: 'no',
    why: 'v9 controls use the default Microsoft blue instead of the site theme.', fix: ['Wrap your root component in <FluentProvider theme={…}> built from the SharePoint theme.'] },
];

export function ruleDoc(id: string): RuleDoc | undefined {
  return RULE_DOCS.find(r => r.id === id);
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const AUTO = { yes: 'Auto-fix available', partly: 'Guided fix (asks you)', no: 'Needs you' };

/** The FAQ page: index of all rules + the selected one expanded. */
export function renderFaqHtml(selected: string | undefined, nonce: string, cspSource: string): string {
  const areas = [...new Set(RULE_DOCS.map(r => r.area))];
  const card = (r: RuleDoc) => `<details class="rule" id="${r.id}" ${r.id === selected ? 'open' : ''} data-text="${esc((r.id + ' ' + r.title + ' ' + r.why).toLowerCase())}">
    <summary><code>${r.id}</code> ${esc(r.title)} <span class="auto ${r.auto}">${AUTO[r.auto]}</span></summary>
    <div class="body">
      <h4>Why it matters</h4><p>${esc(r.why)}</p>
      ${r.where ? `<h4>Where</h4><p><code>${esc(r.where)}</code></p>` : ''}
      <h4>How to fix</h4><ol>${r.fix.map(f => `<li>${esc(f)}</li>`).join('')}</ol>
      ${r.before ? `<h4>Before</h4><pre><code>${snippetHtml(r.before)}</code></pre>` : ''}${r.after ? `<h4>${r.before ? 'After' : 'Example'}</h4><pre><code>${snippetHtml(r.after)}</code></pre>` : ''}
      ${learnLinks(r.id, r.learnMore).length ? `<h4>Microsoft articles</h4><ul class="learn">${learnLinks(r.id, r.learnMore).map(l => `<li><a href="${esc(l.url)}">${esc(l.title)}</a></li>`).join('')}</ul>` : ''}
      ${ruleUrl(r.id) ? `<p><a href="${esc(ruleUrl(r.id)!)}">Open this page online</a></p>` : ''}
    </div></details>`;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} https: data:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>SPFX Pretty FAQ</title>
<style>
:root{--bg:var(--vscode-editor-background,#1f1f1f);--text:var(--vscode-foreground,#eee);--sub:var(--vscode-descriptionForeground,#aaa);--line:var(--vscode-panel-border,#444);--card:var(--vscode-sideBar-background,#262626);--accent:#2A6FDB}
body{margin:0;padding:20px 16px;background:var(--bg);color:var(--text);font:14px/1.5 "Segoe UI",system-ui,sans-serif}
.wrap{max-width:900px;margin:0 auto}h1{font-size:22px;margin:0 0 6px}.sub{color:var(--sub)}
input{width:100%;box-sizing:border-box;margin:14px 0;padding:8px 10px;border-radius:6px;border:1px solid var(--line);background:var(--card);color:var(--text);font:inherit}
h2{font-size:15px;margin:22px 0 8px;padding:6px 12px;background:linear-gradient(90deg,#2A8BD8,#2A6FDB 35%,#7B3FE4 75%,#15287F);color:#fff;border-radius:6px}
details.rule{border:1px solid var(--line);border-radius:6px;margin:6px 0;background:var(--card)}
details.rule[open]{border-color:var(--accent)}
summary{cursor:pointer;padding:8px 12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
summary code{font-size:12px;opacity:.8}
.auto{margin-left:auto;font-size:11px;border-radius:999px;padding:1px 8px;border:1px solid var(--line)}
.auto.yes{color:#54b054;border-color:#54b054}.auto.partly{color:#62abf5;border-color:#62abf5}.auto.no{color:#f7a35c;border-color:#f7a35c}
.body{padding:0 14px 10px}h4{margin:12px 0 4px;font-size:12.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--sub)}
pre{background:var(--bg);border:1px solid var(--line);border-radius:4px;padding:8px;white-space:pre-wrap;word-break:break-word;font-size:12.5px}
a{color:#62abf5}
ul.learn{margin:0;padding-left:20px}ul.learn li{margin:3px 0}
pre code{font:12.5px/1.5 Consolas,"Cascadia Code",monospace}
${SNIPPET_CSS}
body.vscode-dark .k{color:#7cb7ff}body.vscode-dark .s{color:#8bd5a5}body.vscode-dark .n{color:#f5b36b}body.vscode-dark .b{color:#c4a5ff}body.vscode-dark .p{color:#7d8696}
body.vscode-light .k{color:#2A6FDB}body.vscode-light .s{color:#0b7a4b}body.vscode-light .n{color:#b45309}body.vscode-light .b{color:#7B3FE4}body.vscode-light .p{color:#8a94a6}
</style></head><body><div class="wrap">
<h1>SPFX Pretty - FAQ</h1><div class="sub">What each finding means and how to fix it. ${RULE_DOCS.length} rules.</div>
<input id="q" placeholder="Search, e.g. icon, toolbox, React, SOL008" autofocus>
${areas.map(a => `<section data-area><h2>${esc(a)}</h2>${RULE_DOCS.filter(r => r.area === a).map(card).join('')}</section>`).join('')}
<p class="sub" style="text-align:center;margin-top:24px">SPFX Pretty by <a href="https://www.kachihro.com">Kachihro</a> &middot; <a href="https://github.com/kachihro/SPFX-Pretty">GitHub</a></p>
</div>
<script nonce="${nonce}">
const q=document.getElementById('q');
q.addEventListener('input',()=>{const t=q.value.toLowerCase().trim();document.querySelectorAll('details.rule').forEach(d=>{d.style.display=!t||d.dataset.text.includes(t)?'':'none';});document.querySelectorAll('section[data-area]').forEach(s=>{s.style.display=[...s.querySelectorAll('details.rule')].some(d=>d.style.display!=='none')?'':'none';});});
${selected ? `const el=document.getElementById(${JSON.stringify(selected)});if(el){el.scrollIntoView({block:'start'});}` : ''}
</script></body></html>`;
}

/** Markdown for docs/faq/<RULE>.md (for the website / repo). */
export function ruleMarkdown(r: RuleDoc): string {
  return [`# ${r.id}: ${r.title}`, '', `**Area:** ${r.area} · **${AUTO[r.auto]}**`, '', '## Why it matters', '', r.why, '',
    ...(r.where ? ['## Where', '', '`' + r.where + '`', ''] : []),
    '## How to fix', '', ...r.fix.map((f, i) => `${i + 1}. ${f}`), '',
    ...(r.before ? ['### Before', '', '```' + fence(r.before), formatSnippet(r.before).text, '```', ''] : []),
    ...(r.after ? [r.before ? '### After' : '### Example', '', '```' + fence(r.after), formatSnippet(r.after).text, '```', ''] : []),
    ...(learnLinks(r.id, r.learnMore).length ? ['## Microsoft articles', '', ...learnLinks(r.id, r.learnMore).map(l => `- [${l.title}](${l.url})`), ''] : []),
    '[All rules](README.md)', ''].join('\n');
}
