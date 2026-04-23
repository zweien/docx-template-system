"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatValuePreview(value: unknown): string {
  if (value === null) {
    return "null";
  }

  if (value === undefined) {
    return "undefined";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  const serialized = formatJson(value).replace(/\s+/g, " ").trim();
  return serialized.length > 64 ? `${serialized.slice(0, 61)}...` : serialized;
}

function getStepDiffEntries(step: AutomationRunStepItem) {
  const input = step.input;
  const output = step.output;

  if (!isPlainRecord(input) || !isPlainRecord(output)) {
    return [];
  }

  const keys = Array.from(new Set([...Object.keys(input), ...Object.keys(output)])).sort();

  return keys
    .map((key) => {
      const before = input[key];
      const after = output[key];

      if (!(key in input)) {
        return { key, kind: "added" as const, before: undefined, after };
      }

      if (!(key in output)) {
        return { key, kind: "removed" as const, before, after: undefined };
      }

      if (formatJson(before) === formatJson(after)) {
        return null;
      }

      return { key, kind: "changed" as const, before, after };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
}

function StepStatusBadge({ status }: { status: AutomationRunStepItem["status"] }) {
  const variant =
    status === "FAILED" ? "destructive" : status === "SUCCEEDED" ? "default" : "secondary";

  return <Badge variant={variant}>{status}</Badge>;
}

type AutomationRunLogProps = {
  items: AutomationRunItem[];
  helperText?: string;
  detailReloadToken?: number;
};

export function AutomationRunLog({
  items,
  helperText,
  detailReloadToken = 0,
}: AutomationRunLogProps) {
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [detailMap, setDetailMap] = useState<Record<string, AutomationRunDetail | undefined>>({});
  const [loadingRunId, setLoadingRunId] = useState<string | null>(null);
  const [errorMap, setErrorMap] = useState<Record<string, string | undefined>>({});
  const detailMapRef = useRef(detailMap);
  const loadingRunIdRef = useRef(loadingRunId);
  const lastReloadTokenRef = useRef(detailReloadToken);

  useEffect(() => {
    detailMapRef.current = detailMap;
  }, [detailMap]);

  useEffect(() => {
    loadingRunIdRef.current = loadingRunId;
  }, [loadingRunId]);

  const loadRunDetail = useCallback(async (runId: string, force = false) => {
    if (!force && (detailMapRef.current[runId] || loadingRunIdRef.current === runId)) {
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
  }, []);

  useEffect(() => {
    if (!expandedRunId || lastReloadTokenRef.current === detailReloadToken) {
      return;
    }

    lastReloadTokenRef.current = detailReloadToken;
    void loadRunDetail(expandedRunId, true);
  }, [detailReloadToken, expandedRunId, loadRunDetail]);

  async function handleToggle(runId: string) {
    if (expandedRunId === runId) {
      setExpandedRunId(null);
      return;
    }

    setExpandedRunId(runId);
    await loadRunDetail(runId);
  }

  return (
    <Card className="bg-card/90">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-[520]">最近运行</CardTitle>
      </CardHeader>
      <CardContent>
        {helperText ? (
          <p className="mb-3 text-xs text-muted-foreground">{helperText}</p>
        ) : null}
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
                                {(() => {
                                  const diffEntries = getStepDiffEntries(step);

                                  return (
                                    <>
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
                                      {diffEntries.length > 0 ? (
                                        <div className="rounded-md border border-border/60 bg-card/80 p-3">
                                          <p className="text-xs font-[520] uppercase tracking-[0.14em] text-muted-foreground">
                                            差异摘要
                                          </p>
                                          <div className="mt-2 space-y-2">
                                            {diffEntries.slice(0, 8).map((entry) => (
                                              <div
                                                key={entry.key}
                                                className="rounded-md bg-background/70 px-3 py-2 text-xs text-foreground"
                                              >
                                                <div className="flex flex-wrap items-center gap-2">
                                                  <span className="font-mono">{entry.key}</span>
                                                  <Badge variant="outline">
                                                    {entry.kind === "added"
                                                      ? "新增"
                                                      : entry.kind === "removed"
                                                        ? "移除"
                                                        : "变更"}
                                                  </Badge>
                                                </div>
                                                <p className="mt-1 text-muted-foreground">
                                                  {formatValuePreview(entry.before)} →{" "}
                                                  {formatValuePreview(entry.after)}
                                                </p>
                                              </div>
                                            ))}
                                            {diffEntries.length > 8 ? (
                                              <p className="text-xs text-muted-foreground">
                                                其余 {diffEntries.length - 8} 项变化请查看下方原始 JSON。
                                              </p>
                                            ) : null}
                                          </div>
                                        </div>
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
                                    </>
                                  );
                                })()}
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
