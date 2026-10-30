// BongChzzk 부가 기능: 선명한 화면, 주간 랭킹 가리기, 채팅 글씨 크기, 시청자 수, 방향키 이동
(() => {
  'use strict';
  if (window.top !== window) return;
  const X = globalThis.BongExtras;
  const DEF = { vivid: true, hideRanking: true, chatFontSize: 0, viewerChat: true, viewerOverlay: true, arrowSeek: true, seekSeconds: 5, blurRankNames: false, hideTimeGuide: true, adSkip: true };
  let cfg = { ...DEF };
  const log = (...a) => console.log('[BongChzzk]', ...a);
  const ROOT = 'div.pzp.pzp-pc';
  chrome.storage.sync.get(DEF, v => { cfg = { ...DEF, ...v }; applyStyles(); });
  chrome.storage.onChanged.addListener((c, area) => {
    if (area !== 'sync') return;
    let hit = false;
    for (const k in DEF) if (c[k]) { cfg[k] = c[k].newValue; hit = true; }
    if (hit) { applyStyles(); vividState.nextAt = 0; refreshViewerUi(); }
  });

  // ── 스타일 주입: 랭킹 가리기 + 채팅 글씨 크기 + 시청자 배지 ──
  function applyStyles() {
    let st = document.getElementById('bongchzzk-xstyle');
    if (!st) { st = document.createElement('style'); st.id = 'bongchzzk-xstyle'; (document.head || document.documentElement).appendChild(st); }
    let css = '#bongchzzk-vov{position:absolute;top:12px;left:12px;z-index:2147483000;pointer-events:none;background:rgba(0,0,0,.55);color:#fff;font:600 13px/1 sans-serif;padding:5px 9px;border-radius:999px;white-space:nowrap}'
      + '#bongchzzk-vchat{display:inline-block;margin-left:8px;font-size:12px;font-weight:400;color:#9aa0a6;white-space:nowrap;vertical-align:middle;max-width:calc(100% - 60px);overflow:hidden;text-overflow:ellipsis}'
      + 'html.bongchzzk-ad .webplayer-internal-core-ad-ui, html.bongchzzk-ad .pzp-ad-break-indicator, html.bongchzzk-ad .pzp-ad-click-through-button, html.bongchzzk-ad .advertisement_guide{opacity:0 !important}'
      + '.bongchzzk-seektoast{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:2147483000;pointer-events:none;background:rgba(0,0,0,.6);color:#fff;font:700 18px sans-serif;padding:8px 14px;border-radius:10px;transition:opacity .3s}';
    const RANK = '#aside-chatting > div:has(> strong[class*="_ranking_"]), #aside-chatting > div:has(> strong[class*="_title_"][class*="_ranking"]), .bongchzzk-rank';
    if (cfg.hideRanking) css += RANK.split(', ').join(', ') + '{display:none !important}';
    else if (cfg.blurRankNames) css += RANK.split(', ').map(x => x + ' [class*="_nickname_"]').join(', ') + '{filter:blur(5px) !important;user-select:none !important}';
    if (cfg.hideTimeGuide) css += '.restart_guide, .bongchzzk-guidehide{display:none !important}';
    const fs = X.normalizeFontSize(cfg.chatFontSize);
    if (fs) css += `#aside-chatting [class*="_chatting_message_"], #aside-chatting [class*="_chatting_message_"] > span[class*="_text_"], #aside-chatting [class*="_chatting_message_"] [class*="_nickname_"] *{font-size:${fs}px !important;line-height:1.5 !important}`;
    st.textContent = css;
    
  }
  // :has 미지원/구조 변경 대비 JS 보조: 첫 strong에 '랭킹'이 들어간 #aside-chatting 직계 div 숨김
  function hideRankingFallback() {
    if (!cfg.hideRanking && !cfg.blurRankNames) return;
    const aside = document.getElementById('aside-chatting');
    if (!aside) return;
    [...aside.children].forEach((d, i) => {
      if (i === 0 || d.tagName !== 'DIV' || d.querySelector('[role="log"], textarea, [contenteditable]')) return;
      const s = d.querySelector('strong');
      if (s && s.textContent.includes('랭킹')) d.classList.add('bongchzzk-rank');
    });
  }

  // ── 선명한 화면 항상 켜기 ──
  const vividState = { nextAt: 0, lastPath: location.pathname };
  async function ensureVivid() {
    if (!cfg.vivid || !/^\/(live|video)\//.test(location.pathname) || Date.now() < vividState.nextAt) return;
    const root = document.querySelector(ROOT);
    if (!root || !root.querySelector('video')) return;
    const sw = () => document.querySelector('.pzp-pc-setting-intro-filter .pzp-ui-toggle');
    const isOn = () => root.classList.contains('pzp-pc--filter') || sw()?.getAttribute('aria-checked') === 'true';
    if (isOn()) return;
    vividState.nextAt = Date.now() + 10000; // 10초에 한 번까지만 시도
    let row = document.querySelector('.pzp-pc-setting-intro-filter');
    let opened = false;
    const gear = document.querySelector('.pzp-pc-setting-button');
    if (!row && gear && gear.getAttribute('aria-expanded') !== 'true') {
      gear.click(); opened = true;
      await new Promise(r => setTimeout(r, 250));
      row = document.querySelector('.pzp-pc-setting-intro-filter');
    }
    if (row) { row.click(); log('선명한 화면 켜기 시도'); }
    await new Promise(r => setTimeout(r, 300));
    if (opened && gear.getAttribute('aria-expanded') === 'true') gear.click();
    if (!isOn()) log('선명한 화면 켜기 실패(확인 안 됨)');
  }

  // ── 시청자 수 (채팅 헤더 + 플레이어 오버레이), 단일 폴링 루프 ──
  let viewerNum = NaN, viewerChannel = null, vFails = 0, vTimer = 0, vBusy = false;
  const wantViewers = () => (cfg.viewerChat || cfg.viewerOverlay) && document.visibilityState === 'visible' && X.channelIdFromPath(location.pathname);
  const EYE = '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" style="vertical-align:-2px;margin-right:4px"><path fill="currentColor" d="M12 5C6.5 5 2.3 8.6 1 12c1.3 3.4 5.5 7 11 7s9.7-3.6 11-7c-1.3-3.4-5.5-7-11-7zm0 11.5A4.5 4.5 0 1 1 12 7.5a4.5 4.5 0 0 1 0 9zm0-2.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/></svg>';
  // 아이콘 + 숫자 구조로 만들고, 숫자가 바뀌면 증가=초록/감소=빨강으로 잠깐 깜빡임
  function paintViewer(el) {
    if (!el.querySelector('.bc-num')) { el.innerHTML = '<span class="bc-eye"></span><span class="bc-num"></span>'; el.querySelector('.bc-eye').innerHTML = EYE; }
    const eye = el.querySelector('.bc-eye'), num = el.querySelector('.bc-num');
    eye.style.color = X.eyeColor(location.pathname);
    const text = X.formatCount(viewerNum);
    if (num.textContent === text) return;
    const prev = el._bcPrev;
    el._bcPrev = viewerNum;
    num.textContent = text;
    const dir = X.changeDirection(prev, viewerNum);
    if (dir && num.animate) {
      num.getAnimations?.().forEach(an => an.cancel());
      num.animate([{ color: dir === 'up' ? '#2ee59d' : '#ff5c5c' }, { color: 'inherit' }], { duration: 600, easing: 'ease-out' });
    }
  }
  function refreshViewerUi() {
    const onLive = !!X.channelIdFromPath(location.pathname);
    // 채팅 헤더: h2("채팅") 안쪽에 붙임(형제로 두면 보이지 않음, 실사이트 확인)
    let chatEl = document.getElementById('bongchzzk-vchat');
    const h2 = document.querySelector('#aside-chatting > div:first-child h2');
    if (cfg.viewerChat && onLive && h2) {
      if (!chatEl || chatEl.parentElement !== h2) {
        chatEl?.remove();
        chatEl = document.createElement('span'); chatEl.id = 'bongchzzk-vchat';
        h2.appendChild(chatEl);
      }
      paintViewer(chatEl);
    } else chatEl?.remove();
    // 플레이어 오버레이 (fullscreen에서도 보이도록 .pzp 안에)
    let ov = document.getElementById('bongchzzk-vov');
    const host = document.querySelector(ROOT) || document.getElementById('live_player_layout');
    if (cfg.viewerOverlay && onLive && host) {
      if (!ov || ov.parentElement !== host) {
        ov?.remove();
        ov = document.createElement('div'); ov.id = 'bongchzzk-vov';
        if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
        host.appendChild(ov);
      }
      paintViewer(ov);
    } else ov?.remove();
  }
  async function pollViewers() {
    clearTimeout(vTimer);
    const id = wantViewers();
    if (!id) { viewerChannel = null; viewerNum = NaN; refreshViewerUi(); vTimer = setTimeout(pollViewers, 1000); return; }
    if (id !== viewerChannel) { viewerChannel = id; viewerNum = NaN; vFails = 0; }
    if (!vBusy) {
      vBusy = true;
      try {
        const r = await fetch(`https://api.chzzk.naver.com/polling/v3.1/channels/${id}/live-status?includePlayerRecommendContent=true`, { credentials: 'include', cache: 'no-store' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const c = (await r.json())?.content;
        if (id === viewerChannel) viewerNum = c && c.status === 'OPEN' && typeof c.concurrentUserCount === 'number' ? c.concurrentUserCount : NaN;
        vFails = 0;
      } catch (e) {
        vFails++; viewerNum = NaN;
        if (vFails <= 3) log('시청자 수 조회 실패:', e.message);
      } finally { vBusy = false; }
    }
    refreshViewerUi();
    clearTimeout(vTimer);
    vTimer = setTimeout(pollViewers, Math.min(30000, 1000 * Math.pow(2, Math.min(vFails, 5))));
  }
  pollViewers();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pollViewers(); });
  window.addEventListener('popstate', () => setTimeout(pollViewers, 300));

  // ── 방향키 이동 ──
  function mainVideo() {
    const vs = [...document.querySelectorAll(ROOT + ' video, video.webplayer-internal-video, video')].filter(v => v.isConnected && v.readyState > 0);
    return vs.sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight)[0] || null;
  }
  function seekToast(text) {
    const host = document.querySelector(ROOT) || document.getElementById('live_player_layout');
    if (!host) return;
    let t = host.querySelector('.bongchzzk-seektoast');
    if (!t) { t = document.createElement('div'); t.className = 'bongchzzk-seektoast'; host.appendChild(t); }
    t.textContent = text; t.style.opacity = '1';
    clearTimeout(t._h); t._h = setTimeout(() => { t.style.opacity = '0'; }, 600);
  }
  document.addEventListener('keydown', e => {
    if (!cfg.arrowSeek || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (!/^\/(live|video)\//.test(location.pathname)) return;
    const v = mainVideo();
    if (!v) return;
    const sec = X.normalizeSeekSec(cfg.seekSeconds);
    const live = !Number.isFinite(v.duration) || location.pathname.startsWith('/live/');
    const ranges = [];
    for (let i = 0; i < v.seekable.length; i++) ranges.push([v.seekable.start(i), v.seekable.end(i)]);
    const rg = X.seekRange(live, v.duration, ranges);
    if (!rg) return;
    const delta = e.key === 'ArrowLeft' ? -sec : sec;
    const to = X.clampSeek(v.currentTime, delta, rg[0], rg[1]);
    if (to == null) return;
    e.preventDefault(); e.stopImmediatePropagation();
    v.currentTime = to;
    seekToast((delta < 0 ? '-' : '+') + sec + '초');
  }, true);

  // ── 타임머신/치트키 안내창 숨김 (클릭은 하지 않고 숨기기만) ──
  const P = globalThis.BongPlayer;
  function checkGuide(el) {
    if (!cfg.hideTimeGuide || el.nodeType !== 1 || el.id?.startsWith('bongchzzk') || el.classList.contains('bongchzzk-guidehide')) return;
    if (el.closest('.pzp-pc-settings, #aside-chatting, [class*="pzp-pc__bottom"], [class*="pzp-pc-ui-controls"]')) return;
    if (el.tagName === 'VIDEO' || el.querySelector('video')) return;
    if (!P.isGuideText(el.textContent)) return;
    el.classList.add('bongchzzk-guidehide');
    console.debug('[BongChzzk] 안내창 숨김', el.outerHTML.slice(0, 300));
  }
  let guideObs = null, guideRoot = null;
  setInterval(() => {
    const root = document.querySelector(ROOT);
    if (root === guideRoot) return;
    guideObs?.disconnect(); guideRoot = root;
    if (!root) return;
    guideObs = new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) checkGuide(n); });
    guideObs.observe(root, { childList: true, subtree: true });
  }, 1000);

  // ── 광고 방지 (best effort, 실제 광고로 검증 안 됨) ──
  let adWasActive = false;
  const visible = el => !!el && el.offsetParent !== null && el.getBoundingClientRect().width > 0;
  setInterval(() => {
    if (!cfg.adSkip) return;
    const root = document.querySelector(ROOT);
    if (!root) return;
    const ui = root.querySelector('.webplayer-internal-core-ad-ui');
    const active = P.isAdActive({ adUiExists: !!ui, adUiHidden: !!ui && ui.classList.contains('wpc-dis-hid'), indicatorVisible: visible(root.querySelector('.pzp-ad-break-indicator')) });
    globalThis.__bongAdActive = active; // 버퍼링 복구가 광고 중엔 개입하지 않도록
    document.documentElement.classList.toggle('bongchzzk-ad', active);
    if (active) {
      if (!adWasActive) console.debug('[BongChzzk] 광고 감지', { ui: !!ui, videos: root.querySelectorAll('video').length });
      for (const b of root.querySelectorAll('button, [role="button"]')) if (visible(b) && P.isSkipText(b.textContent || b.getAttribute('aria-label'))) { b.click(); break; }
      for (const v of root.querySelectorAll('video')) {
        if (v.classList.contains('webplayer-internal-video')) continue;
        if (Number.isFinite(v.duration) && v.duration > 0) {
          v.muted = true;
          try { v.playbackRate = 16; } catch (e) {}
          if (v.currentTime < v.duration - 0.1) v.currentTime = v.duration - 0.05;
        }
      }
    } else if (adWasActive) {
      const main = root.querySelector('video.webplayer-internal-video');
      if (main && main.paused) main.play().catch(() => {});
    }
    adWasActive = active;
  }, 500);

  // ── 주기 점검 (URL 변경, 재렌더 대비) ──
  let lastPath = location.pathname;
  setInterval(() => {
    if (location.pathname !== lastPath) { lastPath = location.pathname; vividState.nextAt = 0; pollViewers(); }
    hideRankingFallback();
    ensureVivid();
    if (!document.getElementById('bongchzzk-xstyle')) applyStyles();
  }, 3000);
  setInterval(() => { if (!vBusy) refreshViewerUi(); }, 1000); // 플레이어/채팅 재렌더 시 재부착
  setInterval(() => { // 새 비디오(광고 후 재초기화 포함)마다 선명한 화면 재적용
    const v = mainVideo();
    if (v && !v._bongVivid) { v._bongVivid = 1; ['loadedmetadata', 'playing'].forEach(ev => v.addEventListener(ev, () => { vividState.nextAt = 0; setTimeout(ensureVivid, 1500); })); }
  }, 1000);
})();
