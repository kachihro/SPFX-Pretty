# Changelog

## 0.9.2 - 17/11/2026
- Report section bars: description under the title; folded sections are one clean bar
- Marketplace page: more features and a second screenshot

## 0.9.1 - 17/11/2026
- Help website is live: https://victorious-sea-0bde5f710.8.azurestaticapps.net
- Marketplace page shows the before / after photo (served from the website)
- Every rule in the in-editor FAQ has an "Open online" link to its how-to-fix page

## 0.9.0 - 17/11/2026
- Ready for the VS Code Marketplace as kachihro.spfx-pretty (free to use licence)
- npm run publish-marketplace + a "Publish to Marketplace" GitHub workflow (on version tags), with checks that images and links are public
- Website and README: install from the Marketplace; building from source is for developers
- install-local removes the old ChrisOC.spfx-pretty copy
- Toolbox tiles draw the default SharePoint logo (Adaptive Card Extensions) instead of showing a broken image

## 0.8.1 - 17/11/2026
- Report issues are calm expandable rows (dot + short title): expand to see the explanation and exactly what will change, then Apply / Ignore / Help - no more walls of orange buttons
- Toolbox tiles are left-aligned and wider
- Ignore from the report asks once, then adds the rule to this workspace's Disabled Rules

## 0.8.0 - 17/11/2026
- Nothing changes without you seeing it: every fix shows what it will change (file, lines before/after, files created) and waits for Apply. Fix all lists every change first. Setting: spfxPretty.previewFixes
- Report section bars: chevron, an icon per section, one font
- Toolbox tiles draw the default "Page" icon instead of printing its name; short button labels (full text on hover)
- Help website generator (npm run site) with a page per rule, plus an Azure Static Web Apps workflow
- docs/PUBLISHING.md: how to publish to the VS Code Marketplace

## 0.7.4 - 17/11/2026
- Before / after photo on the extension page, embedded so it shows even though the repo is private
- Examples use project-client-side-solution instead of hello-world

## 0.7.3 - 17/11/2026
- Kachihro theme: icon and report use the Kachihro blue / violet / navy palette; default brand colour #2A6FDB
- Cleaner icon frame (no bulge around the SPFX label)
- About: extension homepage, README, report and FAQ footers link to kachihro.com

## 0.7.2 - 17/11/2026
- New icons in the M365 style: a magic wand with sparkles over an "SPFX" label (Activity Bar and extension page)

## 0.7.1 - 17/11/2026
- Source on GitHub: https://github.com/kachihro/SPFX-Pretty
- README screenshot and links point at GitHub, so they work on any extension page
- npm run install-local builds and installs the extension in one step

## 0.7.0 - 17/11/2026
- Fix Step by Step: walks through every issue, worst first - fix, explain, open, skip or ignore each one
- FAQ: what every finding means and how to fix it (54 rules), with search; "Explain & How to Fix" on every item and "? Explain" in the report
- docs/faq/*.md generated for the website (npm run docs)
- Upload company icon straight from the icon fix; the generated placeholder icon is flagged until you do

## 0.6.2 - 17/11/2026
- New setting spfxPretty.location: Activity Bar, Explorer sidebar (next to Outline / Timeline) or both
- New command "SPFX Pretty: Show Findings Panel" jumps to it wherever it is
- New Activity Bar icon in the M365 style: web part tiles with an "SPFx" label

## 0.6.1 - 17/11/2026
- Examples in settings, docs and hints use Kachihro

## 0.6.0 - 17/11/2026
- Renamed to "SPFX Pretty" (no hyphen) everywhere you see it; the extension ID stays spfx-pretty so it updates in place
- Transparent black/white box-shadows are no longer reported as hard-coded colours
- "Write..." fixes ask for the text (short/long description, categories, web part description) and save it
- "Choose toolbox group..." lists the 7 modern sections, plus a company group name for classic pages
- Tree rows show the fix next to each finding; "How to Fix" for items that need you
- Report: items that need you are buttons that open the exact file, instead of "N need a human touch"

## 0.5.3 - 17/11/2026
- Report screenshot embedded in the README so it shows on the installed extension page

## 0.5.2 - 17/11/2026
- Shorter extension page with a report screenshot; full rule list moved to docs/RULES.md

## 0.5.1 - 17/11/2026
- Report sections all use the same blue panel and are collapsible (click the header); Expand all / Collapse all; collapsed state survives refreshes

## 0.5.0 - 17/11/2026
- Fix buttons inside the report panels: App Catalog, each toolbox tile, each property pane card, versions
- "Fix all (N)" on each section header applies that section's safe fixes

## 0.4.0 - 17/11/2026
- Report: coloured section panels with header bars and counts, sticky jump bar, colour-coded check groups
- Property pane preview labels each default value with its property name and flags a missing About section
- Header shows the installed SPFx version (not the .yo-rc.json scaffold version)
- Unused office-ui-fabric-react dependency is reported as "remove it"

## 0.3.1 - 17/11/2026
- Scan Project, and clicking the SPFX Pretty Activity Bar icon, open the report straight away (setting: spfxPretty.showReportAfterScan)

## 0.3.0 - 17/11/2026
- Own Activity Bar icon with an errors + warnings badge
- Severity filter (All / Errors + warnings / Errors only), remembered per workspace
- Right-click per item: Apply Fix..., Open, Copy Message, Ignore This Rule; Fix All in This Group
- New fixes: remove unused loc strings (d.ts + every loc/*.js) and unused properties (interface + manifest default)
- Fewer false positives: nested property pane targets (tile.size), unused loc strings not reported as visible defaults

## 0.2.0 - 16/11/2026
- "Where people see your app" previews: App Catalog row, Add an app tile, Site Contents, toolbox, property pane
- Defaults, Properties, Versions and About checks; upgrade assessment (Markdown + CLI for Microsoft 365 command)
- Upload Company Logo (App Catalog, Teams, toolbox); existing project logos are reused
- Brand-aware title suggestions; custom toolbox groupIds flagged (they fall back to Advanced)
- Rules follow custom base classes and scan shared code (src/common)

## 0.1.0 - 16/11/2026
- First release: App Catalog title checks, .sppkg / toolbox / command / Teams icon generation,
  theme variant + Brand Center font branding checks, App Catalog preview report, CLI for pipelines.
