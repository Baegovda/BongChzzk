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
test('adTextKind / isSafeSkipLabel / isAdDuration', () => {
  assert.equal(P.adTextKind('AD 1/1'), 'counter');
  assert.equal(P.adTextKind('ad 2 / 3'), 'counter');
  assert.equal(P.adTextKind('1 초 후 SKIP'), 'countdown');
  assert.equal(P.adTextKind('5초 후 skip'), 'countdown');
  assert.equal(P.adTextKind('SKIP'), 'skip');
  assert.equal(P.adTextKind('건너뛰기'), 'skip');
  assert.equal(P.adTextKind('광고 페이지 보기'), 'clickthrough');
  assert.equal(P.adTextKind('00:04 / 00:15'), null);
  assert.equal(P.adTextKind('실시간'), null);
  assert.equal(P.isSafeSkipLabel(' SKIP '), true);
  assert.equal(P.isSafeSkipLabel('1 초 후 SKIP'), false);
  assert.equal(P.isSafeSkipLabel('광고 페이지 보기'), false);
  assert.equal(P.isAdDuration(15), true);
  assert.equal(P.isAdDuration(Infinity), false);
  assert.equal(P.isAdDuration(600), false);
  assert.equal(P.isAdDuration(NaN), false);
  assert.equal(P.isAdActive({ textHits: 1 }), true);
});

test('isPurchaseGuideDialogText', () => {
  assert.equal(P.isPurchaseGuideDialogText('치트키를 구매하면\n타임머신 기능을 이용할 수 있어요! 치트키 구매 혜택 다시보기 무제한 치트키 구매하기'), true);
  assert.equal(P.isPurchaseGuideDialogText('방송을 신고하시겠어요? 취소 신고'), false);
  assert.equal(P.isPurchaseGuideDialogText('치트키 사용법'), false);
  assert.equal(P.isPurchaseGuideDialogText(null), false);
});
