import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = {}; ctx.globalThis = ctx;
vm.runInNewContext(readFileSync(new URL('../lib/player.js', import.meta.url), 'utf8'), ctx);
const P = ctx.BongPlayer;

test('isSkipButtonLabel', () => {
  for (const t of ['SKIP', 'SKIP ▶|', ' skip ⏭ ', 'SKIP▶', '건너뛰기', '광고 건너뛰기']) assert.equal(P.isSkipButtonLabel(t), true, t);
  for (const t of ['1초 후 SKIP', '5 초 후 SKIP', '광고 페이지 보기', 'SKIPPED ads', '', null]) assert.equal(P.isSkipButtonLabel(t), false, String(t));
});
test('isSkipCandidate excludes countdown and ad link', () => {
  assert.equal(P.isSkipCandidate({ text: 'SKIP ▶|' }), true);
  assert.equal(P.isSkipCandidate({ text: 'SKIP', inCountdown: true }), false);
  assert.equal(P.isSkipCandidate({ text: 'SKIP', inLink: true }), false);
  assert.equal(P.isSkipCandidate({ text: 'SKIP', dataRole: 'adLink' }), false);
  assert.equal(P.isSkipCandidate({ text: 'SKIP', dataRole: 'countDownTxt' }), false);
  assert.equal(P.isSkipCandidate({ text: 'SKIP', dataRole: 'skipBtn' }), true);
});
test('hasAdContainer', () => {
  assert.equal(P.hasAdContainer({ querySelector: s => (s === '[data-role="adVideoContainerEl"]' ? { isConnected: true } : null) }), true);
  assert.equal(P.hasAdContainer({ querySelector: () => ({ isConnected: false }) }), false);
  assert.equal(P.hasAdContainer({ querySelector: () => null }), false);
  assert.equal(P.hasAdContainer(null), false);
});
test('seekEndTime', () => {
  assert.equal(P.seekEndTime(15), 14.95);
  assert.equal(P.seekEndTime(0.01), 0);
  assert.equal(P.seekEndTime(Infinity), null);
  assert.equal(P.seekEndTime(NaN), null);
  assert.equal(P.seekEndTime(0), null);
});
