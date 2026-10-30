// BongChzzk 팔로잉 채널 자동 새로고침 순수 로직 (전역 BongFollowing, 테스트는 vm으로 로드)
(function (root) {
  'use strict';
  const ALLOWED = [5, 10, 30, 60];
  // 허용 간격(초)으로 정규화. 잘못된 값은 5초.
  function normalizeInterval(sec) {
    const n = Number(sec);
    return ALLOWED.includes(n) ? n : 5;
  }
  // 연속 실패 횟수에 따른 다음 대기(ms): 기본 간격 * 2^실패, 최대 5분
  function nextDelay(sec, failures) {
    const base = normalizeInterval(sec) * 1000;
    const f = Math.max(0, Math.min(10, Number(failures) || 0));
    return Math.min(base * Math.pow(2, f), 300000);
  }
  // followings/live 응답에서 라이브 채널 ID 집합의 서명(정렬된 문자열). 형식이 이상하면 null.
  function liveSignature(json) {
    const list = json && json.content && json.content.followingList;
    if (!Array.isArray(list)) return null;
    const ids = list.filter(x => x && x.channelId && (!x.streamer || x.streamer.openLive !== false))
      .map(x => String(x.channelId)).sort();
    return ids.join(',');
  }
  // 이전 서명 대비 변화 여부 (최초 관측은 변화 아님)
  function hasChanged(prev, next) {
    return prev != null && next != null && prev !== next;
  }
  root.BongFollowing = { ALLOWED, normalizeInterval, nextDelay, liveSignature, hasChanged };
})(typeof globalThis !== 'undefined' ? globalThis : this);
