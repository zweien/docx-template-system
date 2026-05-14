import { NextRequest, NextResponse } from "next/server";
import { consumeOTT } from "@/lib/dingtalk-ott-store";
import { decode } from "next-auth/jwt";

const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

function getBaseUrl(): string {
  return (process.env.NEXTAUTH_URL || "http://localhost:8060").replace(
    /\/$/,
    ""
  );
}

export async function GET(request: NextRequest) {
  const ott = request.nextUrl.searchParams.get("ott");

  if (!ott) {
    return NextResponse.redirect(
      new URL("/login?error=dingtalk_auth_failed", request.url)
    );
  }

  const entry = consumeOTT(ott);
  if (!entry) {
    return NextResponse.redirect(
      new URL("/login?error=dingtalk_auth_failed", request.url)
    );
  }

  console.log(
    "[dingtalk] exchange: valid OTT for user:",
    entry.userId,
    entry.userName
  );

  const decoded = await decode({
    token: entry.sessionToken,
    secret: process.env.NEXTAUTH_SECRET!,
  });

  if (!decoded) {
    console.error("[dingtalk] exchange: invalid session token");
    return NextResponse.redirect(
      new URL("/login?error=dingtalk_auth_failed", request.url)
    );
  }

  const baseUrl = getBaseUrl();
  const cookieName = "next-auth.session-token";

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>正在登录...</title></head>
<body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif">
<div style="text-align:center">
<p>登录成功，正在跳转...</p>
</div>
<script>
(function(){
  var token = ${JSON.stringify(entry.sessionToken)};
  var name = ${JSON.stringify(cookieName)};

  document.cookie = name + "=; path=/; max-age=0";
  document.cookie = name + "=; path=/; max-age=0; domain=doc.idrl.top";
  document.cookie = name + "=" + token + "; path=/; max-age=${SESSION_MAX_AGE}; SameSite=None; Secure";

  setTimeout(function(){
    window.location.href = ${JSON.stringify(baseUrl + "/")};
  }, 1000);
})();
</script>
</body></html>`;

  const response = new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });

  response.cookies.set(cookieName, entry.sessionToken, {
    httpOnly: false,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  return response;
}
