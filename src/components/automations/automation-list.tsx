"use client";

import Link from "next/link";
import { ArrowRight, PauseCircle, PlayCircle, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { AutomationItem } from "@/types/automation";

const TRIGGER_LABELS: Record<AutomationItem["triggerType"], string> = {
  record_created: "记录创建时",
  record_updated: "记录更新时",
  record_deleted: "记录删除时",
  field_changed: "字段变更时",
  schedule: "定时触发",
  manual: "手动触发",
};

const RUN_STATUS_LABELS = {
  PENDING: "排队中",
  RUNNING: "执行中",
  SUCCEEDED: "最近成功",
  FAILED: "最近失败",
  CANCELED: "最近取消",
} satisfies Record<NonNullable<AutomationItem["latestRun"]>["status"], string>;

const RUN_STATUS_VARIANTS = {
  PENDING: "secondary",
  RUNNING: "secondary",
  SUCCEEDED: "default",
  FAILED: "destructive",
  CANCELED: "secondary",
} satisfies Record<
  NonNullable<AutomationItem["latestRun"]>["status"],
  "default" | "secondary" | "destructive"
>;

const TRIGGER_SOURCE_LABELS = {
  EVENT: "事件触发",
  SCHEDULE: "定时触发",
  MANUAL: "手动触发",
} satisfies Record<NonNullable<AutomationItem["latestRun"]>["triggerSource"], string>;

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

function formatDuration(durationMs: number | null): string {
  if (durationMs === null) {
    return "执行中";
  }

  if (durationMs < 1000) {
    return `${durationMs} ms`;
  }

  return `${(durationMs / 1000).toFixed(1)} s`;
}

export function AutomationList({ items }: { items: AutomationItem[] }) {
  if (items.length === 0) {
    return (
      <Card className="border-dashed bg-card/80">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/70 text-accent-foreground">
            <Sparkles className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <p className="text-lg font-[520] text-foreground">还没有自动化规则</p>
            <p className="text-sm text-muted-foreground">
              先创建一条自动化，后续可配置触发器、条件分支和执行动作。
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {items.map((item) => (
        <Link key={item.id} href={`/automations/${item.id}`} className="group block">
          <Card className="h-full overflow-hidden border-border/80 bg-card/90 transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-lg hover:shadow-black/5">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-[520] tracking-[-0.02em] text-foreground">
                      {item.name}
                    </h3>
                    <Badge variant={item.enabled ? "default" : "secondary"}>
                      {item.enabled ? "已启用" : "已停用"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {item.description?.trim() || "暂无描述"}
                  </p>
                </div>
                {item.enabled ? (
                  <PlayCircle className="h-5 w-5 text-primary" />
                ) : (
                  <PauseCircle className="h-5 w-5 text-muted-foreground" />
                )}
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline" className="border-border/70 bg-background/70 text-foreground">
                  {item.tableName || "未命名数据表"}
                </Badge>
                <Badge variant="outline" className="border-border/70 bg-background/70 text-foreground">
                  {TRIGGER_LABELS[item.triggerType]}
                </Badge>
                <Badge variant="outline" className="border-border/70 bg-background/70 text-muted-foreground">
                  DSL v{item.definitionVersion}
                </Badge>
              </div>

              <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-3">
                {item.latestRun ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={RUN_STATUS_VARIANTS[item.latestRun.status]}>
                        {RUN_STATUS_LABELS[item.latestRun.status]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {TRIGGER_SOURCE_LABELS[item.latestRun.triggerSource]} ·{" "}
                        {formatDateTime(item.latestRun.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      耗时 {formatDuration(item.latestRun.durationMs)}
                      {item.latestRun.errorMessage ? ` · ${item.latestRun.errorMessage}` : ""}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm font-[520] text-foreground">最近运行</p>
                    <p className="text-sm text-muted-foreground">
                      暂无运行记录，保存并触发后这里会显示最近一次执行结果。
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-border/60 pt-3 text-sm">
                <span className="text-muted-foreground">
                  更新于 {formatDateTime(item.updatedAt)}
                </span>
                <span className="inline-flex items-center gap-1 font-[520] text-foreground transition-transform duration-200 group-hover:translate-x-0.5">
                  进入编辑
                  <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
