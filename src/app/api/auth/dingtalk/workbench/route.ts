import { NextRequest, NextResponse } from "next/server";
import { getWorkbenchUserInfo } from "@/lib/dingtalk";
import { syncDingtalkUser } from "@/lib/dingtalk-user-sync";
import { createSessionResponse } from "@/lib/dingtalk-session";
import { logAudit } from "@/lib/services/audit-log.service";

function getBaseUrl(): string {
  return (process.env.NEXTAUTH_URL || "http://localhost:8060").replace(
    /\/$/,
    ""
  );
}

export async function POST(request: NextRequest) {
  try {
    let authCode: string | undefined;

    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const form = await request.formData();
      authCode = form.get("authCode") as string | undefined;
    } else {
      const body = await request.json();
      authCode = body.authCode as string | undefined;
    }

    if (!authCode) {
      const loginUrl = new URL("/login", getBaseUrl());
      loginUrl.searchParams.set("error", "dingtalk_auth_failed");
      return NextResponse.redirect(loginUrl);
    }

    console.log("[dingtalk] workbench: exchanging authCode, length:", authCode.length);
    const userInfo = await getWorkbenchUserInfo(authCode);
    console.log("[dingtalk] workbench: got userInfo, openId:", userInfo.openId?.slice(0, 8));

    const user = await syncDingtalkUser(userInfo);
    console.log("[dingtalk] workbench: synced user:", user.id, user.name);

    logAudit({
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      action: "LOGIN",
      detail: { provider: "dingtalk", method: "workbench" },
    });

    return await createSessionResponse(user, "/");
  } catch (error) {
    console.error("DingTalk workbench auth error:", error);
    const loginUrl = new URL("/login", getBaseUrl());
    loginUrl.searchParams.set("error", "dingtalk_auth_failed");
    return NextResponse.redirect(loginUrl);
  }
}
