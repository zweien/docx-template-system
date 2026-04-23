"use client";

import { useEffect, useRef, useState } from "react";
import type {
  AutomationRealtimeEvent,
  AutomationRealtimeStreamEvent,
} from "@/types/automation-realtime";
import type { AutomationRunItem, AutomationRunStepStatus } from "@/types/automation";

interface UseAutomationRunRealtimeOptions {
  automationId: string;
  enabled?: boolean;
  onRunCreated?: (run: AutomationRunItem) => void;
  onRunUpdated?: (run: AutomationRunItem) => void;
  onRunStepUpdated?: (event: {
    runId: string;
    stepId: string;
    status: AutomationRunStepStatus;
  }) => void;
}

export function useAutomationRunRealtime({
  automationId,
  enabled = true,
  onRunCreated,
  onRunUpdated,
  onRunStepUpdated,
}: UseAutomationRunRealtimeOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const callbacksRef = useRef({ onRunCreated, onRunUpdated, onRunStepUpdated });

  useEffect(() => {
    callbacksRef.current = { onRunCreated, onRunUpdated, onRunStepUpdated };
  }, [onRunCreated, onRunUpdated, onRunStepUpdated]);

  useEffect(() => {
    if (!enabled || !automationId) {
      return;
    }

    const eventSource = new EventSource(`/api/automations/${automationId}/realtime`);

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as AutomationRealtimeStreamEvent;
        if (payload.type === "connected" || payload.type === "heartbeat") {
          return;
        }

        const realtimeEvent = payload as AutomationRealtimeEvent;
        if (realtimeEvent.type === "automation_run_created") {
          callbacksRef.current.onRunCreated?.(realtimeEvent.run);
          return;
        }

        if (realtimeEvent.type === "automation_run_updated") {
          callbacksRef.current.onRunUpdated?.(realtimeEvent.run);
          return;
        }

        callbacksRef.current.onRunStepUpdated?.({
          runId: realtimeEvent.runId,
          stepId: realtimeEvent.stepId,
          status: realtimeEvent.status,
        });
      } catch {
        // ignore malformed events
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
    };

    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, [automationId, enabled]);

  return { isConnected };
}
