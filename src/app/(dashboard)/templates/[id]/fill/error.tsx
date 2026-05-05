"use client";

import { AlertTriangle, FileText, RotateCw } from "lucide-react";
import Link from "next/link";

export default function FillFormError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-card">
        <AlertTriangle className="h-7 w-7 text-destructive" />
      </div>
      <h2 className="mt-5 text-xl font-[510] tracking-tight text-foreground">
        表单加载失败
      </h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {error.message || "无法加载表单，请稍后重试。"}
      </p>
      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-[510] text-white transition-colors hover:bg-accent"
        >
          <RotateCw className="h-4 w-4" />
          重试
        </button>
        <Link
          href="/templates"
          className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-[510] text-muted-foreground transition-colors hover:border-border-hover hover:text-foreground"
        >
          <FileText className="h-4 w-4" />
          返回模板列表
        </Link>
      </div>
    </div>
  );
}
