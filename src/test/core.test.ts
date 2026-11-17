import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { toNiceTitle, titleProblems, isPlaceholderDescription, initials } from '../core/titles';
import { scanProject, applyAllSafeFixes, applyFixToDisk, issues } from '../core/scanner';
import { readPngSize, makePngIcon } from '../core/icons';
import { MODERN_GROUPS } from '../core/rules/components';
import { JsoncDoc } from '../core/jsonc';

const FIXTURE = path.join(__dirname, '..', '..', 'test-fixtures', 'ugly-solution');

function copyFixture(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spfx-pretty-'));
  fs.cpSync(FIXTURE, dir, { recursive: true });
  return dir;
}

test('nice titles', () => {
  assert.equal(toNiceTitle('hello-world-client-side-solution'), 'Hello World');
  assert.equal(toNiceTitle('HelloWorldWebPart'), 'Hello World');
  assert.equal(toNiceTitle('team-news-web-part'), 'Team News');
  assert.equal(toNiceTitle('spfx-hr-faq-of-the-day'), 'HR FAQ of the Day');
  assert.equal(toNiceTitle('MyTasks'), 'My Tasks');
  assert.equal(toNiceTitle('approve_item'), 'Approve Item');
});

test('title problems', () => {
  assert.ok(titleProblems('hello-world-client-side-solution').length >= 2);
  assert.ok(titleProblems('HelloWorld').length === 1);
  assert.deepEqual(titleProblems('Contoso Staff Directory'), []);
  assert.deepEqual(titleProblems('HR FAQ'), []);
});

test('placeholder descriptions', () => {
  assert.ok(isPlaceholderDescription('HelloWorld description'));
  assert.ok(isPlaceholderDescription('hello-world description'));
  assert.ok(isPlaceholderDescription(''));
  assert.ok(!isPlaceholderDescription('Shows the latest news from your team site.'));
});

test('initials', () => {
  assert.equal(initials('Hello World'), 'HW');
  assert.equal(initials('Weather'), 'We');
  assert.equal(initials('Team-News-WebPart'), 'TN');
});

test('png icons have the right size', () => {
  for (const size of [32, 96, 192]) {
    assert.deepEqual(readPngSize(makePngIcon({ size, colour: '#0F6CBD', glyph: 'webpart' })), { width: size, height: size });
  }
});

test('modern toolbox groups are the 7 documented ones', () => {
  assert.equal(MODERN_GROUPS.length, 7);
  assert.equal(MODERN_GROUPS.find(g => g.name === 'Advanced')!.id, '5c03119e-3074-46fd-976b-c60198311f70');
});

test('jsonc edits keep comments', () => {
  const text = '{\n  // keep me\n  "a": 1\n}\n';
  const doc = new JsoncDoc('x.json', text);
  const edits = doc.set(['b'], true);
  const out = text.slice(0, edits[0].offset) + edits[0].newText + text.slice(edits[0].offset + edits[0].length);
  assert.ok(out.includes('// keep me'));
  assert.equal(new JsoncDoc('x.json', out).get(['b']), true);
});

test('scan finds the classic scaffold problems', () => {
  const r = scanProject(FIXTURE);
  const ids = new Set(issues(r).map(f => f.ruleId));
  for (const id of ['SOL001', 'SOL004', 'SOL005', 'SOL010', 'CMP001', 'CMP002', 'CMP003', 'CMP004', 'CMD001', 'CMD002', 'TMS001', 'BRD001', 'BRD002', 'BRD003', 'BRD004', 'BRD007']) {
    assert.ok(ids.has(id), `expected ${id}`);
  }
  // Comments in SCSS are ignored; theme tokens already in use are not flagged
  const brd3 = issues(r).filter(f => f.ruleId === 'BRD003').map(f => f.message);
  assert.ok(!brd3.some(m => m.includes('#ff0000')));
  assert.ok(!brd3.some(m => m.includes('#323130')));
  assert.equal(r.components.length, 5);
  for (const id of ['DEF001', 'DEF002', 'DEF003', 'DEF005', 'DEF006', 'PRP001', 'PRP002', 'PRP003', 'PRP004']) {
    assert.ok(ids.has(id), `expected ${id}`);
  }
  const unused = issues(r).filter(f => f.ruleId === 'PRP001').map(f => f.message).join('|');
  assert.ok(unused.includes('"listName"') && unused.includes('"showFooter"'));
  assert.ok(!unused.includes('"description"'), 'used property not flagged');
  // where people see it
  assert.deepEqual(issues(r).find(f => f.ruleId === 'SOL001')!.surfaces, ['App Catalog', 'Add an app', 'Site Contents']);
  assert.equal(r.preview.packageFile, 'hello-world.sppkg');
  assert.equal(r.preview.propertyPanes[0].group, 'Group Name');
  assert.ok(r.score < 30);
});

test('app name prefix', () => {
  const dir = copyFixture();
  applyAllSafeFixes(dir, { appNamePrefix: 'PlanB - ' });
  assert.equal(new JsoncDoc(path.join(dir, 'config', 'package-solution.json')).get(['solution', 'name']), 'PlanB - Hello World');
});

test('disabled rules are skipped (.spfxprettyrc.json)', () => {
  const dir = copyFixture();
  fs.writeFileSync(path.join(dir, '.spfxprettyrc.json'), JSON.stringify({ disabledRules: ['BRD003', 'BRD004'] }));
  const ids = issues(scanProject(dir)).map(f => f.ruleId);
  assert.ok(!ids.includes('BRD003') && !ids.includes('BRD004'));
});

test('fix-all makes the project nicer and is idempotent', () => {
  const dir = copyFixture();
  const before = scanProject(dir).score;
  const applied = applyAllSafeFixes(dir, { developer: { name: 'Contoso', websiteUrl: 'https://contoso.example', privacyUrl: 'https://contoso.example/privacy', termsOfUseUrl: 'https://contoso.example/terms', mpnId: 'Undefined-1.22.0' } });
  assert.ok(applied.length > 10);
  const after = scanProject(dir, { developer: { name: 'Contoso', websiteUrl: 'https://contoso.example', privacyUrl: 'https://contoso.example/privacy', termsOfUseUrl: 'https://contoso.example/terms', mpnId: '' } });
  assert.ok(after.score > before + 35, `score ${before} -> ${after.score}`);

  const sol = new JsoncDoc(path.join(dir, 'config', 'package-solution.json'));
  assert.equal(sol.get(['solution', 'name']), 'Hello World');
  assert.equal(sol.get(['solution', 'iconPath']), 'images/AppIcon.png');
  assert.equal(sol.get(['solution', 'developer', 'name']), 'Contoso');
  assert.deepEqual(readPngSize(fs.readFileSync(path.join(dir, 'sharepoint', 'images', 'AppIcon.png'))), { width: 96, height: 96 });

  const wp = new JsoncDoc(path.join(dir, 'src', 'webparts', 'helloWorld', 'HelloWorldWebPart.manifest.json'));
  assert.equal(wp.get(['preconfiguredEntries', 0, 'title', 'default']), 'Hello World');
  assert.match(wp.get(['preconfiguredEntries', 0, 'iconImageUrl']), /^data:image\/svg\+xml;base64,/);
  assert.equal(wp.get(['preconfiguredEntries', 0, 'officeFabricIconFontName']), undefined, 'Fluent icon removed so the image is used');
  assert.ok(wp.text.includes('// The "*" signifies'), 'comments preserved');

  const scss = fs.readFileSync(path.join(dir, 'src', 'webparts', 'helloWorld', 'components', 'HelloWorld.module.scss'), 'utf8');
  assert.ok(scss.includes('"[theme:bodyBackground, default: #f3f2f1]"'));
  assert.ok(scss.includes('var(--fontFamilyCustomFont1300, var(--fontFamilyBase))'));
  assert.ok(scss.includes('$ms-font-family-fallbacks'), 'Teams fallback font untouched');
  assert.equal(wp.get(['preconfiguredEntries', 0, 'properties', 'description']), 'Hello World', 'default property value made nice');
  const xml = fs.readFileSync(path.join(dir, 'sharepoint', 'assets', 'elements.xml'), 'utf8');
  assert.ok(xml.includes('Title="Banner"'));

  assert.ok(fs.existsSync(path.join(dir, 'teams', 'a1b2c3d4-0000-4000-8000-000000000001_color.png')));
  assert.equal(applyAllSafeFixes(dir).length, 0, 'second run finds nothing to do');
});

// ---------- versions & upgrade ----------
import { cmp, releaseFor } from '../core/versions';
import { buildBrandWords } from '../core/titles';
import { companyIconSet, decodePng } from '../core/imageTools';
import { upgradeMarkdown } from '../core/upgradeMarkdown';

const OLD = path.join(__dirname, '..', '..', 'test-fixtures', 'old-gulp-solution');

test('version compare and compatibility rows', () => {
  assert.ok(cmp('1.24.1', '1.9.1') > 0);
  assert.ok(cmp('1.24.0-rc.0', '1.24.0') < 0);
  assert.equal(releaseFor('1.24.1')!.react, '18.3.1');
  assert.equal(releaseFor('1.23.0')!.react, '17.0.1');
  assert.equal(releaseFor('1.21.1')!.toolchain, 'gulp');
  assert.equal(releaseFor('1.22.0')!.toolchain, 'heft');
});

test('old gulp project gets a Large upgrade with the right steps', () => {
  const r = scanProject(OLD, { latestSpfxVersion: '1.24.1' });
  const ids = issues(r).map(f => f.ruleId);
  for (const id of ['VER001', 'VER002', 'VER006', 'VER007', 'VER008', 'VER009']) { assert.ok(ids.includes(id), id); }
  assert.equal(r.upgrade!.effort, 'Large');
  assert.equal(r.upgrade!.toolchain, 'gulp');
  const titles = r.upgrade!.steps.map(s => s.title).join('|');
  assert.match(titles, /gulp → Heft/);
  assert.match(titles, /React 17\.0\.1 → 18\.3\.1/);
  assert.match(titles, /Node v22/);
  assert.match(upgradeMarkdown([r]), /m365 spfx project upgrade --toVersion 1\.24\.1/);
});

test('React mismatch on the latest SPFx is an error and a plan step', () => {
  const dir = copyFixture();
  const pkg = path.join(dir, 'package.json');
  const json = JSON.parse(fs.readFileSync(pkg, 'utf8'));
  json.dependencies['@microsoft/sp-core-library'] = '1.24.1';
  fs.writeFileSync(pkg, JSON.stringify(json, null, 2));
  const r = scanProject(dir, { latestSpfxVersion: '1.24.1' });
  const v3 = issues(r).find(f => f.ruleId === 'VER003')!;
  assert.equal(v3.severity, 'error');
  assert.match(r.upgrade!.steps[0].title, /React 17\.0\.1 → 18\.3\.1/);
});

// ---------- brand words ----------
test('brand spellings are learnt from titles and developer name', () => {
  const brand = buildBrandWords(['Plan B Consulting', 'PlanB My Team Links']);
  assert.equal(toNiceTitle('planb-personal-web-parts-client-side-solution', brand), 'PlanB Personal Web Parts');
  assert.equal(toNiceTitle('plan-b-copilot-leave-request-client-side-solution', buildBrandWords(['Plan B Consulting'])), 'Plan B Copilot Leave Request');
  assert.equal(toNiceTitle('wolff-formsfx-client-side-solution', buildBrandWords(['FormSFX Tools'])), 'Wolff FormSFX');
});

// ---------- company logo ----------
test('company logo is decoded and resized to every icon size', () => {
  const logo = makePngIcon({ size: 300, colour: '#123456', glyph: 'package' });
  const set = companyIconSet(logo);
  assert.deepEqual(readPngSize(set.app96), { width: 96, height: 96 });
  assert.deepEqual(readPngSize(set.teamsColour192), { width: 192, height: 192 });
  assert.deepEqual(readPngSize(set.teamsOutline32), { width: 32, height: 32 });
  const outline = decodePng(set.teamsOutline32);
  for (let i = 0; i < outline.data.length; i += 4) { assert.equal(outline.data[i], 255); } // white silhouette
  const colour = decodePng(set.teamsColour192);
  for (let i = 3; i < colour.data.length; i += 4) { assert.equal(colour.data[i], 255); } // fully opaque
});

test('company logo setting becomes the first app icon fix', () => {
  const dir = copyFixture();
  const logo = path.join(dir, 'logo.png');
  fs.writeFileSync(logo, makePngIcon({ size: 200, colour: '#00aa88', glyph: 'webpart' }));
  const f = issues(scanProject(dir, { companyIcon: logo })).find(x => x.ruleId === 'SOL010')!;
  assert.match(f.fixes[0].title, /company logo/);
  applyAllSafeFixes(dir, { companyIcon: logo });
  assert.deepEqual(readPngSize(fs.readFileSync(path.join(dir, 'sharepoint', 'images', 'AppIcon.png'))), { width: 96, height: 96 });
});

// ---------- about panel & toolbox groups ----------
test('About section: missing is flagged and the fix wires it in', () => {
  const dir = copyFixture();
  const r = scanProject(dir);
  const f = issues(r).find(x => x.ruleId === 'ABT001' && x.component === 'HelloWorld')!;
  assert.ok(f.fixes[0].creates!.some(c => c.file.endsWith('PropertyPaneAbout.ts')));
  applyFixToDisk(f.fixes[0]);
  const wp = fs.readFileSync(path.join(dir, 'src', 'webparts', 'helloWorld', 'HelloWorldWebPart.ts'), 'utf8');
  assert.match(wp, /import \{ aboutGroup \} from '\.\.\/\.\.\/common\/about\/PropertyPaneAbout';/);
  assert.match(wp, /aboutGroup\(this\.context\.manifest\)\n/);
  const after = issues(scanProject(dir)).filter(x => x.ruleId === 'ABT001').map(x => x.component);
  assert.ok(!after.includes('HelloWorld'));
});

test('About drift: hard-coded version that no longer matches is fixed', () => {
  const dir = copyFixture();
  fs.mkdirSync(path.join(dir, 'src', 'common'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'common', 'solutionMetadata.ts'), "export const solutionMetadata = { developer: { name: 'X' }, version: '0.9.0.0' };\n");
  const f = issues(scanProject(dir)).find(x => x.ruleId === 'ABT002')!;
  assert.match(f.message, /0\.9\.0\.0.*1\.0\.0\.0/);
});

test('custom toolbox groupId is flagged (modern toolbox shows it under Advanced)', () => {
  const dir = copyFixture();
  const m = path.join(dir, 'src', 'webparts', 'teamNews', 'TeamNewsWebPart.manifest.json');
  fs.writeFileSync(m, fs.readFileSync(m, 'utf8').replace('5c03119e-3074-46fd-976b-c60198311f70', 'a9846339-da24-4319-9ebe-d474e5022090'));
  const f = issues(scanProject(dir)).find(x => x.ruleId === 'CMP006' && x.file === m)!;
  assert.equal(f.severity, 'warning');
  assert.match(f.message, /Advanced/);
  assert.equal(f.fixes.length, 7);
  assert.equal(f.fixes[0].title, 'Choose toolbox group...');
  const opts = f.fixes[0].pick!.options.map(o => o.label);
  assert.equal(opts.length, 8); // 6 sections + Advanced + company name
  assert.ok(opts.some(o => /Company group name/.test(o)));
});

test('generated placeholder app icon is flagged until a real icon is uploaded', () => {
  const dir = copyFixture();
  applyFixToDisk(issues(scanProject(dir)).find(x => x.ruleId === 'SOL010')!.fixes.find(x => /Generate/.test(x.title))!);
  const f = issues(scanProject(dir)).find(x => x.ruleId === 'SOL015')!;
  assert.ok(f, 'placeholder flagged');
  assert.equal(f.fixes[0].command?.id, 'spfxPretty.uploadCompanyLogo');
  fs.writeFileSync(path.join(dir, 'sharepoint', 'images', 'AppIcon.png'), companyIconSet(makePngIcon({ size: 200, colour: '#123456', glyph: 'webpart' })).app96);
  assert.ok(!issues(scanProject(dir)).some(x => x.ruleId === 'SOL015'), 'real logo not flagged');
});

test('every rule the scanner can raise has an FAQ entry', () => {
  const { RULE_DOCS } = require('../core/ruleDocs') as typeof import('../core/ruleDocs');
  const src = fs.readdirSync(path.join(__dirname, '..', '..', 'src', 'core', 'rules')).map(f => fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'core', 'rules', f), 'utf8')).join('\n');
  const raised = new Set([...src.matchAll(/ruleId: '([A-Z]{3}\d{3})'|ctx\.pass\('([A-Z]{3}\d{3})'/g)].map(m => m[1] ?? m[2]));
  const documented = new Set(RULE_DOCS.map(r => r.id));
  const missing = [...raised].filter(id => !documented.has(id));
  assert.deepEqual(missing, [], `rules without FAQ: ${missing.join(', ')}`);
  assert.equal(documented.size, RULE_DOCS.length, 'no duplicate FAQ ids');
});
