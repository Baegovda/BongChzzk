// BongChzzk 넓은 화면 자동: /live, /video 진입 시 플레이어 '넓은 화면'을 한 번 켬
// 주의: 넓은 화면 버튼 선택자는 실사이트에서 확인하지 못한 추정입니다.
(() => {
  'use strict';
  if (window.top !== window) return;
  const D = globalThis.BongWide;
  let enabled = true, doneUrl = '', tries = 0, timer = 0;
  BCStore.sync.get({ autoWide: true }, v => { enabled = v.autoWide; start(); });
  BCStore.onChanged.addListener((c, a) => { if (a === 'sync' && c.autoWide) { enabled = c.autoWide.newValue; doneUrl = ''; start(); } });

  const info = el => ({
    cls: el.className && el.className.baseVal !== undefined ? el.className.baseVal : String(el.className || ''),
    label: el.getAttribute('aria-label') || el.getAttribute('title') || '',
    text: (el.textContent || '').trim().slice(0, 40),
    ariaPressed: el.getAttribute('aria-pressed'),
    ariaChecked: el.getAttribute('aria-checked'),
    layoutWide: /wide|theater/i.test((document.getElementById('live_player_layout') || {}).className || '') || undefined
  });
  function findButton() {
    const root = document.querySelector('div.pzp.pzp-pc') || document.getElementById('live_player_layout') || document;
    const els = root.querySelectorAll('button, [role="button"], [class*="viewmode"], [class*="wide"], [class*="screen-mode"]');
    let best = null, bestS = 0;
    const found = [];
    for (const el of els) {
      const i = info(el), s = D.scoreCandidate(i);
      if (s > 0) found.push(`${s}:${i.cls}|${i.label}`);
      if (s > bestS) { best = el; bestS = s; }
    }
    console.debug('[BongChzzk] 넓은 화면 후보:', found.length ? found : '(없음)');
    return best ? (best.closest('button') || best) : null;
  }
  const pageKey = () => /^\/(live|video)\//.test(location.pathname) ? location.pathname : '';

  function attempt() {
    const key = pageKey();
    if (!enabled || !key || doneUrl === key) return;
    const btn = document.querySelector('div.pzp.pzp-pc video') ? findButton() : null;
    if (!btn) {
      if (++tries < 6) timer = setTimeout(attempt, 2000); // ~10초 동안 플레이어 렌더 대기
      return;
    }
    doneUrl = key; // 상태를 몰라도 URL당 최대 1번만 클릭(토글 반복 방지)
    const st = D.wideState(info(btn));
    if (st === true) { console.debug('[BongChzzk] 이미 넓은 화면'); return; }
    btn.click();
    console.debug('[BongChzzk] 넓은 화면 버튼 클릭', btn);
  }
  function start() { clearTimeout(timer); tries = 0; timer = setTimeout(attempt, 1500); }
  let last = location.pathname;
  setInterval(() => { if (location.pathname !== last) { last = location.pathname; start(); } }, 1000);
  window.addEventListener('popstate', () => setTimeout(() => { if (location.pathname !== last) { last = location.pathname; start(); } }, 200));
})();
