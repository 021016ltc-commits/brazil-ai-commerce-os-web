type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const cacheStore = new Map<string, CacheEntry<unknown>>();
let cacheHits = 0;
let cacheMisses = 0;
let cacheWrites = 0;
let lastRebuildAt: string | null = null;

function cacheEnabled() {
  const cacheMode = process.env.CACHE_MODE?.trim().toLowerCase();
  return cacheMode !== "disabled" && cacheMode !== "off" && process.env.CACHE_ENABLED?.trim().toLowerCase() !== "false";
}

function normalizedCacheMode() {
  const cacheMode = process.env.CACHE_MODE?.trim().toLowerCase();
  if (cacheMode === "disabled" || cacheMode === "off") return "disabled";
  if (cacheMode === "upstash") return "upstash";
  if (cacheMode === "memory_or_upstash") return "memory_or_upstash";
  return "memory";
}

function now() {
  return Date.now();
}

export function getCached<T>(key: string): T | null {
  if (!cacheEnabled()) {
    cacheMisses += 1;
    return null;
  }

  const entry = cacheStore.get(key);
  if (!entry) {
    cacheMisses += 1;
    return null;
  }

  if (entry.expiresAt <= now()) {
    cacheMisses += 1;
    return null;
  }

  cacheHits += 1;
  return entry.value as T;
}

export function getStaleCached<T>(key: string): T | null {
  if (!cacheEnabled()) return null;
  const entry = cacheStore.get(key);
  return entry ? (entry.value as T) : null;
}

export function setCached<T>(key: string, value: T, ttlMs: number) {
  if (!cacheEnabled()) return value;

  cacheStore.set(key, {
    value,
    expiresAt: now() + Math.max(0, ttlMs),
  });
  cacheWrites += 1;

  return value;
}

export async function withApiCache<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
): Promise<T> {
  const cached = getCached<T>(key);
  if (cached) return cached;

  try {
    const value = await load();
    return setCached(key, value, ttlMs);
  } catch (error) {
    const stale = getStaleCached<T>(key);
    if (stale) return stale;
    throw error;
  }
}

export function clearCache(prefix?: string) {
  if (!prefix) {
    cacheStore.clear();
    lastRebuildAt = new Date().toISOString();
    return;
  }

  for (const key of cacheStore.keys()) {
    if (key.startsWith(prefix)) {
      cacheStore.delete(key);
    }
  }
  lastRebuildAt = new Date().toISOString();
}

export function warmCacheMarker() {
  lastRebuildAt = new Date().toISOString();
}

export function getCacheStats() {
  const totalReads = cacheHits + cacheMisses;

  return {
    cache_mode: normalizedCacheMode(),
    enabled: cacheEnabled(),
    entries: cacheStore.size,
    hits: cacheHits,
    misses: cacheMisses,
    writes: cacheWrites,
    hit_rate: totalReads > 0 ? Math.round((cacheHits / totalReads) * 1000) / 1000 : 0,
    last_rebuild_at: lastRebuildAt,
  };
}
