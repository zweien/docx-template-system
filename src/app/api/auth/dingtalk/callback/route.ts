import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserAccessToken, getDingtalkUserInfo } from "@/lib/dingtalk";
import { syncDingtalkUser } from "@/lib/dingtalk-user-sync";
import { createSessionResponse } from "@/lib/dingtalk-session";
import { logAudit } from "@/lib/services/audit-log.service";

function getBaseUrl(): string {
  return (process.env.NEXTAUTH_URL || "http://localhost:8060").replace(
    /\/$/,
    ""
  );
}

function errorRedirect(request: NextRequest) {
  const loginUrl = new URL("/login", getBaseUrl());
  loginUrl.searchParams.set("error", "dingtalk_auth_failed");
  return NextResponse.redirect(loginUrl);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const authCode = searchParams.get("authCode") ?? searchParams.get("code");
  const state = searchParams.get("state");

  const cookieStore = await cookies();
  const savedState = cookieStore.get("dingtalk_oauth_state")?.value;

  if (!authCode || !state || !savedState || state !== savedState) {
    return errorRedirect(request);
  }

  cookieStore.delete("dingtalk_oauth_state");

  try {
    const tokenResult = await getUserAccessToken(authCode);
    const userInfo = await getDingtalkUserInfo(tokenResult.accessToken);
    const user = await syncDingtalkUser(userInfo);

    logAudit({
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      action: "LOGIN",
      detail: { provider: "dingtalk", method: "qrcode" },
    });

    return await createSessionResponse(user, "/");
  } catch (error) {
    console.error("DingTalk OAuth callback error:", error);
    return errorRedirect(request);
  }
}
