import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = { URL }; ctx.globalThis = ctx;
vm.runInNewContext(readFileSync(new URL('../lib/watch.js', import.meta.url), 'utf8'), ctx);
vm.runInNewContext(readFileSync(new URL('../lib/wide.js', import.meta.url), 'utf8'), ctx);
const W = ctx.BongWatch, D = ctx.BongWide;
const A = 'a'.repeat(32), B = 'b'.repeat(32), U = 'ABCDEF0123456789abcdef0123456789';

test('parseChannelInput', () => {
  assert.equal(W.parseChannelInput(U), U.toLowerCase());
  assert.equal(W.parseChannelInput(`https://chzzk.naver.com/live/${A}`), A);
  assert.equal(W.parseChannelInput(`https://chzzk.naver.com/${B}/videos`), B);
  assert.equal(W.parseChannelInput(`chzzk.naver.com/${A}?x=1`), A);
  assert.equal(W.parseChannelInput(`https://evil.com/live/${A}`), null);
  assert.equal(W.parseChannelInput('https://chzzk.naver.com/following'), null);
  assert.equal(W.parseChannelInput(''), null);
});
test('detectTransitions only offline→live', () => {
  assert.deepEqual([...W.detectTransitions({}, { [A]: 'OPEN' })], []);
  assert.deepEqual([...W.detectTransitions({ [A]: 'CLOSE', [B]: 'OPEN' }, { [A]: 'OPEN', [B]: 'OPEN' })], [A]);
  assert.deepEqual([...W.detectTransitions({ [A]: 'OPEN' }, { [A]: 'CLOSE' })], []);
});
test('pickTarget order and current page', () => {
  assert.equal(W.pickTarget([B, A], [A, B], '/'), B);
  assert.equal(W.pickTarget([B, A], [A, B], `/live/${B}`), A);
  assert.equal(W.pickTarget([A], [A], `/live/${A}`), null);
  assert.equal(W.pickTarget([A], [], '/'), null);
});
test('canLead', () => {
  assert.equal(W.canLead(null, 'x', 100, 15000), true);
  assert.equal(W.canLead({ id: 'y', ts: 0 }, 'x', 1000, 15000), false);
  assert.equal(W.canLead({ id: 'y', ts: 0 }, 'x', 20000, 15000), true);
  assert.equal(W.canLead({ id: 'x', ts: 0 }, 'x', 1, 15000), true);
});
test('wide scoreCandidate / wideState', () => {
  assert.ok(D.scoreCandidate({ cls: 'pzp-pc-viewmode-button', label: '넓은 화면' }) > 3);
  assert.equal(D.scoreCandidate({ cls: 'pzp-pc-fullscreen-button', label: '전체 화면' }), 0);
  assert.equal(D.scoreCandidate({ cls: 'pzp-pc-setting-button', label: '설정' }), 0);
  assert.equal(D.wideState({ ariaPressed: 'true' }), true);
  assert.equal(D.wideState({ ariaChecked: 'false' }), false);
  assert.equal(D.wideState({ label: '넓은 화면 해제' }), true);
  assert.equal(D.wideState({ label: '넓은 화면', cls: 'pzp-pc-viewmode-button' }), null);
  assert.equal(D.wideState({ layoutWide: true }), true);
});
