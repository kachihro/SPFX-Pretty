# Publishing SPFX Pretty to the VS Code Marketplace

Checked against `@vscode/vsce` 3.2.1 (the version this repo uses) on 17/11/2026.
Microsoft's guide: https://code.visualstudio.com/api/working-with-extensions/publishing-extension

## Before the first publish - decisions

| Item | Now | Needed for the Marketplace |
|---|---|---|
| `publisher` in package.json | `kachihro` ✅ | Must equal your Marketplace **publisher ID**. Extension ID: `kachihro.spfx-pretty`. |
| `LICENSE` | Free to use, proprietary ✅ | - |
| Website address | **not set yet** | Set `DOCS_SITE` in `src/core/site.ts` - `npm run publish-marketplace` refuses to publish until it is. |
| README images | Embedded in the VSIX README | Marketplace requires **HTTPS** image URLs (no `data:` images, no SVG). Host them on the help website and set `DOCS_SITE` in `src/core/site.ts` - the packaged README then uses `https://<site>/assets/before-after.png` automatically. |
| Repo links | Private GitHub repo | Links to a private repo ask visitors to sign in. Point readers at the help website instead (or make the repo public). |
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

## Private alternative (no Marketplace)

Keep sharing the `.vsix`: teammates install it with
`code --install-extension spfx-pretty-<version>.vsix`, or `npm run install-local` from a clone.
