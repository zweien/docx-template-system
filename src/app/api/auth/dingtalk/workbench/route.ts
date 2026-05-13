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

    // DingTalk WebView doesn't persist Set-Cookie headers or document.cookie reliably.
    // Try multiple approaches: document.cookie with minimal flags, and also set via header.
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>登录成功</title></head>
<body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif">
<div style="text-align:center">
<p id="msg">登录成功，正在跳转...</p>
<p id="dbg" style="font-size:12px;color:#999"></p>
</div>
<script>
(function(){
  var token = ${JSON.stringify(sessionToken)};
  var name = ${JSON.stringify(cookieName)};
  var dbg = document.getElementById("dbg");

  // Attempt 1: minimal cookie (no Secure, no SameSite)
  document.cookie = name + "=" + token + "; path=/";
  dbg.textContent = "attempt 1: " + (document.cookie.indexOf(name) !== -1 ? "OK" : "FAIL");

  // Attempt 2: with max-age
  document.cookie = name + "=" + token + "; path=/; max-age=${SESSION_MAX_AGE}";

  // Attempt 3: with domain
  document.cookie = name + "=" + token + "; path=/; max-age=${SESSION_MAX_AGE}; domain=doc.idrl.top";

  console.log("[dingtalk-wb] cookie set attempts done");
  console.log("[dingtalk-wb] document.cookie:", document.cookie);

  // Delayed redirect to allow cookie to be persisted
  setTimeout(function(){
    dbg.textContent += " | redirecting...";
    window.location.href = ${JSON.stringify(baseUrl + "/")};
  }, 2000);
})();
</script>
</body></html>`;

    // Also set via Set-Cookie header as belt-and-suspenders
    const response = new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
    response.cookies.set(cookieName, sessionToken, {
      httpOnly: false,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    return response;

    return new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error) {
    console.error("DingTalk workbench auth error:", error);
    return new NextResponse(errorHtml("钉钉登录失败，请重试"), {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}
