"use client";

import {
  Brain,
  CheckCircle2,
  Database,
  LoaderCircle,
  PenLine,
  ShieldAlert,
  Sparkles,
  Square,
} from "lucide-react";

interface AssistantStreamStateProps {
  status?: string;
  timeline?: string[];
  isStreaming?: boolean;
  hasContent?: boolean;
}

function getStepIcon(step: string, isCurrent: boolean, isCompleted: boolean) {
  if (step.includes("停止")) {
    return <Square className="h-3.5 w-3.5" aria-hidden="true" />;
  }

  if (isCurrent && !isCompleted) {
    return <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />;
  }

  if (isCompleted) {
    return <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />;
  }

  if (step.includes("分析")) {
    return <Brain className="h-3.5 w-3.5" aria-hidden="true" />;
  }

  if (step.includes("查询") || step.includes("读取") || step.includes("表")) {
    return <Database className="h-3.5 w-3.5" aria-hidden="true" />;
  }

  if (step.includes("整理") || step.includes("工具")) {
    return <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />;
  }

  if (step.includes("确认")) {
    return <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />;
  }

  return <PenLine className="h-3.5 w-3.5" aria-hidden="true" />;
}

export function AssistantStreamState({
  status,
  timeline = [],
  isStreaming = false,
  hasContent = false,
}: AssistantStreamStateProps) {
  if (!status && !isStreaming) {
    return null;
  }

  const resolvedStatus = status ?? "正在回复";
  const isStopped = resolvedStatus.includes("停止");
  const summaryTone = isStopped
    ? "bg-amber-50 text-amber-700 ring-amber-100"
    : isStreaming
      ? "bg-sky-50 text-sky-700 ring-sky-100"
      : "bg-emerald-50 text-emerald-700 ring-emerald-100";
  const summaryDotTone = isStopped
    ? "bg-amber-500"
    : isStreaming
      ? "bg-sky-500"
      : "bg-emerald-500";

  return (
    <details
      className="mb-2 rounded-md bg-card/80 px-2 py-1.5 ring-1 ring-black/5 dark:ring-white/5"
      open={isStreaming}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 text-xs text-muted-foreground [&::-webkit-details-marker]:hidden">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ring-1 ${summaryTone}`}
        >
          <span className="relative flex h-2 w-2">
            <span
              className={`absolute inline-flex h-full w-full rounded-full ${
                isStopped ? "bg-amber-400" : isStreaming ? "bg-sky-400" : "bg-emerald-400"
              } ${
                isStreaming ? "animate-ping" : ""
              }`}
            />
            <span className={`relative inline-flex h-2 w-2 rounded-full ${summaryDotTone}`} />
          </span>
          <span>{resolvedStatus}</span>
        </span>
        <span className="text-zinc-400">
          {timeline.length > 1 ? `${timeline.length} 个步骤` : "查看过程"}
        </span>
        {!isStreaming ? (
          <span
            className={`inline-flex items-center rounded-full px-1.5 py-0.5 ${
              isStopped ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {isStopped ? "已停止" : "已完成"}
          </span>
        ) : null}
        {isStreaming && hasContent ? (
          <span className="font-mono tracking-wide text-zinc-400">...</span>
        ) : null}
      </summary>

      {timeline.length > 0 ? (
        <ol className="mt-2 space-y-1 border-l border-border pl-3 text-xs text-muted-foreground">
          {timeline.map((item, index) => {
            const isCurrent = index === timeline.length - 1;
            const isCompleted = !isStreaming || index < timeline.length - 1;
            const toneClass = isCurrent
              ? isStopped
                ? "text-amber-800"
                : isStreaming
                  ? "text-sky-800"
                  : "text-emerald-800"
              : "text-zinc-600";
            const iconToneClass = isCurrent
              ? isStopped
                ? "text-amber-500"
                : isStreaming
                  ? "text-sky-500"
                  : "text-emerald-500"
              : isCompleted
                ? "text-emerald-500"
                : "text-zinc-300";

            return (
              <li
                key={`${item}-${index}`}
                className="relative flex items-center gap-2 pl-3"
              >
                <span className={`absolute left-[-1.15rem] top-1 text-current ${iconToneClass}`}>
                  {getStepIcon(item, isCurrent, isCompleted)}
                </span>
                <span className={isCurrent ? `font-medium ${toneClass}` : toneClass}>
                  {item}
                </span>
              </li>
            );
          })}
        </ol>
      ) : null}
    </details>
  );
}
