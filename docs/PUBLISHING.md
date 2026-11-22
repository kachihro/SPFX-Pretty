# Publishing SPFX Pretty to the VS Code Marketplace

Checked against `@vscode/vsce` 3.2.1 (the version this repo uses) on 17/11/2026.
Microsoft's guide: https://code.visualstudio.com/api/working-with-extensions/publishing-extension

## Before the first publish - decisions

| Item | Now | Needed for the Marketplace |
|---|---|---|
| `publisher` in package.json | `kachihro` ✅ | Must equal your Marketplace **publisher ID**. Extension ID: `kachihro.spfx-pretty`. |
| `LICENSE` | MIT ✅ | - |
| Website address | `https://www.spfxpretty.com` ✅ | Set in `DOCS_SITE` (`src/core/site.ts`) - `npm run publish-marketplace` refuses to publish without it. |
| README images | Served from the website ✅ | Marketplace requires **HTTPS** image URLs (no `data:` images, no SVG). With `DOCS_SITE` set, the packaged README uses `https://<site>/assets/before-after.png` automatically. |
| Repo links | Public GitHub repo ✅ | `repository` / `bugs` in package.json point at https://github.com/kachihro/SPFX-Pretty - the Marketplace page shows them. |
| Icon | `media/icon.png`, 128x128 PNG | OK - PNG, at least 128x128, not SVG. |

## One-off setup

1. **Create a publisher**: https://marketplace.visualstudio.com/manage - sign in with your Microsoft account, **Create publisher**, choose an ID (e.g. `kachihro`) and display name (`Kachihro`).
2. **Create a Personal Access Token (PAT)** in Azure DevOps (any organisation you belong to, e.g. https://dev.azure.com/kachihro):
   - User settings (top right) > **Personal access tokens** > **New Token**
   - **Organization: All accessible organizations** (vsce fails with 401 otherwise)
   - **Scopes: Custom defined > Marketplace > Manage**
   - Copy the token - it is shown once.
4. Check the token works:
   ```powershell
   npx vsce verify-pat kachihro
   ```

## Publish

```powershell
npx vsce login kachihro            # paste the PAT once
npm run publish-marketplace        # builds the VSIX, checks images/links are public, publishes
```

Or let GitHub do it: add the PAT as the repository secret `VSCE_PAT`, bump the version in package.json, then
`git tag v0.9.0; git push origin v0.9.0` - the **Publish to Marketplace** workflow tests, packages and publishes.

Other useful commands:

```powershell
npx vsce publish patch             # bump 0.8.0 -> 0.8.1 and publish
npx vsce publish --pre-release     # publish as a pre-release
npx vsce show kachihro.spfx-pretty # what the Marketplace has
npx vsce unpublish kachihro.spfx-pretty
```

## Publish from GitHub Actions

Add the PAT as a repository secret named `VSCE_PAT` (vsce reads it automatically), then a release step can run:

```yaml
- run: npm ci && npm run package
- run: npx vsce publish -i spfx-pretty-*.vsix
  env:
    VSCE_PAT: ${{ secrets.VSCE_PAT }}
```

## Without the Marketplace

Share the `.vsix` (it is also attached to each **Publish to Marketplace** workflow run): people install it with
`code --install-extension spfx-pretty-<version>.vsix`, or `npm run install-local` from a clone.
