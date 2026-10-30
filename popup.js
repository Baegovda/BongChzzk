import { checkForUpdate, openExtensionsPage } from './lib/updates.js';

const DEF = { enabled: true, threshold: 5, cooldown: 10, toast: true, lockQuality: true, targetQuality: 1080, followRefresh: true, followInterval: 5,
  vivid: true, hideRanking: true, chatFontSize: 0, viewerChat: true, viewerOverlay: true, arrowSeek: true, seekSeconds: 5 };
const $ = id => document.getElementById(id);
chrome.storage.sync.get(DEF, v => {
  for (const k in DEF) { const el = $(k); if (el.type === 'checkbox') el.checked = v[k]; else el.value = String(v[k]); }
  showFont(Number(v.chatFontSize) || 0);
});
// 채팅 글씨 크기 슬라이더: 움직이는 즉시 저장(라이브 미리보기), '기본'은 0(주입 안 함)
function showFont(n) {
  $('chatFontLabel').textContent = n >= 12 && n <= 28 ? n + 'px' : '기본';
  $('chatFontSize').value = String(n >= 12 ? n : 16);
}
$('chatFontSize').addEventListener('input', e => { const n = Number(e.target.value); showFont(n); chrome.storage.sync.set({ chatFontSize: n }); });
$('chatFontReset').addEventListener('click', () => { showFont(0); chrome.storage.sync.set({ chatFontSize: 0 }); });
for (const k in DEF) if (k !== 'chatFontSize') $(k).addEventListener('change', e => {
  const el = e.target;
  chrome.storage.sync.set({ [k]: el.type === 'checkbox' ? el.checked : Math.max(1, Number(el.value) || DEF[k]) });
});
function showCount() {
  chrome.storage.local.get({ recoverCount: 0, lastRecover: 0 }, v => {
    $('count').textContent = v.recoverCount;
    $('last').textContent = v.lastRecover ? '마지막: ' + new Date(v.lastRecover).toLocaleString('ko-KR') : '';
  });
}
$('reset').onclick = () => chrome.storage.local.set({ recoverCount: 0, lastRecover: 0 }, showCount);
showCount();

const updateButton = $('checkUpdate');
const updateStatus = $('updateStatus');
const updateLinks = $('updateLinks');
const openRelease = $('openRelease');
const openZip = $('openZip');
let releaseUrl = '';
let zipUrl = '';

function setUpdate(text, isError) {
  updateStatus.textContent = text || '';
  updateStatus.classList.toggle('error', Boolean(isError));
}

function showReleaseLinks(htmlUrl, downloadUrl) {
  releaseUrl = htmlUrl || '';
  zipUrl = downloadUrl || '';
  updateLinks.hidden = !releaseUrl && !zipUrl;
  openRelease.hidden = !releaseUrl;
  openZip.hidden = !zipUrl;
}

$('manage').addEventListener('click', () => { openExtensionsPage(); });
openRelease.addEventListener('click', () => { if (releaseUrl) chrome.tabs.create({ url: releaseUrl }); });
openZip.addEventListener('click', () => { if (zipUrl) chrome.tabs.create({ url: zipUrl }); });
updateButton.addEventListener('click', async () => {
  updateButton.disabled = true;
  showReleaseLinks('', '');
  $('doUpdate').hidden = true; assetUrl = null;
  setUpdate('확인 중…');
  try {
    const result = await checkForUpdate(chrome.runtime.getManifest().version);
    setUpdate(result.message, false);
    if (!result.upToDate) { showReleaseLinks(result.htmlUrl, result.zipUrl); assetUrl = result.assetUrl; $('doUpdate').hidden = !assetUrl; updateLinks.hidden = false; }
  } catch (error) {
    setUpdate(error?.message || '업데이트 정보를 가져오지 못했습니다.', true);
  } finally {
    updateButton.disabled = false;
  }
});

// 딸깍 업데이트: 폴더 선택 창이 뜨면 팝업이 닫히므로 실제 작업은 별도 탭(update.html)에서 진행
let assetUrl = null;
$('doUpdate').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('update.html') });
});
