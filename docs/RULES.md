# SPFX Pretty rules

Every rule can be switched off with `spfxPretty.disabledRules` (settings) or `disabledRules` in `.spfxprettyrc.json`,
or by right-clicking a finding > **Ignore This Rule**.

✅ = auto-fix · ✍️ = needs you (suggestions offered where possible) · 📋 = snippet / plan

| Area | Rule | What it looks for | Fix |
|---|---|---|---|
| **App Catalog title** | SOL001 | `solution.name` still `hello-world-client-side-solution`, kebab/Pascal case, too long | ✅ Renames to a nice title |
| | SOL002 | Optional `solution.title` not nice | ✅ |
| | SOL003 | Feature title still `xxx Feature` (Manage site features) | ✅ |
| **Metadata** | SOL004 | `developer` block empty (name, website, privacy, terms) | ✅ From your settings |
| | SOL005/006 | Short/long description missing or placeholder (`hello-world description`) | ✍️ Needs you |
| | SOL007/008 | No categories / screenshots | ✍️ |
| | SOL013 | Solution version out of sync with `package.json` | ✅ (opt-in) |
| **.sppkg icon** | SOL010-012 | No `iconPath`, file missing from `./sharepoint`, wrong size/format | ✅ Generates a 96x96 brand PNG |
| **Toolbox** | CMP001 | Web part / ACE title like `HelloWorld` or `team-news-web-part` | ✅ |
| | CMP002 | Description (toolbox tooltip) is a placeholder | ✍️ |
| | CMP003 | No icon, or still the generator's default `Page` icon / SharePoint logo | ✅ SVG brand icon (initials or type glyph) or a suggested Fluent icon |
| | CMP004 | Both `officeFabricIconFontName` **and** `iconImageUrl` set (the Fluent icon wins, so your image is ignored) | ✅ |
| | CMP005 | `http://` icon (mixed content) | ✅ |
| | CMP006 | Custom `groupId` - the modern toolbox ignores it and shows the web part under **Advanced** | ✅ move to one of the 7 predefined groups |
| **Command sets** | CMD001 | Command label `Command One` / `approve_item` | ✅ |
| | CMD002 | Command has no icon (command bar shows text only) | ✅ |
| **Teams** | TMS001/002 | Web part exposed to Teams without `teams/{id}_color.png` (192x192) + `_outline.png` (32x32) | ✅ Generates both |
| **Branding** | BRD001 | Web part doesn't set `supportsThemeVariants` (white box on coloured sections) | ✅ |
| | BRD002 | Opted in, but no `onThemeChanged()` / ThemeProvider handling | 📋 Tailored snippet |
| | BRD003 | Hard-coded colours in SCSS | ✅ `"[theme:bodyText, default: #333]"` tokens |
| | BRD004 | Hard-coded `font-family` | ✅ Brand Center slot, e.g. `var(--fontFamilyCustomFont1300, var(--fontFamilyBase))` |
| | BRD005 | Component never references a Brand Center font | ✅ Adds one to the root class |
| | BRD006 | Inline colours in TSX (`style={{ color: '#333' }}`) | ✍️ |
| | BRD007 | Fluent UI v9 installed but no `<FluentProvider>` | 📋 Snippet |
| **Defaults** | DEF001 | Default property values like `"description": "HelloWorld"` shown the moment a web part is added | ✅ |
| | DEF002 | Property pane text still "Description" / "Group Name" / "Description Field" | ✍️ suggestions |
| | DEF003 | Feature description "The feature that activates elements of the x solution." | ✅ |
| | DEF004 | No `zippedPackage` (file becomes `ClientSolution.sppkg`) | ✅ |
| | DEF005/006 | Extension Titles in elements.xml / ClientSideInstance.xml, and the generator's **"Test message"** alert still registered | ✅ / ✍️ |
| **Properties** | PRP001 | Property declared in the props interface but never read or shown | ✍️ |
| | PRP002 | Manifest default for a property the code doesn't know | ✍️ |
| | PRP003 | Property pane field targeting a property that doesn't exist (typo) | ✍️ |
| | PRP004 | Unused localised strings | ✍️ |
| **Versions** | VER001 | How far behind the latest SPFx (bundled table, or npm when online) | 📋 assessment |
| | VER002 | Mixed / release-candidate / ranged `@microsoft/sp-*` versions | ✍️ |
| | VER003 | React not exactly the version this SPFx needs (e.g. React 17 on SPFx 1.24 → needs 18.3.1) | ✍️ |
| | VER004/005 | TypeScript / Node outside the supported range; no Node version declared | ✅ engines |
| | VER006 | Gulp toolchain (unsupported from SPFx 1.24) | 📋 |
| | VER007 | serve.json uses the Online workbench (retires 01/12/2026) | ✍️ |
| | VER008-011 | .yo-rc drift, office-ui-fabric-react, @types/react mismatch, legacy ReactDom.render on React 18 | ✍️ |
| **About** | ABT001 | Web part has no About section in the property pane | ✅ generates one (logo, title, version, developer, website, runtime packages) |
| | ABT002 | Hard-coded About version / website / developer drifted from package-solution.json | ✅ |
| **About** | ABT001 | Web part has no About section in the property pane | ✅ generates one |
| | ABT002 | About version / website / developer drifted from package-solution.json | ✅ |

## Per-project config: `.spfxprettyrc.json`

```json
{
  "brandColour": "#7A3E9D",
  "appNamePrefix": "PlanB - ",
  "brandWords": ["PlanB"],
  "toolboxGroup": "Discovery",
  "companyIcon": "sharepoint/assets/planb-logo.png",
  "developer": {
    "name": "Plan B Consulting",
    "websiteUrl": "https://www.planbconsulting.com.au/",
    "privacyUrl": "https://www.planbconsulting.com.au/",
    "termsOfUseUrl": "https://www.planbconsulting.com.au/"
  },
  "disabledRules": ["SOL008"]
}
```

## CLI (Azure DevOps / GitHub Actions)

```powershell
npx spfx-pretty . --min-score 70 --fail-on error --html report.html --upgrade-md upgrade.md
```

Options: `--fix`, `--json`, `--html <file>`, `--upgrade-md <file>`, `--company-icon <logo.png>`,
`--online` or `--latest <version>`, `--min-score <n>`, `--fail-on error|warning|info`.

```yaml
- pwsh: npx --yes spfx-pretty . --min-score 70 --html "$(Build.ArtifactStagingDirectory)/spfx-pretty.html"
  displayName: SPFX Pretty checks
- publish: $(Build.ArtifactStagingDirectory)/spfx-pretty.html
  artifact: spfx-pretty-report
```

## Notes
- `solution.iconPath` is relative to `paths.packageDir` (default `./sharepoint`).
- Toolbox icons render at 40x28; generated ones are SVG data URIs (sharp at any DPI, nothing to deploy).
- If both `officeFabricIconFontName` and `iconImageUrl` are set, SharePoint uses the Fluent icon.
- Only the 7 predefined `groupId`s get a modern toolbox section; anything else lands in **Advanced**.
- Version data comes from Microsoft Learn's SPFx compatibility reference (checked 16/11/2026); `--online` asks npm for the latest release.
