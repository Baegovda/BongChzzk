import { chunkTexts } from './chunk.js';
import { makeCacheKey } from './cache.js';
import { isValidModelId, normalizeSettings, resolveModel, stripModelPrefix } from './settings.js';

function logicalKey(model, targetLanguage, text) {
  return `${model}\u0000${targetLanguage}\u0000${text}`;
}

const MEMORY_LIMIT = 5000;

function createDeferred() {
  let settled = false;
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {
    promise,
    resolve(value) {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    },
    reject(error) {
      if (!settled) {
        settled = true;
        reject(error);
      }
    },
  };
}

async function runPool(items, limit, worker) {
  if (!items.length) return;
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index]);
    }
  });
  await Promise.all(runners);
}

export function createTranslator({ persistentCache, translateFn, loadSettings }) {
  const memory = new Map();
  const inflight = new Map();

  function remember(key, value) {
    if (memory.has(key)) memory.delete(key);
    memory.set(key, value);
    if (memory.size > MEMORY_LIMIT) {
      const oldest = memory.keys().next().value;
      memory.delete(oldest);
    }
  }

  function unpackTranslations(result, fallbackModel) {
    if (Array.isArray(result)) return { translations: result, model: fallbackModel };
    if (result && Array.isArray(result.translations)) {
      const cleaned = stripModelPrefix(result.model);
      const model = isValidModelId(cleaned) ? cleaned : fallbackModel;
      return { translations: result.translations, model };
    }
    return { translations: null, model: fallbackModel };
  }

  function noteCacheSavings(persistentCache, texts, avoidedCalls) {
  if (!texts.length || typeof persistentCache.noteSaved !== 'function') return;
  try {
    const pending = persistentCache.noteSaved({
      strings: texts.length,
      calls: avoidedCalls,
    });
    if (pending && typeof pending.catch === 'function') pending.catch(() => {});
  } catch {
    // Stats must not block a translation.
  }
}

function noteCacheTouch(persistentCache, keys) {
  if (!keys.length || typeof persistentCache.touch !== 'function') return;
  try {
    const pending = persistentCache.touch(keys);
    if (pending && typeof pending.catch === 'function') pending.catch(() => {});
  } catch {
    // A missed last-used update only affects eviction order.
  }
}

async function fulfill(claimed, settings, memoryTexts = []) {
    const pending = claimed.slice();
    try {
      const still = [];
      const hitTexts = [];
      const hitKeys = [];
      for (const item of pending) {
        const cacheKey = await makeCacheKey(settings.model, settings.targetLanguage, item.text);
        let stored = null;
        try {
          stored = await persistentCache.get(cacheKey);
        } catch {
          stored = null;
        }
        if (typeof stored === 'string') {
          hitTexts.push(item.text);
          hitKeys.push(cacheKey);
          remember(item.key, stored);
          inflight.delete(item.key);
          item.deferred.resolve(stored);
        } else {
          still.push(item);
        }
      }
      const savedTexts = memoryTexts.concat(hitTexts);
      const avoidedCalls = still.length === 0 && savedTexts.length ? chunkTexts(savedTexts).length : 0;
      noteCacheSavings(persistentCache, savedTexts, avoidedCalls);
      noteCacheTouch(persistentCache, hitKeys);
      const groups = [];
      let offset = 0;
      for (const parts of chunkTexts(still.map((item) => item.text))) {
        groups.push(still.slice(offset, offset + parts.length));
        offset += parts.length;
      }
      await runPool(groups, 2, async (items) => {
        try {
          const unpacked = unpackTranslations(
            await translateFn(items.map((item) => item.text), settings),
            settings.model,
          );
          const translated = unpacked.translations;
          const usedModel = unpacked.model;
          settings.servedModel = usedModel;
          if (!Array.isArray(translated) || translated.length !== items.length) {
            const error = new Error('번역 결과 개수가 맞지 않아요.');
            error.code = 'BAD_RESPONSE';
            throw error;
          }
          const pairs = [];
          for (let index = 0; index < items.length; index += 1) {
            if (usedModel === settings.model) remember(items[index].key, translated[index]);
            const storedKey = await makeCacheKey(usedModel, settings.targetLanguage, items[index].text);
            pairs.push([storedKey, translated[index]]);
          }
          try {
            await persistentCache.setMany(pairs);
          } catch (error) {
            console.warn('[page-translator] cache write failed');
          }
          for (let index = 0; index < items.length; index += 1) {
            inflight.delete(items[index].key);
            items[index].deferred.resolve(translated[index]);
          }
        } catch (error) {
          for (const item of items) {
            if (inflight.get(item.key) === item.deferred) inflight.delete(item.key);
            item.deferred.reject(error);
          }
        }
      });
    } catch (error) {
      for (const item of pending) {
        if (inflight.get(item.key) === item.deferred) inflight.delete(item.key);
        item.deferred.reject(error);
      }
    }
  }

  return {
    async translateMany(texts) {
      if (!Array.isArray(texts) || texts.some((text) => typeof text !== 'string')) {
        const error = new Error('번역할 텍스트 형식이 올바르지 않아요.');
        error.code = 'BAD_REQUEST';
        throw error;
      }
      if (texts.length > 200) {
        const error = new Error('한 번에 너무 많은 문장을 보냈어요.');
        error.code = 'BAD_REQUEST';
        throw error;
      }
      const settings = normalizeSettings(await loadSettings());
      const model = resolveModel(settings);
      const resolved = { ...settings, model, servedModel: model };
      const keys = texts.map((text) => logicalKey(model, resolved.targetLanguage, text));
      const claimed = [];
      const seen = new Set();
      const memoryTexts = [];
      const memorySeen = new Set();
      for (let index = 0; index < texts.length; index += 1) {
        const key = keys[index];
        if (memory.has(key)) {
          if (!memorySeen.has(key)) {
            memorySeen.add(key);
            memoryTexts.push(texts[index]);
          }
          continue;
        }
        if (inflight.has(key) || seen.has(key)) continue;
        seen.add(key);
        const deferred = createDeferred();
        inflight.set(key, deferred);
        claimed.push({ key, text: texts[index], deferred });
      }
      if (claimed.length) void fulfill(claimed, resolved, memoryTexts);
      else noteCacheSavings(persistentCache, memoryTexts, memoryTexts.length ? chunkTexts(memoryTexts).length : 0);
      const translations = await Promise.all(keys.map((key) => (
        memory.has(key) ? memory.get(key) : inflight.get(key).promise
      )));
      return { translations, model: resolved.servedModel };
    },
    async clearCache() {
      memory.clear();
      for (const deferred of inflight.values()) {
        const error = new Error('번역 캐시를 지우는 중이에요.');
        error.code = 'CACHE_CLEARED';
        deferred.reject(error);
      }
      inflight.clear();
      await persistentCache.clear();
    },
  };
}
