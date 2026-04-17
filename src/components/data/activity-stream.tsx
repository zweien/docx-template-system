"use client";

import { useEffect, useState, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import type { ActivityEntry } from "@/types/realtime";

interface ActivityStreamProps {
  tableId: string;
  liveActivities: ActivityEntry[];
}

interface HistoryEntry {
  id: string;
  recordId: string;
  fieldLabel: string;
  oldValue: unknown;
  newValue: unknown;
  changedByName: string;
  changedAt: string;
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}秒前`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  return new Date(dateStr).toLocaleDateString("zh-CN");
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return "(空)";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

export function ActivityStream({ tableId, liveActivities }: ActivityStreamProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/data-tables/${tableId}/activity?pageSize=50`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setHistory(data.entries ?? []);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [tableId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [liveActivities]);

  return (
    <div className="w-72 border-l flex flex-col">
      <div className="p-3 border-b">
        <h3 className="text-sm font-medium">活动动态</h3>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {/* Live activities (newest first) */}
          {liveActivities.map((activity) => (
            <div key={activity.id} className="flex gap-2 text-xs">
              <div className="flex flex-col items-center">
                <div className="w-2 h-2 rounded-full bg-blue-500 mt-1 shrink-0" />
                <div className="w-px flex-1 bg-border" />
              </div>
              <div className="flex-1 pb-2">
                <div className="text-muted-foreground">
                  {activity.userName || "用户"}
                  {activity.action === "updated" && ` 更新了 ${activity.fieldLabel ?? ""}`}
                  {activity.action === "created" && " 创建了记录"}
                  {activity.action === "deleted" && " 删除了记录"}
                </div>
                <div className="text-muted-foreground/60 mt-0.5">
                  {formatTimeAgo(activity.timestamp)}
                </div>
              </div>
            </div>
          ))}

          {/* History entries */}
          {loading ? (
            <div className="flex justify-center py-6">
              <Spinner className="size-4" />
            </div>
          ) : (
            history.map((entry) => (
              <div key={entry.id} className="flex gap-2 text-xs">
                <div className="flex flex-col items-center">
                  <div className="w-2 h-2 rounded-full bg-zinc-300 mt-1 shrink-0" />
                  <div className="w-px flex-1 bg-border" />
                </div>
                <div className="flex-1 pb-2">
                  <div>
                    <span className="font-medium">{entry.changedByName || "用户"}</span>
                    {" 更新了 "}
                    <span className="font-medium">{entry.fieldLabel}</span>
                  </div>
                  <div className="text-muted-foreground/60 mt-0.5">
                    {formatTimeAgo(entry.changedAt)}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
    </div>
  );
}
