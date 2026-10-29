import { checkForUpdate, openExtensionsPage } from './lib/updates.js';

const DEF = { enabled: true, threshold: 5, cooldown: 10, toast: true };
const $ = id => document.getElementById(id);
chrome.storage.sync.get(DEF, v => {
  for (const k in DEF) { const el = $(k); if (el.type === 'checkbox') el.checked = v[k]; else el.value = v[k]; }
});
for (const k in DEF) $(k).addEventListener('change', e => {
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
  setUpdate('확인 중…');
  try {
    const result = await checkForUpdate(chrome.runtime.getManifest().version);
    setUpdate(result.message, false);
    if (!result.upToDate) showReleaseLinks(result.htmlUrl, result.zipUrl);
  } catch (error) {
    setUpdate(error?.message || '업데이트 정보를 가져오지 못했습니다.', true);
  } finally {
    updateButton.disabled = false;
  }
});
