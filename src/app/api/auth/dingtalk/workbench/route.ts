import { NextRequest, NextResponse } from "next/server";
import { getWorkbenchUserInfo } from "@/lib/dingtalk";
import { syncDingtalkUser } from "@/lib/dingtalk-user-sync";
import { logAudit } from "@/lib/services/audit-log.service";
import { encode } from "next-auth/jwt";
import { createOTT } from "@/lib/dingtalk-ott-store";

const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

function getBaseUrl(): string {
  return (process.env.NEXTAUTH_URL || "http://localhost:8060").replace(
    /\/$/,
    ""
  );
}

function errorHtml(message: string): string {
  const baseUrl = getBaseUrl();
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif">
<div style="text-align:center">
<p style="color:red">${message}</p>
<p><a href="${baseUrl}">返回首页</a></p>
</div></body></html>`;
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
      return new NextResponse(errorHtml("缺少 authCode"), {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
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

    // Encode session token
    const sessionToken = await encode({
      token: {
        id: user.id,
        role: user.role,
        name: user.name,
        email: user.email,
      },
      secret: process.env.NEXTAUTH_SECRET!,
      maxAge: SESSION_MAX_AGE,
    });

    // Create one-time token (OTT) for mobile WebView cookie workaround.
    // DingTalk mobile WebView (iOS WKWebView) has unreliable cookie persistence
    // across navigations. Instead of setting cookies in this response, we
    // generate a short-lived OTT and redirect to the exchange endpoint which
    // will handle session establishment.
    const ott = createOTT(sessionToken, user.id, user.name);
    const baseUrl = getBaseUrl();
    const exchangeUrl = `${baseUrl}/api/auth/dingtalk/exchange?ott=${ott}`;

    console.log("[dingtalk] workbench: created OTT, redirecting to exchange endpoint");

    // Use HTTP 302 redirect instead of HTML response.
    // 302 from POST converts to GET, so the browser will GET the exchange URL.
    const response = NextResponse.redirect(exchangeUrl, 302);

    // Clear old cookies
    response.cookies.set("__Secure-next-auth.session-token", "", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    response.cookies.set("next-auth.session-token", "", {
      httpOnly: false,
      secure: true,
      sameSite: "none",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error("DingTalk workbench auth error:", error);
    return new NextResponse(errorHtml("钉钉登录失败，请重试"), {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}
