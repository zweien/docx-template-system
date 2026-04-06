"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit() {
    setIsLoading(true);

    try {
      const result = await signIn("authentik", {
        callbackUrl,
        redirect: false,
      });

      if (result?.error) {
        toast.error("登录失败", {
          description: "统一登录跳转失败，请稍后重试。",
        });
      } else if (result?.url) {
        router.push(result.url);
        router.refresh();
      } else {
        toast.error("登录失败", {
          description: "未获取到统一登录跳转地址。",
        });
      }
    } catch {
      toast.error("登录失败", {
        description: "发生未知错误，请稍后重试。",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">登录</CardTitle>
        <CardDescription>
          使用统一认证中心登录 IDRL填表系统
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            登录认证由统一认证中心负责，系统内部权限继续按本地角色控制。
          </p>
          <Button onClick={handleSubmit} className="w-full" disabled={isLoading}>
            {isLoading ? "跳转中..." : "前往统一登录"}
          </Button>
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          v{process.env.NEXT_PUBLIC_APP_VERSION}
        </p>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
