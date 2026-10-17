'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const manifest=JSON.parse(read('manifest.json')),guard=read('src/preview-guard.js'),content=read('src/content.js');
test('preview guard is a bundled isolated script loaded before the controller',()=>{
 const scripts=manifest.content_scripts.find(s=>s.world==='ISOLATED').js;
 assert.ok(scripts.indexOf('src/preview-guard.js')>=0);assert.ok(scripts.indexOf('src/preview-guard.js')<scripts.indexOf('src/content.js'));
});
test('preview guard cannot fetch history, seek a virtualizer, click a pagination control or override focus',()=>{
 assert.doesNotMatch(guard,/\bfetch\s*\(|\.postMessage\s*\(|\.jump\s*\(|scrollToIndex|\.click\s*\(|\.focus\s*\(|prototype\s*\.|chrome\.storage/);
});
test('preview correction is bounded and has no idle interval loop',()=>{
 assert.match(guard,/endAt = performance\.now\(\) \+ 1000/);assert.doesNotMatch(guard,/setInterval\s*\(/);
 assert.match(guard,/listeners\.forEach\(remove => remove\(\)\)/);assert.match(guard,/observer\.disconnect\(\)/);
});
test('native helper refuses queued seek while preview guard is holding input',()=>assert.match(read('src/page-navigation.js'),/hasAttribute\('data-preview-blocked'\)/));
test('hidden preview guard cannot intercept the native close button; shortcuts honor pause',()=>{
 assert.match(read('src/shell.css'),/:host\(\[data-preview-blocked\]\)\{display:none!important\}/);
 assert.match(content,/if \(previewGuard\?\.check\(\)\) return;/);
 assert.ok(content.indexOf('previewGuard = globalThis.GTNextPreviewGuard.create')<content.indexOf("on(document, 'keydown'"));
});
