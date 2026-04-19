"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const devBypassAuth = process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "true";

const DEV_ACCOUNTS = [
  {
    label: "管理员登录",
    email: "admin@example.com",
    password: "admin123",
    description: "admin@example.com",
  },
  {
    label: "普通用户登录",
    email: "user@example.com",
    password: "user123",
    description: "user@example.com",
  },
];

function DevLoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [loadingIdx, setLoadingIdx] = useState<number | null>(null);

  async function handleDevLogin(
    email: string,
    password: string,
    idx: number
  ) {
    setLoadingIdx(idx);
    try {
      const result = await signIn("dev-credentials", {
        email,
        password,
        callbackUrl,
        redirect: true,
      });
      if (result === undefined) {
        // redirect happened
      } else if (result?.error) {
        toast.error("登录失败", {
          description: "请确保已执行 npx prisma db seed 初始化用户数据",
        });
      }
    } catch {
      toast.error("登录失败", {
        description: "发生未知错误，请稍后重试。",
      });
    } finally {
      setLoadingIdx(null);
    }
  }

  return (
    <Card className="w-full max-w-md border-[rgb(255_255_255_/_0.08)] bg-[rgb(255_255_255_/_0.02)]">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-[510] tracking-[-0.35px]">开发模式登录</CardTitle>
        <CardDescription className="text-[#8a8f98]">
          选择身份直接登录，无需 Authentik
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {DEV_ACCOUNTS.map((account, idx) => (
            <Button
              key={account.email}
              variant={idx === 0 ? "default" : "outline"}
              className="w-full"
              disabled={loadingIdx !== null}
              onClick={() =>
                handleDevLogin(account.email, account.password, idx)
              }
            >
              {loadingIdx === idx
                ? "登录中..."
                : `${account.label}（${account.description}）`}
            </Button>
          ))}
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
        <CardTitle className="text-2xl font-[510] tracking-[-0.35px]">登录</CardTitle>
        <CardDescription className="text-[#8a8f98]">
          使用统一认证中心登录 IDRL填表系统
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-[#8a8f98]">
            登录认证由统一认证中心负责，系统内部权限继续按本地角色控制。
          </p>
          <Button onClick={handleSubmit} className="w-full" disabled={isLoading}>
            {isLoading ? "跳转中..." : "前往统一登录"}
          </Button>
        </div>
        <p className="mt-4 text-center text-xs text-[#62666d]">
          v{process.env.NEXT_PUBLIC_APP_VERSION}
        </p>
      </CardContent>
    </Card>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  if (devBypassAuth) {
    return <DevLoginForm callbackUrl={callbackUrl} />;
  }

  return <AuthentikLoginForm callbackUrl={callbackUrl} />;
}

export default function LoginPage() {
  return (
    <div className="w-full max-w-md">
      <div className="mb-6 text-center">
        <p className="text-xs font-[510] uppercase tracking-[0.14em] text-[#7170ff]">IDRL</p>
        <h1 className="mt-2 text-[32px] font-[510] leading-[1.13] tracking-[-0.704px] text-[#f7f8f8]">
          文档填表系统
        </h1>
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
