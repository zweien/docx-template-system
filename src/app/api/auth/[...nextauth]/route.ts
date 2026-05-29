import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth-options";

const nextAuthHandler = NextAuth(authOptions);

function resolveNextAuthUrl(req: Request): string {
  // Prefer the Origin header when available — it reflects the browser's address.
  const origin = req.headers.get("origin");
  if (origin) return origin;

  // Use proxy headers (X-Forwarded-Proto + Host) set by Nginx/Caddy.
  // Without this, req.url behind a reverse proxy may contain internal addresses
  // like localhost:8060, causing OAuth redirect_uri mismatch.
  const proto = req.headers.get("x-forwarded-proto");
  const host = req.headers.get("host");
  if (proto && host) {
    return `${proto}://${host}`;
  }

  // Fallback: parse request URL (works in direct-access / dev scenarios)
  const url = new URL(req.url);
  let urlHost = url.host;
  if (urlHost.startsWith("0.0.0.0")) {
    urlHost = urlHost.replace("0.0.0.0", "localhost");
  }
  return `${url.protocol}//${urlHost}`;
}

function withDynamicUrl(req: Request) {
  const resolved = resolveNextAuthUrl(req);
  const original = process.env.NEXTAUTH_URL;
  process.env.NEXTAUTH_URL = resolved;
  return () => {
    if (original !== undefined) {
      process.env.NEXTAUTH_URL = original;
    } else {
      delete process.env.NEXTAUTH_URL;
    }
  };
}

export async function GET(
  req: Request,
  context: { params: Promise<{ nextauth: string[] }> }
) {
  const restore = withDynamicUrl(req);
  try {
    return await nextAuthHandler(req, context);
  } finally {
    restore();
  }
}

export async function POST(
  req: Request,
  context: { params: Promise<{ nextauth: string[] }> }
) {
  const restore = withDynamicUrl(req);
  try {
    return await nextAuthHandler(req, context);
  } finally {
    restore();
  }
}
