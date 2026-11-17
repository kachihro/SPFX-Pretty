// Regenerates the website screenshots in media/screens/ (needs Playwright + Chromium; not part of the extension).
//   npm run compile && node scripts/make-screens.js
const fs = require('fs'), os = require('os'), path = require('path');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const out = path.join(root, 'media', 'screens');
const { scanProject } = require(path.join(root, 'out/core/scanner'));
const { renderReportHtml } = require(path.join(root, 'out/core/reportHtml'));
const { renderFaqHtml } = require(path.join(root, 'out/core/ruleDocs'));
const { makePngIcon, makeSvgIcon, svgDataUri } = require(path.join(root, 'out/core/icons'));
const { companyIconSet } = require(path.join(root, 'out/core/imageTools'));
fs.mkdirSync(out, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'screens-'));
const stub = h => h.replace('acquireVsCodeApi()', '({postMessage(){},getState(){return null},setState(){}})');
const report = (dir) => { const f = path.join(tmp, Math.random().toString(36).slice(2) + '.html'); fs.writeFileSync(f, stub(renderReportHtml(scanProject(dir, { latestSpfxVersion: '1.24.1' }), { interactive: true, nonce: 'x' }))); return 'file://' + f; };
const ugly = path.join(root, 'test-fixtures', 'ugly-solution');
const old = path.join(root, 'test-fixtures', 'old-gulp-solution');

// VS Code-style mock chrome for the native UI (quick pick, dialog, tree)
const VS = `body{margin:0;background:#1f1f1f;color:#ccc;font:13px "Segoe UI",system-ui,sans-serif}
.ed{display:flex;height:100vh}.ab{width:48px;background:#181818;border-right:1px solid #2b2b2b;display:flex;flex-direction:column;align-items:center;gap:18px;padding-top:12px}
.ab i{width:24px;height:24px;border-radius:4px;background:#5a5a5a;opacity:.35;display:block}.ab .on{opacity:1;background:none;position:relative}
.badge{position:absolute;right:-8px;bottom:-6px;background:#0078d4;color:#fff;font:600 10px/16px sans-serif;border-radius:8px;padding:0 5px}
.side{width:560px;background:#181818;border-right:1px solid #2b2b2b}.side h4{margin:0;padding:10px 14px;font-size:11px;letter-spacing:.06em;color:#bbb;display:flex;justify-content:space-between}
.tb{display:flex;gap:10px;opacity:.8}.row{padding:3px 14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.row .d{color:#8b8b8b;margin-left:6px}
.main{flex:1;background:#1f1f1f;position:relative}.w{color:#cca700}.e{color:#f14c4c}.i{color:#3794ff}.ok{color:#89d185}.sel{background:#04395e;outline:1px solid #2a6fdb}
.qp{position:absolute;left:50%;top:14px;transform:translateX(-50%);width:640px;background:#252526;border:1px solid #454545;border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,.5);overflow:hidden}
.qp .t{padding:6px 10px;font-size:12px;color:#ccc;text-align:center;border-bottom:1px solid #333}.qp input{width:100%;box-sizing:border-box;background:#313131;border:1px solid #2a6fdb;color:#ccc;padding:6px 8px;font:inherit;margin:8px 0}
.qp .in{padding:0 8px 8px}.qp .it{padding:5px 8px;border-radius:3px;display:flex;gap:8px}.qp .it small{color:#9d9d9d;margin-left:auto}
.dlg{position:absolute;left:50%;top:60px;transform:translateX(-50%);width:600px;background:#252526;border:1px solid #454545;border-radius:8px;box-shadow:0 12px 40px rgba(0,0,0,.6);padding:18px 20px}
.dlg h3{margin:0 0 10px;color:#fff;font-size:14px}.dlg p{margin:0 0 10px;color:#bbb}.dlg pre{background:#1a1a1a;border:1px solid #333;border-radius:4px;padding:8px;font:12px Consolas,monospace;margin:0 0 14px}
.add{color:#89d185}.del{color:#f48771}.btns{display:flex;gap:8px;justify-content:flex-end}.btns span{padding:5px 14px;border-radius:3px;border:1px solid #555}.btns .p{background:#2a6fdb;border-color:#2a6fdb;color:#fff}`;

(async () => {
  const b = await chromium.launch();
  const shot = async (url, file, opts = {}) => {
    const p = await b.newPage({ viewport: { width: opts.w || 1100, height: opts.h || 800 }, colorScheme: 'dark', deviceScaleFactor: 1.5 });
    await p.goto(url);
    if (opts.prep) { await p.evaluate(opts.prep); await p.waitForTimeout(300); }
    const target = opts.el ? await p.$(opts.el) : null;
    if (target) { await target.screenshot({ path: path.join(out, file) }); } else { await p.screenshot({ path: path.join(out, file), fullPage: !!opts.full }); }
    await p.close();
  };
  const fold = (keepOpen) => `(()=>{document.querySelectorAll('details.sec').forEach(d=>d.open=${JSON.stringify(keepOpen)}.includes(d.id));})()`;

  // 1-4: the real report
  await shot(report(ugly), 'report.png', { h: 860, prep: fold(['where']) });
  await shot(report(ugly), 'toolbox.png', { el: '#toolbox', prep: `(()=>{${fold(['toolbox']).slice(6,-4)};const t=document.querySelectorAll('#toolbox details.iss');if(t[3])t[3].open=true;})()` });
  await shot(report(ugly), 'property-pane.png', { el: '#pane', prep: fold(['pane']) });
  await shot(report(old), 'upgrade.png', { el: '#versions', prep: fold(['versions']) });

  // 5: in-editor FAQ
  const faq = path.join(tmp, 'faq.html');
  fs.writeFileSync(faq, renderFaqHtml('SOL008', 'x', 'vscode-resource:').replace(/script-src 'nonce-x'/, "script-src 'unsafe-inline'"));
  await shot('file://' + faq, 'faq.png', { h: 760, w: 980 });

  // 6-8: VS Code native UI (illustrations in VS Code's style)
  const mock = async (file, body, w = 1100, h = 520) => { const f = path.join(tmp, file + '.html'); fs.writeFileSync(f, `<!doctype html><style>${VS}</style>${body}`); await shot('file://' + f, file, { w, h }); };
  const tree = `<div class="side"><h4><span>SPFX PRETTY: FINDINGS</span><span class="tb">⏵ ⛉ ⟳ ▤ ✦</span></h4>
    <div class="row">⌄ 📦 project-client-side-solution <span class="d">7/100 nice · 0 errors, 18 warnings, 10 info</span></div>
    <div class="row">&nbsp;&nbsp;⌄ 🔤 Title <span class="d">7 · 7 auto-fixable</span></div>
    <div class="row sel">&nbsp;&nbsp;&nbsp;&nbsp;<span class="w">⚠</span> App name "project-client-side-solution" is kebab-case <span class="d">SOL001 · 💡 Rename solution to "Project"</span></div>
    <div class="row">&nbsp;&nbsp;&nbsp;&nbsp;<span class="w">⚠</span> Web Part toolbox title "HelloWorld" is PascalCase <span class="d">CMP001 · 💡 Rename to "Hello World"</span></div>
    <div class="row">&nbsp;&nbsp;⌄ 🎨 Icon <span class="d">5 · 4 auto-fixable</span></div>
    <div class="row">&nbsp;&nbsp;&nbsp;&nbsp;<span class="w">⚠</span> No app icon - the App Catalog shows the placeholder <span class="d">SOL010 · 🖼 Upload company icon…</span></div>
    <div class="row">&nbsp;&nbsp;⌄ 📄 Metadata <span class="d">8</span></div>
    <div class="row">&nbsp;&nbsp;&nbsp;&nbsp;<span class="w">⚠</span> No short description <span class="d">SOL005 · ✍ Write the short description…</span></div>
    <div class="row">&nbsp;&nbsp;&nbsp;&nbsp;<span class="i">ⓘ</span> No screenshots on the app details page <span class="d">SOL008 · ✋ needs you</span></div>
    <div class="row">&nbsp;&nbsp;⌄ 🔢 Versions <span class="d">2</span></div>
    <div class="row">&nbsp;&nbsp;&nbsp;&nbsp;<span class="e">⊗</span> React 17.0.1 with SPFx 1.24.1 - needs exactly React 18.3.1 <span class="d">VER003</span></div>
    <div class="row">&nbsp;&nbsp;› <span class="ok">✓</span> Looking nice <span class="d">5</span></div></div>`;
  await mock('panel.png', `<div class="ed" style="height:330px"><div class="ab"><i></i><i></i><i></i><span class="on"><img src="${'data:image/svg+xml;base64,' + Buffer.from(fs.readFileSync(path.join(root, 'media/activitybar.svg'), 'utf8').replace(/currentColor/g, '#e8e8e8')).toString('base64')}" width="24"><span class="badge">18</span></span><i></i></div>${tree}<div class="main"></div></div>`, 1100, 330);
  await mock('step-by-step.png', `<div class="ed"><div class="ab"><i></i><i></i><i></i><i></i></div><div class="main"><div class="qp"><div class="t">Step 4 of 52 · CMP001 · HelloWorld</div><div class="in"><input value="WARNING: Web Part toolbox title &quot;HelloWorld&quot; is PascalCase with no spaces.">
    <div class="it sel">💡 Rename to "Hello World" <small>recommended</small></div><div class="it">❓ Explain &amp; how to fix</div><div class="it">📄 Open the file <small>src/webparts/helloWorld/HelloWorldWebPart.manifest.json</small></div>
    <div class="it">⏭ Skip for now</div><div class="it">🙈 Ignore CMP001 in this workspace</div><div class="it">⏹ Stop</div></div></div></div></div>`, 1100, 400);
  await mock('preview-apply.png', `<div class="ed"><div class="ab"><i></i><i></i><i></i><i></i></div><div class="main"><div class="dlg"><h3>Rename solution to "Project"</h3>
    <p>SOL001: App name "project-client-side-solution" still has the generator suffix "client-side-solution" - this is exactly what people read in the App Catalog and Site Contents.</p>
    <p>This will change:</p><pre>config/package-solution.json:
  <span class="del">- "name": "project-client-side-solution",</span>
  <span class="add">+ "name": "Project",</span></pre><div class="btns"><span>Explain</span><span>Cancel</span><span class="p">Apply</span></div></div></div></div>`, 1100, 340);

  // 9: company logo -> every icon
  const logo = fs.readFileSync(path.join(root, 'media', 'icon.png'));
  const set = companyIconSet(fs.existsSync('/tmp/kachihro-diamond.png') ? fs.readFileSync('/tmp/kachihro-diamond.png') : logo);
  const u = buf => 'data:image/png;base64,' + buf.toString('base64');
  const toolSvg = svgDataUri(makeSvgIcon({ colour: '#2A6FDB', glyph: 'webpart', title: 'Team News' }));
  await mock('icons.png', `<div style="padding:28px;font:14px 'Segoe UI',sans-serif;color:#ddd">
    <div style="font-size:18px;color:#fff;margin-bottom:18px">One company logo → every icon SharePoint and Teams need</div>
    <div style="display:flex;gap:34px;align-items:flex-end;flex-wrap:wrap">
    ${[['App Catalog · Site Contents', u(set.app96), 96], ['Teams colour 192×192', u(set.teamsColour192), 120], ['Teams outline 32×32', u(set.teamsOutline32), 32, '#464775'], ['Toolbox icon', u(set.toolbox64), 48], ['Brand initials icon', toolSvg, 48], ['Placeholder (until you upload)', u(makePngIcon({ size: 96, colour: '#2A6FDB', glyph: 'package' })), 96]].map(([l, src, s, bg]) =>
      `<div style="text-align:center"><div style="display:inline-grid;place-items:center;padding:10px;border-radius:10px;background:${bg || '#2b2b2b'}"><img src="${src}" width="${s}" height="${s}"></div><div style="margin-top:8px;font-size:12px;color:#aaa">${l}</div></div>`).join('')}
    </div></div>`, 1100, 330);
  await b.close();
  console.log('Screens written:', fs.readdirSync(out).join(', '));
})().catch(e => { console.error(e); process.exit(1); });
