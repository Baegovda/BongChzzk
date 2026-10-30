const DEF = { enabled: true, threshold: 5, cooldown: 10, toast: true, lockQuality: true, targetQuality: 1080, followRefresh: true, followInterval: 5,
  vivid: true, hideRanking: true, chatFontSize: 0, viewerChat: true, viewerOverlay: true, arrowSeek: true, seekSeconds: 5, autoWide: true, autoPlay: true, watchEnabled: true, blurRankNames: false, hideTimeGuide: true, adSkip: true };
const $ = id => document.getElementById(id);
BCStore.sync.get(DEF, v => {
  for (const k in DEF) { const el = $(k); if (el.type === 'checkbox') el.checked = v[k]; else el.value = String(v[k]); }
  showFont(Number(v.chatFontSize) || 0);
});
// 채팅 글씨 크기 슬라이더: 움직이는 즉시 저장(라이브 미리보기), '기본'은 0(주입 안 함)
function showFont(n) {
  $('chatFontLabel').textContent = n >= 12 && n <= 28 ? n + 'px' : '기본';
  $('chatFontSize').value = String(n >= 12 ? n : 16);
}
$('chatFontSize').addEventListener('input', e => { const n = Number(e.target.value); showFont(n); BCStore.sync.set({ chatFontSize: n }); });
$('chatFontReset').addEventListener('click', () => { showFont(0); BCStore.sync.set({ chatFontSize: 0 }); });
for (const k in DEF) if (k !== 'chatFontSize') $(k).addEventListener('change', e => {
  const el = e.target;
  BCStore.sync.set({ [k]: el.type === 'checkbox' ? el.checked : Math.max(1, Number(el.value) || DEF[k]) });
});
function showCount() {
  BCStore.local.get({ recoverCount: 0, lastRecover: 0 }, v => {
    $('count').textContent = v.recoverCount;
    $('last').textContent = v.lastRecover ? '마지막: ' + new Date(v.lastRecover).toLocaleString('ko-KR') : '';
  });
}
$('reset').onclick = () => BCStore.local.set({ recoverCount: 0, lastRecover: 0 }, showCount);
showCount();

// ───── 관심 스트리머 자동 이동 ─────
const WB = globalThis.BongWatch;
const API = 'https://api.chzzk.naver.com';
const watchMsg = t => { $('watchMsg').textContent = t || ''; };
const getList = () => new Promise(r => BCStore.sync.get({ watchList: [] }, v => r(v.watchList || [])));
const setList = l => new Promise(r => BCStore.sync.set({ watchList: l }, r));
function renderList(list) {
  const ul = $('watchListEl'); ul.textContent = '';
  if (!list.length) { const li = document.createElement('li'); li.style.color = '#777'; li.textContent = '등록된 스트리머 없음'; ul.appendChild(li); }
  for (const w of list) {
    const li = document.createElement('li'); li.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin:3px 0';
    const s = document.createElement('span'); s.textContent = w.name || w.id.slice(0, 8) + '…'; s.title = w.id;
    const b = document.createElement('button'); b.type = 'button'; b.textContent = '삭제';
    b.onclick = async () => { const l = (await getList()).filter(x => x.id !== w.id); await setList(l); renderList(l); };
    li.append(s, b); ul.appendChild(li);
  }
}
async function channelName(id) {
  try { const r = await fetch(`${API}/service/v1/channels/${id}`, { credentials: 'include' }); return (await r.json())?.content?.channelName || ''; } catch { return ''; }
}
async function addWatch(input) {
  const id = WB.parseChannelInput(input);
  if (!id) { watchMsg('치지직 채널 주소나 32자리 채널 ID를 입력하세요.'); return; }
  const list = await getList();
  if (list.some(x => x.id === id)) { watchMsg('이미 등록된 채널입니다.'); return; }
  watchMsg('채널 확인 중…');
  const name = await channelName(id);
  list.push({ id, name }); await setList(list); renderList(list);
  watchMsg(`${name || id} 추가됨`); $('watchInput').value = '';
}
$('watchAdd').onclick = () => addWatch($('watchInput').value);
$('watchInput').addEventListener('keydown', e => { if (e.key === 'Enter') addWatch(e.target.value); });
$('watchCurrent').onclick = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || !WB.parseChannelInput(tab.url)) { watchMsg('지금 탭이 치지직 채널/방송 페이지가 아닙니다.'); return; }
  addWatch(tab.url);
};
$('watchGoNow').onclick = async () => {
  const list = await getList();
  if (!list.length) { watchMsg('등록된 스트리머가 없습니다.'); return; }
  watchMsg('방송 확인 중…');
  for (const w of list) {
    try {
      const r = await fetch(`${API}/polling/v3.1/channels/${w.id}/live-status`, { credentials: 'include', cache: 'no-store' });
      if ((await r.json())?.content?.status === 'OPEN') {
        const url = 'https://chzzk.naver.com/live/' + w.id;
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.url && /^https:\/\/chzzk\.naver\.com\//.test(tab.url)) chrome.tabs.update(tab.id, { url }); else chrome.tabs.create({ url });
        watchMsg(`${w.name || w.id} 방송 중 → 이동`); return;
      }
    } catch { /* 다음 채널 */ }
  }
  watchMsg('지금 방송 중인 관심 스트리머가 없습니다.');
};
getList().then(renderList);
