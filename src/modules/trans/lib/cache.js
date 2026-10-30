import {
  CACHE_STATS_KEY,
  DEFAULT_CACHE_MAX_AGE_DAYS,
  DEFAULT_CACHE_MAX_BYTES,
  coerceCacheRecord,
  createCacheStats,
  entryBytes,
  planEvictions,
} from './cache-policy.js';

const DB_NAME = 'page-translator';
const DB_VERSION = 2;
const STORE = 'translations';
const PRUNE_INTERVAL_MS = 30_000;

let dbPromise = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
        if (event.oldVersion >= 1 && event.oldVersion < 2) {
          const store = request.transaction.objectStore(STORE);
          const now = Date.now();
          const cursorRequest = store.openCursor();
          cursorRequest.onsuccess = () => {
            const cursor = cursorRequest.result;
            if (!cursor) return;
            if (typeof cursor.value === 'string') {
              cursor.update({
                value: cursor.value,
                usedAt: now,
                bytes: entryBytes(cursor.key, cursor.value),
              });
            }
            cursor.continue();
          };
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => db.close();
        db.onclose = () => {
          dbPromise = null;
        };
        resolve(db);
      };
      request.onerror = () => {
        dbPromise = null;
        reject(request.error || new Error('Failed to open the translation cache.'));
      };
    });
  }
  return dbPromise;
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Cache request failed.'));
  });
}

function defaultStorage() {
  return globalThis.chrome?.storage?.local || null;
}

export async function makeCacheKey(model, targetLanguage, text) {
  const bytes = new TextEncoder().encode(`${model}\u0000${targetLanguage}\u0000${text}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function listEntries(now) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const entries = [];
    const request = tx.objectStore(STORE).openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      const record = coerceCacheRecord(cursor.key, cursor.value, now);
      if (record) entries.push({ key: cursor.key, usedAt: record.usedAt, bytes: record.bytes });
      cursor.continue();
    };
    request.onerror = () => reject(request.error || new Error('Cache read failed.'));
    tx.oncomplete = () => resolve(entries);
    tx.onerror = () => reject(tx.error || new Error('Cache read failed.'));
    tx.onabort = () => reject(tx.error || new Error('Cache read aborted.'));
  });
}

async function deleteKeys(keys) {
  if (!keys.length) return;
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    for (const key of keys) store.delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Cache delete failed.'));
    tx.onabort = () => reject(tx.error || new Error('Cache delete aborted.'));
  });
}

export function createIdbCache(options = {}) {
  const stats = createCacheStats(options.storage || defaultStorage() || {
    async get() { return { [CACHE_STATS_KEY]: { savedStrings: 0, savedCalls: 0 } }; },
    async set() {},
  });
  const getPolicy = options.getPolicy || (async () => ({}));
  let lastPrune = 0;
  let pruneQueue = Promise.resolve();

  async function prune(force = false) {
    const now = Date.now();
    if (!force && now - lastPrune < PRUNE_INTERVAL_MS) return { removed: 0 };
    lastPrune = now;
    let policy = {};
    try {
      policy = await getPolicy();
    } catch {
      policy = {};
    }
    const entries = await listEntries(now);
    const drop = planEvictions(entries, {
      now,
      maxAgeDays: policy?.maxAgeDays ?? DEFAULT_CACHE_MAX_AGE_DAYS,
      maxBytes: policy?.maxBytes ?? DEFAULT_CACHE_MAX_BYTES,
    });
    await deleteKeys(drop);
    return { removed: drop.length };
  }

  return {
    async get(key) {
      const db = await openDb();
      const tx = db.transaction(STORE, 'readonly');
      const result = await requestToPromise(tx.objectStore(STORE).get(key));
      const record = coerceCacheRecord(key, result, Date.now());
      return record ? record.value : null;
    },
    async setMany(pairs) {
      if (!pairs.length) return;
      const db = await openDb();
      const now = Date.now();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        for (const [key, value] of pairs) {
          if (typeof value !== 'string') continue;
          store.put({ value, usedAt: now, bytes: entryBytes(key, value) }, key);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error('Cache write failed.'));
        tx.onabort = () => reject(tx.error || new Error('Cache write aborted.'));
      });
      pruneQueue = pruneQueue.then(() => prune(false), () => prune(false));
    },
    async touch(keys) {
      if (!keys?.length) return;
      const db = await openDb();
      const now = Date.now();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        for (const key of keys) {
          const request = store.get(key);
          request.onsuccess = () => {
            const record = coerceCacheRecord(key, request.result, now);
            if (record) store.put({ ...record, usedAt: now }, key);
          };
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error('Cache touch failed.'));
        tx.onabort = () => reject(tx.error || new Error('Cache touch aborted.'));
      });
    },
    async clear() {
      const db = await openDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error('Cache clear failed.'));
        tx.onabort = () => reject(tx.error || new Error('Cache clear aborted.'));
      });
    },
    noteSaved(delta) {
      return stats.noteSaved(delta);
    },
    resetStats() {
      return stats.reset();
    },
    async summary() {
      await prune(true);
      const entries = await listEntries(Date.now());
      const saved = await stats.read();
      return {
        count: entries.length,
        bytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
        savedStrings: saved.savedStrings,
        savedCalls: saved.savedCalls,
      };
    },
    prune(force = false) {
      const job = pruneQueue.then(() => prune(force), () => prune(force));
      pruneQueue = job.then(() => {}, () => {});
      return job;
    },
  };
}
