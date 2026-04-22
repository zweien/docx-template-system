"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AutomationRunActions({ automationId }: { automationId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleRun() {
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/automations/${automationId}/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const payload = (await response.json()) as
        | { success: true; data: { runId: string } }
        | { error?: { message?: string } };

      if (!response.ok) {
        const message = "error" in payload ? payload.error?.message : undefined;
        setError(message ?? "触发自动化失败");
        return;
      }

      if ("success" in payload && payload.success) {
        setSuccessMessage(`已创建运行任务 ${payload.data.runId}`);
      }
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setError("触发自动化失败");
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" onClick={handleRun} disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
        手动运行
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {successMessage ? <p className="text-xs text-emerald-600 dark:text-emerald-300">{successMessage}</p> : null}
    </div>
  );
}
