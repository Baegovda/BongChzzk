import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = {}; ctx.globalThis = ctx;
vm.runInNewContext(readFileSync(new URL('../lib/player.js', import.meta.url), 'utf8'), ctx);
vm.runInNewContext(readFileSync(new URL('../lib/extras.js', import.meta.url), 'utf8'), ctx);
const P = ctx.BongPlayer, X = ctx.BongExtras;

test('isAdActive', () => {
  assert.equal(P.isAdActive({ adUiExists: true, adUiHidden: true, indicatorVisible: false }), false);
  assert.equal(P.isAdActive({ adUiExists: true, adUiHidden: false }), true);
  assert.equal(P.isAdActive({ adUiExists: false, indicatorVisible: true }), true);
  assert.equal(P.isAdActive({}), false);
  assert.equal(P.isAdActive(null), false);
});
test('isGuideText / isSkipText', () => {
  assert.equal(P.isGuideText('타임머신 기능으로 지난 방송을 볼 수 있어요'), true);
  assert.equal(P.isGuideText('치트키 사용법'), true);
  assert.equal(P.isGuideText('타임 머신'), true);
  assert.equal(P.isGuideText('실시간'), false);
  assert.equal(P.isSkipText('광고 건너뛰기'), true);
  assert.equal(P.isSkipText('Skip Ad'), true);
  assert.equal(P.isSkipText('Learn More'), false);
});
test('formatCount / changeDirection / eyeColor', () => {
  assert.equal(X.formatCount(1234), '1,234명');
  assert.equal(X.formatCount(NaN), '-');
  assert.equal(X.changeDirection(10, 12), 'up');
  assert.equal(X.changeDirection(12, 10), 'down');
  assert.equal(X.changeDirection(10, 10), null);
  assert.equal(X.changeDirection(undefined, 10), null);
  assert.equal(X.changeDirection(10, NaN), null);
  assert.equal(X.eyeColor('/live/abc'), '#ff4d4f');
  assert.equal(X.eyeColor('/video/123'), '#8a8f98');
});
