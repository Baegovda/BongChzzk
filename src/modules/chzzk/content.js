(() => {
  'use strict';
  const DEF = { enabled: true, threshold: 5, cooldown: 10, toast: true, retryTimer: true, lockQuality: true, targetQuality: 1080 };
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
    el.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;background:rgba(18,19,23,.92);color:#e8eaf0;border:1px solid #2c3039;border-left:3px solid #3ec5dc;padding:8px 12px;border-radius:8px;font:13px "Pretendard","Malgun Gothic",system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.35);pointer-events:none;transition:opacity .4s';
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
    v.addEventListener('playing', () => { s.stallSince = 0; if (rtV === v) rtHide(); });
    v.addEventListener('pause', () => { if (rtV === v) rtHide(); });
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

  // ───── 버퍼링 복구 타이머 (영상 위 큰 카운트다운) ─────
  const RT = globalThis.BongRetryTimer;
  let rtEl = null, rtTimer = 0, rtV = null, rtBusyUntil = 0;
  function rtHide() {
    if (rtTimer) { clearInterval(rtTimer); rtTimer = 0; }
    if (rtEl) { rtEl.remove(); rtEl = null; }
    rtV = null; rtBusyUntil = 0;
  }
  // 광고 표시가 비정상적으로 오래 켜져 있으면(오탐 등) 복구를 영원히 막지 않도록 2분까지만 존중
  let adSince = 0;
  function adBlocking() {
    if (!globalThis.__bongAdActive) { adSince = 0; return false; }
    if (!adSince) adSince = Date.now();
    return Date.now() - adSince < 120000;
  }
  function rtMount() {
    const host = (rtV && rtV.closest && rtV.closest('div.pzp')) || document.querySelector('div.pzp.pzp-pc');
    const parent = host || document.body;
    if (!parent) return null;
    if (rtEl && rtEl.parentNode === parent) return rtEl;
    if (rtEl) rtEl.remove();
    const el = document.createElement('div');
    el.className = 'bong-retry-timer';
    el.setAttribute('aria-live', 'off');
    el.style.cssText = `position:${host ? 'absolute' : 'fixed'};left:50%;top:50%;transform:translate(-50%,-50%);z-index:2147483646;pointer-events:none;display:flex;align-items:center;gap:18px;padding:18px 26px 18px 20px;background:rgba(18,19,23,.82);color:#fff;border:1px solid rgba(0,255,163,.55);border-radius:20px;box-shadow:0 0 28px rgba(0,255,163,.22),0 10px 40px rgba(0,0,0,.45);font-family:"Pretendard","Malgun Gothic",system-ui,sans-serif;white-space:nowrap;user-select:none;backdrop-filter:blur(4px)`;
    el.innerHTML = '<svg width="84" height="84" viewBox="0 0 84 84" style="flex:none"><circle cx="42" cy="42" r="36" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="7"/><circle class="rt-ring" cx="42" cy="42" r="36" fill="none" stroke="#00ffa3" stroke-width="7" stroke-linecap="round" transform="rotate(-90 42 42)" stroke-dasharray="226.2" stroke-dashoffset="0" style="filter:drop-shadow(0 0 6px rgba(0,255,163,.7))"/></svg>'
      + '<div style="display:flex;flex-direction:column;gap:2px"><div class="rt-cap" style="font-size:15px;font-weight:600;color:#cfd3dc"></div>'
      + '<div class="rt-num" style="font-size:60px;line-height:1.05;font-weight:800;color:#00ffa3;text-shadow:0 0 18px rgba(0,255,163,.45);font-variant-numeric:tabular-nums"></div>'
      + '<div class="rt-step" style="font-size:14px;color:#9aa1ad"></div></div>';
    parent.appendChild(el);
    rtEl = el;
    return el;
  }
  function rtPaint(cap, num, step, frac, busy) {
    const el = rtMount(); if (!el) return;
    el.querySelector('.rt-cap').textContent = cap;
    const n = el.querySelector('.rt-num');
    n.textContent = num; n.style.fontSize = busy ? '40px' : '60px';
    el.querySelector('.rt-step').textContent = step;
    el.querySelector('.rt-ring').setAttribute('stroke-dashoffset', String(226.2 * (1 - Math.max(0, Math.min(1, frac)))));
  }
  function rtRender() {
    const now = Date.now();
    if (!cfg.enabled || !cfg.retryTimer || adBlocking()) { rtHide(); return; }
    // 시작 안 됨(무한 로딩) 감시 상태
    if (wd.view && (!rtV || !states.get(rtV) || !states.get(rtV).stallSince)) {
      const w = wd.view;
      if (now < wd.busyUntil) { rtPaint('플레이어가 시작되지 않아요', '다시 시도하는 중…', w.label, 1, true); return; }
      if (now - wd.since < RT.SHOW_AFTER_MS) { if (rtEl) rtEl.remove(), rtEl = null; return; }
      const left = Math.max(0, w.at - now);
      rtPaint('플레이어가 시작되지 않아요 · 다음 시도까지', `${Math.ceil(left / 1000)}초`, w.label, left / w.total, false);
      return;
    }
    const v = rtV, s = v && states.get(v);
    if (!v || !s || v.paused || !v.isConnected) { rtHide(); return; }
    const busy = now < rtBusyUntil;
    if (!busy && (!s.stallSince || now - s.stallSince < RT.SHOW_AFTER_MS)) { rtHide(); return; }
    const left = RT.nextRecoverIn(now, s.stallSince, s.lastRecover, s.level, cfg.threshold, cfg.cooldown);
    const total = RT.waitTotal(s.stallSince, s.lastRecover, s.level, cfg.threshold, cfg.cooldown);
    if (busy) rtPaint('버퍼링 중', '복구하는 중…', RT.stepLabel(Math.max(0, s.level - 1)), 1, true);
    else rtPaint('버퍼링 중 · 다음 복구까지', `${Math.ceil(left / 1000)}초`, RT.stepLabel(s.level), total > 0 ? left / total : 0, false);
  }
  function rtWatch(v) {
    if (!cfg.retryTimer || !RT) return;
    rtV = v;
    if (!rtTimer) rtTimer = setInterval(rtRender, 250);
    rtRender();
  }

  async function recover(v, s) {
    s.lastRecover = Date.now();
    if (cfg.retryTimer && RT) { rtV = v; rtBusyUntil = s.lastRecover + 1500; rtWatch(v); }
    const lvl = s.level;
    s.level = Math.min(s.level + 1, 3);
    bumpCounter();
    log('복구 시도 단계', lvl + 1);
    try {
      if (lvl === 0) {
        toast('버퍼링 감지: 다시 재생하는 중');
        if (isLive(v) && v.buffered.length) {
          const end = v.buffered.end(v.buffered.length - 1);
          if (end - v.currentTime > 0.6) v.currentTime = end - 0.5;
        } else {
          v.currentTime = v.currentTime + 0.1;
        }
        await v.play().catch(() => {});
      } else if (lvl === 1) {
        toast('버퍼링이 계속돼서 플레이어를 다시 시작해요');
        v.pause();
        await new Promise(r => setTimeout(r, 300));
        if (isLive(v) && v.buffered.length) v.currentTime = v.buffered.end(v.buffered.length - 1) - 0.5;
        await v.play().catch(() => {});
      } else if (lvl === 2) {
        toast('버퍼링이 계속돼서 방송을 다시 불러와요');
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
        toast('버퍼링이 계속돼서 플레이어를 새로 띄워요 (페이지는 그대로)');
        if (!clickPlayerButton()) softRemount();
      }
    } catch (e) { log('복구 오류', e); }
    scheduleQuality(4000); // 복구/재마운트 후 화질이 자동으로 바뀌는 경우 대비
  }

  // ───── 시작 안 됨(무한 로딩) 감시 ─────
  // 영상이 아예 시작되지 않는 경우(로고만 도는 검은 화면)는 위 루프가 건너뛰므로 따로 지켜봄.
  const wd = { since: 0, attempt: 0, lastAttempt: 0, busyUntil: 0, view: null, key: '' };
  let userPausedAt = 0;
  document.addEventListener('pause', e => { if (e.target && e.target.tagName === 'VIDEO' && document.hasFocus() && !globalThis.__bongAdActive) userPausedAt = Date.now(); }, true);
  document.addEventListener('playing', () => { userPausedAt = 0; }, true);
  function wdReset() { wd.since = 0; wd.attempt = 0; wd.lastAttempt = 0; wd.view = null; }
  const RELOAD_KEY = 'bongchzzk.wdReloads';
  function readReloads(now) { try { return RT.recentReloadTimes(JSON.parse(sessionStorage.getItem(RELOAD_KEY) || '[]'), now); } catch (e) { return []; } }
  function isOfflineUi() {
    const r = document.querySelector('div.pzp') || document.getElementById('live_player_layout');
    const t = r ? (r.textContent || '').slice(0, 2000) : '';
    return /방송이\s*종료|종료된\s*방송|오프라인|OFFLINE|방송\s*중이\s*아니|성인\s*인증|로그인\s*후/.test(t);
  }
  function watchdogTick(now) {
    if (!RT) return;
    const path = location.pathname;
    if (path !== wd.key) { wd.key = path; wdReset(); }
    const vids = [...document.querySelectorAll('video')].filter(v => v.isConnected && !v.closest('[data-role="adVideoContainerEl"]'));
    const ok = vids.some(v => !v.paused && v.readyState >= 3 && (states.get(v)?.goodSince || 0) > 0);
    const main = vids.find(v => v.classList.contains('webplayer-internal-video')) || vids[0];
    const st = {
      now, enabled: cfg.enabled, onVideoPage: /^\/(live|video)\//.test(path), visible: document.visibilityState === 'visible',
      adActive: adBlocking(), userPaused: !!main && main.paused && main.readyState >= 2 && !!userPausedAt,
      ended: !!main && main.ended, offline: isOfflineUi(), ok,
      loopBusy: vids.some(v => states.get(v)?.stallSince > 0 && !v.paused), // 일반 버퍼링 복구가 처리 중
      since: wd.since, attempt: wd.attempt, lastAttempt: wd.lastAttempt, thresholdSec: cfg.threshold, recentReloads: readReloads(now).length,
    };
    const d = RT.watchdogDecide(st);
    if (d.action === 'reset') { if (wd.since) { wdReset(); if (rtEl && !rtV) rtHide(); } return; }
    if (d.action === 'start') { wd.since = now; return; }
    wd.view = { at: now + d.waitMs, total: d.totalMs, label: RT.wdStepLabel(d.next) };
    if (cfg.retryTimer && !rtTimer) { rtTimer = setInterval(rtRender, 250); }
    if (d.action === 'wait') return;
    wd.attempt++; wd.lastAttempt = now; wd.busyUntil = now + 1500;
    bumpCounter();
    log('시작 안 됨 감시: 시도', d.action);
    if (d.action === 'play') {
      toast('방송이 시작되지 않아서 다시 재생해 볼게요');
      if (!clickPlayerButton() && main) main.play().catch(() => {});
    } else if (d.action === 'remount') {
      toast('방송이 시작되지 않아서 플레이어를 새로 띄워요');
      softRemount();
    } else if (d.action === 'reload') {
      toast('방송이 계속 시작되지 않아서 페이지를 새로고침해요');
      try { sessionStorage.setItem(RELOAD_KEY, JSON.stringify([...readReloads(now), now])); } catch (e) {}
      setTimeout(() => location.reload(), 800);
    }
  }

  setInterval(() => {
    if (!cfg.enabled) { wdReset(); if (rtEl || rtTimer) rtHide(); return; }
    const now = Date.now();
    if (adBlocking()) { if (rtEl || rtTimer) rtHide(); wdReset(); for (const v of tracked) { const s = states.get(v); if (s) { s.stallSince = 0; s.lastTime = v.currentTime; } } return; } // 광고 중엔 복구 안 함
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
        if (v.playbackRate > 2 && !v.closest('[data-role="adVideoContainerEl"]')) { try { v.playbackRate = 1; log('광고 배속이 남아 있어 1배속으로 되돌림'); } catch (e) {} }
        if (s.level && now - s.goodSince > 15000) { s.level = 0; log('정상 재생 확인, 단계 초기화'); }
        continue;
      }
      s.goodSince = 0;
      if (!s.stallSince) s.stallSince = now;
      if (RT && cfg.retryTimer && !rtTimer) rtWatch(v);
      const wait = RT ? RT.nextRecoverIn(now, s.stallSince, s.lastRecover, s.level, cfg.threshold, cfg.cooldown)
        : Math.max(cfg.threshold * 1000 - (now - s.stallSince), cfg.cooldown * 1000 * Math.pow(1.5, Math.max(0, s.level - 1)) - (now - s.lastRecover));
      if (wait <= 0) recover(v, s);
    }
    watchdogTick(now);
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
      toast(`화질을 ${labels[i]}로 고정했어요`);
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
