import { checkForUpdate, isBongManifest } from './lib/updates.js';
import { extractAll } from './lib/zip.js';
import { orderFiles, bytesEqual, pendingDecision, versionLine, inBatches } from './lib/installer.js';

const $ = id => document.getElementById(id);
const setStatus = t => { $('status').textContent = t; };
const setError = t => { $('error').textContent = t || ''; };
const running = chrome.runtime.getManifest().version;
let release = null;

// IndexedDB: kv(설치 폴더 핸들), pending(중단된 업데이트)
function openDb() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open('bongchzzk', 2);
    r.onupgradeneeded = () => {
      for (const s of ['kv', 'pending']) if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s);
    };
    r.onerror = () => reject(r.error);
    r.onsuccess = () => resolve(r.result);
  });
}
async function idb(store, mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode); const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req && req.result); tx.onerror = () => reject(tx.error);
  });
}
const loadDir = () => idb('kv', 'readonly', s => s.get('installDir')).catch(() => null);
const saveDir = h => idb('kv', 'readwrite', s => s.put(h, 'installDir'));
const loadPending = () => idb('pending', 'readonly', s => s.get('pending')).catch(() => null);
const savePending = p => idb('pending', 'readwrite', s => s.put(p, 'pending'));
const clearPending = () => idb('pending', 'readwrite', s => s.delete('pending')).catch(() => {});

class StepError extends Error {
  constructor(step, e) { super(`${step}: ${e?.name ? e.name + ' - ' : ''}${e?.message || e}`); this.step = step; }
}

async function verifyDir(dir) {
  let text = '';
  try { text = await (await (await dir.getFileHandle('manifest.json')).getFile()).text(); } catch { /* 없음 */ }
  if (!isBongManifest(text)) throw new Error('선택한 폴더는 BongChzzk 확장 프로그램 폴더가 아닙니다. chrome://extensions 에서 불러온 "압축을 푼 BongChzzk 폴더"(manifest.json이 있는 곳)를 선택하세요. 크롬은 다운로드/바탕화면 폴더 자체는 선택할 수 없게 막습니다.');
}
async function getInstallDir({ allowPick }) {
  let dir = await loadDir();
  if (dir) {
    let p = await dir.queryPermission({ mode: 'readwrite' });
    if (p !== 'granted') p = await dir.requestPermission({ mode: 'readwrite' });
    if (p === 'granted') { try { await verifyDir(dir); return dir; } catch { /* 다시 선택 */ } }
  }
  if (!allowPick) throw new Error('저장된 설치 폴더에 접근할 수 없습니다. "폴더 선택/업데이트 시작"으로 다시 진행하세요.');
  if (!window.showDirectoryPicker) throw new Error('이 브라우저는 폴더 선택을 지원하지 않습니다.');
  setStatus('확장 프로그램 설치 폴더(압축을 푼 BongChzzk 폴더)를 선택하세요…');
  try {
    dir = await window.showDirectoryPicker({ mode: 'readwrite', id: 'bongchzzk-install' });
  } catch (e) {
    if (e?.name === 'AbortError') { const c = new Error('폴더 선택이 취소되었습니다.'); c.cancel = true; throw c; }
    throw new StepError('폴더 선택 실패', e);
  }
  await verifyDir(dir);
  await saveDir(dir);
  return dir;
}

async function readExisting(dir, path) {
  try {
    let d = dir;
    for (const part of path.slice(0, -1)) d = await d.getDirectoryHandle(part);
    return new Uint8Array(await (await (await d.getFileHandle(path.at(-1))).getFile()).arrayBuffer());
  } catch { return null; }
}
async function writeOne(dir, f) {
  const name = f.path.join('/');
  try {
    let d = dir;
    for (const part of f.path.slice(0, -1)) d = await d.getDirectoryHandle(part, { create: true });
    const w = await (await d.getFileHandle(f.path.at(-1), { create: true })).createWritable();
    await w.write(f.data); await w.close();
  } catch (e) { throw new StepError(`쓰기 실패(${name})`, e); }
}

// 바뀐 파일만, manifest.json은 맨 마지막에 단독으로 씀
async function installFiles(dir, files, from, to) {
  const ordered = orderFiles(files);
  const changed = [];
  for (const f of ordered) if (!bytesEqual(await readExisting(dir, f.path), f.data)) changed.push(f);
  const manifest = changed.filter(f => f.path.join('/') === 'manifest.json');
  const rest = changed.filter(f => f.path.join('/') !== 'manifest.json');
  const total = changed.length;
  let done = 0;
  setStatus(`파일 쓰는 중… 0/${total} (변경 없는 ${files.length - total}개 건너뜀)`);
  await inBatches(rest, 6, async f => { await writeOne(dir, f); setStatus(`파일 쓰는 중… ${++done}/${total}`); });
  for (const f of manifest) { await writeOne(dir, f); setStatus(`파일 쓰는 중… ${++done}/${total}`); }
  await clearPending();
  setStatus(`${versionLine(from, to)} 업데이트 완료, 다시 로드합니다`);
  setTimeout(() => chrome.runtime.reload(), 800);
}

async function init() {
  const pending = await loadPending();
  const decision = pendingDecision(pending, running);
  if (decision === 'clear') await clearPending();
  if (decision === 'resume') {
    $('ver').textContent = versionLine(running, pending.version);
    setStatus('이전 업데이트가 중간에 멈췄습니다. 아래 버튼을 눌러 마저 설치하세요.');
    $('resume').hidden = false;
  }
  try {
    release = await checkForUpdate(running);
    if (decision === 'resume') return;
    $('ver').textContent = release.upToDate ? running : versionLine(running, release.latest);
    if (release.upToDate) { setStatus(release.message); return; }
    if (!release.assetUrl) { setStatus(release.message); setError('릴리스에 zip 파일이 없습니다.'); return; }
    setStatus('아래 버튼을 눌러 업데이트하세요.');
    $('start').disabled = false;
  } catch (e) {
    if (decision !== 'resume') { setStatus('업데이트 정보를 가져오지 못했습니다.'); setError(e?.message || ''); }
  }
}

function showFail(e) {
  setStatus('업데이트하지 못했습니다.');
  setError(e?.cancel ? e.message : (e instanceof StepError || e?.step ? e.message : `${e?.name || 'Error'}: ${e?.message || e}`));
}

$('start').addEventListener('click', async () => {
  const btn = $('start'); btn.disabled = true; setError('');
  try {
    const dir = await getInstallDir({ allowPick: true }); // 클릭 직후 호출해야 폴더 선택 창이 뜸
    setStatus('새 버전 다운로드 중…');
    let buf;
    try {
      const res = await fetch(release.assetUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      buf = await res.arrayBuffer();
    } catch (e) { throw new StepError('다운로드 실패', e); }
    setStatus('압축 해제 중…');
    let files;
    try { files = await extractAll(buf); } catch (e) { throw new StepError('압축 해제 실패', e); }
    const mf = files.find(f => f.path.join('/') === 'manifest.json');
    if (!isBongManifest(new TextDecoder().decode(mf.data))) throw new Error('다운로드한 zip이 BongChzzk가 아닙니다.');
    const to = JSON.parse(new TextDecoder().decode(mf.data)).version || release.latest;
    try { await savePending({ version: to, files }); } catch (e) { throw new StepError('임시 저장 실패', e); }
    await installFiles(dir, files, running, to);
  } catch (e) { showFail(e); btn.disabled = false; }
});

$('resume').addEventListener('click', async () => {
  const btn = $('resume'); btn.disabled = true; setError('');
  try {
    const pending = await loadPending();
    if (pendingDecision(pending, running) !== 'resume') { setStatus('이어서 할 업데이트가 없습니다.'); await clearPending(); return; }
    const dir = await getInstallDir({ allowPick: true });
    await installFiles(dir, pending.files, running, pending.version);
  } catch (e) { showFail(e); btn.disabled = false; }
});

init();
