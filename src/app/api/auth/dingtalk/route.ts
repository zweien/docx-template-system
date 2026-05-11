import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { generateState, buildAuthUrl, getCallbackUrl } from "@/lib/dingtalk";

export async function GET(request: NextRequest) {
  const state = generateState();
  const redirectUri = getCallbackUrl();
  const authUrl = buildAuthUrl(state, redirectUri);

  const response = NextResponse.redirect(authUrl);
  (await cookies()).set("dingtalk_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/api/auth/dingtalk/callback",
  });

  return response;
}
