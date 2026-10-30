// BongChzzk 자동 재생: /live, /video 진입·새로고침 시 멈춰 있으면 한 번 재생 (사용자가 직접 멈추면 다시 안 건드림)
(() => {
  'use strict';
  if (window.top !== window) return;
  const A = globalThis.BongAutoplay;
  const VIDEO = 'div.pzp video.webplayer-internal-video';
  let enabled = true, key = '', done = false, userPaused = false, deadline = 0, timer = 0, clicked = 0;
  BCStore.sync.get({ autoPlay: true }, v => { enabled = v.autoPlay; start(); });
  BCStore.onChanged.addListener((c, a) => { if (a === 'sync' && c.autoPlay) { enabled = c.autoPlay.newValue; start(); } });

  // 사용자가 플레이어를 클릭/키로 조작하면 이후 자동 재생 중단 (isTrusted만)
  const markUser = e => { if (e.isTrusted && e.target && e.target.closest && e.target.closest('div.pzp')) userPaused = true; };
  document.addEventListener('pointerdown', markUser, true);
  document.addEventListener('keydown', e => { if (e.isTrusted && (e.code === 'Space' || e.key === 'k' || e.key === 'K') && document.querySelector('div.pzp')) userPaused = true; }, true);

  function findPlayButton() {
    const root = document.querySelector('div.pzp') || document;
    let best = null, bestS = 0;
    for (const el of root.querySelectorAll('button, [role="button"]')) {
      const s = A.scorePlayButton({ cls: String(el.className || ''), label: el.getAttribute('aria-label') || el.getAttribute('title') || '', text: (el.textContent || '').trim().slice(0, 30) });
      if (s > bestS) { best = el; bestS = s; }
    }
    return best;
  }
  function tick() {
    clearTimeout(timer);
    if (!chrome.runtime?.id || Date.now() > deadline) return;
    const v = document.querySelector(VIDEO);
    const st = { enabled, onVideoPage: A.isVideoPage(location.pathname), hasVideo: !!v, userPaused, adActive: !!globalThis.__bongAdActive, done, paused: v && v.paused, ended: v && v.ended };
    if (v && !v.paused && v.currentTime > 0) { done = true; console.debug('[BongChzzk] 자동 재생: 재생 중 확인'); return; }
    if (A.shouldPlay(st)) {
      const p = v.play();
      if (p && p.catch) p.catch(err => {
        console.debug('[BongChzzk] 자동 재생 play() 실패:', err && err.name);
        if (Date.now() - clicked > 3000) {
          const b = findPlayButton();
          if (b) { clicked = Date.now(); b.click(); console.debug('[BongChzzk] 자동 재생: 재생 버튼 클릭', b); }
        }
      });
    }
    timer = setTimeout(tick, 1000);
  }
  function start() {
    const k = location.pathname;
    if (k !== key) { key = k; done = false; userPaused = false; }
    deadline = Date.now() + 15000;
    clearTimeout(timer); timer = setTimeout(tick, 800);
  }
  let last = location.pathname;
  setInterval(() => { if (location.pathname !== last) { last = location.pathname; start(); } }, 1000);
})();
