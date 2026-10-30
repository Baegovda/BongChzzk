// BongChzzk 콘텐츠 스크립트 보호: 확장 프로그램이 다시 로드/업데이트되면 이전 스크립트는
// chrome.* 호출 시 'Extension context invalidated' 오류를 냅니다. 이 격리된 환경(isolated world)의
// 타이머/옵저버만 감싸서, 컨텍스트가 사라지면 조용히 멈추게 합니다. (페이지 자체 스크립트에는 영향 없음)
(function (root) {
  'use strict';
  if (root.__bongGuard) return;
  root.__bongGuard = true;
  const alive = () => { try { return !!(root.chrome && chrome.runtime && chrome.runtime.id); } catch (e) { return false; } };
  const isInvalidated = e => /Extension context invalidated/i.test(String(e && (e.message || e)));
  root.BongAlive = alive;
  const si = root.setInterval.bind(root), st = root.setTimeout.bind(root), ci = root.clearInterval.bind(root);
  const wrap = (fn, onDead) => typeof fn !== 'function' ? fn : function (...a) {
    if (!alive()) { onDead(); return; }
    try { return fn.apply(this, a); } catch (e) { if (isInvalidated(e)) { onDead(); return; } throw e; }
  };
  root.setInterval = (fn, ms, ...a) => { let id; id = si(wrap(fn, () => ci(id)), ms, ...a); return id; };
  root.setTimeout = (fn, ms, ...a) => st(wrap(fn, () => {}), ms, ...a);
  const MO = root.MutationObserver;
  root.MutationObserver = class extends MO {
    constructor(cb) { let self; super(wrap(cb, () => self && self.disconnect())); self = this; }
  };
  root.addEventListener('unhandledrejection', e => { if (isInvalidated(e.reason)) e.preventDefault(); });
  root.addEventListener('error', e => { if (isInvalidated(e.error || e.message)) e.preventDefault(); });
})(globalThis);
