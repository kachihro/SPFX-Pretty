import * as fs from 'fs';
import * as path from 'path';
import { RuleContext } from './context';
import { isPlaceholderDescription, titleProblems } from '../titles';
import { makePngIcon, readPngSize } from '../icons';
import { Fix } from '../types';
import { companyIconSet } from '../imageTools';
import { JsoncDoc } from '../jsonc';
import { cmp } from '../versions';

export const APP_ICON_SIZE = 96;
export const APP_ICON_RELATIVE = 'images/AppIcon.png';

/**
 * Rules for config/package-solution.json - this is what people see in the
 * tenant App Catalog / "Apps for SharePoint" and the "Add an app" page.
 */
export function solutionRules(ctx: RuleContext): void {
  const { solutionDoc: doc, solution, config, root, packageJson } = ctx.project;
  if (!doc || !solution) { return; }
  const file = doc.file;

  // ---- SOL001: Solution name (the App Catalog title) ----
  const name: string | undefined = solution.name;
  const problems = titleProblems(name);
  if (problems.length) {
    const nice = `${config.appNamePrefix ?? ''}${ctx.nice(name || path.basename(root))}`;
    const fixes: Fix[] = [{ title: `Rename solution to "${nice}"`, safe: true, edits: doc.set(['solution', 'name'], nice) }];
    ctx.issue({
      ruleId: 'SOL001', severity: 'warning', category: 'Title', file, ...doc.locate(['solution', 'name']),
      message: `App name "${name ?? ''}" ${problems.join(', ')} - this is exactly what people read in the App Catalog and Site Contents.`,
      detail: 'solution.name is the app title in the App Catalog, "Add an app" and Site Contents. Changing it is safe - SharePoint tracks the package by solution.id. Upload the new .sppkg over the old one to update the title.',
      fixes,
    });
  } else {
    ctx.pass('SOL001', 'Title', `App Catalog title "${name}" looks nice`, file, undefined, 3);
  }

  // ---- SOL002: optional solution.title should agree with the name ----
  const title = doc.get(['solution', 'title']);
  if (typeof title === 'string' && titleProblems(title).length) {
    const nice = ctx.nice(title);
    ctx.issue({
      ruleId: 'SOL002', severity: 'info', category: 'Title', file, ...doc.locate(['solution', 'title']),
      message: `solution.title "${title}" ${titleProblems(title).join(', ')}.`,
      fixes: [{ title: `Set solution.title to "${nice}"`, safe: true, edits: doc.set(['solution', 'title'], nice) }],
    });
  }

  // ---- SOL003: features[].title / description ----
  const features: any[] = doc.get(['solution', 'features']) ?? [];
  features.forEach((f, i) => {
    const ft: string | undefined = f?.title;
    if (ft && (/client-side-solution/i.test(ft) || /^[a-z0-9-]+ Feature$/.test(ft))) {
      const nice = `${ctx.nice(name && !titleProblems(name).length ? name : ft)} Feature`;
      ctx.issue({
        ruleId: 'SOL003', severity: 'info', category: 'Title', file, ...doc.locate(['solution', 'features', i, 'title']),
        message: `Feature title "${ft}" is the generator default (visible in Site Settings > Manage site features).`,
        fixes: [{ title: `Rename feature to "${nice}"`, safe: true, edits: doc.set(['solution', 'features', i, 'title'], nice) }],
      });
    }
  });

  // ---- SOL004: developer block ----
  const dev = doc.get(['solution', 'developer']) ?? {};
  const devMissing = ['name', 'websiteUrl', 'privacyUrl', 'termsOfUseUrl'].filter(k => !dev[k]);
  if (devMissing.length) {
    const fromSettings = config.developer;
    const merged = {
      name: dev.name || fromSettings.name || '',
      websiteUrl: dev.websiteUrl || fromSettings.websiteUrl || '',
      privacyUrl: dev.privacyUrl || fromSettings.privacyUrl || '',
      termsOfUseUrl: dev.termsOfUseUrl || fromSettings.termsOfUseUrl || '',
      mpnId: dev.mpnId || fromSettings.mpnId || `Undefined-${ctx.project.spfxVersion ?? '1.0.0'}`,
    };
    const canFill = devMissing.some(k => (merged as any)[k]);
    ctx.issue({
      ruleId: 'SOL004', severity: 'warning', category: 'Metadata', file, ...doc.locate(['solution', 'developer']),
      message: `Developer details missing: ${devMissing.join(', ')}.`,
      detail: 'The developer block is shown on the app details page in the App Catalog and is required for Teams / Viva Connections. Set your defaults once in Settings > SPFX-Pretty > Developer (or .spfxprettyrc.json).',
      fixes: canFill ? [{ title: 'Fill developer details from SPFX-Pretty settings', safe: true, edits: doc.set(['solution', 'developer'], merged) }] : [],
    });
  } else {
    ctx.pass('SOL004', 'Metadata', `Developer details set (${dev.name})`, file);
  }

  // ---- SOL005/006: metadata descriptions ----
  const shortDesc = solution.shortDescription;
  if (isPlaceholderDescription(shortDesc, name)) {
    ctx.issue({
      ruleId: 'SOL005', severity: 'warning', category: 'Metadata', file, ...doc.locate(['solution', 'metadata', 'shortDescription', 'default']),
      message: shortDesc ? `Short description "${shortDesc}" looks like a placeholder.` : 'No short description - the App Catalog tile will be blank under the title.',
      detail: 'solution.metadata.shortDescription.default appears under the title in the App Catalog. One friendly sentence is perfect.',
      fixes: shortDesc === undefined && packageJson?.description
        ? [{ title: 'Use the package.json description', safe: false, edits: doc.set(['solution', 'metadata', 'shortDescription'], { default: packageJson.description }) }]
        : [],
    });
  } else {
    ctx.pass('SOL005', 'Metadata', 'Short description set', file);
  }
  const longDesc = solution.longDescription;
  if (isPlaceholderDescription(longDesc, name) || longDesc === shortDesc) {
    ctx.issue({
      ruleId: 'SOL006', severity: 'info', category: 'Metadata', file, ...doc.locate(['solution', 'metadata', 'longDescription', 'default']),
      message: longDesc === shortDesc && longDesc ? 'Long description is the same as the short description.' : 'Long description is missing or a placeholder.',
      detail: 'Shown on the app details page. Describe what it does, who it is for, and any setup needed.',
    });
  } else {
    ctx.pass('SOL006', 'Metadata', 'Long description set', file, undefined, 1);
  }
  if (!solution.categories.length) {
    ctx.issue({
      ruleId: 'SOL007', severity: 'info', category: 'Metadata', file, ...doc.locate(['solution', 'metadata', 'categories']),
      message: 'No categories - add at least one so people can filter for it.',
    });
  }
  const screenshots = doc.get(['solution', 'metadata', 'screenshotPaths']);
  if (!Array.isArray(screenshots) || screenshots.length === 0) {
    ctx.issue({
      ruleId: 'SOL008', severity: 'info', category: 'Metadata', file, ...doc.locate(['solution', 'metadata', 'screenshotPaths']),
      message: 'No screenshots on the app details page (solution.metadata.screenshotPaths).',
    });
  }

  // ---- SOL010-012: the .sppkg icon ----
  const packageDirRel: string = doc.get(['paths', 'packageDir']) ?? 'sharepoint';
  const packageDir = path.join(root, packageDirRel);
  const iconFixes = (generatedTitle: string): Fix[] => {
    // Write our own file so an existing source asset (e.g. assets/planb-logo.png) is never overwritten
    const iconRel = solution.iconPath && !solution.iconFile ? solution.iconPath : APP_ICON_RELATIVE;
    const target = path.join(packageDir, iconRel);
    const fixes: Fix[] = [];
    const setPath = (rel: string) => solution.iconPath === rel ? [] : doc.set(['solution', 'iconPath'], rel);
    // 1. The company logo from settings / .spfxprettyrc.json, resized to 96x96
    const logo = companyLogo(root, config.companyIcon);
    if (logo) {
      try {
        const png = companyIconSet(fs.readFileSync(logo)).app96;
        fixes.push({ title: `Use company logo (${path.basename(logo)}) as the ${APP_ICON_SIZE}x${APP_ICON_SIZE} app icon`, safe: true,
          edits: setPath(iconRel), creates: [{ file: target, content: png.toString('base64'), encoding: 'base64' }] });
      } catch { /* unreadable logo: fall through to the other options */ }
    }
    // 2. A logo already in the project (e.g. sharepoint/assets/planb-logo.png)
    for (const found of existingLogos(root, packageDir)) {
      const size = readPngSize(fs.readFileSync(found));
      if (!size || size.width !== size.height) { continue; }
      const rel = path.relative(packageDir, found).replace(/\\/g, '/');
      if (!rel.startsWith('..') && size.width === APP_ICON_SIZE) {
        fixes.push({ title: `Use existing ${path.basename(found)} (${size.width}x${size.height})`, safe: true, edits: setPath(rel) });
      } else {
        const png = companyIconSet(fs.readFileSync(found)).app96;
        fixes.push({ title: `Use existing ${path.basename(found)} resized to ${APP_ICON_SIZE}x${APP_ICON_SIZE}`, safe: true,
          edits: setPath(iconRel), creates: [{ file: target, content: png.toString('base64'), encoding: 'base64' }] });
      }
      break;
    }
    // 3. A generated brand-colour icon
    const png = makePngIcon({ size: APP_ICON_SIZE, colour: config.brandColour, glyph: 'package', rounded: true });
    fixes.push({ title: generatedTitle, safe: fixes.length === 0, edits: setPath(iconRel), creates: [{ file: target, content: png.toString('base64'), encoding: 'base64' }] });
    return fixes;
  };
  if (!solution.iconPath) {
    ctx.issue({
      ruleId: 'SOL010', severity: 'warning', category: 'Icon', file, ...doc.locate(['solution', 'iconPath']),
      message: 'No app icon - the App Catalog, "Add an app" and Site Contents all show the generic placeholder.',
      detail: `Set solution.iconPath (relative to ./${packageDirRel}) to a ${APP_ICON_SIZE}x${APP_ICON_SIZE} PNG.`,
      fixes: iconFixes(`Generate a ${APP_ICON_SIZE}x${APP_ICON_SIZE} brand-colour icon at ${packageDirRel}/${APP_ICON_RELATIVE}`),
    });
  } else if (!solution.iconFile) {
    const rootLevel = fs.existsSync(path.join(root, solution.iconPath));
    ctx.issue({
      ruleId: 'SOL011', severity: 'error', category: 'Icon', file, ...doc.locate(['solution', 'iconPath']),
      message: `Icon "${solution.iconPath}" not found in ./${packageDirRel}/ - packaging will fail or show no icon.`,
      detail: rootLevel ? `The file exists at the project root, but iconPath is resolved relative to ./${packageDirRel}. Move it to ./${packageDirRel}/${solution.iconPath}.` : undefined,
      fixes: iconFixes('Generate a brand-colour icon at that path'),
    });
  } else {
    const ext = path.extname(solution.iconFile).toLowerCase();
    const size = ext === '.png' ? readPngSize(fs.readFileSync(solution.iconFile)) : undefined;
    if (ext !== '.png' && ext !== '.jpg' && ext !== '.jpeg') {
      ctx.issue({ ruleId: 'SOL012', severity: 'warning', category: 'Icon', file, ...doc.locate(['solution', 'iconPath']),
        message: `App icon is ${ext} - use a PNG for the App Catalog.` });
    } else if (size && (size.width !== size.height || size.width < APP_ICON_SIZE)) {
      ctx.issue({
        ruleId: 'SOL012', severity: 'info', category: 'Icon', file, ...doc.locate(['solution', 'iconPath']),
        message: `App icon is ${size.width}x${size.height}; ${APP_ICON_SIZE}x${APP_ICON_SIZE} (square) looks crisp in the catalog.`,
        fixes: iconFixes(`Replace with a generated ${APP_ICON_SIZE}x${APP_ICON_SIZE} brand-colour icon`),
      });
    } else {
      ctx.pass('SOL010', 'Icon', `App Catalog icon ${solution.iconPath}${size ? ` (${size.width}x${size.height})` : ''}`, file, undefined, 3);
    }
  }

  // ---- SOL013: version in sync with package.json (never suggest a downgrade) ----
  const pv: string | undefined = packageJson?.version;
  if (pv && solution.version && !solution.version.startsWith(pv.split('-')[0])) {
    const pv3 = pv.split('-')[0];
    const sol3 = solution.version.split('.').slice(0, 3).join('.');
    const pkgDoc = new JsoncDoc(path.join(root, 'package.json'));
    const solutionNewer = cmp(sol3, pv3) > 0;
    ctx.issue({
      ruleId: 'SOL013', severity: 'info', category: 'Metadata', file, ...doc.locate(['solution', 'version']),
      message: solutionNewer
        ? `package.json is ${pv} but the solution is ${solution.version} - web part manifests use "version": "*", so web parts report ${pv} while the App Catalog shows ${solution.version}.`
        : `Solution version ${solution.version} is behind package.json ${pv} - the App Catalog shows the solution version.`,
      fixes: solutionNewer
        ? [{ title: `Set package.json version to ${sol3}`, safe: false, edits: pkgDoc.set(['version'], sol3) }]
        : [{ title: `Set solution version to ${pv3}.0`, safe: false, edits: doc.set(['solution', 'version'], `${pv3}.0`) }],
    });
  }
}

/** Resolve the configured company logo (absolute, or relative to the project). */
export function companyLogo(root: string, configured?: string): string | undefined {
  if (!configured) { return undefined; }
  const p = path.isAbsolute(configured) ? configured : path.join(root, configured);
  return fs.existsSync(p) && /\.png$/i.test(p) ? p : undefined;
}

/** PNG logos already in the project, best candidates first. */
export function existingLogos(root: string, packageDir: string): string[] {
  const dirs = [path.join(packageDir, 'images'), path.join(packageDir, 'assets'), path.join(root, 'assets'), path.join(root, 'src', 'assets'), path.join(root, 'src', 'common', 'assets'), path.join(root, 'images')];
  const found: string[] = [];
  for (const d of dirs) {
    if (!fs.existsSync(d)) { continue; }
    for (const f of fs.readdirSync(d)) {
      if (/\.png$/i.test(f) && /(logo|icon|brand)/i.test(f) && !/_(color|outline)\.png$/i.test(f)) { found.push(path.join(d, f)); }
    }
  }
  return found.sort((a, b) => Number(/logo/i.test(path.basename(b))) - Number(/logo/i.test(path.basename(a))));
}
