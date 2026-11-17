# Changelog

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
