"use client";

import { useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AutomationRunDetail, AutomationRunItem, AutomationRunStepItem } from "@/types/automation";

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

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function StepStatusBadge({ status }: { status: AutomationRunStepItem["status"] }) {
  const variant =
    status === "FAILED" ? "destructive" : status === "SUCCEEDED" ? "default" : "secondary";

  return <Badge variant={variant}>{status}</Badge>;
}

export function AutomationRunLog({ items }: { items: AutomationRunItem[] }) {
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [detailMap, setDetailMap] = useState<Record<string, AutomationRunDetail | undefined>>({});
  const [loadingRunId, setLoadingRunId] = useState<string | null>(null);
  const [errorMap, setErrorMap] = useState<Record<string, string | undefined>>({});

  async function handleToggle(runId: string) {
    if (expandedRunId === runId) {
      setExpandedRunId(null);
      return;
    }

    setExpandedRunId(runId);
    if (detailMap[runId] || loadingRunId === runId) {
      return;
    }

    setLoadingRunId(runId);
    setErrorMap((prev) => ({ ...prev, [runId]: undefined }));
    try {
      const response = await fetch(`/api/automations/runs/${runId}`);
      const payload = (await response.json()) as
        | { success: true; data: AutomationRunDetail }
        | { error?: { message?: string } };

      if (!response.ok) {
        const message = "error" in payload ? payload.error?.message : undefined;
        setErrorMap((prev) => ({ ...prev, [runId]: message ?? "获取运行详情失败" }));
        return;
      }

      if ("success" in payload && payload.success) {
        setDetailMap((prev) => ({ ...prev, [runId]: payload.data }));
      }
    } catch {
      setErrorMap((prev) => ({ ...prev, [runId]: "获取运行详情失败" }));
    } finally {
      setLoadingRunId(null);
    }
  }

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
                <div className="flex items-center gap-2">
                  <div className="text-right text-sm text-muted-foreground">
                    {item.durationMs !== null ? `${item.durationMs} ms` : "未完成"}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleToggle(item.id)}
                  >
                    {loadingRunId === item.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${
                          expandedRunId === item.id ? "rotate-180" : ""
                        }`}
                      />
                    )}
                    详情
                  </Button>
                </div>

                {expandedRunId === item.id ? (
                  <div className="w-full rounded-xl border border-border/60 bg-card px-4 py-4">
                    {errorMap[item.id] ? (
                      <p className="text-sm text-destructive">{errorMap[item.id]}</p>
                    ) : loadingRunId === item.id && !detailMap[item.id] ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        正在加载运行详情
                      </div>
                    ) : detailMap[item.id] ? (
                      <div className="space-y-4">
                        <div className="grid gap-3 lg:grid-cols-2">
                          <div className="rounded-lg border border-border/60 bg-background/70 p-3">
                            <p className="text-xs font-[520] uppercase tracking-[0.14em] text-muted-foreground">
                              触发载荷
                            </p>
                            <pre className="mt-2 overflow-x-auto text-xs text-foreground">
                              {formatJson(detailMap[item.id]?.run.triggerPayload)}
                            </pre>
                          </div>
                          <div className="rounded-lg border border-border/60 bg-background/70 p-3">
                            <p className="text-xs font-[520] uppercase tracking-[0.14em] text-muted-foreground">
                              执行上下文
                            </p>
                            <pre className="mt-2 overflow-x-auto text-xs text-foreground">
                              {formatJson(detailMap[item.id]?.run.contextSnapshot)}
                            </pre>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <p className="text-sm font-[520] text-foreground">步骤执行</p>
                          {detailMap[item.id]?.steps.length ? (
                            detailMap[item.id]?.steps.map((step) => (
                              <div
                                key={step.id}
                                className="space-y-3 rounded-lg border border-border/60 bg-background/70 p-3"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="space-y-1">
                                    <p className="font-mono text-xs text-muted-foreground">{step.id}</p>
                                    <p className="text-sm font-[520] text-foreground">
                                      {step.stepType} · {step.branch}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <StepStatusBadge status={step.status} />
                                    <span className="text-xs text-muted-foreground">
                                      {step.durationMs !== null ? `${step.durationMs} ms` : "-"}
                                    </span>
                                  </div>
                                </div>
                                {step.errorMessage ? (
                                  <p className="text-sm text-destructive">{step.errorMessage}</p>
                                ) : null}
                                <div className="grid gap-3 lg:grid-cols-2">
                                  <div>
                                    <p className="text-xs text-muted-foreground">输入</p>
                                    <pre className="mt-1 overflow-x-auto rounded-md bg-card px-3 py-2 text-xs text-foreground">
                                      {formatJson(step.input)}
                                    </pre>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">输出</p>
                                    <pre className="mt-1 overflow-x-auto rounded-md bg-card px-3 py-2 text-xs text-foreground">
                                      {formatJson(step.output)}
                                    </pre>
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="rounded-lg border border-dashed border-border/60 px-4 py-6 text-sm text-muted-foreground">
                              暂无步骤记录
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">暂无详情数据</div>
                    )}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
