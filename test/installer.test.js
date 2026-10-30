import test from 'node:test';
import assert from 'node:assert/strict';
import { orderFiles, bytesEqual, pendingDecision, versionLine, inBatches } from '../lib/installer.js';

const f = p => ({ path: p.split('/'), data: new Uint8Array([1]) });
test('orderFiles: manifest last, update files first', () => {
  const out = orderFiles([f('manifest.json'), f('content.js'), f('lib/watch.js'), f('update.js'), f('update.html')]).map(x => x.path.join('/'));
  assert.equal(out.at(-1), 'manifest.json');
  assert.deepEqual(out.slice(0, 2).sort(), ['update.html', 'update.js']);
  assert.equal(out.length, 5);
});
test('bytesEqual', () => {
  assert.equal(bytesEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2])), true);
  assert.equal(bytesEqual(new Uint8Array([1, 2]), new Uint8Array([1, 3])), false);
  assert.equal(bytesEqual(new Uint8Array([1]), new Uint8Array([1, 2])), false);
  assert.equal(bytesEqual(null, new Uint8Array()), false);
});
test('pendingDecision', () => {
  const p = { version: '1.5.1', files: [f('a.js')] };
  assert.equal(pendingDecision(null, '1.5.0'), 'none');
  assert.equal(pendingDecision(p, '1.5.0'), 'resume');
  assert.equal(pendingDecision(p, '1.5.1'), 'clear');
  assert.equal(pendingDecision(p, '1.6.0'), 'clear');
  assert.equal(pendingDecision({ version: '2.0.0', files: [] }, '1.0.0'), 'clear');
});
test('versionLine / inBatches', async () => {
  assert.equal(versionLine('1.4.0', '1.5.0'), '1.4.0 → 1.5.0');
  const seen = []; let active = 0, max = 0;
  await inBatches([1, 2, 3, 4, 5, 6, 7], 3, async (x, i) => { active++; max = Math.max(max, active); await new Promise(r => setTimeout(r, 2)); seen.push(i); active--; });
  assert.equal(seen.length, 7); assert.ok(max <= 3);
  await assert.rejects(inBatches([1, 2], 2, async x => { if (x === 2) throw new Error('boom'); }), /boom/);
});
