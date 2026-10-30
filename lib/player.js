// BongChzzk 플레이어 보조(안내창/광고) 순수 로직 (전역 BongPlayer)
(function (root) {
  'use strict';
  // 광고 진행 중 판단: 광고 UI가 있고 숨김(wpc-dis-hid)이 아니거나, 광고 안내 표시가 보이면
  function isAdActive(s) {
    return !!(s && ((s.adUiExists && !s.adUiHidden) || s.indicatorVisible));
  }
  const isGuideText = t => /치트키|타임\s?머신|되감기|다시보기\s*안내/.test(String(t || ''));
  const isSkipText = t => /건너뛰기|skip|광고\s*닫기/i.test(String(t || ''));
  root.BongPlayer = { isAdActive, isGuideText, isSkipText };
})(typeof globalThis !== 'undefined' ? globalThis : this);
