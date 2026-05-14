// In-memory one-time token store for DingTalk mobile WebView auth
// Mobile WebView (especially iOS WKWebView) may lose cookies across navigations,
// so we use a short-lived OTT passed via URL to establish the session.

interface OTTEntry {
  sessionToken: string;
  userId: string;
  userName: string;
  expiresAt: number;
}

const store = new Map<string, OTTEntry>();

// Cleanup expired entries every 2 minutes
const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt < now) store.delete(key);
  }
}, 2 * 60 * 1000);

if (cleanup.unref) cleanup.unref();

export function createOTT(
  sessionToken: string,
  userId: string,
  userName: string
): string {
  const ott = crypto.randomUUID();
  store.set(ott, {
    sessionToken,
    userId,
    userName,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
  });
  return ott;
}

export function consumeOTT(ott: string): OTTEntry | null {
  const entry = store.get(ott);
  if (!entry) return null;
  store.delete(ott);
  if (entry.expiresAt < Date.now()) return null;
  return entry;
}
