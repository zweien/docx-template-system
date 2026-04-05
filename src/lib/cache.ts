// Use globalThis to ensure cache is shared across all module instances
// (e.g., API route handlers and page SSR may have separate module scopes in dev mode)
const globalForCache = globalThis as unknown as {
  __appCache: Map<string, { data: unknown; expires: number }> | undefined;
  __appPending: Map<string, Promise<unknown>> | undefined;
};

const MAX_CACHE_SIZE = 100;

function getCache(): Map<string, { data: unknown; expires: number }> {
  if (!globalForCache.__appCache) {
    globalForCache.__appCache = new Map();
  }
  return globalForCache.__appCache;
}

function getPending(): Map<string, Promise<unknown>> {
  if (!globalForCache.__appPending) {
    globalForCache.__appPending = new Map();
  }
  return globalForCache.__appPending;
}

function evictIfNeeded(): void {
  const cache = getCache();
  if (cache.size >= MAX_CACHE_SIZE) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
}

export function withCache<T>(
  key: string,
  ttl: number,
  fn: () => Promise<T>
): Promise<T> {
  const cache = getCache();
  const pending = getPending();
  const cached = cache.get(key);
  const now = Date.now();

  if (cached && cached.expires > now) {
    return Promise.resolve(cached.data as T);
  }

  const pendingRequest = pending.get(key);
  if (pendingRequest) return pendingRequest as Promise<T>;

  const promise = fn().then((data) => {
    evictIfNeeded();
    cache.set(key, { data, expires: now + ttl });
    pending.delete(key);
    return data;
  }).catch((error) => {
    pending.delete(key);
    throw error;
  });

  pending.set(key, promise);
  return promise;
}

export function invalidateCache(pattern: string): void {
  const cache = getCache();
  const pending = getPending();
  for (const key of cache.keys()) {
    if (key.startsWith(pattern)) {
      cache.delete(key);
    }
  }
  for (const key of pending.keys()) {
    if (key.startsWith(pattern)) {
      pending.delete(key);
    }
  }
}

export function clearCache(): void {
  getCache().clear();
  getPending().clear();
}

// 缓存 TTL 常量（毫秒）
export const CACHE_TTL = {
  TABLE_DEF: 5 * 60 * 1000,   // 5 分钟
  RELATIONS: 60 * 1000,       // 1 分钟
} as const;
