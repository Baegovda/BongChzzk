(() => {
  'use strict';
  const DEF = { enabled: true, threshold: 5, cooldown: 10, toast: true, lockQuality: true, targetQuality: 1080 };
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
    v.addEventListener('loadedmetadata', () => scheduleQuality(1500));
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
    scheduleQuality(4000); // 복구/재마운트 후 화질이 자동으로 바뀌는 경우 대비
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

  // ───── 화질 고정 (치지직 pzp 플레이어 설정 메뉴 조작) ─────
  // 선택자는 공개 유저스크립트들이 쓰는 치지직 pzp 클래스명을 기준으로 함(사이트 변경 시 깨질 수 있음).
  const Q = globalThis.BongQuality;
  const SEL = {
    settingBtn: '.pzp-pc-setting-button, button[class*="setting-button"], .pzp-pc-setting-button__icon',
    qualityIntro: '.pzp-pc-setting-intro-quality, [class*="setting-intro-quality"]',
    items: 'li.pzp-pc-ui-setting-quality-item, .pzp-pc-setting-quality-pane__list-container > li, [class*="setting-quality-item"]'
  };
  const HIDE_CLASS = 'bongchzzk-qhide';
  const q = { busy: false, nextAt: 0, fails: 0, userUntil: 0, timer: 0, lastPath: location.pathname };
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function injectHideStyle() {
    if (document.getElementById('bongchzzk-qstyle')) return;
    const st = document.createElement('style');
    st.id = 'bongchzzk-qstyle';
    st.textContent = `html.${HIDE_CLASS} [class*="pzp-pc-setting"][class*="pane"],html.${HIDE_CLASS} [class*="pzp-pc-setting-intro"],html.${HIDE_CLASS} [class*="pzp-pc-ui-setting"]{opacity:0!important;transition:none!important}`;
    (document.head || document.documentElement).appendChild(st);
  }
  const uniq = els => [...new Set(els)];
  const getItems = () => uniq([...document.querySelectorAll(SEL.items)].map(e => e.closest('li') || e));
  const labelOf = li => ((li.querySelector('[class*="quality-item__prefix"]') || li).textContent || '').trim();
  const isChecked = li => /checked|selected|active/i.test(li.className) || li.getAttribute('aria-checked') === 'true' || li.getAttribute('aria-selected') === 'true';

  // 메뉴가 이미 DOM에 있으면 바로 판단/클릭. 반환: 'ok' | 'clicked' | 'none'
  function applyFromItems(items) {
    if (!items.length) return 'none';
    const labels = items.map(labelOf);
    const cur = items.find(isChecked);
    if (cur && Q.isSatisfied(labelOf(cur), labels, cfg.targetQuality)) return 'ok';
    const i = Q.pickQualityIndex(labels, cfg.targetQuality);
    if (i < 0) return 'ok';
    items[i].click();
    log('화질 선택:', labels[i]);
    return 'clicked';
  }

  async function ensureQuality() {
    if (q.busy || !cfg.lockQuality || Date.now() < q.userUntil || Date.now() < q.nextAt) return;
    const v = [...tracked].find(x => x.isConnected && x.readyState > 0);
    if (!v || !/^\/(live|video)\//.test(location.pathname)) return;
    q.busy = true;
    let opened = false;
    try {
      let r = applyFromItems(getItems());
      if (r === 'none') {
        const btn = document.querySelector(SEL.settingBtn);
        if (!btn) throw new Error('설정 버튼 없음');
        injectHideStyle();
        document.documentElement.classList.add(HIDE_CLASS);
        (btn.closest('button') || btn).click(); opened = true;
        await sleep(250);
        const intro = document.querySelector(SEL.qualityIntro);
        if (intro) { intro.click(); await sleep(250); }
        r = applyFromItems(getItems());
        if (r === 'none') throw new Error('화질 목록 없음');
      }
      q.fails = 0;
      q.nextAt = Date.now() + (r === 'clicked' ? 3000 : 5000);
      if (r === 'clicked') toast(`화질 ${cfg.targetQuality}p 고정 적용`);
    } catch (e) {
      q.fails++;
      q.nextAt = Date.now() + Math.min(60000, 3000 * Math.pow(2, q.fails)); // 실패 시 백오프
      if (q.fails <= 3) log('화질 고정 실패:', e.message);
    } finally {
      if (opened) {
        await sleep(50);
        const btn = document.querySelector(SEL.settingBtn);
        if (btn && document.querySelector('[class*="pzp-pc-setting"][class*="pane"], [class*="pzp-pc-setting-intro"]')) (btn.closest('button') || btn).click();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      }
      setTimeout(() => document.documentElement.classList.remove(HIDE_CLASS), opened ? 150 : 0);
      q.busy = false;
    }
  }
  function scheduleQuality(delay) {
    clearTimeout(q.timer);
    q.timer = setTimeout(() => { q.nextAt = 0; ensureQuality(); }, delay);
  }
  // 사용자가 직접 화질을 바꾸면 10분간은 간섭하지 않음
  document.addEventListener('click', e => {
    if (e.isTrusted && e.target.closest && e.target.closest(SEL.items)) {
      q.userUntil = Date.now() + 10 * 60 * 1000;
      log('수동 화질 변경 감지 → 10분간 화질 고정 일시 중지');
    }
  }, true);
  setInterval(() => {
    if (location.pathname !== q.lastPath) { q.lastPath = location.pathname; q.userUntil = 0; q.fails = 0; scheduleQuality(1500); }
    ensureQuality();
  }, 3000);
  chrome.storage.onChanged.addListener((c, area) => {
    if (area === 'sync' && (c.lockQuality || c.targetQuality)) { q.userUntil = 0; scheduleQuality(300); }
  });

  new MutationObserver(ms => {
    for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) scan(n);
  }).observe(document.documentElement, { childList: true, subtree: true });
  scan(document);
})();
