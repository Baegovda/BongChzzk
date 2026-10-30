// BongChzzk 플레이어 보조(안내창/광고) 순수 로직 (전역 BongPlayer)
(function (root) {
  'use strict';
  // 광고 진행 중 판단: 광고 UI가 있고 숨김(wpc-dis-hid)이 아니거나, 광고 안내 표시가 보이면
  function isAdActive(s) {
    return !!(s && ((s.adUiExists && !s.adUiHidden) || s.indicatorVisible || s.textHits > 0));
  }
  // 플레이어 안 짧은 텍스트 분류: 'counter'(AD 1/1) | 'countdown'(1 초 후 SKIP) | 'skip'(SKIP/건너뛰기) | 'clickthrough'(광고 페이지 보기) | null
  function adTextKind(t) {
    const s = String(t || '').replace(/\s+/g, ' ').trim();
    if (/^AD\s*\d+\s*\/\s*\d+$/i.test(s)) return 'counter';
    if (/\d+\s*초\s*후\s*SKIP/i.test(s)) return 'countdown';
    if (/^(SKIP|건너뛰기|광고\s*건너뛰기)$/i.test(s)) return 'skip';
    if (/^광고\s*페이지\s*보기$/.test(s)) return 'clickthrough';
    return null;
  }
  // 누를 수 있는 SKIP 라벨인지(정확히 SKIP/건너뛰기/광고 건너뛰기만)
  const isSafeSkipLabel = t => /^(SKIP|건너뛰기|광고\s*건너뛰기)$/i.test(String(t || '').replace(/\s+/g, ' ').trim());
  // 광고 영상 길이로 보이는지 (유한, 0초 초과 180초 이하)
  const isAdDuration = d => Number.isFinite(d) && d > 0 && d <= 180;
  const isPurchaseGuideDialogText = t => { const s = String(t || '').replace(/\s+/g, ''); return /치트키/.test(s) && /타임머신/.test(s); };
  const isGuideText = t => /치트키|타임\s?머신|되감기|다시보기\s*안내/.test(String(t || ''));
  const isSkipText = t => /건너뛰기|skip|광고\s*닫기/i.test(String(t || ''));
  // 네이버 광고 플레이어의 SKIP 버튼 라벨 (뒤에 ▶| 같은 아이콘 문자 허용). 카운트다운('1초 후 SKIP')은 제외
  function isSkipButtonLabel(t) {
    const s = String(t || '').replace(/\s+/g, ' ').trim();
    if (/\d\s*초/.test(s)) return false;
    return /^SKIP\b[\s\u25B6\u25BA\u23ED\u23E9|>▶►⏭⏩]*$/i.test(s) || /^(광고\s*)?건너뛰기[\s▶►⏭|>]*$/.test(s);
  }
  // 요소 자체 정보로 SKIP 클릭 후보 판정. info {text, inCountdown, inLink, dataRole, cls}
  function isSkipCandidate(info) {
    if (!info || info.inCountdown || info.inLink) return false;
    if (/adLink/i.test(info.dataRole || '') || /countDown|skipInfo/i.test(info.dataRole || '')) return false;
    return isSkipButtonLabel(info.text);
  }
  const AD_CONTAINER_SEL = '[data-role="adVideoContainerEl"]';
  const hasAdContainer = doc => { const el = doc && doc.querySelector && doc.querySelector(AD_CONTAINER_SEL); return !!(el && el.isConnected !== false); };
  // 끝으로 이동할 시각 (유한한 길이일 때만)
  const seekEndTime = d => (Number.isFinite(d) && d > 0 ? Math.max(0, d - 0.05) : null);
  root.BongPlayer = { isSkipButtonLabel, isSkipCandidate, hasAdContainer, seekEndTime, AD_CONTAINER_SEL, isAdActive, isGuideText, isPurchaseGuideDialogText, isSkipText, adTextKind, isSafeSkipLabel, isAdDuration };
})(typeof globalThis !== 'undefined' ? globalThis : this);
