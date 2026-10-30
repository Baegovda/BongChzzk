// BongChzzk 관심 스트리머 자동 이동: 감시 중인 스트리머가 방송을 켜면(꺼짐→켜짐 전환) 해당 /live 페이지로 이동
(() => {
  'use strict';
  if (window.top !== window) return;
  const W = globalThis.BongWatch;
  const DEF = { watchEnabled: true, watchList: [] }; // watchList: [{ id, name }]
  const POLL = 5000, TTL = 15000;
  const myId = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const log = (...a) => console.log('[BongChzzk]', ...a);
  let cfg = { ...DEF }, timer = 0, busy = false, fails = 0, navigating = false;
  BCStore.sync.get(DEF, v => { cfg = { ...DEF, ...v }; schedule(1000); });
  BCStore.onChanged.addListener((c, area) => {
    if (area === 'sync' && (c.watchEnabled || c.watchList)) {
      if (c.watchEnabled) cfg.watchEnabled = c.watchEnabled.newValue;
      if (c.watchList) cfg.watchList = c.watchList.newValue || [];
      schedule(500);
    }
  });
  const getLocal = d => new Promise(r => BCStore.local.get(d, r));
  const setLocal = o => new Promise(r => BCStore.local.set(o, r));

  async function status(id) {
    const r = await fetch(`https://api.chzzk.naver.com/polling/v3.1/channels/${id}/live-status`, { credentials: 'include', cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const s = (await r.json())?.content?.status;
    return s === 'OPEN' ? 'OPEN' : 'CLOSE';
  }
  function toast(msg) {
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText = 'position:fixed;left:50%;top:20px;transform:translateX(-50%);z-index:2147483647;background:rgba(18,19,23,.92);color:#e8eaf0;border:1px solid #2c3039;border-left:3px solid #3ec5dc;padding:10px 16px;border-radius:8px;font:600 14px "Pretendard","Malgun Gothic",system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.35);pointer-events:none';
    (document.body || document.documentElement).appendChild(el);
  }

  async function tick() {
    const list = (cfg.watchList || []).filter(x => x && x.id);
    if (!cfg.watchEnabled || !list.length || busy || navigating) return;
    // 여러 탭 중 하나(리더)만 조회/이동. 보이는 탭은 만료 전이라도 리더를 넘겨받음
    const { watchLeader } = await getLocal({ watchLeader: null });
    const now = Date.now();
    if (!W.canLead(watchLeader, myId, now, TTL) && document.visibilityState !== 'visible') return;
    await setLocal({ watchLeader: { id: myId, ts: now } });
    busy = true;
    try {
      const { watchStatus: prev } = await getLocal({ watchStatus: {} });
      const cur = {};
      for (const w of list) {
        try { cur[w.id] = await status(w.id); } catch (e) { cur[w.id] = prev[w.id]; if (fails++ < 3) log('관심 스트리머 상태 조회 실패:', e.message); }
      }
      const prevFiltered = {};
      for (const k in cur) if (cur[k] !== undefined) prevFiltered[k] = cur[k];
      const went = W.detectTransitions(prev, cur);
      await setLocal({ watchStatus: { ...prev, ...prevFiltered } });
      const target = W.pickTarget(list.map(x => x.id), went, location.pathname);
      if (target) {
        const name = (list.find(x => x.id === target) || {}).name || '관심 스트리머';
        navigating = true;
        log('관심 스트리머 방송 시작 → 이동', target);
        toast(`${name} 방송 시작! 이동합니다`);
        setTimeout(() => location.assign('https://chzzk.naver.com/live/' + target), 1000);
      }
    } finally { busy = false; }
  }
  function schedule(delay) {
    clearTimeout(timer);
    timer = setTimeout(async () => { try { await tick(); } catch (e) { log('관심 스트리머 확인 오류:', e.message); } schedule(POLL); }, delay ?? POLL);
  }
})();
