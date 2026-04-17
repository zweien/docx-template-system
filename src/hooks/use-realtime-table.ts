"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import type { RealtimeEvent, ActivityEntry } from "@/types/realtime";

interface UseRealtimeTableOptions {
  tableId: string;
  onUpdateRecordField: (recordId: string, fieldKey: string, value: unknown) => void;
  onRefresh: () => void;
  enabled?: boolean;
}

interface UseRealtimeTableReturn {
  isConnected: boolean;
  activityFeed: ActivityEntry[];
}

const MAX_ACTIVITY = 50;

export function useRealtimeTable({
  tableId,
  onUpdateRecordField,
  onRefresh,
  enabled = true,
}: UseRealtimeTableOptions): UseRealtimeTableReturn {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id ?? "";
  const [isConnected, setIsConnected] = useState(false);
  const [activityFeed, setActivityFeed] = useState<ActivityEntry[]>([]);

  const callbacksRef = useRef({ onUpdateRecordField, onRefresh });
  callbacksRef.current = { onUpdateRecordField, onRefresh };

  const addActivity = useCallback((entry: ActivityEntry) => {
    setActivityFeed((prev) => {
      const next = [entry, ...prev];
      return next.slice(0, MAX_ACTIVITY);
    });
  }, []);

  useEffect(() => {
    if (!enabled || !tableId || !currentUserId) return;

    const es = new EventSource(`/api/data-tables/${tableId}/realtime`);

    es.onopen = () => {
      setIsConnected(true);
    };

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as RealtimeEvent | { type: "connected" | "heartbeat" };

        if (event.type === "connected" || event.type === "heartbeat") return;

        const rtEvent = event as RealtimeEvent;

        // Self-suppression: skip events from current user
        const eventUserId =
          rtEvent.type === "record_updated" ? rtEvent.changedById :
          rtEvent.type === "record_created" ? rtEvent.createdById :
          rtEvent.deletedById;

        if (eventUserId === currentUserId) return;

        // Apply changes
        if (rtEvent.type === "record_updated") {
          callbacksRef.current.onUpdateRecordField(
            rtEvent.recordId,
            rtEvent.fieldKey,
            rtEvent.value
          );
          addActivity({
            id: `${rtEvent.recordId}-${rtEvent.fieldKey}-${rtEvent.changedAt}`,
            userName: rtEvent.changedByName,
            action: "updated",
            fieldLabel: rtEvent.fieldLabel,
            recordId: rtEvent.recordId,
            timestamp: rtEvent.changedAt,
          });
        } else if (rtEvent.type === "record_created" || rtEvent.type === "record_deleted") {
          callbacksRef.current.onRefresh();
          addActivity({
            id: `${rtEvent.type}-${rtEvent.recordId}-${Date.now()}`,
            userName: rtEvent.type === "record_created" ? rtEvent.createdByName : rtEvent.deletedByName,
            action: rtEvent.type === "record_created" ? "created" : "deleted",
            recordId: rtEvent.recordId,
            timestamp: rtEvent.type === "record_created" ? rtEvent.createdAt : rtEvent.deletedAt,
          });
        }
      } catch {
        // ignore malformed events
      }
    };

    es.onerror = () => {
      setIsConnected(false);
    };

    return () => {
      es.close();
      setIsConnected(false);
    };
  }, [tableId, enabled, currentUserId, addActivity]);

  return { isConnected, activityFeed };
}
