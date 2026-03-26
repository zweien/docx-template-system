interface CacheEntry<T> {
  data: T;
  expires: number;
}

const MAX_CACHE_SIZE = 100;
const cache = new Map<string, CacheEntry<unknown>>();

// 正在进行的请求，避免缓存穿透
const pendingRequests = new Map<string, Promise<unknown>>();

function evictIfNeeded(): void {
  if (cache.size >= MAX_CACHE_SIZE) {
    // 删除最早的条目
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
}

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

  // 检查是否有正在进行的请求，避免缓存穿透
  const pending = pendingRequests.get(key);
  if (pending) return pending as Promise<T>;

  const promise = fn().then((data) => {
    evictIfNeeded();
    cache.set(key, { data, expires: now + ttl });
    pendingRequests.delete(key);
    return data;
  }).catch((error) => {
    pendingRequests.delete(key);
    throw error;
  });

  pendingRequests.set(key, promise);
  return promise;
}

export function invalidateCache(pattern: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(pattern)) {
      cache.delete(key);
    }
  }
  // 同时清除相关的 pending 请求
  for (const key of pendingRequests.keys()) {
    if (key.startsWith(pattern)) {
      pendingRequests.delete(key);
    }
  }
}

export function clearCache(): void {
  cache.clear();
  pendingRequests.clear();
}

// 缓存 TTL 常量（毫秒）
export const CACHE_TTL = {
  TABLE_DEF: 5 * 60 * 1000,   // 5 分钟
  RELATIONS: 60 * 1000,       // 1 分钟
} as const;
