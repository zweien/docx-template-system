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

const DINGTALK_SDK_URL =
  "https://g.alicdn.com/dingding/dingtalk-jsapi/3.0.25/dingtalk.open.js";

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
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

    async function init() {
      try {
        if (!window.dd?.ready) {
          await loadScript(DINGTALK_SDK_URL);
        }

        if (!window.dd?.ready) {
          window.location.href = "/api/auth/dingtalk";
          return;
        }

        window.dd!.ready(() => {
          window.dd!.runtime.permission.requestAuthCode({
            corpId: corpId!,
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
      } catch {
        window.location.href = "/api/auth/dingtalk";
      }
    }

    init();
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
            <button
              onClick={() => { window.location.href = "/"; }}
              className="text-sm text-primary underline"
            >
              返回首页
            </button>
          </>
        )}
      </div>
    </div>
  );
}
