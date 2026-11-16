'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const C = require('../src/core.js');
test('long reply results include and highlight a keyword after the opening excerpt', () => {
  const item = {text:'消息开头。'.repeat(80) + '不要上传到服务器。' + '后续内容。'.repeat(50)};
  const segments = C.queryPreview(item,'服务器');
  assert.ok(segments.map(s=>s.text).join('').startsWith('…'));
  assert.deepEqual(segments.filter(s=>s.match).map(s=>s.text),['服务器']);
  assert.ok(segments.map(s=>s.text).join('').length < 180);
});
test('multiple literal keywords are highlighted case-insensitively', () => {
  const segments = C.queryPreview({text:'ChatGPT 的本地 SEARCH 与收藏'},'chatgpt search');
  assert.deepEqual(segments.filter(s=>s.match).map(s=>s.text),['ChatGPT','SEARCH']);
});
test('query punctuation is literal and markup remains inert text', () => {
  const segments = C.queryPreview({text:'a+b [foo] <img src=x>'},'a+b [foo]');
  assert.deepEqual(segments.filter(s=>s.match).map(s=>s.text),['a+b','[foo]']);
  assert.ok(segments.map(s=>s.text).join('').includes('<img src=x>'));
});
test('snippets preserve emoji and fall back when only metadata matched', () => {
  const segments=C.queryPreview({text:'🙂'.repeat(200)+'准确命中'},'准确');
  assert.equal(segments.map(s=>s.text).join('').includes('\ufffd'),false);
  assert.deepEqual(C.queryPreview({text:'普通消息'},'42'),[{text:'普通消息',match:false}]);
});
