import { badgeForStatus } from './lib/badge.js';
import { createIdbCache } from './lib/cache.js';
import { checkApiKey, translateWithGemini } from './lib/gemini.js';
import { MESSAGES } from './lib/messages.js';
import { canTranslateUrl, contentPrefs, normalizeSettings, resolveModel } from './lib/settings.js';
import { loadSettings } from './lib/settings-store.js';
import { STORAGE_KEY } from './lib/settings.js';
import { isModuleEnabled } from '../core-modules.js';
import { createTranslator } from './lib/translator.js';

// BongExtend: 우클릭 메뉴는 디시 모듈 메뉴와 함께 background.ts의 createContextMenus에서 만든다.
// (removeAll을 각자 부르면 서로의 메뉴를 지우므로 여기서는 만들지 않는다.)
export function createTransMenus() {
  return chrome.contextMenus.create({
    id: 'toggle-translation',
    title: 'BongExtend: 페이지 번역 켜기/끄기',
    contexts: ['page', 'action'],
    documentUrlPatterns: ['http://*/*', 'https://*/*'],
  });
}

// BongExtend: 서비스 워커는 background.ts 하나다. 거기서 이 함수를 한 번 불러 번역 모듈 처리기를 붙인다.
let started = false;
export function startTransBackground() {
if (started) return;
started = true;

const persistentCache = createIdbCache({
  getPolicy: async () => {
    const settings = await loadSettings();
    return { maxAgeDays: settings.cacheMaxAgeDays, maxBytes: settings.cacheMaxBytes };
  },
});

const translator = createTranslator({
  persistentCache,
  translateFn: translateWithGemini,
  loadSettings,
});

persistentCache.prune(true).catch(() => {});


function isTopResult(result) {
  return result?.frameId === 0 || result?.frameId == null;
}

function statusFromResults(results) {
  const top = (results || []).find((result) => isTopResult(result) && result.result);
  return top?.result || (results || []).find((result) => result.result)?.result || null;
}

async function requireTab(tabId) {
  let tab = null;
  if (tabId != null) {
    tab = await chrome.tabs.get(tabId);
  } else {
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
    tab = active || null;
  }
  if (!tab?.id) {
    const error = new Error('현재 탭을 찾지 못했어요.');
    error.code = 'NO_TAB';
    throw error;
  }
  if (!(await isModuleEnabled('trans'))) {
    const error = new Error('번역 모듈이 꺼져 있어요. BongExtend 팝업의 번역 탭에서 켜 주세요.');
    error.code = 'MODULE_OFF';
    throw error;
  }
  if (tab.url && !canTranslateUrl(tab.url)) {
    const error = new Error(MESSAGES.PAGE_BLOCKED);
    error.code = 'PAGE_BLOCKED';
    throw error;
  }
  return tab;
}

function mainTarget(tabId) {
  return { tabId, frameIds: [0] };
}

function injectFailed() {
  const error = new Error(MESSAGES.INJECT_FAILED);
  error.code = 'INJECT_FAILED';
  return error;
}

async function injectFile(target) {
  await chrome.scripting.executeScript({ target, files: ['trans/content/content.js'] });
}

function callInPage(target, func, args) {
  const details = { target, func };
  if (Array.isArray(args)) details.args = args;
  return chrome.scripting.executeScript(details);
}

function injectRemainingFrames(tabId, func, args) {
  const target = { tabId, allFrames: true };
  injectFile(target)
    .then(() => callInPage(target, func, args))
    .catch(() => {});
}

async function runInFrames(tabId, func, args) {
  const main = mainTarget(tabId);
  try {
    await injectFile(main);
    const results = await callInPage(main, func, args);
    injectRemainingFrames(tabId, func, args);
    return results;
  } catch (error) {
    console.warn('[page-translator] inject', error?.message || error);
    throw injectFailed();
  }
}

function enableInPage() {
  const session = globalThis.__pageTranslator?.session;
  let top = true;
  try {
    top = window.top === window;
  } catch {
    top = false;
  }
  if (!session || !top) return null;
  return session.setEnabled(true);
}

function disableInPage() {
  const session = globalThis.__pageTranslator?.session;
  let top = true;
  try {
    top = window.top === window;
  } catch {
    top = false;
  }
  if (!session || !top) return null;
  return session.setEnabled(false);
}

function readStatusInPage() {
  const session = globalThis.__pageTranslator?.session;
  let top = true;
  try {
    top = window.top === window;
  } catch {
    top = false;
  }
  if (!top) return null;
  return session ? session.getStatus() : null;
}

function setBadge(tabId, status) {
  if (tabId == null) return;
  const badge = badgeForStatus(status);
  chrome.action.setBadgeBackgroundColor({ tabId, color: badge.color }).catch(() => {});
  chrome.action.setBadgeText({ tabId, text: badge.text }).catch(() => {});
}

function clearBadge(tabId) {
  setBadge(tabId, null);
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (typeof changeInfo.url === 'string') clearBadge(tabId);
});

async function setEnabled(tabId, enabled) {
  const tab = await requireTab(tabId);
  if (!enabled) {
    let results = [];
    try {
      results = await chrome.scripting.executeScript({
        target: mainTarget(tab.id),
        func: disableInPage,
      });
    } catch {
      throw injectFailed();
    }
    injectRemainingFrames(tab.id, disableInPage);
    const status = statusFromResults(results);
    if (status?.enabled) {
      return { ok: false, code: 'INJECT_FAILED', message: MESSAGES.INJECT_FAILED };
    }
    const settled = status || { enabled: false, showOriginal: true, started: false, done: 0, pending: 0 };
    setBadge(tab.id, settled);
    return { ok: true, status: settled };
  }
  const results = await runInFrames(tab.id, enableInPage);
  const status = statusFromResults(results);
  if (!status?.enabled) {
    return { ok: false, code: 'INJECT_FAILED', message: MESSAGES.INJECT_FAILED };
  }
  setBadge(tab.id, status);
  return { ok: true, status };
}

async function toggleTranslation(tabId) {
  const tab = await requireTab(tabId);
  let enabled = false;
  try {
    const current = await getStatus(tab.id);
    enabled = Boolean(current.status?.enabled);
  } catch {
    enabled = false;
  }
  return setEnabled(tab.id, !enabled);
}

function broadcastPrefs(settings) {
  const prefs = contentPrefs(settings);
  chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] }).then((tabs) => {
    for (const tab of tabs) {
      if (tab.id == null) continue;
      chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        func: (next) => {
          globalThis.__pageTranslator?.session?.setPrefs(next);
        },
        args: [prefs],
      }).catch(() => {});
    }
  }).catch(() => {});
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes[STORAGE_KEY]) return;
  const settings = normalizeSettings(changes[STORAGE_KEY].newValue);
  broadcastPrefs(settings);
  persistentCache.prune(true).catch(() => {});
});

async function getStatus(tabId) {
  const tab = await requireTab(tabId);
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, frameIds: [0] },
      func: readStatusInPage,
    });
    return { ok: true, status: results?.[0]?.result || null };
  } catch {
    return { ok: true, status: null };
  }
}

function fromExtensionPage(sender) {
  const url = sender?.url || '';
  try {
    return url.startsWith(chrome.runtime.getURL(''));
  } catch {
    return false;
  }
}

async function checkKeyMessage(message) {
  const draft = normalizeSettings(message.settings || await loadSettings());
  let model = '';
  try {
    model = resolveModel(draft);
  } catch (error) {
    return {
      code: error.code || 'NO_MODEL',
      message: error.message || MESSAGES.NO_MODEL,
      models: [],
      presetAvailability: {},
      probe: null,
    };
  }
  return checkApiKey(draft.apiKey, model);
}

function publicError(error) {
  return {
    ok: false,
    code: error?.code || 'API_ERROR',
    message: error?.message || '번역에 실패했어요.',
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || !message || typeof message !== 'object') return;
  if (message.type === 'TRANSLATE_BATCH') {
    translator.translateMany(message.texts).then(
      (result) => sendResponse({ ok: true, translations: result.translations, model: result.model }),
      (error) => {
        console.warn('[page-translator]', error?.code || 'API_ERROR', error?.status || '');
        sendResponse(publicError(error));
      },
    );
    return true;
  }
  if (message.type === 'PROGRESS') {
    if (sender.tab?.id != null) setBadge(sender.tab.id, message.status);
    return;
  }
  if (message.type === 'CLEAR_BADGE') {
    if (sender.tab?.id != null) clearBadge(sender.tab.id);
    return;
  }
  if (message.type === 'GET_PREFS') {
    loadSettings().then((settings) => {
      sendResponse(contentPrefs(settings));
    }, (error) => sendResponse(publicError(error)));
    return true;
  }
  if (message.type === 'TRANSLATE_TAB' || message.type === 'SET_ENABLED') {
    const enabled = message.type === 'TRANSLATE_TAB' ? true : Boolean(message.enabled);
    setEnabled(message.tabId, enabled).then(sendResponse, (error) => sendResponse(publicError(error)));
    return true;
  }
  if (message.type === 'GET_STATUS') {
    getStatus(message.tabId).then(sendResponse, (error) => sendResponse(publicError(error)));
    return true;
  }
  if (message.type === 'CHECK_KEY') {
    if (!fromExtensionPage(sender)) {
      sendResponse({ ok: false, code: 'FORBIDDEN', message: '설정 페이지에서만 키를 확인해요.' });
      return;
    }
    checkKeyMessage(message).then(
      (result) => sendResponse({ ok: true, ...result }),
      (error) => sendResponse(publicError(error)),
    );
    return true;
  }
  if (message.type === 'GET_CACHE_STATS' || message.type === 'RESET_CACHE_STATS' || message.type === 'CLEAR_CACHE') {
    if (!fromExtensionPage(sender)) {
      sendResponse({ ok: false, code: 'FORBIDDEN', message: '설정 페이지에서만 캐시를 다뤄요.' });
      return;
    }
    const run = message.type === 'CLEAR_CACHE'
      ? translator.clearCache().then(() => persistentCache.summary())
      : message.type === 'RESET_CACHE_STATS'
        ? persistentCache.resetStats().then(() => persistentCache.summary())
        : persistentCache.summary();
    run.then(
      (summary) => sendResponse({ ok: true, ...summary }),
      (error) => sendResponse(publicError(error)),
    );
    return true;
  }
  return undefined;
});

// BongExtend: 단축키(chrome.commands)는 사용자 요청으로 모두 뺐다.

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'toggle-translation') {
    toggleTranslation(tab?.id).catch((error) => console.warn('[page-translator]', error?.code || error?.message));
  }
});
}
