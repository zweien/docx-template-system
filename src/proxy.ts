import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static assets in /public (e.g. /logo.png, /uploads/*)
  if (/\.[^/]+$/.test(pathname)) {
    return NextResponse.next();
  }

  // Allow auth-related routes
  if (
    pathname.startsWith("/login") ||
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

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
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
