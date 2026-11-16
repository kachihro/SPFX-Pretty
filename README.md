# SPFX-Pretty ✨

Make your SharePoint Framework solutions look great **everywhere people see them**: the App Catalog, the web part toolbox, the list command bar, Teams, and inside the web part itself.

SPFX-Pretty scans every SPFx project in your workspace, shows what isn't "nice" yet, and fixes most of it for you.

## What it checks

| Area | Rule | What it looks for | Auto-fix |
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
| | CMP006 | Not in your organisation's toolbox group (when `spfxPretty.toolboxGroup` is set) | ✅ |
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

### Defaults, properties, versions and About (v0.2)

| Area | Rule | What it looks for | Auto-fix |
|---|---|---|---|
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
| **Toolbox** | CMP006 | Custom `groupId` - the modern toolbox ignores it and shows the web part under **Advanced** | ✅ move to one of the 7 predefined groups |

Brand spellings ("PlanB", "SharePoint") are learnt from your developer name and existing nice titles, so suggestions keep your casing.

Each component type is handled on its own terms:
- **Web Parts**: toolbox title, description, icon, group, Teams icons, theme variants, Brand Center fonts
- **Adaptive Card Extensions**: toolbox title, description, icon (catches the default SharePoint logo)
- **ListView Command Sets**: command labels and 16x16 command bar icons
- **Application / Field / Form Customizers**: branding in their SCSS (they don't appear in a toolbox)

## Commands

All commands are under **SPFX-Pretty** in the Command Palette (`Ctrl+Shift+P`):

- **Scan Project**: refresh the Problems panel and the *SPFX-Pretty* view in the Explorer
- **Show App Catalog Preview & Report**: what your app looks like in the catalog and toolbox, a niceness score, and one-click fixes
- **Make Titles Nice**: walks through every visible title (catalog, toolbox, commands) with a suggestion you can tweak
- **Generate Icons**: pick a brand colour, then generate the .sppkg icon, toolbox SVGs, command icons and Teams icons
- **Apply All Safe Fixes**: everything that doesn't need a human
- **Upload Company Logo**: pick a PNG once - it becomes the App Catalog / Add an app / Site Contents icon (96x96), the Teams colour + outline icons, and optionally toolbox icons. It's remembered for every project.
- **Version Check & Upgrade Assessment**: a Markdown plan (current vs latest, React/Node/TypeScript, steps with effort) ready for a DevOps PBI, plus the CLI for Microsoft 365 command for the file-by-file report
- **Show Theme-Aware Web Part Snippet**: `onThemeChanged()` + CSS variables + Brand Center SCSS, tailored to your web part (React 17 or 18, with or without Fluent v9)

Quick fixes also appear on the lightbulb (`Ctrl+.`) right in the manifest or SCSS file.

### Snippets
- `spfx-theme-changed`, `spfx-theme-provider` (TypeScript)
- `spfx-theme-color`, `spfx-brand-font` (SCSS)

## Settings

| Setting | Purpose |
|---|---|
| `spfxPretty.brandColour` | Colour for generated icons (default `#0F6CBD`) |
| `spfxPretty.toolboxGroup` | Your organisation's toolbox group name |
| `spfxPretty.developer.*` | Name, website, privacy, terms, MPN ID used to fill the developer block |
| `spfxPretty.disabledRules` | Rule IDs to skip |
| `spfxPretty.scanOnSave` | Re-scan when manifests / styles are saved |

### Per-project config: `.spfxprettyrc.json`
Commit this to the repo so the whole team (and the pipeline) agree:

```json
{
  "brandColour": "#7A3E9D",
  "toolboxGroup": "Contoso Tools",
  "developer": {
    "name": "Contoso",
    "websiteUrl": "https://contoso.example",
    "privacyUrl": "https://contoso.example/privacy",
    "termsOfUseUrl": "https://contoso.example/terms"
  },
  "disabledRules": ["SOL008"]
}
```

## CLI (Azure DevOps / GitHub Actions)

The same engine ships as a CLI:

```powershell
npx spfx-pretty . --min-score 80 --fail-on warning --html $(Build.ArtifactStagingDirectory)\spfx-pretty.html
```

Options: `--fix` (apply safe fixes), `--json`, `--html <file>`, `--upgrade-md <file>`, `--company-icon <logo.png>`, `--online` or `--latest <version>`, `--min-score <n>`, `--fail-on error|warning|info`.

Azure DevOps step:

```yaml
- pwsh: |
    npx --yes spfx-pretty . --min-score 70 --html "$(Build.ArtifactStagingDirectory)/spfx-pretty.html"
  displayName: 'SPFX-Pretty checks'
- publish: $(Build.ArtifactStagingDirectory)/spfx-pretty.html
  artifact: spfx-pretty-report
```

## Building

```powershell
npm install
npm test           # unit tests against test-fixtures/ugly-solution
npm run package    # produces spfx-pretty-0.1.0.vsix
code --install-extension .\spfx-pretty-0.1.0.vsix
```

## Notes
- `solution.iconPath` is resolved relative to `paths.packageDir` (default `./sharepoint`), so the generated icon goes to `sharepoint/images/AppIcon.png`.
- Toolbox icons render at 40x28. Generated icons are SVG data URIs, so they stay sharp at any DPI and need no deployment.
- If both `officeFabricIconFontName` and `iconImageUrl` are set, SharePoint uses the Fluent icon. SPFX-Pretty removes the Fluent name when it sets an image.
- Manifest edits preserve comments and formatting (JSONC-aware).
