// 작은 zip 리더 (stored/deflate). 브라우저(popup)와 node 테스트 모두에서 동작.
const SIG_EOCD = 0x06054b50, SIG_CEN = 0x02014b50, SIG_LOC = 0x04034b50;

// zip-slip 방지: 안전한 상대 경로면 정규화된 경로 배열, 아니면 null
export function safePath(name) {
  const n = String(name || '').replace(/\\/g, '/');
  if (!n || n.startsWith('/') || /^[a-zA-Z]:/.test(n) || n.includes('\0')) return null;
  const parts = n.split('/').filter(p => p !== '' && p !== '.');
  if (!parts.length || parts.some(p => p === '..')) return null;
  return parts;
}

// 중앙 디렉터리 읽기 → [{ name, method, compSize, size, offset, isDir }]
export function listEntries(buf) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 22 - 65535); i--) {
    if (dv.getUint32(i, true) === SIG_EOCD) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('zip 형식이 아닙니다.');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const out = [];
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(p, true) !== SIG_CEN) throw new Error('zip 중앙 디렉터리가 손상되었습니다.');
    const method = dv.getUint16(p + 10, true);
    const compSize = dv.getUint32(p + 20, true);
    const size = dv.getUint32(p + 24, true);
    const nLen = dv.getUint16(p + 28, true), eLen = dv.getUint16(p + 30, true), cLen = dv.getUint16(p + 32, true);
    const offset = dv.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nLen));
    out.push({ name, method, compSize, size, offset, isDir: name.endsWith('/') });
    p += 46 + nLen + eLen + cLen;
  }
  return out;
}

async function inflateRaw(data) {
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([data]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// 모든 파일을 메모리로 추출. 하나라도 실패/위험하면 예외 → 아무것도 쓰지 않음.
// 반환: [{ path: ['lib','x.js'], data: Uint8Array }]. 공통 최상위 폴더 하나만 있으면 벗겨냄.
export async function extractAll(buf) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const files = [];
  for (const e of listEntries(u8)) {
    const parts = safePath(e.name);
    if (!parts) throw new Error('안전하지 않은 경로가 zip에 있습니다: ' + e.name);
    if (e.isDir) continue;
    if (dv.getUint32(e.offset, true) !== SIG_LOC) throw new Error('zip 항목 헤더 손상: ' + e.name);
    const start = e.offset + 30 + dv.getUint16(e.offset + 26, true) + dv.getUint16(e.offset + 28, true);
    const raw = u8.subarray(start, start + e.compSize);
    let data;
    if (e.method === 0) data = raw.slice();
    else if (e.method === 8) data = await inflateRaw(raw);
    else throw new Error('지원하지 않는 압축 방식: ' + e.method);
    if (data.length !== e.size) throw new Error('압축 해제 크기 불일치: ' + e.name);
    files.push({ path: parts, data });
  }
  if (!files.length) throw new Error('zip이 비어 있습니다.');
  const first = files[0].path[0];
  if (!files.some(f => f.path.length === 1 && f.path[0] === 'manifest.json') && files.every(f => f.path.length > 1 && f.path[0] === first)) {
    files.forEach(f => f.path.shift());
  }
  if (!files.some(f => f.path.join('/') === 'manifest.json')) throw new Error('zip에 manifest.json이 없습니다.');
  return files;
}
