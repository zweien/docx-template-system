import { NextRequest, NextResponse } from "next/server";
import { getUserAccessToken, getDingtalkUserInfo } from "@/lib/dingtalk";
import { syncDingtalkUser } from "@/lib/dingtalk-user-sync";
import { createSessionJsonResponse } from "@/lib/dingtalk-session";
import { logAudit } from "@/lib/services/audit-log.service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const authCode = body.authCode as string | undefined;

    if (!authCode) {
      return NextResponse.json(
        { error: "authCode is required" },
        { status: 400 }
      );
    }

    const tokenResult = await getUserAccessToken(authCode);
    const userInfo = await getDingtalkUserInfo(tokenResult.accessToken);
    const user = await syncDingtalkUser(userInfo);

    logAudit({
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      action: "LOGIN",
      detail: { provider: "dingtalk", method: "workbench" },
    });

    return await createSessionJsonResponse(user);
  } catch (error) {
    console.error("DingTalk workbench auth error:", error);
    return NextResponse.json(
      { error: "dingtalk_auth_failed" },
      { status: 500 }
    );
  }
}
