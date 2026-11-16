'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
const scripts=manifest.content_scripts.flatMap(e=>e.js);
test('MV3: storage only; no cookies, tabs, debugger, webRequest, broad hosts or remote resources',()=>{assert.equal(manifest.manifest_version,3);assert.deepEqual(manifest.permissions,['storage']);assert.equal(manifest.host_permissions,undefined);assert.equal(manifest.web_accessible_resources,undefined);});
test('site-limited idle scripts: Gemini is isolated-only and React MAIN helper remains ChatGPT-only',()=>{
 assert.equal(manifest.content_scripts.length,2);
 for(const e of manifest.content_scripts){assert.equal(e.all_frames,false);assert.ok(['MAIN','ISOLATED'].includes(e.world));assert.equal(e.run_at,'document_idle');}
 const main=manifest.content_scripts.find(e=>e.world==='MAIN'),isolated=manifest.content_scripts.find(e=>e.world==='ISOLATED');
 assert.ok(main&&isolated);assert.deepEqual(main.matches,['https://chatgpt.com/*','https://chat.openai.com/*']);
 assert.deepEqual(isolated.matches,['https://chatgpt.com/*','https://chat.openai.com/*','https://gemini.google.com/*']);
 assert.deepEqual(main.js,['src/page-navigation.js']);assert.ok(isolated.js.includes('src/content.js'));
});
test('all declared extension assets exist',()=>{for(const asset of [...scripts,manifest.action.default_popup,manifest.options_ui.page,...Object.values(manifest.icons)])assert.ok(fs.statSync(path.join(root,asset)).size>0,asset);});
test('offline translations load before controllers on both platforms and settings pages',()=>{
 const isolated=manifest.content_scripts.find(e=>e.world==='ISOLATED');
 assert.ok(isolated.js.indexOf('src/i18n.js')>=0);
 assert.ok(isolated.js.indexOf('src/i18n.js')<isolated.js.indexOf('src/core.js'));
 for(const f of [manifest.action.default_popup,manifest.options_ui.page]){
  const html=fs.readFileSync(path.join(root,f),'utf8');
  const resources=[...html.matchAll(/<script[^>]*src=["']([^"']+)["']/g)].map(m=>m[1]);
  for(const required of ['../src/i18n.js','i18n.js','popup.js'])assert.ok(resources.includes(required),f+': '+required);
  assert.ok(resources.indexOf('../src/i18n.js')<resources.indexOf('i18n.js'));
  assert.ok(resources.indexOf('i18n.js')<resources.indexOf('popup.js'));
  for(const resource of resources)assert.ok(fs.statSync(path.resolve(root,path.dirname(f),resource)).size>0);
 }
});
test('versions agree',()=>assert.equal(require('../src/core.js').VERSION,manifest.version));
test('embedded CSS equals maintained source',()=>{const vm=require('node:vm'),ctx={};vm.runInNewContext(fs.readFileSync(path.join(root,'src/styles.js'),'utf8'),ctx);assert.equal(ctx.GTNextCSS,fs.readFileSync(path.join(root,'src/timeline.css'),'utf8'));});
test('no eval, executable HTML sinks, external sockets or third-party runtime dependencies',()=>{for(const file of [...scripts,'popup/i18n.js','popup/popup.js']){const text=fs.readFileSync(path.join(root,file),'utf8');for(const pattern of [/\beval\s*\(/,/new\s+Function\s*\(/,/\.innerHTML\s*=/,/insertAdjacentHTML\s*\(/,/\bWebSocket\b/,/\bXMLHttpRequest\b/])assert.doesNotMatch(text,pattern,file);}});
test('no network or history access exists in any runtime script',()=>{for(const file of [...scripts,'popup/i18n.js','popup/popup.js']){const s=fs.readFileSync(path.join(root,file),'utf8');assert.doesNotMatch(s,/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|backend-api|accessToken|GTN_LOAD_HISTORY|GTN_SCROLL_HISTORY|GTN_CANCEL_HISTORY/);}});
test('popups have only bundled script sources and no inline handlers',()=>{for(const f of [manifest.action.default_popup,manifest.options_ui.page]){const html=fs.readFileSync(path.join(root,f),'utf8');assert.doesNotMatch(html,/<script(?![^>]*\bsrc=)[^>]*>/i);assert.doesNotMatch(html,/<script[^>]*src=["']https?:/i);assert.doesNotMatch(html,/\bon(click|change|load)=/i);}});
test('test/demo shims are not shipped as injected code',()=>{for(const file of scripts)assert.doesNotMatch(file,/demo|mock|tests/);});
test('popup intrinsic width explicit on both html/body; no max-width:100vw shrink loop',()=>{const css=fs.readFileSync(path.join(root,'popup/popup.css'),'utf8');assert.match(css,/html\{width:400px;min-width:400px/);assert.match(css,/body\{width:400px;min-width:400px/);assert.doesNotMatch(css,/max-width:100vw/);});
