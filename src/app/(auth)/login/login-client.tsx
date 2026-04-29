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
import { LogIn, Check, Loader2 } from "lucide-react";
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

function DevLoginForm({ users, callbackUrl }: LoginClientProps) {
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
                          ? "border-border bg-transparent text-muted-foreground opacity-50 cursor-not-allowed"
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
                      <LogIn className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-[#62666d]">
          ⚠️ 开发绕过模式（DEV_BYPASS_AUTH=true）· v
          {process.env.NEXT_PUBLIC_APP_VERSION}
        </p>
      </CardContent>
    </Card>
  );
}

function AuthentikLoginForm({ callbackUrl }: { callbackUrl: string }) {
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
            className="w-full inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground h-8 px-2.5 text-sm font-[510] disabled:opacity-45"
            disabled={isLoading}
          >
            {isLoading ? "跳转中..." : "前往统一登录"}
          </button>
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
  return <AuthentikLoginForm callbackUrl={props.callbackUrl} />;
}
