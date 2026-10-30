import { normalizeCacheMaxAgeDays, normalizeCacheMaxBytes } from './cache-policy.js';

export const STORAGE_KEY = 'trans.settings'; // BongChrome: 번역 모듈 구역

export const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
export const DEFAULT_FALLBACK_MODEL = 'gemini-3.5-flash-lite';

export const BUILTIN_MODELS = [
  {
    id: 'gemini-3.5-flash-lite',
    label: 'Gemini 3.5 Flash-Lite',
    hint: '기본값. 새 계정에서 권장하는 저비용 모델입니다.',
  },
  {
    id: 'gemini-3.1-flash-lite',
    label: 'Gemini 3.1 Flash-Lite',
    hint: '이전 기본 모델입니다. 혼잡하면 3.5로 넘어갑니다.',
  },
];

const RETIRED_MODELS = new Set([
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
]);

export const LANGUAGES = [
  { code: 'ko', native: '한국어', english: 'Korean' },
  { code: 'en', native: 'English', english: 'English' },
  { code: 'ja', native: '日本語', english: 'Japanese' },
  { code: 'zh-CN', native: '简体中文', english: 'Simplified Chinese' },
  { code: 'zh-TW', native: '繁體中文', english: 'Traditional Chinese' },
  { code: 'es', native: 'Español', english: 'Spanish' },
  { code: 'fr', native: 'Français', english: 'French' },
  { code: 'de', native: 'Deutsch', english: 'German' },
  { code: 'vi', native: 'Tiếng Việt', english: 'Vietnamese' },
  { code: 'th', native: 'ไทย', english: 'Thai' },
  { code: 'id', native: 'Bahasa Indonesia', english: 'Indonesian' },
  { code: 'ru', native: 'Русский', english: 'Russian' },
  { code: 'pt', native: 'Português', english: 'Portuguese' },
];

export const DEFAULT_SETTINGS = {
  apiKey: '',
  modelChoice: DEFAULT_MODEL,
  customModel: '',
  fallbackChoice: DEFAULT_FALLBACK_MODEL,
  customFallback: '',
  targetLanguage: 'ko',
  prioritizeCursor: false,
  cacheMaxAgeDays: 90,
  cacheMaxBytes: 0,
  revealAnimation: true,
};

const MODEL_ID = /^[A-Za-z0-9._:-]+(?:\/[A-Za-z0-9._:-]+)*$/;
const BUILTIN_IDS = new Set(BUILTIN_MODELS.map((model) => model.id));

export function isValidModelId(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 200 && MODEL_ID.test(value);
}

function choiceOrDefault(value, fallback) {
  if (RETIRED_MODELS.has(value)) return fallback;
  if (BUILTIN_IDS.has(value) || value === 'custom') return value;
  return fallback;
}

export const SETTINGS_FILE_TYPE = 'page-translator-settings';

export function exportSettingsDocument(settings, exportedAt = new Date().toISOString()) {
  return {
    type: SETTINGS_FILE_TYPE,
    version: 1,
    exportedAt,
    settings: normalizeSettings(settings),
  };
}

export function serializeSettings(settings, exportedAt) {
  return `${JSON.stringify(exportSettingsDocument(settings, exportedAt), null, 2)}\n`;
}

export function parseSettingsImport(text) {
  let parsed;
  try {
    parsed = JSON.parse(String(text || ''));
  } catch {
    const error = new Error('설정 파일을 읽지 못했습니다. JSON 형식인지 확인하세요.');
    error.code = 'BAD_SETTINGS_FILE';
    throw error;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    const error = new Error('설정 파일에 설정이 없습니다.');
    error.code = 'BAD_SETTINGS_FILE';
    throw error;
  }
  if (parsed.type != null && parsed.type !== SETTINGS_FILE_TYPE) {
    const error = new Error('이 확장 프로그램의 설정 파일이 아닙니다.');
    error.code = 'BAD_SETTINGS_FILE';
    throw error;
  }
  const source = parsed.type === SETTINGS_FILE_TYPE ? parsed.settings : parsed;
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    const error = new Error('설정 파일에 설정이 없습니다.');
    error.code = 'BAD_SETTINGS_FILE';
    throw error;
  }
  return normalizeSettings(source);
}

export function normalizeSettings(input) {
  const source = input && typeof input === 'object' ? input : {};
  return {
    apiKey: typeof source.apiKey === 'string' ? source.apiKey.trim() : '',
    modelChoice: choiceOrDefault(source.modelChoice, DEFAULT_SETTINGS.modelChoice),
    customModel: typeof source.customModel === 'string' ? source.customModel.trim() : '',
    fallbackChoice: choiceOrDefault(source.fallbackChoice, DEFAULT_SETTINGS.fallbackChoice),
    customFallback: typeof source.customFallback === 'string' ? source.customFallback.trim() : '',
    targetLanguage: LANGUAGES.some((language) => language.code === source.targetLanguage)
      ? source.targetLanguage
      : DEFAULT_SETTINGS.targetLanguage,
    prioritizeCursor: source.prioritizeCursor === true,
    cacheMaxAgeDays: normalizeCacheMaxAgeDays(source.cacheMaxAgeDays),
    cacheMaxBytes: normalizeCacheMaxBytes(source.cacheMaxBytes),
    revealAnimation: source.revealAnimation !== false,
  };
}

export function contentPrefs(settings) {
  const normalized = normalizeSettings(settings);
  return {
    prioritizeCursor: normalized.prioritizeCursor,
    revealAnimation: normalized.revealAnimation,
  };
}

export function languageLabel(code) {
  const found = LANGUAGES.find((language) => language.code === code);
  return found ? `${found.english} (${found.native})` : String(code || 'Korean (한국어)');
}

export function stripModelPrefix(model) {
  return String(model || '').replace(/^models\//, '');
}

function resolveChoice(choice, customValue) {
  if (choice === 'custom') {
    const custom = stripModelPrefix(customValue);
    if (!isValidModelId(custom)) {
      const error = new Error('사용자 지정 모델 이름이 비어 있거나 올바르지 않습니다. (Invalid model)');
      error.code = 'NO_MODEL';
      throw error;
    }
    return custom;
  }
  return choice;
}

export function resolveModel(settings) {
  const normalized = normalizeSettings(settings);
  return resolveChoice(normalized.modelChoice, normalized.customModel);
}

export function resolveFallback(settings) {
  const normalized = normalizeSettings(settings);
  try {
    return resolveChoice(normalized.fallbackChoice, normalized.customFallback);
  } catch {
    return '';
  }
}

export function fallbackModels(primary, fallback) {
  const chain = [];
  const push = (id) => {
    const clean = stripModelPrefix(id);
    if (!isValidModelId(clean) || chain.includes(clean)) return;
    chain.push(clean);
  };
  push(primary);
  push(fallback);
  for (const model of BUILTIN_MODELS) push(model.id);
  return chain;
}

export function canTranslateUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
