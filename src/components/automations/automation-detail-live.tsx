"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AutomationRunActions } from "@/components/automations/automation-run-actions";
import { AutomationRunLog } from "@/components/automations/automation-run-log";
import { useAutomationRunRealtime } from "@/hooks/use-automation-run-realtime";
import type { AutomationRunItem } from "@/types/automation";

type AutomationDetailLiveProps = {
  automationId: string;
  initialRuns: AutomationRunItem[];
};

function upsertRun(items: AutomationRunItem[], nextRun: AutomationRunItem): AutomationRunItem[] {
  const existingIndex = items.findIndex((item) => item.id === nextRun.id);
  if (existingIndex === -1) {
    return [nextRun, ...items].slice(0, 10);
  }

  const nextItems = [...items];
  nextItems[existingIndex] = nextRun;
  return nextItems;
}

export function AutomationDetailLive({
  automationId,
  initialRuns,
}: AutomationDetailLiveProps) {
  const [runs, setRuns] = useState(initialRuns);
  const seenTerminalRef = useRef(new Set<string>());
  const [connectionHint, setConnectionHint] = useState<string | null>(null);
  const [detailReloadToken, setDetailReloadToken] = useState(0);

  const handleRunUpdated = useCallback((run: AutomationRunItem) => {
    setRuns((current) => upsertRun(current, run));

    const isTerminal = run.status === "SUCCEEDED" || run.status === "FAILED";
    if (!isTerminal) {
      return;
    }

    setDetailReloadToken((current) => current + 1);
    if (seenTerminalRef.current.has(run.id)) {
      return;
    }

    seenTerminalRef.current.add(run.id);
    if (run.status === "SUCCEEDED") {
      toast.success("自动化运行成功");
      return;
    }

    toast.error(run.errorMessage ?? "自动化运行失败");
  }, []);

  const realtime = useAutomationRunRealtime({
    automationId,
    onRunCreated: (run) => setRuns((current) => upsertRun(current, run)),
    onRunUpdated: handleRunUpdated,
    onRunStepUpdated: () => {
      setDetailReloadToken((current) => current + 1);
    },
  });

  useEffect(() => {
    if (realtime.isConnected) {
      setConnectionHint(null);
      return;
    }

    setConnectionHint("实时连接已断开，状态可能不是最新。");
  }, [realtime.isConnected]);

  return (
    <div className="space-y-4">
      <AutomationRunActions automationId={automationId} />
      <AutomationRunLog
        items={runs}
        helperText={connectionHint ?? undefined}
        detailReloadToken={detailReloadToken}
      />
    </div>
  );
}
