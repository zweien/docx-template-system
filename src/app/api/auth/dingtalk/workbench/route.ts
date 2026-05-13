import { NextRequest, NextResponse } from "next/server";
import { getWorkbenchUserInfo } from "@/lib/dingtalk";
import { syncDingtalkUser } from "@/lib/dingtalk-user-sync";
import { logAudit } from "@/lib/services/audit-log.service";
import { encode } from "next-auth/jwt";
import type { Role } from "@/generated/prisma/enums";

const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

function getBaseUrl(): string {
  return (process.env.NEXTAUTH_URL || "http://localhost:8060").replace(
    /\/$/,
    ""
  );
}

function getSessionCookieName(): string {
  const useSecureCookies =
    process.env.NEXTAUTH_URL?.startsWith("https://") ?? !!process.env.VERCEL;
  return `${useSecureCookies ? "__Secure-" : ""}next-auth.session-token`;
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

    const baseUrl = getBaseUrl();
    const cookieName = getSessionCookieName();

    // Return HTML page with meta refresh instead of 302 redirect
    // WebView handles Set-Cookie on 200 responses more reliably than on redirects
    const html = `<!DOCTYPE html><html><head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="2;url=${baseUrl}/">
<title>登录成功</title>
</head>
<body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif">
<div style="text-align:center">
<p>登录成功，正在跳转...</p>
<p><a href="${baseUrl}/">如果没有自动跳转，请点击这里</a></p>
</div>
<script>
// Debug: log cookie status
console.log("[dingtalk-workbench] cookies:", document.cookie);
// Force redirect as fallback
setTimeout(function(){ window.location.href = "${baseUrl}/"; }, 1500);
</script>
</body></html>`;

    const response = new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });

    response.cookies.set(cookieName, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
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
