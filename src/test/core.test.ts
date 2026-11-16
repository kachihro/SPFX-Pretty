import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { toNiceTitle, titleProblems, isPlaceholderDescription, initials } from '../core/titles';
import { scanProject, applyAllSafeFixes, issues } from '../core/scanner';
import { readPngSize, makePngIcon } from '../core/icons';
import { stableGuid } from '../core/rules/components';
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

test('stable guid is deterministic and v5-shaped', () => {
  assert.equal(stableGuid('Contoso Tools'), stableGuid('contoso tools'));
  assert.match(stableGuid('x'), /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
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
  assert.ok(after.score > before + 40, `score ${before} -> ${after.score}`);

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
