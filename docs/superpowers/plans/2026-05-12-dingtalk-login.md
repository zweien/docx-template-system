# DingTalk Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add DingTalk QR code scan login and workbench auto-login while preserving existing Authentik SSO.

**Architecture:** DingTalk's OAuth2 token endpoint is non-standard (`clientId`/`clientSecret` JSON body instead of standard form-encoded), so we cannot use NextAuth's built-in OAuth provider. Instead, custom API routes handle the OAuth flow and create NextAuth JWT sessions directly using `next-auth/jwt`'s `encode`. This keeps session management unified — the same JWT cookie that NextAuth creates is what our custom routes set, so `proxy.ts` and `getToken()` work unchanged.

**Tech Stack:** NextAuth v4 JWT, DingTalk OAuth2 REST API, Prisma, Next.js Route Handlers

---

## File Structure

| Operation | File | Responsibility |
|-----------|------|----------------|
| Modify | `prisma/schema.prisma` | Add dingtalk fields to User model |
| Create | `src/lib/dingtalk.ts` | DingTalk API calls (auth URL, token exchange, user info) |
| Create | `src/lib/dingtalk-user-sync.ts` | Find or create DingTalk users |
| Create | `src/lib/dingtalk-session.ts` | Create NextAuth JWT session from custom routes |
| Create | `src/app/api/auth/dingtalk/route.ts` | OAuth redirect to DingTalk |
| Create | `src/app/api/auth/dingtalk/callback/route.ts` | OAuth callback + session creation |
| Create | `src/app/api/auth/dingtalk/workbench/route.ts` | Workbench auto-login + session creation |
| Create | `src/app/dingtalk/page.tsx` | Workbench entry page (SDK detection) |
| Modify | `src/app/(auth)/login/page.tsx` | Pass `dingtalkEnabled` prop |
| Modify | `src/app/(auth)/login/login-client.tsx` | Add DingTalk login button |
| Modify | `src/proxy.ts` | Whitelist `/dingtalk` path |

---

### Task 1: Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma` (User model, around line 30)

- [ ] **Step 1: Add DingTalk fields to User model**

Add after the `oidcSubject` line in the User model:

```prisma
  oidcSubject   String?   @unique
  dingtalkOpenId   String?   @unique
  dingtalkUnionId  String?
  dingtalkNick     String?
  authProvider     String    @default("local")
```

- [ ] **Step 2: Push schema to database**

Run: `npx prisma db push`
Expected: Schema applied successfully

- [ ] **Step 3: Regenerate Prisma client**

Run: `npx prisma generate`
Expected: Prisma client generated

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add dingtalk fields to User model"
```

---

### Task 2: DingTalk Utility Library

**Files:**
- Create: `src/lib/dingtalk.ts`

- [ ] **Step 1: Create `src/lib/dingtalk.ts`**

Port from scheduling project. Read env vars with safe fallbacks (don't throw at build time).

```typescript
import crypto from "crypto";

const DINGTALK_AUTH_BASE = "https://login.dingtalk.com/oauth2/auth";
const DINGTALK_TOKEN_URL =
  "https://api.dingtalk.com/v1.0/oauth2/userAccessToken";
const DINGTALK_USER_INFO_URL =
  "https://api.dingtalk.com/v1.0/contact/users/me";

export function isDingtalkConfigured(): boolean {
  return !!(process.env.DINGTALK_CLIENT_ID && process.env.DINGTALK_CLIENT_SECRET);
}

function getClientId(): string {
  const id = process.env.DINGTALK_CLIENT_ID;
  if (!id) throw new Error("DINGTALK_CLIENT_ID 未配置");
  return id;
}

function getClientSecret(): string {
  const secret = process.env.DINGTALK_CLIENT_SECRET;
  if (!secret) throw new Error("DINGTALK_CLIENT_SECRET 未配置");
  return secret;
}

export function generateState(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function getCallbackUrl(): string {
  const baseUrl = (
    process.env.NEXTAUTH_URL || "http://localhost:8060"
  ).replace(/\/$/, "");
  return `${baseUrl}/api/auth/dingtalk/callback`;
}

export function buildAuthUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    redirect_uri: redirectUri,
    response_type: "code",
    client_id: getClientId(),
    scope: "openid",
    state,
    prompt: "consent",
  });
  return `${DINGTALK_AUTH_BASE}?${params.toString()}`;
}

interface UserAccessTokenResponse {
  accessToken: string;
  refreshToken: string;
  expireIn: number;
}

export async function getUserAccessToken(
  authCode: string
): Promise<UserAccessTokenResponse> {
  const response = await fetch(DINGTALK_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: getClientId(),
      clientSecret: getClientSecret(),
      code: authCode,
      grantType: "authorization_code",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `获取钉钉 access token 失败: ${response.status} ${text}`
    );
  }

  const data = await response.json();
  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expireIn: data.expireIn,
  };
}

export interface DingtalkUserInfo {
  openId: string;
  unionId: string;
  nick: string;
  avatarUrl: string;
  mobile: string;
}

export async function getDingtalkUserInfo(
  accessToken: string
): Promise<DingtalkUserInfo> {
  const response = await fetch(DINGTALK_USER_INFO_URL, {
    headers: {
      "x-acs-dingtalk-access-token": accessToken,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `获取钉钉用户信息失败: ${response.status} ${text}`
    );
  }

  const data = await response.json();
  return {
    openId: data.openId,
    unionId: data.unionId ?? "",
    nick: data.nick ?? "",
    avatarUrl: data.avatarUrl ?? "",
    mobile: data.mobile ?? "",
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/dingtalk.ts
git commit -m "feat: add DingTalk OAuth utility library"
```

---

### Task 3: DingTalk Session Helper

**Files:**
- Create: `src/lib/dingtalk-session.ts`

This helper creates a NextAuth-compatible JWT session cookie. It uses the same `encode` function that NextAuth uses internally, so `getToken()` in `proxy.ts` reads it correctly.

- [ ] **Step 1: Create `src/lib/dingtalk-session.ts`**

```typescript
import { encode } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { Role } from "@/generated/prisma/enums";

const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days, matches NextAuth default

function getSessionCookieName(): string {
  const useSecureCookies =
    process.env.NEXTAUTH_URL?.startsWith("https://") ?? false;
  return `${useSecureCookies ? "__Secure-" : ""}next-auth.session-token`;
}

interface SessionUser {
  id: string;
  role: Role;
  name: string;
  email: string;
}

export async function createSessionResponse(
  user: SessionUser,
  redirectUrl: string
) {
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

  const response = NextResponse.redirect(new URL(redirectUrl));
  response.cookies.set(getSessionCookieName(), sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  return response;
}

export async function createSessionJsonResponse(user: SessionUser) {
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

  const response = NextResponse.json({ success: true, redirect: "/" });
  response.cookies.set(getSessionCookieName(), sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  return response;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/dingtalk-session.ts
git commit -m "feat: add DingTalk session helper for NextAuth JWT"
```

---

### Task 4: DingTalk User Sync

**Files:**
- Create: `src/lib/dingtalk-user-sync.ts`

Follows the same repository pattern as `oidc-user-sync.ts`. DingTalk users are independent — no linking to existing accounts.

- [ ] **Step 1: Create `src/lib/dingtalk-user-sync.ts`**

```typescript
import { db } from "@/lib/db";
import type { Role } from "@/generated/prisma/enums";
import type { DingtalkUserInfo } from "@/lib/dingtalk";

interface DingtalkUserRecord {
  id: string;
  email: string;
  name: string;
  role: Role;
  dingtalkOpenId: string | null;
  dingtalkUnionId: string | null;
  dingtalkNick: string | null;
}

function buildDisplayName(info: DingtalkUserInfo): string {
  return info.nick?.trim() || `钉钉用户_${info.openId.slice(0, 6)}`;
}

function buildPlaceholderEmail(openId: string): string {
  return `dingtalk_${openId.slice(0, 8)}@dingtalk.local`;
}

export async function syncDingtalkUser(
  userInfo: DingtalkUserInfo
): Promise<DingtalkUserRecord> {
  const existing = await db.user.findUnique({
    where: { dingtalkOpenId: userInfo.openId },
  });

  if (existing) {
    return db.user.update({
      where: { id: existing.id },
      data: {
        name: buildDisplayName(userInfo),
        dingtalkUnionId: userInfo.unionId || existing.dingtalkUnionId,
        dingtalkNick: userInfo.nick || existing.dingtalkNick,
      },
    });
  }

  return db.user.create({
    data: {
      email: buildPlaceholderEmail(userInfo.openId),
      name: buildDisplayName(userInfo),
      role: "USER" as Role,
      dingtalkOpenId: userInfo.openId,
      dingtalkUnionId: userInfo.unionId,
      dingtalkNick: userInfo.nick,
      authProvider: "dingtalk",
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/dingtalk-user-sync.ts
git commit -m "feat: add DingTalk user sync logic"
```

---

### Task 5: OAuth Redirect Route

**Files:**
- Create: `src/app/api/auth/dingtalk/route.ts`

- [ ] **Step 1: Create directory**

Run: `mkdir -p src/app/api/auth/dingtalk`

- [ ] **Step 2: Create `src/app/api/auth/dingtalk/route.ts`**

```typescript
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
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/auth/dingtalk/route.ts
git commit -m "feat: add DingTalk OAuth redirect route"
```

---

### Task 6: OAuth Callback Route

**Files:**
- Create: `src/app/api/auth/dingtalk/callback/route.ts`

This route handles the DingTalk OAuth callback. It validates the state, exchanges the code for user info, syncs the user, and creates a NextAuth session.

- [ ] **Step 1: Create directory**

Run: `mkdir -p src/app/api/auth/dingtalk/callback`

- [ ] **Step 2: Create `src/app/api/auth/dingtalk/callback/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserAccessToken, getDingtalkUserInfo } from "@/lib/dingtalk";
import { syncDingtalkUser } from "@/lib/dingtalk-user-sync";
import { createSessionResponse } from "@/lib/dingtalk-session";
import { logAudit } from "@/lib/services/audit-log.service";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const authCode = searchParams.get("authCode") ?? searchParams.get("code");
  const state = searchParams.get("state");

  const cookieStore = await cookies();
  const savedState = cookieStore.get("dingtalk_oauth_state")?.value;

  if (!authCode || !state || !savedState || state !== savedState) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "dingtalk_auth_failed");
    return NextResponse.redirect(loginUrl);
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
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "dingtalk_auth_failed");
    return NextResponse.redirect(loginUrl);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/auth/dingtalk/callback/route.ts
git commit -m "feat: add DingTalk OAuth callback route"
```

---

### Task 7: Workbench Auto-login API

**Files:**
- Create: `src/app/api/auth/dingtalk/workbench/route.ts`

- [ ] **Step 1: Create directory**

Run: `mkdir -p src/app/api/auth/dingtalk/workbench`

- [ ] **Step 2: Create `src/app/api/auth/dingtalk/workbench/route.ts`**

```typescript
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
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/auth/dingtalk/workbench/route.ts
git commit -m "feat: add DingTalk workbench auto-login API"
```

---

### Task 8: Workbench Page

**Files:**
- Create: `src/app/dingtalk/page.tsx`

Adapted from scheduling project. Detects DingTalk environment and either uses JS SDK for auto-login or falls back to OAuth redirect.

- [ ] **Step 1: Create directory**

Run: `mkdir -p src/app/dingtalk`

- [ ] **Step 2: Create `src/app/dingtalk/page.tsx`**

```typescript
"use client";

import { useEffect, useState } from "react";

declare global {
  interface Window {
    dd?: {
      ready: (fn: () => void) => void;
      runtime: {
        permission: {
          requestAuthCode: (params: {
            corpId: string;
            onSuccess: (result: { code: string }) => void;
            onFail: (err: unknown) => void;
          }) => void;
        };
      };
    };
  }
}

export default function DingtalkPage() {
  const [status, setStatus] = useState<"loading" | "error" | "redirecting">(
    "loading"
  );
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const corpId = process.env.NEXT_PUBLIC_DINGTALK_CORP_ID;

    if (!corpId) {
      window.location.href = "/api/auth/dingtalk";
      return;
    }

    const checkSdk = () => {
      if (window.dd?.ready) {
        window.dd.ready(() => {
          window.dd!.runtime.permission.requestAuthCode({
            corpId,
            onSuccess: async (result) => {
              setStatus("redirecting");
              try {
                const res = await fetch("/api/auth/dingtalk/workbench", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ authCode: result.code }),
                });
                const data = await res.json();
                if (data.redirect) {
                  window.location.href = data.redirect;
                } else {
                  setStatus("error");
                  setErrorMsg(data.error || "登录失败");
                }
              } catch {
                setStatus("error");
                setErrorMsg("请求失败");
              }
            },
            onFail: (err) => {
              console.error("DingTalk requestAuthCode failed:", err);
              window.location.href = "/api/auth/dingtalk";
            },
          });
        });
      } else {
        window.location.href = "/api/auth/dingtalk";
      }
    };

    checkSdk();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="space-y-4 text-center">
        {status === "loading" && (
          <>
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">正在登录...</p>
          </>
        )}
        {status === "redirecting" && (
          <p className="text-sm text-muted-foreground">
            登录成功，正在跳转...
          </p>
        )}
        {status === "error" && (
          <>
            <p className="text-sm text-destructive">{errorMsg}</p>
            <a href="/" className="text-sm text-primary underline">
              返回首页
            </a>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/dingtalk/page.tsx
git commit -m "feat: add DingTalk workbench auto-login page"
```

---

### Task 9: Login Page UI

**Files:**
- Modify: `src/app/(auth)/login/page.tsx`
- Modify: `src/app/(auth)/login/login-client.tsx`

- [ ] **Step 1: Update `src/app/(auth)/login/page.tsx`**

Add `dingtalkEnabled` prop derived from server-side env check. Replace the full file:

```typescript
import { db } from "@/lib/db";
import { Role } from "@/generated/prisma/enums";
import { LoginClient } from "./login-client";

interface DevUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;

  const users: DevUser[] =
    process.env.DEV_BYPASS_AUTH === "true"
      ? await db.user.findMany({
          where: { password: { not: null } },
          select: { id: true, name: true, email: true, role: true },
          orderBy: { role: "desc" },
        })
      : [];

  const dingtalkEnabled = !!(
    process.env.DINGTALK_CLIENT_ID && process.env.DINGTALK_CLIENT_SECRET
  );

  return (
    <div className="w-full max-w-md">
      <div className="mb-6 text-center">
        <p className="text-xs font-[510] uppercase tracking-[0.14em] text-[#7170ff]">
          IDRL
        </p>
        <h1 className="mt-2 text-[32px] font-[510] leading-[1.13] tracking-[-0.704px] text-[#f7f8f8]">
          文档填表系统
        </h1>
      </div>
      <LoginClient
        users={users}
        callbackUrl={callbackUrl || "/"}
        dingtalkEnabled={dingtalkEnabled}
      />
    </div>
  );
}
```

- [ ] **Step 2: Update `src/app/(auth)/login/login-client.tsx`**

Add DingTalk button to both login forms. The full file:

```typescript
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { toast } from "sonner";

import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LogIn, Check, Loader2, ScanQrCode } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@/generated/prisma/enums";

interface DevUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

interface LoginClientProps {
  users: DevUser[];
  callbackUrl: string;
  dingtalkEnabled: boolean;
}

const devBypassAuth = process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "true";

function RoleLabel({ role }: { role: Role }) {
  if (role === "ADMIN") {
    return (
      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-400">
        管理员
      </span>
    );
  }
  return (
    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
      普通用户
    </span>
  );
}

function DingTalkLoginButton() {
  const [isLoading, setIsLoading] = useState(false);

  async function handleClick() {
    setIsLoading(true);
    window.location.href = "/api/auth/dingtalk";
  }

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className="inline-flex h-8 w-full items-center justify-center rounded-md border border-[rgb(255_255_255_/_0.08)] bg-[rgb(255_255_255_/_0.02)] px-2.5 text-sm font-[510] text-foreground transition-colors hover:bg-muted/50 disabled:opacity-45"
    >
      {isLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin text-blue-500" />
      ) : (
        <ScanQrCode className="mr-2 h-4 w-4 text-blue-500" />
      )}
      {isLoading ? "跳转中..." : "钉钉扫码登录"}
    </button>
  );
}

function DevLoginForm({ users, callbackUrl, dingtalkEnabled }: LoginClientProps) {
  const [loggingInEmail, setLoggingInEmail] = useState<string | null>(null);

  async function handleLogin(email: string) {
    setLoggingInEmail(email);
    try {
      await signIn("dev-credentials", {
        email,
        skipPassword: "true",
        callbackUrl,
        redirect: true,
      });
    } catch {
      toast.error("登录失败", {
        description: "发生未知错误，请稍后重试。",
      });
      setLoggingInEmail(null);
    }
  }

  return (
    <Card className="w-full max-w-md border-[rgb(255_255_255_/_0.08)] bg-[rgb(255_255_255_/_0.02)]">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-[510] tracking-[-0.35px]">
          开发模式登录
        </CardTitle>
        <CardDescription className="text-[#8a8f98]">
          选择用户一键登录，无需 Authentik
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>选择用户</Label>
            <div className="space-y-1.5">
              {users.map((user) => {
                const isLoggingIn = loggingInEmail === user.email;
                return (
                  <button
                    key={user.id}
                    type="button"
                    disabled={isLoggingIn || loggingInEmail !== null}
                    onClick={() => handleLogin(user.email)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                      isLoggingIn
                        ? "border-[#7170ff]/50 bg-[#7170ff]/10 text-foreground"
                        : loggingInEmail !== null
                          ? "cursor-not-allowed border-border bg-transparent text-muted-foreground opacity-50"
                          : "border-border bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {user.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {user.email}
                      </span>
                      <RoleLabel role={user.role} />
                    </span>
                    {isLoggingIn ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#7170ff]" />
                    ) : (
                      <LogIn className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {dingtalkEnabled && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">或</span>
                </div>
              </div>
              <DingTalkLoginButton />
            </>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-[#62666d]">
          ⚠️ 开发绕过模式（DEV_BYPASS_AUTH=true）· v
          {process.env.NEXT_PUBLIC_APP_VERSION}
        </p>
      </CardContent>
    </Card>
  );
}

function AuthentikLoginForm({
  callbackUrl,
  dingtalkEnabled,
}: {
  callbackUrl: string;
  dingtalkEnabled: boolean;
}) {
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit() {
    setIsLoading(true);
    try {
      await signIn("authentik", {
        callbackUrl,
      });
    } catch {
      toast.error("登录失败", {
        description: "发生未知错误，请稍后重试。",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md border-[rgb(255_255_255_/_0.08)] bg-[rgb(255_255_255_/_0.02)]">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-[510] tracking-[-0.35px]">
          登录
        </CardTitle>
        <CardDescription className="text-[#8a8f98]">
          使用统一认证中心登录 IDRL填表系统
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-[#8a8f98]">
            登录认证由统一认证中心负责，系统内部权限继续按本地角色控制。
          </p>
          <button
            onClick={handleSubmit}
            className="inline-flex h-8 w-full items-center justify-center rounded-md bg-primary px-2.5 text-sm font-[510] text-primary-foreground disabled:opacity-45"
            disabled={isLoading}
          >
            {isLoading ? "跳转中..." : "前往统一登录"}
          </button>

          {dingtalkEnabled && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">或</span>
                </div>
              </div>
              <DingTalkLoginButton />
            </>
          )}
        </div>
        <p className="mt-4 text-center text-xs text-[#62666d]">
          v{process.env.NEXT_PUBLIC_APP_VERSION}
        </p>
      </CardContent>
    </Card>
  );
}

export function LoginClient(props: LoginClientProps) {
  if (devBypassAuth) {
    return <DevLoginForm {...props} />;
  }
  return (
    <AuthentikLoginForm
      callbackUrl={props.callbackUrl}
      dingtalkEnabled={props.dingtalkEnabled}
    />
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(auth\)/login/page.tsx src/app/\(auth\)/login/login-client.tsx
git commit -m "feat: add DingTalk login button to login page"
```

---

### Task 10: Proxy Whitelist + Layout

**Files:**
- Modify: `src/proxy.ts`

The `/dingtalk` page must be accessible without authentication (workbench entry point).

- [ ] **Step 1: Update `src/proxy.ts`**

Add `/dingtalk` to the allowlist. Change the auth routes check:

```typescript
  // Allow auth-related routes and dingtalk page
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/dingtalk") ||
    pathname.startsWith("/api/auth")
  ) {
    return NextResponse.next();
  }
```

- [ ] **Step 2: Commit**

```bash
git add src/proxy.ts
git commit -m "feat: whitelist /dingtalk path in proxy"
```

---

### Task 11: Environment Variables

**Files:**
- Modify: `.env` (local only, not committed)

- [ ] **Step 1: Add DingTalk env vars to `.env`**

Add these lines to `.env`:

```env
# DingTalk OAuth (required for DingTalk login)
DINGTALK_CLIENT_ID=dingtiesk0cqjtvgsmcd
DINGTALK_CLIENT_SECRET=iCxw9Iz9W1iHvCDZGKJWnLz7rNOGi7ilqZEuLaXZzvqxkVe2cEfQg8HFeO8garHs

# DingTalk Workbench (optional, enables auto-login in DingTalk app)
NEXT_PUBLIC_DINGTALK_CORP_ID=
```

---

### Task 12: Build Verification

- [ ] **Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: No lint errors

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Manual smoke test**

1. Start dev server: `npm run dev`
2. Visit `/login` — should see DingTalk button below the existing login options
3. Click "钉钉扫码登录" — should redirect to DingTalk auth page (will fail without proper callback URL configuration in DingTalk developer console, but the redirect itself validates the route works)
4. Visit `/dingtalk` — should show loading spinner (or redirect to OAuth if no corpId configured)
