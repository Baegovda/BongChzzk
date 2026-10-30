import {
  CACHE_AGE_CHOICES,
  CACHE_SIZE_CHOICES,
  formatBytes,
} from '../lib/cache-policy.js';
import { MESSAGES } from '../lib/messages.js';
import {
  LANGUAGES,
  STORAGE_KEY,
  isValidModelId,
  normalizeSettings,
} from '../lib/settings.js';
import { saveSettings } from '../lib/settings-store.js';

const form = document.querySelector('#settings');
const apiKey = document.querySelector('#apiKey');
const showKey = document.querySelector('#showKey');
const customModel = document.querySelector('#customModel');
const customFallback = document.querySelector('#customFallback');
const language = document.querySelector('#targetLanguage');
const prioritizeCursor = document.querySelector('#prioritizeCursor');
const revealAnimation = document.querySelector('#revealAnimation');
const cacheMaxAgeDays = document.querySelector('#cacheMaxAgeDays');
const cacheMaxBytes = document.querySelector('#cacheMaxBytes');
const cacheCount = document.querySelector('#cacheCount');
const cacheBytes = document.querySelector('#cacheBytes');
const savedStrings = document.querySelector('#savedStrings');
const savedCalls = document.querySelector('#savedCalls');
const resetStatsButton = document.querySelector('#resetCacheStats');
const statusEl = document.querySelector('#status');
const clearButton = document.querySelector('#clearCache');
const checkKeyButton = document.querySelector('#checkKey');
const versionLine = document.querySelector('#versionLine');

const DEFAULT_MODEL = 'gemini-3.5-flash-lite';

function addOptions(select, choices, valueKey) {
  for (const choice of choices) {
    const option = document.createElement('option');
    option.value = String(choice[valueKey]);
    option.textContent = choice.label;
    select.appendChild(option);
  }
}

for (const item of LANGUAGES) {
  const option = document.createElement('option');
  option.value = item.code;
  option.textContent = `${item.native} · ${item.english}`;
  language.appendChild(option);
}
addOptions(cacheMaxAgeDays, CACHE_AGE_CHOICES, 'days');
addOptions(cacheMaxBytes, CACHE_SIZE_CHOICES, 'bytes');

function setStatus(text, kind) {
  statusEl.textContent = text;
  statusEl.className = kind || '';
}

function selectedValue(name, fallback) {
  return form.querySelector(`input[name="${name}"]:checked`)?.value || fallback;
}

function selectedModel() {
  return selectedValue('modelChoice', DEFAULT_MODEL);
}

function selectedFallback() {
  return selectedValue('fallbackChoice', DEFAULT_MODEL);
}

function syncCustomFields() {
  const custom = selectedModel() === 'custom';
  customModel.disabled = !custom;
  customModel.required = custom;
  const customFallbackSelected = selectedFallback() === 'custom';
  customFallback.disabled = !customFallbackSelected;
  customFallback.required = customFallbackSelected;
}

function draftSettings() {
  return normalizeSettings({
    apiKey: apiKey.value,
    modelChoice: selectedModel(),
    customModel: customModel.value,
    fallbackChoice: selectedFallback(),
    customFallback: customFallback.value,
    targetLanguage: language.value,
    prioritizeCursor: prioritizeCursor.checked,
    revealAnimation: revealAnimation.checked,
    cacheMaxAgeDays: cacheMaxAgeDays.value,
    cacheMaxBytes: cacheMaxBytes.value,
  });
}

function renderCacheStats(summary) {
  cacheCount.textContent = String(summary?.count ?? 0);
  cacheBytes.textContent = formatBytes(summary?.bytes);
  savedStrings.textContent = String(summary?.savedStrings ?? 0);
  savedCalls.textContent = String(summary?.savedCalls ?? 0);
}

async function refreshCacheStats() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_CACHE_STATS' });
    if (!response?.ok) {
      cacheCount.textContent = '–';
      return;
    }
    renderCacheStats(response);
  } catch {
    cacheCount.textContent = '–';
  }
}

function fill(settings) {
  apiKey.value = settings.apiKey;
  customModel.value = settings.customModel;
  customFallback.value = settings.customFallback;
  language.value = settings.targetLanguage;
  prioritizeCursor.checked = settings.prioritizeCursor;
  revealAnimation.checked = settings.revealAnimation !== false;
  cacheMaxAgeDays.value = String(settings.cacheMaxAgeDays);
  cacheMaxBytes.value = String(settings.cacheMaxBytes);
  const radio = form.querySelector(`input[name="modelChoice"][value="${settings.modelChoice}"]`);
  if (radio) radio.checked = true;
  const fallback = form.querySelector(`input[name="fallbackChoice"][value="${settings.fallbackChoice}"]`);
  if (fallback) fallback.checked = true;
  syncCustomFields();
}

function formatKeyCheck(result) {
  const lines = [result.message || '키를 확인하지 못했어요.'];
  const availability = result.presetAvailability || {};
  const showList = result.code === 'VALID' || result.code === 'OVERLOADED' || result.code === 'MODEL_NOT_FOUND';
  if (showList) {
    lines.push('이 키의 모델 목록:');
    for (const [id, listed] of Object.entries(availability)) {
      lines.push(`- ${id}: ${listed ? '사용 가능' : '목록에 없음'}`);
    }
  }
  return lines.join('\n');
}

function keyCheckKind(code) {
  if (code === 'VALID') return 'ok';
  if (code === 'OVERLOADED' || code === 'MODEL_NOT_FOUND') return 'warn';
  return 'error';
}

form.addEventListener('change', (event) => {
  if (event.target?.name === 'modelChoice' || event.target?.name === 'fallbackChoice') syncCustomFields();
});

showKey.addEventListener('change', () => {
  apiKey.type = showKey.checked ? 'text' : 'password';
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const next = draftSettings();
  if (next.modelChoice === 'custom' && !isValidModelId(next.customModel.replace(/^models\//, ''))) {
    setStatus(MESSAGES.NO_MODEL, 'error');
    customModel.focus();
    return;
  }
  if (next.fallbackChoice === 'custom' && !isValidModelId(next.customFallback.replace(/^models\//, ''))) {
    setStatus(MESSAGES.NO_MODEL, 'error');
    customFallback.focus();
    return;
  }
  await saveSettings(next);
  fill(next);
  await refreshCacheStats();
  setStatus(next.apiKey ? '저장했어요.' : `저장했어요. ${MESSAGES.NO_API_KEY}`, next.apiKey ? 'ok' : 'error');
});

checkKeyButton.addEventListener('click', async () => {
  const next = draftSettings();
  if (!next.apiKey) {
    setStatus(MESSAGES.NO_API_KEY, 'error');
    return;
  }
  if (next.modelChoice === 'custom' && !isValidModelId(next.customModel.replace(/^models\//, ''))) {
    setStatus(MESSAGES.NO_MODEL, 'error');
    customModel.focus();
    return;
  }
  checkKeyButton.disabled = true;
  setStatus('키와 모델 목록을 확인하는 중…', '');
  try {
    const response = await chrome.runtime.sendMessage({ type: 'CHECK_KEY', settings: next });
    if (!response?.ok) {
      setStatus(response?.message || '키를 확인하지 못했어요.', 'error');
      return;
    }
    setStatus(formatKeyCheck(response), keyCheckKind(response.code));
  } catch (error) {
    setStatus(error?.message || '키를 확인하지 못했어요.', 'error');
  } finally {
    checkKeyButton.disabled = false;
  }
});

clearButton.addEventListener('click', async () => {
  const confirmed = confirm('저장된 번역 캐시를 지울까요? 같은 문장도 다시 API로 번역해요. 누적 통계는 남아요.');
  if (!confirmed) return;
  const response = await chrome.runtime.sendMessage({ type: 'CLEAR_CACHE' });
  if (!response?.ok) {
    setStatus(response?.message || '캐시를 지우지 못했어요.', 'error');
    return;
  }
  renderCacheStats(response);
  setStatus('번역 캐시를 지웠어요.', 'ok');
});

resetStatsButton.addEventListener('click', async () => {
  const confirmed = confirm('누적 통계를 0으로 되돌릴까요? 저장된 번역은 지우지 않아요.');
  if (!confirmed) return;
  const response = await chrome.runtime.sendMessage({ type: 'RESET_CACHE_STATS' });
  if (!response?.ok) {
    setStatus(response?.message || '통계를 초기화하지 못했어요.', 'error');
    return;
  }
  renderCacheStats(response);
  setStatus('캐시 통계를 초기화했어요.', 'ok');
});

versionLine.textContent = `설치된 버전 ${chrome.runtime.getManifest().version}`;

const stored = await chrome.storage.local.get(STORAGE_KEY);
fill(normalizeSettings(stored[STORAGE_KEY]));
await refreshCacheStats();
