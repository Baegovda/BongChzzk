import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { safePath, listEntries, extractAll } from '../lib/zip.js';

function crc32(b) { let c, crc = ~0; for (const x of b) { c = (crc ^ x) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1; crc = (crc >>> 8) ^ c; } return ~crc >>> 0; }
function makeZip(entries) { // entries: [{name, data(Buffer), deflate}]
  const locs = [], cens = []; let off = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name); const data = e.data || Buffer.alloc(0);
    const comp = e.deflate ? zlib.deflateRawSync(data) : data; const m = e.deflate ? 8 : 0;
    const L = Buffer.alloc(30); L.writeUInt32LE(0x04034b50, 0); L.writeUInt16LE(20, 4); L.writeUInt16LE(m, 8);
    L.writeUInt32LE(crc32(data), 14); L.writeUInt32LE(comp.length, 18); L.writeUInt32LE(data.length, 22); L.writeUInt16LE(name.length, 26);
    const C = Buffer.alloc(46); C.writeUInt32LE(0x02014b50, 0); C.writeUInt16LE(20, 4); C.writeUInt16LE(20, 6); C.writeUInt16LE(m, 10);
    C.writeUInt32LE(crc32(data), 16); C.writeUInt32LE(comp.length, 20); C.writeUInt32LE(data.length, 24); C.writeUInt16LE(name.length, 28); C.writeUInt32LE(off, 42);
    locs.push(L, name, comp); cens.push(C, name); off += 30 + name.length + comp.length;
  }
  const cen = Buffer.concat(cens); const E = Buffer.alloc(22);
  E.writeUInt32LE(0x06054b50, 0); E.writeUInt16LE(entries.length, 8); E.writeUInt16LE(entries.length, 10); E.writeUInt32LE(cen.length, 12); E.writeUInt32LE(off, 16);
  return new Uint8Array(Buffer.concat([...locs, cen, E]));
}
const dec = d => Buffer.from(d).toString();

test('safePath', () => {
  assert.deepEqual(safePath('lib/zip.js'), ['lib', 'zip.js']);
  assert.deepEqual(safePath('./a//b'), ['a', 'b']);
  assert.equal(safePath('../evil.js'), null);
  assert.equal(safePath('lib/../../x'), null);
  assert.equal(safePath('/etc/passwd'), null);
  assert.equal(safePath('C:/x'), null);
  assert.equal(safePath('..\\x'), null);
  assert.equal(safePath(''), null);
});
test('extract stored + deflate with dirs', async () => {
  const big = Buffer.from('console.log(1);\n'.repeat(200));
  const z = makeZip([{ name: 'manifest.json', data: Buffer.from('{"name":"BongChzzk"}') }, { name: 'lib/' }, { name: 'lib/a.js', data: big, deflate: true }]);
  assert.equal(listEntries(z).length, 3);
  const files = await extractAll(z);
  assert.deepEqual(files.map(f => f.path.join('/')), ['manifest.json', 'lib/a.js']);
  assert.equal(dec(files[1].data), big.toString());
});
test('strips single top folder', async () => {
  const files = await extractAll(makeZip([{ name: 'BongChzzk/manifest.json', data: Buffer.from('{}') }, { name: 'BongChzzk/icons/i.png', data: Buffer.from('x'), deflate: true }]));
  assert.deepEqual(files.map(f => f.path.join('/')), ['manifest.json', 'icons/i.png']);
});
test('rejects zip-slip and missing manifest', async () => {
  await assert.rejects(extractAll(makeZip([{ name: 'manifest.json', data: Buffer.from('{}') }, { name: '../x.js', data: Buffer.from('x') }])), /안전하지 않은/);
  await assert.rejects(extractAll(makeZip([{ name: 'a.js', data: Buffer.from('x') }])), /manifest/);
  assert.throws(() => listEntries(new Uint8Array(10)), /zip/);
});
