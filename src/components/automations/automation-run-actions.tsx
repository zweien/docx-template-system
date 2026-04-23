"use client";

import { useState } from "react";
import { Loader2, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type AutomationRunActionsProps = {
  automationId: string;
  onRunQueued?: (runId: string) => void;
};

export function AutomationRunActions({
  automationId,
  onRunQueued,
}: AutomationRunActionsProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setPending(true);
    setError(null);

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
        toast.error(message ?? "触发自动化失败");
        return;
      }

      if ("success" in payload && payload.success) {
        onRunQueued?.(payload.data.runId);
        toast.success(`已创建运行任务 ${payload.data.runId}`);
      }
    } catch {
      setError("触发自动化失败");
      toast.error("触发自动化失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" onClick={handleRun} disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
        手动运行
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
