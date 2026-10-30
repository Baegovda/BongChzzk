// BongChzzk 관심 스트리머 자동 이동 순수 로직 (전역 BongWatch; 팝업은 classic script로, 테스트는 vm으로 로드)
(function (root) {
  'use strict';
  const HEX32 = /^[0-9a-f]{32}$/i;
  // 채널 URL(chzzk.naver.com/<id>, /live/<id>, /<id>/videos 등) 또는 32자리 ID → 소문자 ID, 아니면 null
  function parseChannelInput(input) {
    const s = String(input || '').trim();
    if (HEX32.test(s)) return s.toLowerCase();
    let u;
    try { u = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s); } catch (e) { return null; }
    if (!/(^|\.)chzzk\.naver\.com$/i.test(u.hostname)) return null;
    const parts = u.pathname.split('/').filter(Boolean);
    const id = parts[0] === 'live' ? parts[1] : parts[0];
    return id && HEX32.test(id) ? id.toLowerCase() : null;
  }
  // 이전 상태 → 현재 상태에서 '방송 꺼짐 → 켜짐'으로 바뀐 채널 ID들. 이전 기록이 없으면 전환 아님.
  function detectTransitions(prev, now) {
    const out = [];
    for (const id of Object.keys(now || {})) {
      const p = prev ? prev[id] : undefined;
      if (p !== undefined && p !== null && p !== 'OPEN' && now[id] === 'OPEN') out.push(id);
    }
    return out;
  }
  // 감시 목록 순서상 첫 번째 대상(이미 그 /live 페이지면 제외). 없으면 null
  function pickTarget(watchIds, candidates, currentPath) {
    const set = new Set(candidates || []);
    const cur = String(currentPath || '').match(/^\/live\/([0-9a-f]{32})/i);
    for (const id of watchIds || []) {
      if (set.has(id) && !(cur && cur[1].toLowerCase() === id)) return id;
    }
    return null;
  }
  // 리더 잠금: 잠금이 없거나 만료됐거나 내 것이면 획득 가능
  function canLead(lock, myId, now, ttl) {
    return !lock || lock.id === myId || !(now - lock.ts < ttl);
  }
  root.BongWatch = { parseChannelInput, detectTransitions, pickTarget, canLead };
})(typeof globalThis !== 'undefined' ? globalThis : this);
