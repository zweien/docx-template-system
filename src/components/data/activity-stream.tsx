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
    <div className="flex w-72 flex-col border-l border-[rgb(255_255_255_/_0.08)] bg-[rgb(255_255_255_/_0.02)]">
      <div className="border-b border-[rgb(255_255_255_/_0.08)] p-3">
        <h3 className="text-sm font-[510] text-[#f7f8f8]">活动动态</h3>
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-3 p-3">
          {/* Live activities (newest first) */}
          {liveActivities.map((activity) => (
            <div key={activity.id} className="flex gap-2 text-xs">
              <div className="flex flex-col items-center">
                <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#7170ff]" />
                <div className="w-px flex-1 bg-[rgb(255_255_255_/_0.08)]" />
              </div>
              <div className="flex-1 pb-2">
                <div className="text-[#d0d6e0]">
                  {activity.userName || "用户"}
                  {activity.action === "updated" && ` 更新了 ${activity.fieldLabel ?? ""}`}
                  {activity.action === "created" && " 创建了记录"}
                  {activity.action === "deleted" && " 删除了记录"}
                </div>
                <div className="mt-0.5 text-[#8a8f98]">
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
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[rgb(255_255_255_/_0.28)]" />
                  <div className="w-px flex-1 bg-[rgb(255_255_255_/_0.08)]" />
                </div>
                <div className="flex-1 pb-2">
                  <div className="text-[#d0d6e0]">
                    <span className="font-[510] text-[#f7f8f8]">{entry.changedByName || "用户"}</span>
                    {" 更新了 "}
                    <span className="font-[510]">{entry.fieldLabel}</span>
                  </div>
                  <div className="mt-0.5 text-[#8a8f98]">
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
