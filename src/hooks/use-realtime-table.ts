"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import type { RealtimeEvent, ActivityEntry, OnlineUser, CellLock } from "@/types/realtime";
import { getUserColor } from "@/types/realtime";

interface UseRealtimeTableOptions {
  tableId: string;
  onUpdateRecordField: (recordId: string, fieldKey: string, value: unknown) => void;
  onRefresh: () => void;
  enabled?: boolean;
}

interface UseRealtimeTableReturn {
  isConnected: boolean;
  activityFeed: ActivityEntry[];
  onlineUsers: OnlineUser[];
  cellLocks: Map<string, CellLock>;
  acquireCellLock: (recordId: string, fieldKey: string) => Promise<boolean>;
  releaseCellLock: (recordId: string, fieldKey: string) => Promise<void>;
  isCellLockedByOther: (recordId: string, fieldKey: string) => boolean;
  getLockOwner: (recordId: string, fieldKey: string) => { userId: string; userName: string } | null;
  broadcastCursor: (recordId: string, fieldKey: string) => void;
  myColor: string;
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
  const myColor = getUserColor(currentUserId);

  const [isConnected, setIsConnected] = useState(false);
  const [activityFeed, setActivityFeed] = useState<ActivityEntry[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [cellLocks, setCellLocks] = useState<Map<string, CellLock>>(new Map());

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

        // ── Presence snapshot ──
        if (event.type === "presence_snapshot") {
          const snap = event;
          setOnlineUsers(snap.users.filter((u) => u.userId !== currentUserId));
          const lockMap = new Map<string, CellLock>();
          for (const lock of snap.locks) {
            if (lock.lockedById !== currentUserId) {
              lockMap.set(`${lock.recordId}:${lock.fieldKey}`, lock);
            }
          }
          setCellLocks(lockMap);
          return;
        }

        // ── User joined ──
        if (event.type === "user_joined") {
          if (event.userId === currentUserId) return;
          setOnlineUsers((prev) => {
            if (prev.some((u) => u.userId === event.userId)) return prev;
            return [...prev, { userId: event.userId, userName: event.userName, color: event.color }];
          });
          return;
        }

        // ── User left ──
        if (event.type === "user_left") {
          setOnlineUsers((prev) => prev.filter((u) => u.userId !== event.userId));
          // Release any locks from this user
          setCellLocks((prev) => {
            const next = new Map(prev);
            for (const [key, lock] of next) {
              if (lock.lockedById === event.userId) {
                next.delete(key);
              }
            }
            return next;
          });
          return;
        }

        // ── Cell locked ──
        if (event.type === "cell_locked") {
          if (event.lockedById === currentUserId) return;
          setCellLocks((prev) => {
            const next = new Map(prev);
            next.set(`${event.recordId}:${event.fieldKey}`, {
              recordId: event.recordId,
              fieldKey: event.fieldKey,
              lockedById: event.lockedById,
              lockedByName: event.lockedByName,
              color: event.color,
            });
            return next;
          });
          return;
        }

        // ── Cell unlocked ──
        if (event.type === "cell_unlocked") {
          setCellLocks((prev) => {
            const next = new Map(prev);
            next.delete(`${event.recordId}:${event.fieldKey}`);
            return next;
          });
          return;
        }

        // ── Cursor moved (no state needed, consumed by overlay) ──
        if (event.type === "cursor_moved") return;

        // ── Data change events ──
        const rtEvent = event as RealtimeEvent;
        if (rtEvent.type !== "record_updated" && rtEvent.type !== "record_created" && rtEvent.type !== "record_deleted") return;

        const eventUserId =
          rtEvent.type === "record_updated" ? rtEvent.changedById :
          rtEvent.type === "record_created" ? rtEvent.createdById :
          rtEvent.deletedById;

        if (eventUserId === currentUserId) return;

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
      setOnlineUsers([]);
      setCellLocks(new Map());
    };
  }, [tableId, enabled, currentUserId, addActivity]);

  const acquireCellLock = useCallback(async (recordId: string, fieldKey: string): Promise<boolean> => {
    const res = await fetch(`/api/data-tables/${tableId}/realtime/lock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "acquire", recordId, fieldKey }),
    });
    const data = await res.json();
    return data.acquired === true;
  }, [tableId]);

  const releaseCellLock = useCallback(async (recordId: string, fieldKey: string): Promise<void> => {
    await fetch(`/api/data-tables/${tableId}/realtime/lock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "release", recordId, fieldKey }),
    });
  }, [tableId]);

  const isCellLockedByOther = useCallback((recordId: string, fieldKey: string): boolean => {
    return cellLocks.has(`${recordId}:${fieldKey}`);
  }, [cellLocks]);

  const getLockOwner = useCallback((recordId: string, fieldKey: string): { userId: string; userName: string } | null => {
    const lock = cellLocks.get(`${recordId}:${fieldKey}`);
    if (!lock) return null;
    return { userId: lock.lockedById, userName: lock.lockedByName };
  }, [cellLocks]);

  const broadcastCursor = useCallback((recordId: string, fieldKey: string): void => {
    void fetch(`/api/data-tables/${tableId}/realtime/cursor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recordId, fieldKey }),
    });
  }, [tableId]);

  return {
    isConnected,
    activityFeed,
    onlineUsers,
    cellLocks,
    acquireCellLock,
    releaseCellLock,
    isCellLockedByOther,
    getLockOwner,
    broadcastCursor,
    myColor,
  };
}
