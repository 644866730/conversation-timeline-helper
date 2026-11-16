'use strict';
const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm'), path=require('node:path');
const I=require('../src/i18n.js');
test('eight native language names are immutable and contain no auto pseudo-locale',()=>{
  assert.deepEqual(I.LANGUAGES.map(l=>l.value),['zh-CN','zh-TW','en','ja','ko','es','fr','de']);
  assert.ok(I.LANGUAGES.every(l=>typeof l.label==='string'&&l.label));
  assert.ok(Object.isFrozen(I.LANGUAGES)&&I.LANGUAGES.every(Object.isFrozen));
});
test('browser language resolution handles Chinese regions and scripts',()=>{
  for(const input of ['zh-TW','zh-HK','zh-MO','zh-Hant','zh-Hant-US','zh-Hant-CN','zh_Hant_SG'])assert.equal(I.resolve(input),'zh-TW');
  for(const input of ['zh','zh-CN','zh-SG','zh-Hans-TW','zh-Hans-MO','ZH_hAnS_hK'])assert.equal(I.resolve(input),'zh-CN');
  assert.equal(I.resolve('auto',['xx','zh-HK','en-US']),'zh-TW');
  assert.equal(I.resolve('auto',['xx','ja-JP']),'ja');
});
test('browser language resolution supports common regions and defaults safely',()=>{
  for(const [input,expected]of [['EN_us','en'],['ja-JP','ja'],['ko-KR','ko'],['es-MX','es'],['fr-CA','fr'],['de-AT','de']])assert.equal(I.resolve(input),expected);
  assert.equal(I.resolve('auto',['unknown']),'en');assert.equal(I.resolve('auto',[]),'en');
  assert.equal(I.resolve('unknown',['zh-CN']),'en');
  assert.equal(I.resolve(null),'en');
});
test('no browser navigator is required to load or translate the engine',()=>{
  const context={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/i18n.js'),'utf8'),context);
  assert.equal(context.GTNextI18n.resolve(),'en');assert.equal(context.GTNextI18n.t('目录'),'Index');
});
function assertBundledDictionary(relativePath,locales){
  const filename=path.join(__dirname,relativePath),source=fs.readFileSync(filename,'utf8'),context={};
  if(relativePath!=='../src/i18n.js')vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/i18n.js'),'utf8'),context);
  assert.equal((source.match(/const rows = \[/g)||[]).length,1,'one bundled dictionary per file');
  vm.runInNewContext(source.replace('const rows = [','const rows = globalThis.__dictionaryRows = ['),context,{filename});
  const rows=context.__dictionaryRows,keys=new Set();assert.ok(rows.length>90);
  for(const row of rows){
    assert.equal(row.length,locales.length,row[0]);
    assert.ok(!keys.has(row[0]),'duplicate key: '+row[0]);keys.add(row[0]);
    const placeholders=Array.from(row[0].matchAll(/\{[A-Za-z][A-Za-z0-9_]*\}/g),m=>m[0]).sort();
    for(let index=0;index<locales.length;index++){
      const value=row[index],locale=locales[index],label=row[0]+' '+locale;
      // Validate literal cells before translating: fallback must never conceal a missing entry.
      assert.equal(typeof value,'string',label);assert.ok(value.trim(),label);
      assert.deepEqual(Array.from(value.matchAll(/\{[A-Za-z][A-Za-z0-9_]*\}/g),m=>m[0]).sort(),placeholders,label);
      assert.equal(context.GTNextI18n.t(row[0],{},locale),value,label+' column mapping');
    }
  }
}
test('every bundled content dictionary cell is complete and preserves placeholders',()=>{
  assertBundledDictionary('../src/i18n.js',['zh-CN','en','zh-TW','ja','ko','es','fr','de']);
});
test('every bundled popup dictionary cell is complete and registers under its correct locale',()=>{
  assertBundledDictionary('../popup/i18n.js',['zh-CN','zh-TW','en','ja','ko','es','fr','de']);
});
test('interpolation is literal text and does not recurse into inserted values',()=>{
  assert.equal(I.t('已定位到{name}',{name:'<script>{count}</script>'},'en'),'Moved to <script>{count}</script>');
  assert.equal(I.t('第 {current} / {total} 条 · 已加载',{current:0,total:12},'en'),'0 / 12 · Loaded');
  assert.equal(I.t('提问 {number}',{},'en'),'Prompt {number}');
});
test('missing keys use Chinese catalog before the original literal key',()=>{
  I.register({'zh-CN':{'__test_missing_locale':'中文回退'}});
  assert.equal(I.t('__test_missing_locale',{},'de'),'中文回退');
  assert.equal(I.t('未注册键 {name}',{name:'内容'},'fr'),'未注册键 内容');
});
test('catalog registration merges only supported own string data properties',()=>{
  const inherited=Object.create({inherited:'wrong'});inherited.__test_registered='Offline';inherited.bad=42;
  Object.defineProperty(inherited,'getter',{enumerable:true,get(){throw Error('Getter must not run');}});
  I.register({en:inherited,xx:{bad:'wrong'}});
  assert.equal(I.t('__test_registered',{},'en'),'Offline');assert.equal(I.t('inherited',{},'en'),'inherited');
  assert.equal(I.t('bad',{},'en'),'bad');assert.equal(I.t('getter',{},'en'),'getter');
});
test('catalog registration and interpolation reject prototype pollution and getters',()=>{
  I.register(JSON.parse('{"en":{"__proto__":"polluted","constructor":"polluted","prototype":"polluted"},"__proto__":{"polluted":true}}'));
  assert.equal({}.polluted,undefined);assert.equal(I.t('__proto__',{},'en'),'__proto__');
  assert.equal(I.t('constructor',{},'en'),'constructor');
  const values=Object.create({number:'inherited'});assert.equal(I.t('提问 {number}',values,'en'),'Prompt {number}');
  Object.defineProperty(values,'number',{get(){throw Error('Getter must not run');}});
  assert.equal(I.t('提问 {number}',values,'en'),'Prompt {number}');
});
