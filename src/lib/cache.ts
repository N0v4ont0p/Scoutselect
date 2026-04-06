export const TTL_LIVE = 90_000;        // 90 s  — live event data
export const TTL_COMPLETE = 86_400_000; // 24 h  — finished events
export const TTL_TEAM = 3_600_000;      // 1 h   — team info
export const TTL_SEARCH = 300_000;      // 5 min — search results

interface CacheEntry<T> { value: T; expires: number }

const store = new Map<string, CacheEntry<unknown>>();

export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return undefined;
  if (Date.now() > entry.expires) { store.delete(key); return undefined; }
  return entry.value;
}

export function cacheSet<T>(key: string, value: T, ttl: number): void {
  store.set(key, { value, expires: Date.now() + ttl });
}
