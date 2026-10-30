// BongChzzk 팔로잉 채널 자동 새로고침 (버퍼링 복구/화질 고정과 독립)
(() => {
  'use strict';
  if (window.top !== window) return; // 사이드바는 최상위 프레임에만 있음
  const F = globalThis.BongFollowing;
  const DEF = { followRefresh: true, followInterval: 5 };
  const API = 'https://api.chzzk.naver.com/service/v1/channels/followings/live';
  const log = (...a) => console.log('[BongChzzk]', ...a);
  let cfg = { ...DEF }, timer = 0, failures = 0, lastSig = null, busy = false;

  // 사이드바 '팔로잉 채널' 영역 찾기 (추정: 제목 텍스트 기준, 클래스명 해시 변경에 대비)
  function findSection() {
    const heads = document.querySelectorAll('aside h2, aside h3, aside strong, aside span, nav h2, nav h3, nav strong, nav span, [class*="navigator"] h2, [class*="navigator"] strong, [class*="navigator"] span');
    for (const h of heads) {
      if (h.childElementCount === 0 && /^\s*팔로잉(\s*채널)?\s*$/.test(h.textContent)) {
        return h.closest('[class*="navigator_list"], [class*="navigator_section"], section, div[class*="navigator"]') || h.parentElement;
      }
    }
    return null;
  }
  const onFollowingPage = () => location.pathname.startsWith('/following');

  // 1단계: 영역 안의 새로고침 버튼 클릭 (추정 선택자)
  function clickRefresh(scope) {
    const sel = 'button[aria-label*="새로고침"], button[title*="새로고침"], button[class*="refresh" i], [role="button"][class*="refresh" i]';
    const roots = [scope, onFollowingPage() ? document.querySelector('main') : null].filter(Boolean);
    for (const r of roots) {
      let b = r.querySelector(sel);
      if (!b) b = [...r.querySelectorAll('button')].find(x => /새로고침/.test(x.textContent));
      if (b) { b.click(); return true; }
    }
    return false;
  }
  // 2단계: 포커스/가시성 이벤트로 SPA 재요청 유도 (React-Query refetchOnWindowFocus 가정)
  function nudgeRefetch() {
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
  }

  async function fetchSig() {
    const r = await fetch(API, { credentials: 'include', cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const sig = F.liveSignature(await r.json());
    if (sig == null) throw new Error('응답 형식 불일치');
    return sig;
  }

  async function tick() {
    if (busy || !cfg.followRefresh || document.visibilityState !== 'visible') return;
    const section = findSection();
    if (!section && !onFollowingPage()) return;
    busy = true;
    try {
      const x = window.scrollX, y = window.scrollY;
      const st = section ? section.scrollTop : 0;
      if (!clickRefresh(section)) {
        // 버튼이 없으면 API로 변화만 감지하고, 바뀌었을 때만 사이트 자체 재요청 유도
        const sig = await fetchSig();
        if (F.hasChanged(lastSig, sig)) { nudgeRefetch(); log('팔로잉 라이브 목록 변경 감지 → 새로고침 유도'); }
        lastSig = sig;
      }
      requestAnimationFrame(() => {
        if (window.scrollX !== x || window.scrollY !== y) window.scrollTo(x, y);
        if (section && section.scrollTop !== st) section.scrollTop = st;
      });
      failures = 0;
    } catch (e) {
      failures++;
      if (failures <= 3) log('팔로잉 새로고침 실패:', e.message);
    } finally { busy = false; }
  }

  function schedule() {
    clearTimeout(timer);
    if (!cfg.followRefresh) return;
    timer = setTimeout(async () => { await tick(); schedule(); }, F.nextDelay(cfg.followInterval, failures));
  }
  chrome.storage.sync.get(DEF, v => { cfg = { ...DEF, ...v }; schedule(); });
  chrome.storage.onChanged.addListener((c, area) => {
    if (area !== 'sync' || !(c.followRefresh || c.followInterval)) return;
    for (const k in DEF) if (c[k]) cfg[k] = c[k].newValue;
    failures = 0; schedule();
  });
  document.addEventListener('visibilitychange', e => { if (e.isTrusted && document.visibilityState === 'visible') { failures = 0; schedule(); } });
})();
