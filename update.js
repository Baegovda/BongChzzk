import { checkForUpdate, isBongManifest } from './lib/updates.js';
import { extractAll } from './lib/zip.js';

const $ = id => document.getElementById(id);
const setStatus = t => { $('status').textContent = t; };
const setError = t => { $('error').textContent = t || ''; };
let assetUrl = null;

function idb(mode, fn) {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open('bongchzzk', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onerror = () => reject(r.error);
    r.onsuccess = () => {
      const tx = r.result.transaction('kv', mode); const req = fn(tx.objectStore('kv'));
      tx.oncomplete = () => resolve(req && req.result); tx.onerror = () => reject(tx.error);
    };
  });
}
const loadDir = () => idb('readonly', s => s.get('installDir')).catch(() => null);
const saveDir = h => idb('readwrite', s => s.put(h, 'installDir'));

async function verifyDir(dir) {
  let text = '';
  try { text = await (await (await dir.getFileHandle('manifest.json')).getFile()).text(); } catch { /* 없음 */ }
  if (!isBongManifest(text)) throw new Error('선택한 폴더는 BongChzzk 확장 프로그램 폴더가 아닙니다. chrome://extensions 에서 불러온 "압축을 푼 BongChzzk 폴더"(manifest.json이 있는 곳)를 선택하세요. 크롬은 다운로드/바탕화면 폴더 자체는 선택할 수 없게 막습니다.');
}
async function getInstallDir() {
  let dir = await loadDir();
  if (dir) {
    let p = await dir.queryPermission({ mode: 'readwrite' });
    if (p !== 'granted') p = await dir.requestPermission({ mode: 'readwrite' });
    if (p === 'granted') { try { await verifyDir(dir); return dir; } catch { /* 다시 선택 */ } }
  }
  if (!window.showDirectoryPicker) throw new Error('이 브라우저는 폴더 선택을 지원하지 않습니다.');
  setStatus('확장 프로그램 설치 폴더(압축을 푼 BongChzzk 폴더)를 선택하세요…');
  dir = await window.showDirectoryPicker({ mode: 'readwrite', id: 'bongchzzk-install' });
  await verifyDir(dir);
  await saveDir(dir);
  return dir;
}
async function writeAll(dir, files) {
  for (const f of files) {
    let d = dir;
    for (const part of f.path.slice(0, -1)) d = await d.getDirectoryHandle(part, { create: true });
    const w = await (await d.getFileHandle(f.path[f.path.length - 1], { create: true })).createWritable();
    await w.write(f.data); await w.close();
  }
}

async function init() {
  try {
    const r = await checkForUpdate(chrome.runtime.getManifest().version);
    if (r.upToDate) { setStatus(r.message); return; }
    assetUrl = r.assetUrl;
    if (!assetUrl) { setStatus(r.message); setError('릴리스에 zip 파일이 없습니다.'); return; }
    setStatus(`${r.message} (현재 ${r.current}) — 아래 버튼을 눌러 업데이트하세요.`);
    $('start').disabled = false;
  } catch (e) { setStatus('업데이트 정보를 가져오지 못했습니다.'); setError(e?.message || ''); }
}

$('start').addEventListener('click', async () => {
  const btn = $('start');
  btn.disabled = true; setError('');
  try {
    const dir = await getInstallDir(); // 클릭 직후 호출해야 폴더 선택 창이 뜸
    setStatus('새 버전 다운로드 중…');
    const res = await fetch(assetUrl);
    if (!res.ok) throw new Error(`다운로드 실패 (HTTP ${res.status})`);
    setStatus('압축 해제 중…');
    const files = await extractAll(await res.arrayBuffer()); // 전부 메모리에 푼 뒤에만 씀
    const mf = files.find(f => f.path.join('/') === 'manifest.json');
    if (!isBongManifest(new TextDecoder().decode(mf.data))) throw new Error('다운로드한 zip이 BongChzzk가 아닙니다.');
    setStatus(`파일 쓰는 중… (${files.length}개)`);
    await writeAll(dir, files);
    setStatus('업데이트 완료, 확장 프로그램을 다시 로드합니다');
    setTimeout(() => chrome.runtime.reload(), 1000);
  } catch (e) {
    setStatus('업데이트하지 못했습니다.');
    setError(e?.name === 'AbortError' ? '폴더 선택이 취소되었습니다.' : (e?.message || '업데이트 실패'));
    btn.disabled = false;
  }
});
init();
