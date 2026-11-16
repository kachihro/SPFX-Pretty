# Changelog

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
