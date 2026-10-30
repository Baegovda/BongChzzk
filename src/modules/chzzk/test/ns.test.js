// BongExtend: 치지직 저장소 구역 shim(lib/ns.js) 확인
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function setup() {
  const store = { sync: {}, local: {} };
  const listeners = [];
  const area = name => ({
    get(d, cb) {
      const out = {};
      if (d && typeof d === 'object' && !Array.isArray(d)) for (const k in d) out[k] = k in store[name] ? store[name][k] : d[k];
      else for (const k of [].concat(d)) if (k in store[name]) out[k] = store[name][k];
      cb(out);
    },
    set(o, cb) {
      const changes = {};
      for (const k in o) { changes[k] = { oldValue: store[name][k], newValue: o[k] }; store[name][k] = o[k]; }
      listeners.forEach(fn => fn(changes, name));
      cb && cb();
    },
  });
  const chrome = { runtime: { id: 'x' }, storage: { sync: area('sync'), local: area('local'), onChanged: { addListener: fn => listeners.push(fn) } } };
  const ctx = { chrome };
  ctx.globalThis = ctx;
  vm.runInNewContext(readFileSync(new URL('../lib/ns.js', import.meta.url), 'utf8'), ctx);
  return { ctx, store, chrome };
}

test('settings are saved under chzzk. and read back with the old names', async () => {
  const { ctx, store } = setup();
  await new Promise(r => ctx.BCStore.sync.set({ vivid: false }, r));
  assert.deepEqual(store.sync, { 'chzzk.vivid': false });
  const v = await new Promise(r => ctx.BCStore.sync.get({ vivid: true, toast: true }, r));
  assert.deepEqual({ ...v }, { vivid: false, toast: true });
  const l = await ctx.BCStore.local.get({ recoverCount: 0 });
  assert.equal(l.recoverCount, 0);
});

test('change events carry the old names and skip other modules', async () => {
  const { ctx, chrome } = setup();
  const seen = [];
  ctx.BCStore.onChanged.addListener((c, area) => seen.push([Object.keys(c), area]));
  chrome.storage.local.set({ 'trans.settings': {} });
  await ctx.BCStore.sync.set({ watchList: [] });
  assert.equal(seen.length, 1);
  assert.deepEqual([...seen[0][0]], ['watchList']);
  assert.equal(seen[0][1], 'sync');
});
