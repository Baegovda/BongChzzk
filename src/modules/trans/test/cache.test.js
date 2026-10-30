import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addStats,
  coerceCacheRecord,
  createCacheStats,
  entryBytes,
  formatBytes,
  planEvictions,
} from '../lib/cache-policy.js';

const DAY = 24 * 60 * 60 * 1000;

test('cache records migrate from strings and approximate their size', () => {
  const now = 5_000;
  const legacy = coerceCacheRecord('abc', '무료배송', now);
  assert.equal(legacy.value, '무료배송');
  assert.equal(legacy.usedAt, now);
  assert.equal(legacy.bytes, entryBytes('abc', '무료배송'));
  const current = coerceCacheRecord('abc', { value: '무료배송', usedAt: 10, bytes: 4 }, now);
  assert.equal(current.usedAt, 10);
  assert.equal(current.bytes, 4);
  assert.equal(coerceCacheRecord('abc', null, now), null);
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(1536), '1.5 KB');
  assert.equal(formatBytes(2.5 * 1024 * 1024), '2.5 MB');
});

test('eviction drops expired entries and then the least recently used', () => {
  const now = 1_000_000_000_000;
  const entries = [
    { key: 'old', usedAt: now - 100 * DAY, bytes: 10 },
    { key: 'mid', usedAt: now - 10 * DAY, bytes: 50 },
    { key: 'new', usedAt: now - DAY, bytes: 40 },
    { key: 'fresh', usedAt: now, bytes: 30 },
  ];
  assert.deepEqual(planEvictions(entries, { now, maxAgeDays: 90, maxBytes: 0 }), ['old']);
  assert.deepEqual(planEvictions(entries, { now, maxAgeDays: 0, maxBytes: 0 }), []);
  assert.deepEqual(planEvictions(entries, { now, maxAgeDays: 0, maxBytes: 100 }), ['old', 'mid']);
  assert.deepEqual(planEvictions(entries, { now, maxAgeDays: 90, maxBytes: 80 }), ['old', 'mid']);
  assert.deepEqual(planEvictions(entries, { now, maxAgeDays: 30, maxBytes: 20 * 1024 * 1024 }), ['old']);
});

test('saved cache stats add up across overlapping updates and then reset', async () => {
  const memory = {};
  const storage = {
    async get(key) { return { [key]: memory[key] }; },
    async set(values) { Object.assign(memory, values); },
  };
  const stats = createCacheStats(storage);
  await Promise.all([
    stats.noteSaved({ strings: 2, calls: 1 }),
    stats.noteSaved({ strings: 3, calls: 1 }),
  ]);
  assert.deepEqual(await stats.read(), { savedStrings: 5, savedCalls: 2 });
  assert.deepEqual(addStats({ savedStrings: 5, savedCalls: 2 }, { strings: 0, calls: 0 }), {
    savedStrings: 5,
    savedCalls: 2,
  });
  await stats.reset();
  assert.deepEqual(await stats.read(), { savedStrings: 0, savedCalls: 0 });
  assert.equal(memory['trans.cacheStats'].savedStrings, 0);
});
