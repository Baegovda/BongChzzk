// BongChzzk 넓은 화면 자동 순수 로직 (전역 BongWide)
(function (root) {
  'use strict';
  const LABEL = /넓은\s*화면|와이드|wide/i;
  const CLS = /viewmode|wide|screen-mode|theater/i;
  // 후보 요소 정보 {cls, label, text} → 점수(0이면 후보 아님). 전체화면 버튼은 제외.
  function scoreCandidate(info) {
    const cls = String(info && info.cls || ''), label = String(info && info.label || ''), text = String(info && info.text || '');
    if (/fullscreen|전체\s*화면/i.test(cls + ' ' + label + ' ' + text)) return 0;
    let s = 0;
    if (LABEL.test(label)) s += 3;
    if (LABEL.test(text)) s += 2;
    if (CLS.test(cls)) s += 1;
    return s;
  }
  // 넓은 화면 상태: true/false/null(모름). label이 '넓은 화면 해제/종료' 류면 이미 켜짐.
  function wideState(info) {
    const ap = info && info.ariaPressed, ac = info && info.ariaChecked;
    if (ap === 'true' || ac === 'true') return true;
    if (ap === 'false' || ac === 'false') return false;
    const label = String(info && info.label || '');
    if (/(해제|종료|끄기|exit)/i.test(label)) return true;
    const cls = String(info && info.cls || '');
    if (/--(active|on|wide|checked)\b|is-active|is-wide/i.test(cls)) return true;
    if (info && info.layoutWide === true) return true;
    return null;
  }
  root.BongWide = { scoreCandidate, wideState };
})(typeof globalThis !== 'undefined' ? globalThis : this);
