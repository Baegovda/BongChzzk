// BongChrome 공통: 모듈(치지직/번역/디시) 켜기·끄기 상태.
// chrome.storage.local 'core.modules' = { chzzk: true, trans: true, dc: true }
export const MODULES_KEY = 'core.modules';
export const MODULE_IDS = ['chzzk', 'trans', 'dc'];
export const DEFAULT_MODULES = { chzzk: true, trans: true, dc: true };

export function normalizeModules(value) {
  const out = { ...DEFAULT_MODULES };
  if (value && typeof value === 'object') {
    for (const id of MODULE_IDS) if (typeof value[id] === 'boolean') out[id] = value[id];
  }
  return out;
}

export async function getModules() {
  const stored = await chrome.storage.local.get(MODULES_KEY);
  return normalizeModules(stored[MODULES_KEY]);
}

export async function isModuleEnabled(id) {
  return (await getModules())[id] !== false;
}

export async function setModuleEnabled(id, enabled) {
  const next = { ...(await getModules()), [id]: Boolean(enabled) };
  await chrome.storage.local.set({ [MODULES_KEY]: next });
  return next;
}
