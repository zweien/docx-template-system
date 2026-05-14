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
  // Always use non-prefixed name so JS can set it via document.cookie
  // (__Secure- prefix cookies cannot be set by JavaScript)
  return "next-auth.session-token";
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

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>登录成功</title></head>
<body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif">
<div style="text-align:center">
<p>登录成功，正在跳转...</p>
</div>
<script>
(function(){
  var token = ${JSON.stringify(sessionToken)};
  var name = ${JSON.stringify(cookieName)};

  // Clear any existing cookies first (avoid duplicates)
  document.cookie = name + "=; path=/; max-age=0";
  document.cookie = name + "=; path=/; max-age=0; domain=doc.idrl.top";

  // DingTalk mobile WebView requires SameSite=None for cookies to be
  // sent on navigation. SameSite=Lax (default) causes cookies to be
  // silently dropped on page navigation in mobile WebView.
  document.cookie = name + "=" + token + "; path=/; max-age=${SESSION_MAX_AGE}; SameSite=None; Secure";

  setTimeout(function(){
    window.location.href = ${JSON.stringify(baseUrl + "/")};
  }, 1000);
})();
</script>
</body></html>`;

    // Also set via Set-Cookie header (clear old + set new)
    const response = new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
    // Clear old __Secure- prefixed cookie if any
    response.cookies.set("__Secure-next-auth.session-token", "", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    // Set non-prefixed cookie with SameSite=None for DingTalk mobile WebView
    response.cookies.set(cookieName, sessionToken, {
      httpOnly: false,
      secure: true,
      sameSite: "none",
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
