import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = {}; ctx.globalThis = ctx;
vm.runInNewContext(readFileSync(new URL('../lib/following.js', import.meta.url), 'utf8'), ctx);
const F = ctx.BongFollowing;

test('normalizeInterval', () => {
  assert.equal(F.normalizeInterval(5), 5);
  assert.equal(F.normalizeInterval('30'), 30);
  assert.equal(F.normalizeInterval(7), 5);
  assert.equal(F.normalizeInterval(undefined), 5);
});
test('nextDelay backoff', () => {
  assert.equal(F.nextDelay(5, 0), 5000);
  assert.equal(F.nextDelay(5, 2), 20000);
  assert.equal(F.nextDelay(60, 5), 300000);
  assert.equal(F.nextDelay(10, -1), 10000);
});
test('liveSignature', () => {
  const j = { content: { followingList: [
    { channelId: 'b', streamer: { openLive: true } },
    { channelId: 'a', streamer: { openLive: true } },
    { channelId: 'c', streamer: { openLive: false } }] } };
  assert.equal(F.liveSignature(j), 'a,b');
  assert.equal(F.liveSignature({}), null);
  assert.equal(F.liveSignature({ content: { followingList: [] } }), '');
});
test('hasChanged', () => {
  assert.equal(F.hasChanged(null, 'a'), false);
  assert.equal(F.hasChanged('a', 'a'), false);
  assert.equal(F.hasChanged('a', 'a,b'), true);
  assert.equal(F.hasChanged('a', null), false);
});
