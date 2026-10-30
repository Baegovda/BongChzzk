import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = {}; ctx.globalThis = ctx;
vm.runInNewContext(readFileSync(new URL('../lib/extras.js', import.meta.url), 'utf8'), ctx);
const X = ctx.BongExtras;
const id = '0123456789abcdef0123456789ABCDEF';

test('channelIdFromPath', () => {
  assert.equal(X.channelIdFromPath('/live/' + id), id.toLowerCase());
  assert.equal(X.channelIdFromPath('/live/' + id + '/'), id.toLowerCase());
  assert.equal(X.channelIdFromPath('/live/abc'), null);
  assert.equal(X.channelIdFromPath('/video/123'), null);
  assert.equal(X.channelIdFromPath(''), null);
});
test('formatViewers', () => {
  assert.equal(X.formatViewers(1234), '👁 1,234명');
  assert.equal(X.formatViewers(0), '👁 0명');
  assert.equal(X.formatViewers(NaN), '👁 -');
  assert.equal(X.formatViewers('5'), '👁 -');
});
test('clampSeek', () => {
  assert.equal(X.clampSeek(100, -5, 0, 200), 95);
  assert.equal(X.clampSeek(2, -5, 0, 200), 0);
  assert.equal(X.clampSeek(198, 5, 0, 199.5), 199.5);
  assert.equal(X.clampSeek(NaN, 5, 0, 10), null);
  assert.equal(X.clampSeek(1, 5, 10, 0), null);
});
test('seekRange', () => {
  assert.deepEqual([...X.seekRange(false, 600, [])], [0, 600]);
  assert.deepEqual([...X.seekRange(true, Infinity, [[0, 10], [50, 110]])], [50, 109.5]);
  assert.equal(X.seekRange(true, Infinity, []), null);
});
test('normalizeFontSize / normalizeSeekSec', () => {
  assert.equal(X.normalizeFontSize(16), 16);
  assert.equal(X.normalizeFontSize(0), 0);
  assert.equal(X.normalizeFontSize(40), 0);
  assert.equal(X.normalizeFontSize(13), 13);
  assert.equal(X.normalizeFontSize('27'), 27);
  assert.equal(X.normalizeFontSize(11), 0);
  assert.equal(X.normalizeFontSize(29), 0);
  assert.equal(X.normalizeSeekSec('10'), 10);
  assert.equal(X.normalizeSeekSec(7), 5);
});
test('isNameText', () => {
  assert.equal(X.isNameText('SAKURA'), true);
  assert.equal(X.isNameText('구구구ㅜㅜ'), true);
  assert.equal(X.isNameText('13,020'), false);
  assert.equal(X.isNameText(' 13000 '), false);
  assert.equal(X.isNameText('1등'), false);
  assert.equal(X.isNameText('주간 후원 랭킹'), false);
  assert.equal(X.isNameText(''), false);
});
test('rankRowIndices', () => {
  const d = (o = {}) => ({ isDiv: true, hasLog: false, hasInput: false, signal: false, ...o });
  assert.deepEqual([...X.rankRowIndices([d(), d(), d({ hasLog: true }), d({ hasInput: true })])], [1]);
  assert.deepEqual([...X.rankRowIndices([d(), d({ hasLog: true }), d({ hasInput: true })])], []);
  assert.deepEqual([...X.rankRowIndices([d(), d({ signal: true }), d()])], [1]);
  assert.deepEqual([...X.rankRowIndices([d(), d({ isDiv: false }), d({ hasLog: true })])], []);
});
