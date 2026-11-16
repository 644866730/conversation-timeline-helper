'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../src/core.js');
test('settings default is copied, not mutable singleton', () => { const a=C.normalizeSettings(); a.enabled=false; assert.equal(C.DEFAULTS.enabled,true); });
test('settings reject truthy strings and unknown fields', () => { const x=C.normalizeSettings({enabled:'false',includeAssistant:1,evil:true}); assert.equal(x.enabled,true);assert.equal(x.includeAssistant,true);assert.equal(x.evil,undefined); });
test('settings safely handle null / array input', () => {assert.deepEqual(C.normalizeSettings(null),C.DEFAULTS);assert.deepEqual(C.normalizeSettings([]),C.DEFAULTS);});
test('settings enum validation', () => {assert.equal(C.normalizeSettings({theme:'javascript:',side:'middle'}).theme,'auto');assert.equal(C.normalizeSettings({side:'middle'}).side,'right');});
test('vertical range clamps and rounds', () => {assert.equal(C.normalizeSettings({verticalPosition:100}).verticalPosition,75);assert.equal(C.normalizeSettings({verticalPosition:0}).verticalPosition,25);assert.equal(C.normalizeSettings({verticalPosition:50.8}).verticalPosition,51);assert.equal(C.normalizeSettings({verticalPosition:NaN}).verticalPosition,52);});
test('selector length limit and trimming', () => {assert.equal(C.normalizeSettings({customUserSelector:' [data-turn="user"] '}).customUserSelector,'[data-turn="user"]');assert.equal(C.normalizeSettings({customUserSelector:'a'.repeat(1500)}).customUserSelector.length,1000);});
test('storage settings round trip', () => {const s=C.normalizeSettings({theme:'dark',includeAssistant:true});assert.deepEqual(C.settingsFromStorage(C.settingsToStorage(s)),s);});
test('language preferences persist and invalid values return to browser auto', () => {
  for (const language of ['auto','zh-CN','zh-TW','en','ja','ko','es','fr','de']) {
    const saved=C.settingsToStorage({...C.DEFAULTS,language});
    assert.equal(saved['gtn:setting:language'],language);
    assert.equal(C.settingsFromStorage(saved).language,language);
  }
  for (const language of [null,[],{},true,'unknown','en-US','javascript:alert(1)']) assert.equal(C.normalizeSettings({language}).language,'auto');
  assert.equal(C.settingsFromStorage({'gtn:setting:theme':'dark'}).language,'auto');
});
test('unknown storage keys do not become settings', () => {assert.deepEqual(C.settingsFromStorage({enabled:false,random:1}),C.DEFAULTS);});
test('text normalizes Unicode whitespace', () => {assert.equal(C.normalizeText('  你好\n\t世\u00a0界  '),'你好 世 界');});
test('excerpt does not split emoji surrogate pairs', () => {assert.equal(C.excerpt('🙂🙂🙂🙂',3),'🙂🙂…');assert.equal(C.excerpt('hello',9),'hello');});
test('hash deterministic, fixed width and differing inputs', () => {assert.equal(C.hash('你好'),C.hash('你好'));assert.match(C.hash('你好'),/^[0-9a-f]{16}$/);assert.notEqual(C.hash('你好'),C.hash('您好'));});
test('hash sample uniqueness (not a cryptographic guarantee)', () => {assert.equal(new Set(Array.from({length:10000},(_,i)=>C.hash('message-'+i))).size,10000);});
test('regular conversation has stable scope', () => {const a=C.scopeFromURL('https://chatgpt.com/c/abc');assert.equal(a.persistent,true);assert.equal(a.key,C.scopeFromURL('https://chat.openai.com/c/abc?x=1#foo').key);});
test('project and custom GPT routes resolve conversation IDs', () => {const base=C.scopeFromURL('https://chatgpt.com/c/abc');assert.deepEqual(C.scopeFromURL('https://chatgpt.com/g/g-project/c/abc'),base);assert.deepEqual(C.scopeFromURL('https://chatgpt.com/g/g-bot/c/abc'),base);});
test('different threads and shared links are isolated', () => {assert.notEqual(C.scopeFromURL('https://chatgpt.com/c/a').key,C.scopeFromURL('https://chatgpt.com/c/b').key);assert.notEqual(C.scopeFromURL('https://chatgpt.com/c/a').key,C.scopeFromURL('https://chatgpt.com/share/a').key);});
test('existing ChatGPT bookmark fingerprints remain byte-compatible', () => {
  assert.equal(C.scopeFromURL('https://chatgpt.com/c/abc').key,C.hash('chatgpt:c:abc'));
  assert.equal(C.scopeFromURL('https://chat.openai.com/share/abc').key,C.hash('chatgpt:share:abc'));
});
test('platform recognition uses supported HTTPS hostnames, not lookalike strings', () => {
  assert.equal(C.platformFromURL('https://gemini.google.com/app/abc'),'gemini');
  assert.equal(C.platformFromURL('https://chatgpt.com/c/abc'),'chatgpt');
  assert.equal(C.platformFromURL('https://chat.openai.com/c/abc'),'chatgpt');
  for(const url of ['https://gemini.google.com.evil.example/app/abc','https://gemini.google.com@evil.example/app/abc','http://gemini.google.com/app/abc','file:///app/abc','garbage'])assert.equal(C.platformFromURL(url),'unknown');
});
test('platform names accept platform identifiers or supported URLs', () => {
  assert.equal(C.platformName('gemini'),'Gemini');assert.equal(C.platformName('chatgpt'),'ChatGPT');
  assert.equal(C.platformName('https://gemini.google.com/app'),'Gemini');assert.equal(C.platformName('unknown'),'当前页面');
});
test('Gemini app scopes remain stable across account routes and tracking queries', () => {
  const expected={persistent:true,key:C.hash('gemini:app:abc')};
  for(const url of ['https://gemini.google.com/app/abc','https://gemini.google.com/app/abc/?hl=zh-CN#reply','https://gemini.google.com/u/0/app/abc','https://gemini.google.com/u/2/app/abc'])assert.deepEqual(C.scopeFromURL(url),expected);
});
test('Gem conversations use their final conversation ID and share app scopes', () => {
  const expected=C.scopeFromURL('https://gemini.google.com/app/abc');
  for(const url of ['https://gemini.google.com/gem/gem-one/abc','https://gemini.google.com/gem/gem-two/abc/?hl=zh-CN#reply','https://gemini.google.com/u/0/gem/gem-one/abc','https://gemini.google.com/u/2/gem/gem-one/abc'])assert.deepEqual(C.scopeFromURL(url),expected);
  assert.notEqual(expected.key,C.scopeFromURL('https://gemini.google.com/gem/gem-one/another').key);
});
test('Gemini shares and ChatGPT conversations cannot collide on the same identifier', () => {
  const app=C.scopeFromURL('https://gemini.google.com/app/abc'),share=C.scopeFromURL('https://gemini.google.com/share/abc'),chat=C.scopeFromURL('https://chatgpt.com/c/abc');
  assert.equal(share.key,C.hash('gemini:share:abc'));assert.equal(new Set([app.key,share.key,chat.key]).size,3);
  assert.notEqual(app.key,C.scopeFromURL('https://gemini.google.com/app/another').key);
});
test('Gemini new chats, incomplete routes and unsupported sites remain memory-only', () => {
  for(const url of ['https://gemini.google.com/app','https://gemini.google.com/app/','https://gemini.google.com/u/0/app','https://gemini.google.com/','https://gemini.google.com/app/abc/extra','https://gemini.google.com/gem/gem-one','https://gemini.google.com/gem/gem-one/','https://gemini.google.com/u/0/gem/gem-one','https://gemini.google.com/gem/gem-one/abc/extra','https://example.com/c/abc','https://example.com/share/abc'])assert.deepEqual(C.scopeFromURL(url),{persistent:false,key:'ephemeral'});
});
test('missing conversation ID and invalid URLs are ephemeral', () => {for(const url of ['https://chatgpt.com/','https://chatgpt.com/?temporary-chat=true','about:blank','garbage','https://chatgpt.com/g/g-bot'])assert.equal(C.scopeFromURL(url).persistent,false);});
test('route ignores non-semantic queries and hash', () => {assert.equal(C.routeFromURL('https://chatgpt.com/c/a?q=x#node'),'/c/a');assert.equal(C.routeFromURL('https://chatgpt.com/?temporary-chat=true'),'/?temporary-chat=true'.replace('/?','?'));});
test('bookmark keys contain no raw identifiers', () => {const key=C.starKey(C.scopeFromURL('https://chatgpt.com/c/secret-id'),'message:private-id:user');assert.equal(C.isStarKey(key),true);assert.equal(key.includes('secret'),false);assert.equal(key.includes('private'),false);});
test('query is case-insensitive AND search, including Chinese', () => {const item={text:'ChatGPT 新版 页面',ordinal:4,role:'user'};assert.equal(C.matchesQuery(item,'CHATGPT 新版'),true);assert.equal(C.matchesQuery(item,'新版 错词'),false);assert.equal(C.matchesQuery(item,'4'),true);assert.equal(C.matchesQuery(item,''),true);});
test('binary active index at all boundaries', () => {assert.equal(C.activeIndex([],0),-1);assert.equal(C.activeIndex([100,200,300],10),0);assert.equal(C.activeIndex([100,200,300],200),1);assert.equal(C.activeIndex([100,200,300],999),2);});
test('valid backup retains only allowed fields', () => {const key=C.starKey(C.scopeFromURL('https://chatgpt.com/c/a'),'m');assert.deepEqual(C.validateBackup({format:'gpt-timeline-next-bookmarks',version:1,entries:[[key,{savedAt:123,text:'not stored'}]]}),{[key]:{version:1,savedAt:123}});});
test('backup rejects arbitrary keys, invalid dates and versions', () => {for(const b of [{},{format:'wrong',version:1,entries:[]},{format:'gpt-timeline-next-bookmarks',version:1,entries:[['__proto__',{savedAt:123}]]},{format:'gpt-timeline-next-bookmarks',version:1,entries:[['gtn:star:'+'a'.repeat(16)+':'+'b'.repeat(16),{savedAt:NaN}]]}])assert.throws(()=>C.validateBackup(b));});
test('backup caps entry count', () => {assert.throws(()=>C.validateBackup({format:'gpt-timeline-next-bookmarks',version:1,entries:new Array(20001)}));});
