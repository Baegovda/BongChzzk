import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { blockedToggle, refreshToggle, settleToggle, startToggle } from '../lib/toggle-state.js';

test('page inject functions do not call service-worker helpers', () => {
  const source = readFileSync(new URL('../background.js', import.meta.url), 'utf8');
  const enable = source.slice(source.indexOf('function enableInPage'), source.indexOf('function disableInPage'));
  const disable = source.slice(source.indexOf('function disableInPage'), source.indexOf('function readStatusInPage'));
  assert.match(enable, /window\.top === window/);
  assert.match(disable, /window\.top === window/);
  assert.doesNotMatch(enable, /topStatus|isTopFrame/);
  assert.doesNotMatch(disable, /topStatus|isTopFrame/);
});

test('a status poll cannot turn an in-flight switch off', () => {
  const pending = startToggle(true);
  assert.equal(pending.pending, true);
  assert.equal(pending.on, true);
  const during = refreshToggle(pending, null);
  assert.equal(during.on, true);
  assert.equal(during.pending, true);
  const still = refreshToggle(pending, { enabled: false, started: false });
  assert.equal(still.on, true);
});

test('turning translation on settles only when the tab reports enabled', () => {
  const on = settleToggle(true, {
    ok: true,
    status: { enabled: true, started: true, done: 0, pending: 1 },
  });
  assert.equal(on.on, true);
  assert.equal(on.error, '');
  const missing = settleToggle(true, { ok: true, status: null });
  assert.equal(missing.on, false);
  assert.match(missing.error, /켜지 못했습니다/);
  const injected = settleToggle(true, { ok: false, message: '이 페이지에 번역기를 넣을 수 없습니다.' });
  assert.equal(injected.on, false);
  assert.match(injected.error, /넣을 수 없습니다/);
});

test('turning translation off stays off and a blocked page shows its reason', () => {
  const off = settleToggle(false, { ok: true, status: null });
  assert.equal(off.on, false);
  assert.equal(off.error, '');
  const blocked = blockedToggle('이 페이지에서는 확장 프로그램을 실행할 수 없습니다.');
  const shown = refreshToggle(blocked, null);
  assert.equal(shown.on, false);
  assert.match(shown.error, /실행할 수 없습니다/);
});
