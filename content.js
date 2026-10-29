(() => {
  'use strict';
  const DEF = { enabled: true, threshold: 5, cooldown: 10, toast: true };
  let cfg = { ...DEF };
  const TAG = '[BongChzzk]';
  const log = (...a) => console.log(TAG, ...a);
  chrome.storage.sync.get(DEF, v => { cfg = { ...DEF, ...v }; });
  chrome.storage.onChanged.addListener((c, area) => {
    if (area === 'sync') for (const k in c) if (k in DEF) cfg[k] = c[k].newValue;
  });

  const states = new WeakMap();
  const tracked = new Set();

  function toast(msg) {
    if (!cfg.toast || !document.body) return;
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;background:rgba(0,0,0,.78);color:#00ffa3;padding:8px 12px;border-radius:8px;font:13px sans-serif;pointer-events:none;transition:opacity .4s';
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; }, 2200);
    setTimeout(() => el.remove(), 2800);
  }

  function bumpCounter() {
    try {
      chrome.storage.local.get({ recoverCount: 0 }, v =>
        chrome.storage.local.set({ recoverCount: (v.recoverCount || 0) + 1, lastRecover: Date.now() }));
    } catch (e) { /* context invalidated */ }
  }

  const isLive = v => !isFinite(v.duration) || location.pathname.startsWith('/live/');
  const isBlob = v => (v.currentSrc || v.src || '').startsWith('blob:');

  function track(v) {
    if (states.has(v)) return;
    const s = { lastTime: v.currentTime, stallSince: 0, level: 0, lastRecover: 0, goodSince: 0 };
    states.set(v, s); tracked.add(v);
    const mark = () => { if (!s.stallSince && !v.paused) s.stallSince = Date.now(); };
    v.addEventListener('waiting', mark);
    v.addEventListener('stalled', mark);
    v.addEventListener('playing', () => { s.stallSince = 0; });
    log('비디오 감시 시작');
  }

  function scan(root) {
    if (root.tagName === 'VIDEO') track(root);
    root.querySelectorAll && root.querySelectorAll('video').forEach(track);
  }

  function clickPlayerButton() {
    // 플레이어 자체의 재시도/다시보기 버튼 탐색 (best-effort)
    const sel = 'button[class*="retry" i],button[class*="replay" i],button[class*="refresh" i],[class*="error"] button,button[aria-label*="다시"],button[aria-label*="재시도"]';
    const b = document.querySelector(sel);
    if (b) { b.click(); return true; }
    return false;
  }

  function softRemount() {
    const url = location.href;
    history.pushState(history.state, '', url);
    window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
  }

  async function recover(v, s) {
    s.lastRecover = Date.now();
    const lvl = s.level;
    s.level = Math.min(s.level + 1, 3);
    bumpCounter();
    log('복구 시도 단계', lvl + 1);
    try {
      if (lvl === 0) {
        toast('버퍼링 감지 → 재생 재개 시도');
        if (isLive(v) && v.buffered.length) {
          const end = v.buffered.end(v.buffered.length - 1);
          if (end - v.currentTime > 0.6) v.currentTime = end - 0.5;
        } else {
          v.currentTime = v.currentTime + 0.1;
        }
        await v.play().catch(() => {});
      } else if (lvl === 1) {
        toast('버퍼링 지속 → 플레이어 재시작');
        v.pause();
        await new Promise(r => setTimeout(r, 300));
        if (isLive(v) && v.buffered.length) v.currentTime = v.buffered.end(v.buffered.length - 1) - 0.5;
        await v.play().catch(() => {});
      } else if (lvl === 2) {
        toast('버퍼링 지속 → 스트림 다시 불러오기');
        if (clickPlayerButton()) return;
        if (!isBlob(v) && (v.currentSrc || v.src)) {
          const t = v.currentTime; v.load();
          if (!isLive(v)) v.addEventListener('loadedmetadata', () => { v.currentTime = t; }, { once: true });
          await v.play().catch(() => {});
        } else {
          // MSE: 일시정지 후 라이브 엣지로 크게 점프 → 플레이어가 세그먼트를 다시 요청하도록 유도
          v.pause();
          if (v.seekable.length) v.currentTime = v.seekable.end(v.seekable.length - 1) - 1;
          await v.play().catch(() => {});
        }
      } else {
        toast('버퍼링 지속 → 플레이어 재마운트(페이지 새로고침 아님)');
        if (!clickPlayerButton()) softRemount();
      }
    } catch (e) { log('복구 오류', e); }
  }

  setInterval(() => {
    if (!cfg.enabled) return;
    const now = Date.now();
    for (const v of tracked) {
      if (!v.isConnected) { tracked.delete(v); continue; }
      const s = states.get(v);
      const advancing = Math.abs(v.currentTime - s.lastTime) > 0.01;
      s.lastTime = v.currentTime;
      if (v.paused || v.ended || v.readyState === 0 && !v.currentSrc) { s.stallSince = 0; continue; }
      const stuck = !advancing || v.readyState < 3;
      if (!stuck) {
        s.stallSince = 0;
        if (!s.goodSince) s.goodSince = now;
        if (s.level && now - s.goodSince > 15000) { s.level = 0; log('정상 재생 확인, 단계 초기화'); }
        continue;
      }
      s.goodSince = 0;
      if (!s.stallSince) s.stallSince = now;
      const backoff = cfg.cooldown * 1000 * Math.pow(1.5, Math.max(0, s.level - 1));
      if (now - s.stallSince >= cfg.threshold * 1000 && now - s.lastRecover >= backoff) recover(v, s);
    }
  }, 1000);

  new MutationObserver(ms => {
    for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) scan(n);
  }).observe(document.documentElement, { childList: true, subtree: true });
  scan(document);
})();
