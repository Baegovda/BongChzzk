import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = {}; ctx.globalThis = ctx;
vm.runInNewContext(readFileSync(new URL('../lib/quality.js', import.meta.url), 'utf8'), ctx);
const Q = ctx.BongQuality;

test('parseHeight', () => {
  assert.equal(Q.parseHeight('1080p'), 1080);
  assert.equal(Q.parseHeight(' 720p 60fps '), 720);
  assert.equal(Q.parseHeight('1080p60'), 1080);
  assert.equal(Q.parseHeight('자동'), null);
  assert.equal(Q.parseHeight('자동(720p)'), null);
  assert.equal(Q.parseHeight(''), null);
});
test('pickQualityIndex prefers target', () => {
  assert.equal(Q.pickQualityIndex(['1080p', '720p', '480p', '자동'], 1080), 0);
  assert.equal(Q.pickQualityIndex(['자동', '360p', '720p', '1080p'], 1080), 3);
});
test('pickQualityIndex falls back below target', () => {
  assert.equal(Q.pickQualityIndex(['720p', '480p', '360p', '자동'], 1080), 0);
  assert.equal(Q.pickQualityIndex(['1080p', '720p', '480p'], 480), 2);
  assert.equal(Q.pickQualityIndex(['1080p', '720p'], 360), 1);
  assert.equal(Q.pickQualityIndex(['자동'], 1080), -1);
  assert.equal(Q.pickQualityIndex([], 1080), -1);
});
test('isSatisfied', () => {
  assert.equal(Q.isSatisfied('1080p', ['1080p', '720p'], 1080), true);
  assert.equal(Q.isSatisfied('자동', ['1080p', '720p'], 1080), false);
  assert.equal(Q.isSatisfied('720p', ['720p', '480p'], 1080), true);
  assert.equal(Q.isSatisfied('480p', ['자동'], 1080), true);
});
test('real pzp labels (no 자동, 60fps suffix)', () => {
  assert.equal(Q.pickQualityIndex(['1080p', '720p', '480p', '360p'], 1080), 0);
  assert.equal(Q.isSatisfied('360p', ['1080p', '720p', '480p', '360p'], 1080), false);
  assert.equal(Q.parseHeight('1080p 60fps'), 1080);
});
