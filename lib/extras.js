// BongChzzk 부가 기능 순수 로직 (전역 BongExtras, 테스트는 vm으로 로드)
(function (root) {
  'use strict';
  // "/live/<32자리 hex>" 경로에서 채널 ID 추출, 아니면 null
  function channelIdFromPath(path) {
    const m = String(path || '').match(/^\/live\/([0-9a-f]{32})(?:[/?#]|$)/i);
    return m ? m[1].toLowerCase() : null;
  }
  // 시청자 수 표시 문자열. 숫자가 아니면 '-'
  function formatViewers(n) {
    return typeof n === 'number' && isFinite(n) && n >= 0 ? '👁 ' + Math.round(n).toLocaleString('ko-KR') + '명' : '👁 -';
  }
  // 이동 목표 시간 계산. 범위 [lo, hi] 안으로 제한. 범위가 잘못되면 null
  function clampSeek(current, delta, lo, hi) {
    if (![current, delta, lo, hi].every(Number.isFinite) || hi < lo) return null;
    return Math.min(hi, Math.max(lo, current + delta));
  }
  // 라이브는 seekable 범위, VOD는 [0, duration]. seekable: [[start,end],...] 형태의 마지막 구간 사용
  function seekRange(isLive, duration, ranges) {
    if (isLive || !Number.isFinite(duration)) {
      if (!ranges || !ranges.length) return null;
      const r = ranges[ranges.length - 1];
      return [r[0], Math.max(r[0], r[1] - 0.5)]; // 라이브 엣지보다 살짝 앞에서 멈춤
    }
    return [0, duration];
  }
  // 채팅 글씨 크기: 12~28 정수, 0/잘못된 값은 0(=기본, 주입 안 함)
  function normalizeFontSize(v) {
    const n = Math.round(Number(v));
    return n >= 12 && n <= 28 ? n : 0;
  }
  // 숫자만: '1,234명' / '-'
  function formatCount(n) {
    return typeof n === 'number' && isFinite(n) && n >= 0 ? Math.round(n).toLocaleString('ko-KR') + '명' : '-';
  }
  // 이전 → 현재 변화 방향: 'up' | 'down' | null (둘 중 하나라도 숫자가 아니면 null)
  function changeDirection(prev, next) {
    if (!(typeof prev === 'number' && isFinite(prev)) || !(typeof next === 'number' && isFinite(next)) || prev === next) return null;
    return next > prev ? 'up' : 'down';
  }
  // 라이브는 빨강, 다시보기/그 외는 회색
  const eyeColor = path => /^\/live\//.test(String(path || '')) ? '#ff4d4f' : '#8a8f98';
  // 후원 랭킹에서 닉네임으로 볼 텍스트인지 (숫자/쉼표/금액, '1등', '랭킹' 류 제외)
  function isNameText(t) {
    const s = String(t || '').trim();
    if (!s) return false;
    if (/^[\d,.\s]+(원|치즈|개)?$/.test(s)) return false;
    if (/^\d+\s*(등|위)$/.test(s)) return false;
    if (/랭킹/.test(s)) return false;
    return true;
  }
  // #aside-chatting 직계 자식 정보 → 랭킹 줄 인덱스: 0번(헤더) 이후, 채팅 목록(log) 앞, 입력창/로그 미포함 div.
  // log가 없으면 랭킹 신호(signal)가 있는 줄만.
  function rankRowIndices(kids) {
    const list = kids || [];
    const logAt = list.findIndex(k => k.hasLog);
    const out = [];
    list.forEach((k, i) => {
      if (i === 0 || !k.isDiv || k.hasLog || k.hasInput) return;
      if (logAt >= 0 ? i < logAt : k.signal) out.push(i);
    });
    return out;
  }
  const SEEK_ALLOWED = [5, 10, 15, 30];
  const normalizeSeekSec = v => SEEK_ALLOWED.includes(Number(v)) ? Number(v) : 5;
  root.BongExtras = { isNameText, rankRowIndices, channelIdFromPath, formatViewers, formatCount, changeDirection, eyeColor, clampSeek, seekRange, normalizeFontSize, normalizeSeekSec };
})(typeof globalThis !== 'undefined' ? globalThis : this);
