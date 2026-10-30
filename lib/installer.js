// BongChzzk 업데이트 설치 순수 로직
import { compareVersions } from './updates.js';

// 쓰기 순서: 업데이트 페이지/팝업 파일 먼저, 나머지, manifest.json은 맨 마지막(크롬이 manifest 변경 시 재로드하므로)
export function orderFiles(files) {
  const key = f => f.path.join('/');
  const first = new Set(['update.html', 'update.js', 'popup.html', 'popup.js', 'lib/installer.js', 'lib/zip.js', 'lib/updates.js']);
  const rank = f => key(f) === 'manifest.json' ? 2 : first.has(key(f)) ? 0 : 1;
  return [...files].sort((a, b) => rank(a) - rank(b));
}

export function bytesEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// 저장된 중단 업데이트 처리: 'resume'(이어서 완료) | 'clear'(이미 적용됨/무효) | 'none'
export function pendingDecision(pending, runningVersion) {
  if (!pending) return 'none';
  if (!pending.version || !Array.isArray(pending.files) || !pending.files.length) return 'clear';
  return compareVersions(pending.version, runningVersion) > 0 ? 'resume' : 'clear';
}

export const versionLine = (from, to) => `${from} → ${to}`;

// items를 limit개씩 병렬 처리. 첫 오류에서 중단(이미 시작한 배치는 끝까지 기다림)
export async function inBatches(items, limit, fn) {
  for (let i = 0; i < items.length; i += limit) {
    await Promise.all(items.slice(i, i + limit).map((x, j) => fn(x, i + j)));
  }
}
