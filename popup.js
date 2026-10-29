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
