# Publishing SPFX Pretty to the VS Code Marketplace

Checked against `@vscode/vsce` 4.1.1 (the version this repo uses; needs Node 22+) on 22/11/2026.
Microsoft's guide: https://code.visualstudio.com/api/working-with-extensions/publishing-extension

## Checklist

| Item | Now | Needed for the Marketplace |
|---|---|---|
| `publisher` in package.json | `kachihro` ✅ | Must equal your Marketplace **publisher ID**. Extension ID: `kachihro.spfx-pretty`. |
| `LICENSE` | MIT ✅ | - |
| Website address | `https://www.spfxpretty.com` ✅ | Set in `DOCS_SITE` (`src/core/site.ts`) - `npm run publish-marketplace` refuses to publish without it. |
| README images | Served from the website ✅ | Marketplace requires **HTTPS** image URLs (no `data:` images, no SVG). With `DOCS_SITE` set, the packaged README uses `https://<site>/assets/before-after.png` automatically. |
| Repo links | Public GitHub repo ✅ | `repository` / `bugs` in package.json point at https://github.com/kachihro/SPFX-Pretty - the Marketplace page shows them. |
| Icon | `media/icon.png`, 128x128 PNG | OK - PNG, at least 128x128, not SVG. |

## Release (GitHub Actions, trusted publishing)

No token or secret: the **Publish to Marketplace** workflow (`.github/workflows/publish.yml`) gets a short-lived
GitHub OIDC token and the Marketplace trusts it because of the publisher's Trusted Publishing policy.

1. Bump `version` in package.json (and package-lock.json) and add a CHANGELOG entry; commit and push.
2. Tag and push the tag - the workflow tests, packages and publishes:
   ```powershell
   git tag v0.9.6
   git push origin v0.9.6
   ```
   It can also be started by hand from the repo's **Actions** tab (**Run workflow**).

One-off setup (done): https://marketplace.visualstudio.com/manage > **Kachihro** > **Trusted Publishing** >
a **GitHub Actions** policy with owner `kachihro`, repository `SPFX-Pretty`, workflow `publish.yml`.
The workflow needs `permissions: id-token: write` and runs `npm run publish-marketplace -- --oidc`.
If the repo, the workflow file name or an environment changes, update the policy to match.

## Publish from your own machine

Needs Node 22+ (`nvm use 22.22.0`) and a Personal Access Token (Azure DevOps > User settings >
**Personal access tokens** > **New Token**, Organization **All accessible organizations**, scope **Marketplace > Manage**):

```powershell
npx vsce login kachihro            # paste the PAT once
npm run publish-marketplace        # builds the VSIX, checks images/links are public, publishes
```

Other useful commands:

```powershell
npx vsce publish --pre-release     # publish as a pre-release
npx vsce show kachihro.spfx-pretty # what the Marketplace has
npx vsce unpublish kachihro.spfx-pretty
```

## Without the Marketplace

Share the `.vsix` (it is also attached to each **Publish to Marketplace** workflow run): people install it with
`code --install-extension spfx-pretty-<version>.vsix`, or `npm run install-local` from a clone.
