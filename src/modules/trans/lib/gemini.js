import { fallbackModels, isValidModelId, languageLabel, resolveFallback, BUILTIN_MODELS } from './settings.js';
import { buildPrompt, parseTranslations, sanitizeTranslation } from './prompt.js';
import { GeminiError } from './errors.js';
import { MESSAGES, withDetail } from './messages.js';

const ARRAY_SCHEMA = {
  responseMimeType: 'application/json',
  responseSchema: {
    type: 'ARRAY',
    items: { type: 'STRING' },
  },
};

const OBJECT_SCHEMA = {
  responseMimeType: 'application/json',
  responseSchema: {
    type: 'OBJECT',
    properties: {
      translations: {
        type: 'ARRAY',
        items: { type: 'STRING' },
      },
    },
    required: ['translations'],
  },
};

const MODELS_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const OVERLOAD_COOLDOWN_MS = 60_000;
const NOT_FOUND_COOLDOWN_MS = 10 * 60_000;
const preferredConfigByModel = new Map();
const globalCooldown = new Map();

export function resetGenerationPreference() {
  preferredConfigByModel.clear();
}

export function resetModelCooldown() {
  globalCooldown.clear();
}

export function modelEndpoint(model) {
  if (!isValidModelId(model)) {
    throw new GeminiError('NO_MODEL', MESSAGES.NO_MODEL);
  }
  const path = model.includes('/') ? model : `models/${model}`;
  return `https://generativelanguage.googleapis.com/v1beta/${path}:generateContent`;
}

function generationConfigs(model) {
  const preferred = { ...ARRAY_SCHEMA };
  if (/^gemini-2\.5(?:[.-]|$)/i.test(model)) {
    preferred.temperature = 0.2;
    preferred.thinkingConfig = { thinkingBudget: 0 };
  } else if (/^gemini-3(?:[.-]|$)/i.test(model)) {
    preferred.thinkingConfig = { thinkingLevel: 'minimal' };
  }
  return [
    { id: 0, generationConfig: preferred },
    { id: 1, generationConfig: { ...OBJECT_SCHEMA } },
    { id: 2, generationConfig: { responseMimeType: 'application/json' } },
  ];
}

export function buildGenerationAttempts(model) {
  const configs = generationConfigs(model);
  const preferredId = preferredConfigByModel.get(model);
  if (preferredId == null) return configs;
  return [...configs].sort((a, b) => {
    if (a.id === preferredId) return -1;
    if (b.id === preferredId) return 1;
    return a.id - b.id;
  });
}

function retryAfterMs(response) {
  const header = response.headers?.get?.('retry-after');
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const when = Date.parse(header);
  if (Number.isFinite(when)) return Math.max(0, when - Date.now());
  return null;
}

function isQuotaMessage(text) {
  return /quota|prepay|credit balance|billing|free tier is not available|insufficient/i.test(text);
}

function isOverloadMessage(text) {
  return /high demand|overloaded|try again later|currently experiencing|UNAVAILABLE/i.test(text || '');
}

export function classifyHttpError(status, body, retryAfter) {
  const message = body?.error?.message || '';
  const reason = body?.error?.status || '';
  const blob = `${reason} ${message}`;
  if (status === 400 && /API key not valid|API_KEY_INVALID|invalid api key/i.test(blob)) {
    return new GeminiError('INVALID_KEY', MESSAGES.INVALID_KEY, { status });
  }
  if (status === 401 || status === 403) {
    return new GeminiError('INVALID_KEY', withDetail(MESSAGES.INVALID_KEY, message), { status });
  }
  if (status === 404) {
    return new GeminiError('MODEL_NOT_FOUND', withDetail(MESSAGES.MODEL_NOT_FOUND, message), { status });
  }
  if (status === 402 || (status !== 429 && isQuotaMessage(blob))) {
    return new GeminiError('QUOTA', withDetail(MESSAGES.QUOTA, message), { status, retryAfterMs: retryAfter });
  }
  if (status === 429) {
    const code = isQuotaMessage(blob) ? 'QUOTA' : 'RATE_LIMIT';
    const base = code === 'QUOTA' ? MESSAGES.QUOTA : MESSAGES.RATE_LIMIT;
    return new GeminiError(code, withDetail(base, message), { status, retryAfterMs: retryAfter });
  }
  if (status === 503 || (status >= 500 && isOverloadMessage(blob))) {
    return new GeminiError('OVERLOADED', withDetail(MESSAGES.OVERLOADED, message), { status, retryAfterMs: retryAfter });
  }
  if (status >= 500) {
    return new GeminiError('UNAVAILABLE', withDetail(MESSAGES.UNAVAILABLE, message), { status, retryAfterMs: retryAfter });
  }
  return new GeminiError(
    'API_ERROR',
    withDetail('Gemini API 요청이 거부되었습니다.', message || `HTTP ${status}`),
    { status, retryAfterMs: retryAfter },
  );
}

function extractResponseText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts || [];
  const texts = [];
  for (const part of parts) {
    if (part?.thought) continue;
    if (typeof part?.text === 'string') texts.push(part.text);
  }
  if (texts.length) return texts.join('');
  const reason = payload?.candidates?.[0]?.finishReason || payload?.promptFeedback?.blockReason;
  throw new GeminiError(
    'BAD_RESPONSE',
    reason ? `${MESSAGES.BAD_RESPONSE} (${reason})` : MESSAGES.BAD_RESPONSE,
  );
}

async function readBody(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postOnce(texts, settings, generationConfig, deps) {
  const fetchImpl = deps.fetchImpl || fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), deps.timeoutMs ?? 25000);
  try {
    const response = await fetchImpl(modelEndpoint(settings.model), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': settings.apiKey,
      },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{ text: buildPrompt(texts, languageLabel(settings.targetLanguage)) }],
        }],
        generationConfig,
      }),
      signal: controller.signal,
    });
    const wait = retryAfterMs(response);
    if (!response.ok) {
      const body = await readBody(response);
      throw classifyHttpError(response.status, body, wait);
    }
    const payload = await readBody(response);
    const parsed = parseTranslations(extractResponseText(payload), texts.length);
    return parsed.map((item, index) => sanitizeTranslation(texts[index], item));
  } catch (error) {
    if (error instanceof GeminiError) throw error;
    if (error?.name === 'AbortError') {
      throw new GeminiError('NETWORK', MESSAGES.NETWORK);
    }
    throw new GeminiError('NETWORK', MESSAGES.NETWORK);
  } finally {
    clearTimeout(timeout);
  }
}

function canRetry(error) {
  if (error?.code === 'RATE_LIMIT') return true;
  if (error?.code === 'QUOTA' && error.status === 429) return true;
  if (error?.code === 'OVERLOADED' || error?.code === 'UNAVAILABLE') return true;
  if (error?.status >= 500) return true;
  if (error?.code === 'NETWORK') return true;
  return false;
}

async function callWithRetry(texts, settings, generationConfig, deps) {
  const sleep = deps.sleep || defaultSleep;
  const jitter = deps.jitter || (() => Math.floor(Math.random() * 200));
  const retries = deps.retries ?? 3;
  let delay = 800;
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await postOnce(texts, settings, generationConfig, deps);
    } catch (error) {
      lastError = error;
      const retryable = canRetry(error) && attempt < retries;
      if (!retryable) throw error;
      const wait = Math.min(error.retryAfterMs ?? delay, 8000) + jitter();
      await sleep(wait);
      delay = Math.min(delay * 2, 8000);
    }
  }
  throw lastError;
}

function shouldTryNextConfig(error) {
  if (error?.code === 'BAD_RESPONSE') return true;
  return error?.status === 400 && error?.code === 'API_ERROR';
}

function shouldFallback(error) {
  return error?.code === 'OVERLOADED'
    || error?.code === 'UNAVAILABLE'
    || error?.code === 'MODEL_NOT_FOUND'
    || error?.status === 404
    || error?.status >= 500;
}

async function translateChunk(texts, settings, deps, depth) {
  if (!texts.length) return [];
  const attempts = buildGenerationAttempts(settings.model);
  let lastError;
  for (const attempt of attempts) {
    try {
      const translated = await callWithRetry(texts, settings, attempt.generationConfig, deps);
      preferredConfigByModel.set(settings.model, attempt.id);
      return translated;
    } catch (error) {
      lastError = error;
      if (!shouldTryNextConfig(error)) throw error;
    }
  }
  if (lastError?.code === 'BAD_RESPONSE' && texts.length > 1 && depth < 1) {
    const mid = Math.ceil(texts.length / 2);
    const left = await translateChunk(texts.slice(0, mid), settings, deps, depth + 1);
    const right = await translateChunk(texts.slice(mid), settings, deps, depth + 1);
    return left.concat(right);
  }
  throw lastError || new GeminiError('BAD_RESPONSE', MESSAGES.BAD_RESPONSE);
}

function modelChain(settings) {
  const source = Array.isArray(settings.models) && settings.models.length
    ? settings.models
    : fallbackModels(settings.model, resolveFallback(settings));
  const chain = [];
  for (const id of source) {
    const clean = String(id || '').replace(/^models\//, '');
    if (isValidModelId(clean) && !chain.includes(clean)) chain.push(clean);
  }
  return chain;
}

function markCooldown(cooldown, model, error, now, deps) {
  const missing = error?.code === 'MODEL_NOT_FOUND' || error?.status === 404;
  const wait = missing
    ? (deps.notFoundCooldownMs ?? NOT_FOUND_COOLDOWN_MS)
    : (deps.overloadCooldownMs ?? OVERLOAD_COOLDOWN_MS);
  cooldown.set(model, now + wait);
}

function chainFailure(attempts) {
  const last = attempts[attempts.length - 1]?.error || new GeminiError('OVERLOADED', MESSAGES.OVERLOADED);
  const names = attempts.map((attempt) => attempt.model).join(', ');
  const overloaded = attempts.some((attempt) => (
    attempt.error?.code === 'OVERLOADED' || attempt.error?.code === 'UNAVAILABLE' || attempt.error?.status >= 500
  ));
  if (overloaded) {
    return new GeminiError('OVERLOADED', withDetail(MESSAGES.OVERLOADED, names), { status: last.status || 503 });
  }
  if (attempts.some((attempt) => attempt.error?.code === 'MODEL_NOT_FOUND')) {
    return new GeminiError(
      'MODEL_NOT_FOUND',
      withDetail(MESSAGES.MODEL_NOT_FOUND, names),
      { status: 404 },
    );
  }
  return last;
}

export async function translateWithGemini(texts, settings, deps = {}) {
  if (!settings?.apiKey) throw new GeminiError('NO_API_KEY', MESSAGES.NO_API_KEY);
  const chain = modelChain(settings);
  if (!chain.length) throw new GeminiError('NO_MODEL', MESSAGES.NO_MODEL);
  if (!texts.length) return { translations: [], model: chain[0] };

  const cooldown = deps.cooldown || globalCooldown;
  const now = deps.now ?? Date.now();
  const ready = chain.filter((model) => (cooldown.get(model) || 0) <= now);
  const attemptModels = ready.length ? ready : [chain[0]];
  const failures = [];
  for (const model of attemptModels) {
    try {
      const translations = await translateChunk(texts, { ...settings, model }, deps, 0);
      return { translations, model };
    } catch (error) {
      if (!shouldFallback(error)) throw error;
      markCooldown(cooldown, model, error, now, deps);
      failures.push({ model, error });
    }
  }
  throw chainFailure(failures);
}

function presetAvailability(models) {
  const available = {};
  for (const preset of BUILTIN_MODELS) available[preset.id] = models.includes(preset.id);
  return available;
}

function supportsGenerate(model) {
  const methods = model?.supportedGenerationMethods;
  if (!Array.isArray(methods) || methods.length === 0) return true;
  return methods.includes('generateContent');
}

async function listModelIds(apiKey, deps) {
  const fetchImpl = deps.fetchImpl || fetch;
  const ids = [];
  let pageToken = '';
  for (let page = 0; page < 5; page += 1) {
    const url = new URL(MODELS_URL);
    url.searchParams.set('pageSize', '100');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), deps.timeoutMs ?? 20000);
    try {
      const response = await fetchImpl(url, {
        headers: { 'x-goog-api-key': apiKey },
        signal: controller.signal,
      });
      if (!response.ok) {
        const body = await readBody(response);
        throw classifyHttpError(response.status, body, retryAfterMs(response));
      }
      const body = await readBody(response);
      for (const model of body?.models || []) {
        const name = String(model?.name || '').replace(/^models\//, '');
        if (name && supportsGenerate(model)) ids.push(name);
      }
      pageToken = body?.nextPageToken || '';
      if (!pageToken) break;
    } catch (error) {
      if (error instanceof GeminiError) throw error;
      throw new GeminiError('NETWORK', MESSAGES.NETWORK);
    } finally {
      clearTimeout(timeout);
    }
  }
  return ids;
}

export async function checkApiKey(apiKey, model, deps = {}) {
  const key = typeof apiKey === 'string' ? apiKey.trim() : '';
  if (!key) {
    return {
      code: 'NO_API_KEY',
      message: MESSAGES.NO_API_KEY,
      models: [],
      presetAvailability: presetAvailability([]),
      probe: null,
    };
  }
  let models = [];
  try {
    models = await listModelIds(key, deps);
  } catch (error) {
    return {
      code: error.code || 'NETWORK',
      message: error.message || MESSAGES.NETWORK,
      models: [],
      presetAvailability: presetAvailability([]),
      probe: null,
    };
  }
  const availability = presetAvailability(models);
  if (!isValidModelId(model)) {
    return {
      code: 'NO_MODEL',
      message: MESSAGES.NO_MODEL,
      models,
      presetAvailability: availability,
      probe: null,
    };
  }
  let probe;
  try {
    await translateChunk(['ok'], {
      apiKey: key,
      model,
      targetLanguage: 'en',
    }, { ...deps, retries: 0 }, 0);
    probe = { code: 'OK', model };
  } catch (error) {
    probe = { code: error.code || 'API_ERROR', model, message: error.message, status: error.status || 0 };
  }
  if (probe.code === 'OK' || probe.code === 'BAD_RESPONSE') {
    return {
      code: 'VALID',
      message: 'API 키가 유효합니다. 선택한 모델도 응답합니다.',
      models,
      presetAvailability: availability,
      probe,
    };
  }
  if (probe.code === 'OVERLOADED' || probe.code === 'UNAVAILABLE') {
    return {
      code: 'OVERLOADED',
      message: `API 키는 유효합니다. 선택한 모델(${model})이 지금 혼잡합니다. 키 문제가 아닙니다.`,
      models,
      presetAvailability: availability,
      probe,
    };
  }
  if (probe.code === 'MODEL_NOT_FOUND') {
    return {
      code: 'MODEL_NOT_FOUND',
      message: `API 키는 유효합니다. 선택한 모델(${model})은 이 키로 사용할 수 없습니다.`,
      models,
      presetAvailability: availability,
      probe,
    };
  }
  return {
    code: probe.code,
    message: probe.message || MESSAGES.NETWORK,
    models,
    presetAvailability: availability,
    probe,
  };
}
