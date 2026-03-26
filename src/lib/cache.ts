interface CacheEntry<T> {
  data: T;
  expires: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

export function withCache<T>(
  key: string,
  ttl: number,
  fn: () => Promise<T>
): Promise<T> {
  const cached = cache.get(key);
  const now = Date.now();

  if (cached && cached.expires > now) {
    return Promise.resolve(cached.data as T);
  }

  return fn().then((data) => {
    cache.set(key, { data, expires: now + ttl });
    return data;
  });
}

export function invalidateCache(pattern: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(pattern)) {
      cache.delete(key);
    }
  }
}

export function clearCache(): void {
  cache.clear();
}

// 缓存 TTL 常量（毫秒）
export const CACHE_TTL = {
  TABLE_DEF: 5 * 60 * 1000,   // 5 分钟
  RELATIONS: 60 * 1000,       // 1 分钟
} as const;
