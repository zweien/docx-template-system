import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const cookieHeader = request.headers.get("cookie") || "(empty)";
  const sessionToken = request.cookies.get("next-auth.session-token")?.value;
  const secureToken = request.cookies.get("__Secure-next-auth.session-token")?.value;
  return NextResponse.json({
    cookieHeader,
    sessionToken: sessionToken ? `found (length ${sessionToken.length})` : "not found",
    secureToken: secureToken ? `found (length ${secureToken.length})` : "not found",
  });
}
