'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), C = require('../src/core.js');
test('dense regions are distinguished from safely separated nodes', () => {
  assert.equal(C.isDense([16,17,40],0),true);
  assert.equal(C.isDense([16,17,40],2),false);
  assert.equal(C.isDense([16],0),false);
  assert.equal(C.isDense([],0),false);
  assert.equal(C.isDense([16,17],-1),false);
});
test('nearby choices include the clicked node and respect both endpoints', () => {
  for(const total of [0,1,8,37,1000]) for(const index of [0,Math.floor(total/2),total-1]) {
    const range=C.nearbyWindow(total,index);
    assert.ok(range.start>=0 && range.end<=total && range.end-range.start<=10);
    if(total)assert.ok(index>=range.start && index<range.end);
  }
});
