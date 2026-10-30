import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const ctx = {}; ctx.globalThis = ctx;
vm.runInNewContext(readFileSync(new URL('../lib/autoplay.js', import.meta.url), 'utf8'), ctx);
const A = ctx.BongAutoplay;
const base = { enabled: true, onVideoPage: true, hasVideo: true, paused: true };
test('shouldPlay', () => {
  assert.equal(A.shouldPlay(base), true);
  assert.equal(A.shouldPlay({ ...base, paused: false }), false);
  assert.equal(A.shouldPlay({ ...base, userPaused: true }), false);
  assert.equal(A.shouldPlay({ ...base, adActive: true }), false);
  assert.equal(A.shouldPlay({ ...base, enabled: false }), false);
  assert.equal(A.shouldPlay({ ...base, done: true }), false);
  assert.equal(A.shouldPlay({ ...base, ended: true }), false);
  assert.equal(A.shouldPlay({ ...base, onVideoPage: false }), false);
  assert.equal(A.shouldPlay(null), false);
});
test('isVideoPage', () => {
  assert.equal(A.isVideoPage('/live/abc'), true);
  assert.equal(A.isVideoPage('/video/123'), true);
  assert.equal(A.isVideoPage('/following'), false);
  assert.equal(A.isVideoPage('/live/'), false);
});
test('scorePlayButton', () => {
  assert.ok(A.scorePlayButton({ cls: 'pzp-button pzp-pc-playback-switch', label: '재생' }) > 0);
  assert.ok(A.scorePlayButton({ cls: 'pzp-pc__playback-switch', label: '' }) > 0);
  assert.equal(A.scorePlayButton({ cls: 'pzp-pc-playback-switch', label: '일시정지' }), 0);
  assert.equal(A.scorePlayButton({ cls: 'pzp-pc-fullscreen-button', label: '전체 화면' }), 0);
  assert.equal(A.scorePlayButton({ cls: 'pzp-pc-setting-button', label: '설정' }), 0);
  assert.equal(A.scorePlayButton({ cls: 'pzp-pc-volume-button', label: '음소거' }), 0);
  assert.ok(A.scorePlayButton({ cls: 'x', label: 'Play' }) > 0);
});
test('scorePlayButton: 실제 치지직 DOM (2026-10-31 관찰)', () => {
  assert.equal(A.scorePlayButton({ cls: 'pzp-upnext-endscreen__next-button', label: 'Play next video' }), 0);
  assert.ok(A.scorePlayButton({ cls: 'pzp-pc__center-playback-switch pzp-button pzp-playback-switch', label: 'Play' }) >= 5);
  assert.ok(A.scorePlayButton({ cls: 'pzp-pc__playback-switch pzp-button pzp-playback-switch', label: 'Play' }) >= 5);
  assert.equal(A.scorePlayButton({ cls: 'pzp-pc__playback-switch pzp-button pzp-playback-switch', label: 'Pause' }), 0);
});
