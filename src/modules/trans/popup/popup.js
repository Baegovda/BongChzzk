import { canTranslateUrl, languageLabel, normalizeSettings, resolveModel, STORAGE_KEY } from '../lib/settings.js';
import { MESSAGES } from '../lib/messages.js';
import { blockedToggle, refreshToggle, settleToggle, startToggle } from '../lib/toggle-state.js';

const enabledBox = document.querySelector('#enabled');
const switchState = document.querySelector('#switchState');
const statusEl = document.querySelector('#status');
const metaEl = document.querySelector('#meta');
const optionsButton = document.querySelector('#options');

function setStatus(text, isError) {
  statusEl.textContent = text || '';
  statusEl.classList.toggle('error', Boolean(isError));
}

function describe(status) {
  const modelLine = status?.model && status.enabled && !status.error ? `\n사용 모델: ${status.model}` : '';
  let text;
  if (status?.error && status.enabled) text = status.error;
  else if (status?.enabled && (status.pending > 0 || status.pumping)) text = `번역 중… ${status.done}개 완료, ${status.pending}개 대기`;
  else if (status?.enabled && status.done > 0) text = `${status.done}개 문장을 번역했습니다.`;
  else if (status?.enabled) text = '번역할 문장을 찾지 못했습니다.';
  else if (status?.started) text = `번역을 껐습니다. 원문으로 되돌렸고 ${status.done}개를 보관 중입니다.`;
  else text = '켜면 보이는 문장부터 번역하고, 스크롤하면 이어집니다.';
  return `${text}${modelLine}`;
}

function showSwitch(on) {
  enabledBox.checked = Boolean(on);
  switchState.textContent = on ? 'ON' : 'OFF';
}

async function activeTab() {
  const queries = [
    { active: true, currentWindow: true },
    { active: true, lastFocusedWindow: true },
  ];
  let fallback = null;
  for (const query of queries) {
    const [tab] = await chrome.tabs.query(query);
    if (!tab?.id) continue;
    if (!fallback) fallback = tab;
    if (canTranslateUrl(tab.url)) return tab;
  }
  return fallback;
}

let hasKey = false;
let toggleState = { pending: false, on: false, error: '', tabId: null };
let toggleGeneration = 0;

function applyToggleView() {
  showSwitch(toggleState.on);
  if (toggleState.error) setStatus(toggleState.error, true);
}

async function refresh() {
  const tab = await activeTab();
  if (!tab?.id) return;
  if (toggleState.tabId != null && toggleState.tabId !== tab.id && !toggleState.pending) {
    toggleState = { pending: false, on: false, error: '', tabId: tab.id };
  }
  if (tab.url && !canTranslateUrl(tab.url)) {
    toggleState = { ...blockedToggle(MESSAGES.PAGE_BLOCKED), tabId: tab.id };
    enabledBox.disabled = true;
    applyToggleView();
    return;
  }
  if (!toggleState.pending) enabledBox.disabled = false;
  if (toggleState.pending && (toggleState.tabId == null || toggleState.tabId === tab.id)) {
    showSwitch(toggleState.on);
    return;
  }
  const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS', tabId: tab.id });
  if (toggleState.pending && (toggleState.tabId == null || toggleState.tabId === tab.id)) {
    showSwitch(toggleState.on);
    return;
  }
  const status = response?.status;
  toggleState = { ...refreshToggle(toggleState, status), tabId: tab.id };
  if (document.activeElement !== enabledBox) showSwitch(toggleState.on);
  else switchState.textContent = enabledBox.checked ? 'ON' : 'OFF';
  if (toggleState.error) {
    setStatus(toggleState.error, true);
    return;
  }
  if (!hasKey && !status?.started) {
    setStatus(MESSAGES.NO_API_KEY, true);
    return;
  }
  setStatus(response?.ok === false ? response.message : describe(status), Boolean(status?.error || response?.ok === false));
}

async function init() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const settings = normalizeSettings(stored[STORAGE_KEY]);
  let model = settings.modelChoice;
  try {
    model = resolveModel(settings);
  } catch {
    model = '모델 이름을 확인해 주세요';
  }
  metaEl.textContent = `${languageLabel(settings.targetLanguage)} · ${model}`;
  hasKey = Boolean(settings.apiKey);
  if (!hasKey) setStatus(MESSAGES.NO_API_KEY, true);
  optionsButton.addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('trans/options/options.html') }));
  enabledBox.addEventListener('change', () => {
    const turnOn = enabledBox.checked;
    const generation = ++toggleGeneration;
    toggleState = { ...startToggle(turnOn), tabId: toggleState.tabId, generation };
    showSwitch(turnOn);
    applyToggle(turnOn, generation).catch((error) => {
      if (generation !== toggleGeneration) return;
      toggleState = { ...settleToggle(turnOn, { ok: false, message: error?.message }), tabId: toggleState.tabId, generation };
      enabledBox.disabled = false;
      applyToggleView();
    });
  });
  refresh().catch(() => {});
  setInterval(() => {
    refresh().catch(() => {});
  }, 500);
}

async function applyToggle(turnOn, generation) {
  const tab = await activeTab();
  if (generation !== toggleGeneration) return;
  if (!tab?.id) {
    toggleState = { ...blockedToggle('현재 탭을 찾지 못했습니다.'), generation };
    enabledBox.disabled = false;
    applyToggleView();
    return;
  }
  if (tab.url && !canTranslateUrl(tab.url)) {
    toggleState = { ...blockedToggle(MESSAGES.PAGE_BLOCKED), tabId: tab.id, generation };
    enabledBox.disabled = true;
    applyToggleView();
    return;
  }
  toggleState = { ...toggleState, tabId: tab.id };
  setStatus(turnOn ? '이 페이지 번역을 켜는 중…' : '원문으로 되돌리는 중…');
  let response;
  try {
    response = await chrome.runtime.sendMessage({
      type: 'SET_ENABLED',
      tabId: tab.id,
      enabled: turnOn,
    });
  } catch (error) {
    response = { ok: false, message: error?.message || '번역 상태를 바꾸지 못했습니다.' };
  }
  if (generation !== toggleGeneration) return;
  toggleState = {
    ...settleToggle(turnOn, response),
    tabId: tab.id,
    generation,
  };
  enabledBox.disabled = !canTranslateUrl(tab.url) && Boolean(tab.url);
  applyToggleView();
  if (!toggleState.error) {
    setStatus(describe(response?.status), Boolean(response?.status?.error && response?.status?.enabled));
  }
}

init().catch((error) => setStatus(error.message, true));
