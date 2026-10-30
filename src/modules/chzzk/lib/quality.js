// BongChzzk 화질 선택 순수 로직 (콘텐츠 스크립트에서 전역 BongQuality로 사용, 테스트는 vm으로 로드)
(function (root) {
  'use strict';
  // "1080p", "1080p60", "720p 60fps", "자동(720p)" 같은 라벨에서 높이 추출. 자동 항목은 null.
  function parseHeight(label) {
    const t = String(label || '').trim();
    if (!t || /^(자동|auto)/i.test(t)) return null;
    const m = t.match(/(\d{3,4})\s*p/i);
    return m ? Number(m[1]) : null;
  }
  // labels 중 target 이하에서 가장 높은 화질의 인덱스. target 이하가 없으면 가장 낮은 화질, 없으면 -1.
  function pickQualityIndex(labels, target) {
    const tgt = Number(target) || 1080;
    let best = -1, bestH = -1, low = -1, lowH = Infinity;
    (labels || []).forEach((l, i) => {
      const h = parseHeight(l);
      if (h == null) return;
      if (h <= tgt && h > bestH) { best = i; bestH = h; }
      if (h < lowH) { low = i; lowH = h; }
    });
    return best >= 0 ? best : low;
  }
  // 현재 선택된 라벨이 목표 선택과 같은 화질인지
  function isSatisfied(currentLabel, labels, target) {
    const i = pickQualityIndex(labels, target);
    if (i < 0) return true; // 고를 게 없으면 건드리지 않음
    const cur = parseHeight(currentLabel);
    return cur != null && cur === parseHeight(labels[i]);
  }
  const api = { parseHeight, pickQualityIndex, isSatisfied };
  root.BongQuality = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
