import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { consumeOTT } from "@/lib/dingtalk-ott-store";

const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Allow static assets in /public (e.g. /logo.png, /uploads/*)
  if (/\.[^/]+$/.test(pathname)) {
    return NextResponse.next();
  }

  // Allow auth-related routes and dingtalk workbench page
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/dingtalk") ||
    pathname.startsWith("/api/auth")
  ) {
    return NextResponse.next();
  }

  // Allow v1 API routes (uses Token auth, not session)
  if (pathname.startsWith("/api/v1")) {
    return NextResponse.next();
  }

  // Allow public form routes
  if (pathname.startsWith("/api/public/") || pathname.startsWith("/f/")) {
    return NextResponse.next();
  }

  const secureCookie =
    process.env.NEXTAUTH_URL?.startsWith("https://") ?? false;
  const cookieName = secureCookie
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";

  let token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    cookieName,
  });

  // Fallback: check non-prefixed cookie (set by DingTalk WebView via JS)
  // Must pass secureCookie: false so SessionStore reads the non-prefixed name
  if (!token && secureCookie) {
    token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
      cookieName: "next-auth.session-token",
      secureCookie: false,
    });
  }

  // Log all proxy hits for debugging DingTalk mobile auth
  const allCookies = request.cookies.get("next-auth.session-token")
    ? "non-prefixed-found"
    : request.cookies.get("__Secure-next-auth.session-token")
      ? "secure-found"
      : "none";
  const ua = request.headers.get("user-agent") || "";
  const isMobile = /DingTalk|Mobile|Android|iPhone/i.test(ua);
  if (isMobile || allCookies !== "none") {
    console.log(
      "[proxy] hit path:",
      pathname,
      "cookie:",
      allCookies,
      "token:",
      !!token,
      "ua:",
      ua.slice(0, 80)
    );
  }

  if (!token) {
    console.log(
      "[proxy] REJECT path:",
      pathname,
      "cookie:",
      allCookies,
      "ua:",
      ua.slice(0, 80)
    );
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/|api/auth/|api/v1/|api/public/|f/|login$|favicon.ico|logo.png|sitemap.xml|robots.txt|.*\\..*).*)",
  ],
};
