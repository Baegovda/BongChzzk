import { STORAGE_KEY, normalizeSettings } from './settings.js';

export async function loadSettings() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return normalizeSettings(stored[STORAGE_KEY]);
}

export async function saveSettings(settings) {
  const normalized = normalizeSettings(settings);
  await chrome.storage.local.set({ [STORAGE_KEY]: normalized });
  return normalized;
}
