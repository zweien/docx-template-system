"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AutomationRunItem } from "@/types/automation";

const STATUS_LABELS: Record<AutomationRunItem["status"], string> = {
  PENDING: "排队中",
  RUNNING: "执行中",
  SUCCEEDED: "成功",
  FAILED: "失败",
  CANCELED: "已取消",
};

const STATUS_VARIANTS: Record<
  AutomationRunItem["status"],
  "default" | "secondary" | "destructive"
> = {
  PENDING: "secondary",
  RUNNING: "secondary",
  SUCCEEDED: "default",
  FAILED: "destructive",
  CANCELED: "secondary",
};

function formatDateTime(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AutomationRunLog({ items }: { items: AutomationRunItem[] }) {
  return (
    <Card className="bg-card/90">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-[520]">最近运行</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 bg-background/50 px-4 py-10 text-center text-sm text-muted-foreground">
            还没有运行记录。执行手动触发或等待数据变更后，这里会展示每次运行状态。
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/70 px-4 py-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{item.id}</span>
                    <Badge variant={STATUS_VARIANTS[item.status]}>
                      {STATUS_LABELS[item.status]}
                    </Badge>
                  </div>
                  <p className="text-sm text-foreground">
                    触发源: {item.triggerSource} · 创建于 {formatDateTime(item.createdAt)}
                  </p>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  {item.durationMs !== null ? `${item.durationMs} ms` : "未完成"}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
