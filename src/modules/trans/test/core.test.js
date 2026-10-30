import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { badgeForStatus, formatBadgeCount } from '../lib/badge.js';
import { chunkTexts } from '../lib/chunk.js';
import { makeCacheKey } from '../lib/cache.js';
import { GeminiError } from '../lib/errors.js';
import {
  buildGenerationAttempts,
  checkApiKey,
  classifyHttpError,
  modelEndpoint,
  resetGenerationPreference,
  translateWithGemini,
} from '../lib/gemini.js';
import { buildPrompt, parseTranslations, sanitizeTranslation } from '../lib/prompt.js';
import {
  canTranslateUrl,
  fallbackModels,
  languageLabel,
  contentPrefs,
  normalizeSettings,
  parseSettingsImport,
  resolveFallback,
  resolveModel,
  serializeSettings,
} from '../lib/settings.js';
import { createTranslator } from '../lib/translator.js';

test('settings default to Korean and Gemini 3.5 Flash-Lite', () => {
  const settings = normalizeSettings(undefined);
  assert.equal(settings.targetLanguage, 'ko');
  assert.equal(settings.modelChoice, 'gemini-3.5-flash-lite');
  assert.equal(settings.fallbackChoice, 'gemini-3.5-flash-lite');
  assert.equal(resolveModel(settings), 'gemini-3.5-flash-lite');
  assert.equal(resolveFallback(settings), 'gemini-3.5-flash-lite');
  assert.deepEqual(fallbackModels(resolveModel(settings), resolveFallback(settings)), [
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
  ]);
  assert.equal(settings.prioritizeCursor, false);
  assert.equal(normalizeSettings({ prioritizeCursor: true }).prioritizeCursor, true);
  assert.equal(settings.cacheMaxAgeDays, 90);
  assert.equal(settings.cacheMaxBytes, 0);
  assert.equal(settings.revealAnimation, true);
  assert.equal(normalizeSettings({ cacheMaxAgeDays: '30', cacheMaxBytes: 5 * 1024 * 1024 }).cacheMaxAgeDays, 30);
  assert.equal(normalizeSettings({ cacheMaxAgeDays: 12, cacheMaxBytes: 123 }).cacheMaxAgeDays, 90);
  assert.equal(normalizeSettings({ cacheMaxAgeDays: 12, cacheMaxBytes: 123 }).cacheMaxBytes, 0);
  assert.equal(normalizeSettings({ revealAnimation: false }).revealAnimation, false);
  const prefs = contentPrefs({ apiKey: 'secret', prioritizeCursor: true, revealAnimation: false });
  assert.deepEqual(prefs, { prioritizeCursor: true, revealAnimation: false });
  assert.equal(JSON.stringify(prefs).includes('secret'), false);
  assert.equal(languageLabel('ko'), 'Korean (한국어)');
  const retired = normalizeSettings({ modelChoice: 'gemini-2.5-flash-lite', fallbackChoice: 'gemini-2.5-flash' });
  assert.equal(retired.modelChoice, 'gemini-3.5-flash-lite');
  assert.equal(retired.fallbackChoice, 'gemini-3.5-flash-lite');
  const kept = normalizeSettings({ modelChoice: 'gemini-3.1-flash-lite' });
  assert.equal(kept.modelChoice, 'gemini-3.1-flash-lite');
  assert.deepEqual(fallbackModels('gemini-3.1-flash-lite', 'gemini-3.5-flash-lite'), [
    'gemini-3.1-flash-lite',
    'gemini-3.5-flash-lite',
  ]);
});

test('custom model ids are validated and a models/ prefix is removed', () => {
  const settings = normalizeSettings({
    modelChoice: 'custom',
    customModel: ' models/gemini-3.5-flash-lite ',
    targetLanguage: 'ja',
    apiKey: '  abc  ',
  });
  assert.equal(settings.apiKey, 'abc');
  assert.equal(resolveModel(settings), 'gemini-3.5-flash-lite');
  assert.throws(() => resolveModel({ modelChoice: 'custom', customModel: 'bad model' }), /모델/);
  assert.equal(canTranslateUrl('https://item.taobao.com/item.htm'), true);
  assert.equal(canTranslateUrl('chrome://extensions'), false);
});

test('prompt asks for a JSON array and natural Korean shopping copy', () => {
  const prompt = buildPrompt(['包邮', '尺码'], 'Korean (한국어)');
  assert.match(prompt, /Korean \(한국어\)/);
  assert.match(prompt, /무료배송/);
  assert.match(prompt, /\["包邮","尺码"\]/);
  assert.match(prompt, /JSON array of strings/);
});

test('parser accepts an array, a wrapper object, and a fenced payload', () => {
  assert.deepEqual(parseTranslations('["무료배송","사이즈"]', 2), ['무료배송', '사이즈']);
  assert.deepEqual(parseTranslations('{"translations":["a","b"]}', 2), ['a', 'b']);
  assert.deepEqual(parseTranslations('```json\n["a"]\n```', 1), ['a']);
  assert.equal(sanitizeTranslation('包邮', '   '), '包邮');
  assert.throws(() => parseTranslations('["only"]', 2), GeminiError);
});

test('chunks stay within item and character budgets', () => {
  const chunks = chunkTexts(['aaaa', 'bbbb', 'cc'], 2, 5);
  assert.deepEqual(chunks, [['aaaa'], ['bbbb'], ['cc']]);
  assert.deepEqual(chunkTexts(['hello', 'world'], 10, 100), [['hello', 'world']]);
});

test('generation config keeps Flash-Lite thinking small', () => {
  resetGenerationPreference();
  const lite = buildGenerationAttempts('gemini-3.5-flash-lite')[0].generationConfig;
  assert.equal(lite.thinkingConfig.thinkingLevel, 'minimal');
  assert.equal(lite.temperature, undefined);
  assert.equal(lite.responseMimeType, 'application/json');
  const previous = buildGenerationAttempts('gemini-3.1-flash-lite')[0].generationConfig;
  assert.equal(previous.thinkingConfig.thinkingLevel, 'minimal');
  const older = buildGenerationAttempts('gemini-2.5-flash-lite')[0].generationConfig;
  assert.equal(older.thinkingConfig.thinkingBudget, 0);
  assert.equal(older.temperature, 0.2);
  assert.equal(
    modelEndpoint('gemini-3.1-flash-lite'),
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent',
  );
});

function jsonResponse(status, body, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => headers[name.toLowerCase()] || null },
    json: async () => body,
  };
}

function geminiPayload(value) {
  return { candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }] };
}

test('missing API key never calls Gemini', async () => {
  let called = false;
  await assert.rejects(
    translateWithGemini(['你好'], {
      apiKey: '',
      model: 'gemini-3.1-flash-lite',
      targetLanguage: 'ko',
    }, { fetchImpl: async () => { called = true; } }),
    (error) => error.code === 'NO_API_KEY',
  );
  assert.equal(called, false);
});

test('429 responses are retried and then reported as quota or rate limit', async () => {
  const waits = [];
  let calls = 0;
  await assert.rejects(
    translateWithGemini(['包邮'], {
      apiKey: 'test-key',
      model: 'gemini-3.1-flash-lite',
      targetLanguage: 'ko',
    }, {
      retries: 2,
      jitter: () => 0,
      sleep: async (ms) => { waits.push(ms); },
      fetchImpl: async () => {
        calls += 1;
        return jsonResponse(429, {
          error: { status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded for quota metric.' },
        });
      },
    }),
    (error) => error.code === 'QUOTA',
  );
  assert.equal(calls, 3);
  assert.deepEqual(waits, [800, 1600]);
});

test('a schema rejection falls back to the next response shape', async () => {
  resetGenerationPreference();
  const calls = [];
  const translated = await translateWithGemini(['包邮', '颜色'], {
    apiKey: 'test-key',
    model: 'gemini-2.5-flash-lite',
    targetLanguage: 'ko',
  }, {
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body);
      calls.push(body.generationConfig.responseSchema?.type || 'none');
      assert.equal(init.headers['x-goog-api-key'], 'test-key');
      if (calls.length === 1) {
        return jsonResponse(400, { error: { status: 'INVALID_ARGUMENT', message: 'Unknown field thinkingBudget' } });
      }
      return jsonResponse(200, geminiPayload({ translations: ['무료배송', '색상'] }));
    },
  });
  assert.deepEqual(translated.translations, ['무료배송', '색상']);
  assert.equal(translated.model, 'gemini-2.5-flash-lite');
  assert.deepEqual(calls, ['ARRAY', 'OBJECT']);
});

test('an invalid API key is not retried', async () => {
  let calls = 0;
  await assert.rejects(
    translateWithGemini(['hi'], {
      apiKey: 'bad',
      model: 'gemini-3.1-flash-lite',
      targetLanguage: 'en',
    }, {
      fetchImpl: async () => {
        calls += 1;
        return jsonResponse(400, { error: { message: 'API key not valid. Please pass a valid API key.' } });
      },
    }),
    (error) => error.code === 'INVALID_KEY',
  );
  assert.equal(calls, 1);
  const quota = classifyHttpError(402, { error: { message: 'Prepay credit balance is depleted.' } }, null);
  assert.equal(quota.code, 'QUOTA');
});

test('cache skips repeated strings and separates model or language', async () => {
  const calls = [];
  const stored = new Map();
  const persistentCache = {
    async get(key) { return stored.get(key) ?? null; },
    async setMany(pairs) { for (const [key, value] of pairs) stored.set(key, value); },
    async clear() { stored.clear(); },
  };
  let settings = {
    apiKey: 'k',
    modelChoice: 'gemini-3.1-flash-lite',
    customModel: '',
    targetLanguage: 'ko',
  };
  const translator = createTranslator({
    persistentCache,
    loadSettings: async () => settings,
    translateFn: async (texts) => {
      calls.push(texts);
      return texts.map((text) => `KO:${text}`);
    },
  });
  const first = await translator.translateMany(['包邮', '包邮', '颜色']);
  assert.deepEqual(first.translations, ['KO:包邮', 'KO:包邮', 'KO:颜色']);
  assert.equal(first.model, 'gemini-3.1-flash-lite');
  assert.deepEqual(calls, [['包邮', '颜色']]);
  calls.length = 0;
  const [again, parallel] = await Promise.all([
    translator.translateMany(['包邮']),
    translator.translateMany(['包邮']),
  ]);
  assert.deepEqual(again.translations, ['KO:包邮']);
  assert.deepEqual(parallel.translations, ['KO:包邮']);
  assert.equal(calls.length, 0);

  settings = { ...settings, targetLanguage: 'en' };
  await translator.translateMany(['包邮']);
  assert.deepEqual(calls, [['包邮']]);

  const hash = await makeCacheKey('gemini-3.1-flash-lite', 'ko', '包邮');
  assert.equal(stored.get(hash), 'KO:包邮');
  await translator.clearCache();
  assert.equal(stored.size, 0);
});

test('a fallback result is cached under the model that produced it', async () => {
  const calls = [];
  const stored = new Map();
  const translator = createTranslator({
    persistentCache: {
      async get(key) { return stored.get(key) ?? null; },
      async setMany(pairs) { for (const [key, value] of pairs) stored.set(key, value); },
      async clear() { stored.clear(); },
    },
    loadSettings: async () => ({
      apiKey: 'k',
      modelChoice: 'gemini-3.1-flash-lite',
      targetLanguage: 'ko',
    }),
    translateFn: async (texts) => {
      calls.push(texts);
      return { translations: texts.map((text) => `OK:${text}`), model: 'gemini-3.5-flash-lite' };
    },
  });
  const first = await translator.translateMany(['包邮']);
  assert.deepEqual(first, { translations: ['OK:包邮'], model: 'gemini-3.5-flash-lite' });
  const primary = await makeCacheKey('gemini-3.1-flash-lite', 'ko', '包邮');
  const used = await makeCacheKey('gemini-3.5-flash-lite', 'ko', '包邮');
  assert.equal(stored.has(primary), false);
  assert.equal(stored.get(used), 'OK:包邮');
  await translator.translateMany(['包邮']);
  assert.equal(calls.length, 2);
});

test('cache hits count saved strings and avoided calls without counting a mixed request', async () => {
  const calls = [];
  const stored = new Map();
  const notes = [];
  const touched = [];
  const persistentCache = {
    async get(key) { return stored.get(key) ?? null; },
    async setMany(pairs) { for (const [key, value] of pairs) stored.set(key, value); },
    async clear() { stored.clear(); },
    touch(keys) { touched.push(...keys); },
    noteSaved(delta) { notes.push(delta); },
  };
  const settings = {
    apiKey: 'k',
    modelChoice: 'gemini-3.1-flash-lite',
    targetLanguage: 'ko',
  };
  const translator = createTranslator({
    persistentCache,
    loadSettings: async () => settings,
    translateFn: async (texts) => {
      calls.push(texts);
      return texts.map((text) => `KO:${text}`);
    },
  });
  await translator.translateMany(['하나', '둘']);
  assert.deepEqual(calls, [['하나', '둘']]);
  assert.deepEqual(notes, []);
  notes.length = 0;
  await translator.translateMany(['하나', '하나']);
  assert.deepEqual(notes, [{ strings: 1, calls: 1 }]);
  assert.equal(calls.length, 1);

  const cold = createTranslator({
    persistentCache,
    loadSettings: async () => settings,
    translateFn: async (texts) => {
      calls.push(texts);
      return texts.map((text) => `KO:${text}`);
    },
  });
  calls.length = 0;
  notes.length = 0;
  touched.length = 0;
  await cold.translateMany(['하나', '셋']);
  assert.deepEqual(calls, [['셋']]);
  assert.deepEqual(notes, [{ strings: 1, calls: 0 }]);
  assert.equal(touched.length, 1);
  calls.length = 0;
  notes.length = 0;
  await cold.translateMany(['하나']);
  assert.deepEqual(calls, []);
  assert.deepEqual(notes, [{ strings: 1, calls: 1 }]);
});

function requestUrl(input) {
  if (typeof input === 'string') return input;
  return input?.url || String(input);
}

test('503 overload retries, then the next model is used', async () => {
  resetGenerationPreference();
  const cooldown = new Map();
  const calls = [];
  const waits = [];
  let now = 1_000_000;
  const settings = {
    apiKey: 'test-key',
    model: 'gemini-3.1-flash-lite',
    models: ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite'],
    targetLanguage: 'ko',
  };
  const deps = {
    retries: 2,
    jitter: () => 0,
    cooldown,
    now,
    sleep: async (ms) => { waits.push(ms); },
    fetchImpl: async (url) => {
      calls.push(requestUrl(url));
      if (requestUrl(url).includes('gemini-3.1-flash-lite')) {
        return jsonResponse(503, {
          error: {
            status: 'UNAVAILABLE',
            message: 'This model is currently experiencing high demand. Please try again later.',
          },
        });
      }
      return jsonResponse(200, geminiPayload(['무료배송']));
    },
  };
  const translated = await translateWithGemini(['包邮'], settings, deps);
  assert.deepEqual(translated, { translations: ['무료배송'], model: 'gemini-3.5-flash-lite' });
  assert.equal(calls.filter((url) => url.includes('gemini-3.1-flash-lite')).length, 3);
  assert.equal(calls.filter((url) => url.includes('gemini-3.5-flash-lite')).length, 1);
  assert.deepEqual(waits, [800, 1600]);

  calls.length = 0;
  now += 1000;
  const skipped = await translateWithGemini(['颜色'], settings, { ...deps, now });
  assert.equal(skipped.model, 'gemini-3.5-flash-lite');
  assert.equal(calls.some((url) => url.includes('gemini-3.1-flash-lite')), false);

  calls.length = 0;
  deps.fetchImpl = async (url) => {
    calls.push(requestUrl(url));
    return jsonResponse(200, geminiPayload(['색상']));
  };
  const recovered = await translateWithGemini(['颜色'], settings, { ...deps, now: now + 60_000 });
  assert.equal(recovered.model, 'gemini-3.1-flash-lite');
  assert.match(calls[0], /gemini-3\.1-flash-lite/);
});

test('404 and exhausted overload are not reported as a bad API key', async () => {
  resetGenerationPreference();
  const calls = [];
  const moved = await translateWithGemini(['包邮'], {
    apiKey: 'test-key',
    model: 'gemini-3.5-flash-lite',
    models: ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'],
    targetLanguage: 'ko',
  }, {
    retries: 0,
    cooldown: new Map(),
    fetchImpl: async (url) => {
      calls.push(requestUrl(url));
      if (calls.length === 1) {
        return jsonResponse(404, {
          error: { message: 'models/gemini-2.5-flash-lite is no longer available to new users. Use models/gemini-3.5-flash-lite.' },
        });
      }
      return jsonResponse(200, geminiPayload(['무료배송']));
    },
  });
  assert.equal(moved.model, 'gemini-3.1-flash-lite');
  assert.equal(calls.length, 2);

  let invalidCalls = 0;
  await assert.rejects(
    translateWithGemini(['hi'], {
      apiKey: 'bad',
      model: 'gemini-3.1-flash-lite',
      models: ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite'],
      targetLanguage: 'en',
    }, {
      cooldown: new Map(),
      fetchImpl: async () => {
        invalidCalls += 1;
        return jsonResponse(400, { error: { message: 'API key not valid. Please pass a valid API key.' } });
      },
    }),
    (error) => error.code === 'INVALID_KEY',
  );
  assert.equal(invalidCalls, 1);

  await assert.rejects(
    translateWithGemini(['hi'], {
      apiKey: 'test-key',
      model: 'gemini-3.1-flash-lite',
      models: ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite'],
      targetLanguage: 'ko',
    }, {
      retries: 0,
      jitter: () => 0,
      cooldown: new Map(),
      sleep: async () => {},
      fetchImpl: async () => jsonResponse(503, {
        error: { message: 'This model is currently experiencing high demand.' },
      }),
    }),
    (error) => {
      assert.equal(error.code, 'OVERLOADED');
      assert.match(error.message, /API 키 문제가 아니에요/);
      assert.doesNotMatch(error.message, /Invalid API key|키가 거부/);
      return true;
    },
  );
  const overload = classifyHttpError(503, {
    error: { message: 'This model is currently experiencing high demand.' },
  }, null);
  assert.equal(overload.code, 'OVERLOADED');
  const plain500 = classifyHttpError(500, { error: { message: 'internal' } }, null);
  assert.equal(plain500.code, 'UNAVAILABLE');
});

test('key check lists preset models and separates overload from a bad key', async () => {
  const pages = [
    {
      models: [{
        name: 'models/gemini-3.5-flash-lite',
        supportedGenerationMethods: ['generateContent'],
      }],
      nextPageToken: 'page-2',
    },
    {
      models: [
        { name: 'models/gemini-3.1-flash-lite', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] },
      ],
    },
  ];
  let listed = 0;
  const overloaded = await checkApiKey('test-key', 'gemini-3.1-flash-lite', {
    fetchImpl: async (input) => {
      const url = requestUrl(input);
      if (url.includes('/models?') || url.includes('/models?'.slice(0))) {
        if (!url.includes(':generateContent')) {
          const body = pages[listed] || { models: [] };
          listed += 1;
          return jsonResponse(200, body);
        }
      }
      if (url.includes(':generateContent')) {
        return jsonResponse(503, {
          error: { message: 'This model is currently experiencing high demand.' },
        });
      }
      throw new Error(`unexpected ${url}`);
    },
  });
  assert.equal(overloaded.code, 'OVERLOADED');
  assert.match(overloaded.message, /API 키는 유효해요/);
  assert.match(overloaded.message, /키 문제가 아니에요/);
  assert.equal(overloaded.presetAvailability['gemini-3.5-flash-lite'], true);
  assert.equal(overloaded.presetAvailability['gemini-3.1-flash-lite'], true);
  assert.equal(listed, 2);

  const missing = await checkApiKey('', 'gemini-3.5-flash-lite', {
    fetchImpl: async () => { throw new Error('should not fetch'); },
  });
  assert.equal(missing.code, 'NO_API_KEY');

  const invalid = await checkApiKey('bad', 'gemini-3.5-flash-lite', {
    fetchImpl: async () => jsonResponse(400, { error: { message: 'API key not valid. Please pass a valid API key.' } }),
  });
  assert.equal(invalid.code, 'INVALID_KEY');
  assert.equal(invalid.presetAvailability['gemini-3.5-flash-lite'], false);

  const quota = await checkApiKey('limited', 'gemini-3.5-flash-lite', {
    fetchImpl: async () => jsonResponse(429, { error: { message: 'Quota exceeded for metric.' } }),
  });
  assert.equal(quota.code, 'QUOTA');
});

test('badge count stays compact and clears for original text', () => {
  assert.equal(formatBadgeCount(0), '0');
  assert.equal(formatBadgeCount(999), '999');
  assert.equal(formatBadgeCount(1000), '1k');
  assert.equal(formatBadgeCount(1200), '1.2k');
  assert.equal(formatBadgeCount(9949), '9.9k');
  assert.equal(formatBadgeCount(9950), '10k');
  assert.equal(formatBadgeCount(12000), '12k');
  assert.equal(formatBadgeCount(99500), '99k+');
  const live = badgeForStatus({ started: true, done: 1200, pending: 3, pumping: true, error: null });
  assert.equal(live.text, '1.2k');
  assert.equal(live.color, '#1d4ed8');
  assert.equal(badgeForStatus({ started: true, done: 8, showOriginal: true }).text, '');
  const failed = badgeForStatus({ started: true, done: 8, error: 'quota' });
  assert.equal(failed.text, '!');
  assert.equal(failed.color, '#b91c1c');
  assert.equal(badgeForStatus({ started: true, done: 0, pumping: true }).text, '');
});

test('settings JSON export and import keep the saved choices', () => {
  const raw = serializeSettings({
    apiKey: ' secret ',
    modelChoice: 'gemini-3.1-flash-lite',
    fallbackChoice: 'custom',
    customFallback: 'models/gemini-3.5-flash-lite',
    targetLanguage: 'ja',
  }, '2026-10-25T00:00:00.000Z');
  const document = JSON.parse(raw);
  assert.equal(document.type, 'page-translator-settings');
  assert.equal(document.version, 1);
  const imported = parseSettingsImport(raw);
  assert.equal(imported.apiKey, 'secret');
  assert.equal(imported.modelChoice, 'gemini-3.1-flash-lite');
  assert.equal(imported.fallbackChoice, 'custom');
  assert.equal(imported.customFallback, 'models/gemini-3.5-flash-lite');
  assert.equal(imported.targetLanguage, 'ja');
  assert.equal(imported.cacheMaxAgeDays, 90);
  assert.equal(imported.revealAnimation, true);
  const withMotion = parseSettingsImport(JSON.stringify({
    type: 'page-translator-settings',
    version: 1,
    settings: { revealAnimation: false, cacheMaxAgeDays: 180, cacheMaxBytes: 50 * 1024 * 1024 },
  }));
  assert.equal(withMotion.revealAnimation, false);
  assert.equal(withMotion.cacheMaxAgeDays, 180);
  assert.equal(withMotion.cacheMaxBytes, 50 * 1024 * 1024);
  assert.equal(parseSettingsImport(JSON.stringify(imported)).modelChoice, 'gemini-3.1-flash-lite');
  assert.throws(() => parseSettingsImport('{'), /JSON/);
  assert.throws(() => parseSettingsImport(JSON.stringify({ type: 'other', settings: {} })), /설정 파일/);
});

