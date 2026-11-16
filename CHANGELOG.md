# Changelog

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
- Scan Project, and clicking the SPFX-Pretty Activity Bar icon, open the report straight away (setting: spfxPretty.showReportAfterScan)

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
