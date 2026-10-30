(() => {
  'use strict';
  const DEF = { enabled: true, threshold: 5, cooldown: 10, toast: true, lockQuality: true, targetQuality: 1080 };
  let cfg = { ...DEF };
  const TAG = '[BongChzzk]';
  const log = (...a) => console.log(TAG, ...a);
  BCStore.sync.get(DEF, v => { cfg = { ...DEF, ...v }; });
  BCStore.onChanged.addListener((c, area) => {
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
      BCStore.local.get({ recoverCount: 0 }, v =>
        BCStore.local.set({ recoverCount: (v.recoverCount || 0) + 1, lastRecover: Date.now() }));
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
    v.addEventListener('playing', () => scheduleQuality(1200));
    v.addEventListener('emptied', () => scheduleQuality(2500));
    new MutationObserver(() => scheduleQuality(2500)).observe(v, { attributes: true, attributeFilter: ['src'] });
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
    if (globalThis.__bongAdActive) { for (const v of tracked) { const s = states.get(v); if (s) { s.stallSince = 0; s.lastTime = v.currentTime; } } return; } // 광고 중엔 복구 안 함
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

  // ───── 화질 고정 (치지직 pzp 플레이어, 실제 DOM 확인된 선택자) ─────
  // li 항목은 합성 click으로 선택되지 않고 Enter keydown/keyup으로 선택됨(실사이트 확인).
  const Q = globalThis.BongQuality;
  const SEL = {
    root: 'div.pzp.pzp-pc',
    settingBtn: '.pzp-pc-setting-button',
    menu: '.pzp-pc-settings',
    qualityIntro: '.pzp-pc-setting-intro-quality',
    items: 'li.pzp-ui-setting-quality-item',
    prefix: '.pzp-ui-setting-quality-item__prefix',
    checked: 'pzp-ui-setting-pane-item--checked'
  };
  const HIDE_CLASS = 'bongchzzk-qhide';
  const q = { busy: false, nextAt: 0, fails: 0, userUntil: 0, timer: 0, lastPath: location.pathname };
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function injectHideStyle() {
    if (document.getElementById('bongchzzk-qstyle')) return;
    const st = document.createElement('style');
    st.id = 'bongchzzk-qstyle';
    st.textContent = `html.${HIDE_CLASS} .pzp-pc-settings,html.${HIDE_CLASS} [class*="pzp-pc-setting-"]:not(.pzp-pc-setting-button){opacity:0!important;transition:none!important}`;
    (document.head || document.documentElement).appendChild(st);
  }
  const getItems = () => [...document.querySelectorAll(SEL.items)];
  const labelOf = li => ((li.querySelector(SEL.prefix) || li).textContent || '').trim();
  const isChecked = li => li.classList.contains(SEL.checked);
  function currentQuality() {
    const intro = document.querySelector(SEL.qualityIntro);
    const v = intro && (intro.getAttribute('value') || intro.querySelector('.pzp-ui-setting-home-item__value')?.textContent);
    if (v) return v.trim();
    const c = getItems().find(isChecked);
    return c ? labelOf(c) : '';
  }
  function pressEnter(el) {
    try { el.focus({ preventScroll: true }); } catch (e) {}
    const o = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
    el.dispatchEvent(new KeyboardEvent('keydown', o));
    el.dispatchEvent(new KeyboardEvent('keyup', o));
  }
  const menuOpen = () => document.querySelector(SEL.settingBtn)?.getAttribute('aria-expanded') === 'true';

  async function ensureQuality() {
    if (q.busy || !cfg.lockQuality || Date.now() < q.userUntil || Date.now() < q.nextAt) return;
    const v = [...tracked].find(x => x.isConnected && x.readyState > 0);
    if (!v || !/^\/(live|video)\//.test(location.pathname)) return;
    const btn = document.querySelector(SEL.settingBtn);
    if (!btn) return;
    let labels = getItems().map(labelOf);
    if (labels.length && Q.isSatisfied(currentQuality(), labels, cfg.targetQuality)) { q.fails = 0; return; }
    if (menuOpen()) return; // 사용자가 메뉴를 열어둔 상태면 건드리지 않음
    q.busy = true;
    let opened = false;
    try {
      injectHideStyle();
      document.documentElement.classList.add(HIDE_CLASS);
      btn.click(); opened = true;
      await sleep(200);
      const intro = document.querySelector(SEL.qualityIntro);
      if (!intro) throw new Error('화질 메뉴 없음');
      intro.click();
      await sleep(300);
      const items = getItems();
      labels = items.map(labelOf);
      const i = Q.pickQualityIndex(labels, cfg.targetQuality);
      if (i < 0) throw new Error('화질 목록 없음');
      if (!isChecked(items[i])) { pressEnter(items[i]); log('화질 선택:', labels[i]); }
      await sleep(300);
      if (!Q.isSatisfied(currentQuality(), getItems().map(labelOf), cfg.targetQuality)) throw new Error('적용 확인 실패(현재 ' + currentQuality() + ')');
      q.fails = 0;
      q.nextAt = Date.now() + 3000;
      toast(`화질 ${labels[i]} 고정 적용`);
    } catch (e) {
      q.fails++;
      q.nextAt = Date.now() + Math.min(60000, 3000 * Math.pow(2, q.fails)); // 실패 시 백오프
      if (q.fails <= 3) log('화질 고정 실패:', e.message);
    } finally {
      if (opened && menuOpen()) {
        const b = document.querySelector(SEL.settingBtn);
        if (b) b.click();
        await sleep(50);
        if (menuOpen()) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
      }
      setTimeout(() => document.documentElement.classList.remove(HIDE_CLASS), opened ? 150 : 0);
      q.busy = false;
    }
  }
  function scheduleQuality(delay) {
    clearTimeout(q.timer);
    q.timer = setTimeout(() => { q.nextAt = 0; q.fails = 0; ensureQuality(); }, delay);
  }
  // 사용자가 직접 화질을 바꾸면 10분간은 간섭하지 않음 (신뢰된 클릭/Enter만)
  const manual = e => {
    if (e.isTrusted && !q.busy && e.target.closest && e.target.closest(SEL.items)) {
      if (e.type === 'keydown' && e.key !== 'Enter') return;
      q.userUntil = Date.now() + 10 * 60 * 1000;
      log('수동 화질 변경 감지 → 10분간 화질 고정 일시 중지');
    }
  };
  document.addEventListener('click', manual, true);
  document.addEventListener('keydown', manual, true);
  setInterval(() => {
    if (location.pathname !== q.lastPath) { q.lastPath = location.pathname; q.userUntil = 0; scheduleQuality(1500); }
    ensureQuality();
  }, 3000);
  BCStore.onChanged.addListener((c, area) => {
    if (area === 'sync' && (c.lockQuality || c.targetQuality)) { q.userUntil = 0; scheduleQuality(300); }
  });

  new MutationObserver(ms => {
    for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) scan(n);
  }).observe(document.documentElement, { childList: true, subtree: true });
  scan(document);
})();
