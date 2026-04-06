interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

export const TTL = {
  LIVE_EVENT: 90 * 1000,
  COMPLETED_EVENT: 24 * 60 * 60 * 1000,
  TEAM_DATA: 60 * 60 * 1000,
  SEARCH: 5 * 60 * 1000,
};

export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data;
}

export function cacheSet<T>(key: string, data: T, ttl: number): void {
  store.set(key, { data, expiresAt: Date.now() + ttl });
}

export async function withCache<T>(key: string, ttl: number, fetcher: () => Promise<T>): Promise<T> {
  const cached = cacheGet<T>(key);
  if (cached !== null) return cached;
  const data = await fetcher();
  cacheSet(key, data, ttl);
  return data;
}
