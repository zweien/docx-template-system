import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth-options";

const nextAuthHandler = NextAuth(authOptions);

function resolveNextAuthUrl(req: Request): string {
  const url = new URL(req.url);
  // When dev server binds to 0.0.0.0, the host in request URL is "0.0.0.0:port"
  // which browsers cannot access. Replace with localhost.
  let host = url.host;
  if (host.startsWith("0.0.0.0")) {
    host = host.replace("0.0.0.0", "localhost");
  }
  // Prefer the Origin header when available — it reflects the browser's address.
  const origin = req.headers.get("origin");
  if (origin) return origin;
  return `${url.protocol}//${host}`;
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
