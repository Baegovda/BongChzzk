import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const ctx = {}; ctx.globalThis = ctx;
vm.runInNewContext(readFileSync(new URL('../lib/retrytimer.js', import.meta.url), 'utf8'), ctx);
const R = ctx.BongRetryTimer;
test('first stall: threshold only', () => {
  assert.equal(R.nextRecoverIn(10000, 8000, 0, 0, 5, 10), 3000);
  assert.equal(R.nextRecoverIn(13000, 8000, 0, 0, 5, 10), 0);
  assert.equal(R.nextRecoverIn(20000, 8000, 0, 0, 5, 10), 0);
});
test('backoff after recover dominates', () => {
  // level 1 → 10s, level 2 → 15s
  assert.equal(R.nextRecoverIn(100000, 90000, 98000, 1, 5, 10), 8000);
  assert.equal(R.nextRecoverIn(100000, 90000, 98000, 2, 5, 10), 13000);
});
test('step labels and total', () => {
  assert.equal(R.stepLabel(0), '1단계: 다시 재생');
  assert.equal(R.stepLabel(3), '4단계: 플레이어 새로 띄우기');
  assert.equal(R.stepLabel(9), '4단계: 플레이어 새로 띄우기');
  assert.equal(R.waitTotal(1000, 0, 0, 5, 10), 5000);
  assert.equal(R.waitTotal(1000, 2000, 1, 5, 10), 10000);
});
const base = { now: 100000, enabled: true, onVideoPage: true, visible: true, adActive: false, userPaused: false, ended: false, offline: false, ok: false, loopBusy: false, since: 0, attempt: 0, lastAttempt: 0, thresholdSec: 5, recentReloads: 0 };
test('watchdog: guards reset', () => {
  for (const k of ['adActive', 'userPaused', 'ended', 'offline', 'ok', 'loopBusy']) assert.equal(R.watchdogDecide({ ...base, [k]: true }).action, 'reset');
  for (const k of ['enabled', 'onVideoPage', 'visible']) assert.equal(R.watchdogDecide({ ...base, [k]: false }).action, 'reset');
  assert.equal(R.watchdogDecide({ ...base }).action, 'start');
});
test('watchdog: delay min 10s, threshold+5', () => {
  assert.equal(R.wdDelayMs(3), 10000);
  assert.equal(R.wdDelayMs(8), 13000);
  const d = R.watchdogDecide({ ...base, since: 95000 });
  assert.equal(d.action, 'wait'); assert.equal(d.waitMs, 5000); assert.equal(d.next, 'play');
});
test('watchdog: escalation play → remount → reload, reload capped', () => {
  assert.equal(R.watchdogDecide({ ...base, since: 80000 }).action, 'play');
  assert.equal(R.watchdogDecide({ ...base, since: 70000, attempt: 1, lastAttempt: 85000 }).action, 'remount');
  assert.equal(R.watchdogDecide({ ...base, since: 70000, attempt: 1, lastAttempt: 95000 }).action, 'wait');
  assert.equal(R.watchdogDecide({ ...base, since: 50000, attempt: 2, lastAttempt: 85000 }).action, 'reload');
  assert.equal(R.watchdogDecide({ ...base, since: 50000, attempt: 2, lastAttempt: 85000, recentReloads: 2 }).action, 'remount');
});
test('recentReloadTimes keeps last 5 minutes', () => {
  assert.deepEqual([...R.recentReloadTimes([1000, 400000, 'x', 500000], 500000)], [400000, 500000]);
  assert.deepEqual([...R.recentReloadTimes(null, 1)], []);
});
