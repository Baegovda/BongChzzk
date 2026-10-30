export const CACHE_STATS_KEY = 'trans.cacheStats'; // BongExtend: 번역 모듈 구역

export const CACHE_AGE_CHOICES = [
  { days: 30, label: '30일' },
  { days: 90, label: '90일' },
  { days: 180, label: '180일' },
  { days: 0, label: '삭제 안 함' },
];

export const CACHE_SIZE_CHOICES = [
  { bytes: 5 * 1024 * 1024, label: '5 MB' },
  { bytes: 20 * 1024 * 1024, label: '20 MB' },
  { bytes: 50 * 1024 * 1024, label: '50 MB' },
  { bytes: 0, label: '제한 없음' },
];

export const DEFAULT_CACHE_MAX_AGE_DAYS = 90;
export const DEFAULT_CACHE_MAX_BYTES = 0;

const DAY_MS = 24 * 60 * 60 * 1000;

function whole(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.min(Math.floor(number), Number.MAX_SAFE_INTEGER);
}

export function normalizeCacheMaxAgeDays(value) {
  const days = Number(value);
  return CACHE_AGE_CHOICES.some((choice) => choice.days === days) ? days : DEFAULT_CACHE_MAX_AGE_DAYS;
}

export function normalizeCacheMaxBytes(value) {
  const bytes = Number(value);
  return CACHE_SIZE_CHOICES.some((choice) => choice.bytes === bytes) ? bytes : DEFAULT_CACHE_MAX_BYTES;
}

export function utf8Bytes(text) {
  return new TextEncoder().encode(String(text ?? '')).length;
}

export function entryBytes(key, value) {
  return utf8Bytes(value) + String(key ?? '').length;
}

export function formatBytes(bytes) {
  const number = Math.max(0, Math.round(Number(bytes) || 0));
  if (number < 1024) return `${number} B`;
  if (number < 1024 * 1024) return `${(number / 1024).toFixed(1)} KB`;
  return `${(number / (1024 * 1024)).toFixed(1)} MB`;
}

export function emptyCacheStats() {
  return { savedStrings: 0, savedCalls: 0 };
}

export function addStats(current, delta) {
  const base = current && typeof current === 'object' ? current : {};
  const extra = delta && typeof delta === 'object' ? delta : {};
  return {
    savedStrings: whole(base.savedStrings) + whole(extra.strings ?? extra.savedStrings),
    savedCalls: whole(base.savedCalls) + whole(extra.calls ?? extra.savedCalls),
  };
}

export function coerceCacheRecord(key, raw, now) {
  const stamped = Number(now) > 0 ? Number(now) : Date.now();
  if (typeof raw === 'string') {
    return { value: raw, usedAt: stamped, bytes: entryBytes(key, raw) };
  }
  if (!raw || typeof raw !== 'object' || typeof raw.value !== 'string') return null;
  return {
    value: raw.value,
    usedAt: Number(raw.usedAt) > 0 ? Number(raw.usedAt) : stamped,
    bytes: Number(raw.bytes) > 0 ? Number(raw.bytes) : entryBytes(key, raw.value),
  };
}

export function planEvictions(entries, options = {}) {
  const now = Number(options.now) || 0;
  const ageDays = Number(options.maxAgeDays);
  const byteCap = Number(options.maxBytes);
  const maxAgeMs = Number.isFinite(ageDays) && ageDays > 0 ? ageDays * DAY_MS : 0;
  const maxBytes = Number.isFinite(byteCap) && byteCap > 0 ? Math.floor(byteCap) : 0;
  const drop = [];
  const fresh = [];
  for (const entry of entries || []) {
    if (!entry || entry.key == null) continue;
    const usedAt = Number(entry.usedAt) || 0;
    const bytes = Math.max(0, Number(entry.bytes) || 0);
    if (maxAgeMs && now - usedAt >= maxAgeMs) drop.push(entry.key);
    else fresh.push({ key: entry.key, usedAt, bytes });
  }
  if (maxBytes > 0) {
    fresh.sort((a, b) => a.usedAt - b.usedAt);
    let total = fresh.reduce((sum, entry) => sum + entry.bytes, 0);
    for (const entry of fresh) {
      if (total <= maxBytes) break;
      drop.push(entry.key);
      total -= entry.bytes;
    }
  }
  return drop;
}

export function createCacheStats(storage) {
  let queue = Promise.resolve();
  function readRaw() {
    return Promise.resolve(storage.get(CACHE_STATS_KEY)).then((stored) => (
      addStats(stored && stored[CACHE_STATS_KEY], { strings: 0, calls: 0 })
    ));
  }
  function enqueue(work) {
    const job = queue.then(work);
    queue = job.then(() => {}, () => {});
    return job;
  }
  return {
    noteSaved(delta) {
      return enqueue(async () => {
        const next = addStats(await readRaw(), delta);
        await storage.set({ [CACHE_STATS_KEY]: next });
        return next;
      });
    },
    read() {
      return readRaw();
    },
    reset() {
      return enqueue(async () => {
        const next = emptyCacheStats();
        await storage.set({ [CACHE_STATS_KEY]: next });
        return next;
      });
    },
  };
}
