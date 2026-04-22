"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type {
  DataFieldItem,
  DataRecordItem,
  DataViewItem,
  TaskDependencyItem,
} from "@/types/data-table";
import { FieldType } from "@/generated/prisma/enums";
import { TimelineOptions, type TimelineScale } from "./timeline-options";
import { TimelineConfig } from "./timeline-config";
import {
  buildTimelineGraph,
  type TimelineTask,
} from "./timeline-adapter";
import { calculateTimelineConflicts } from "./timeline-conflicts";
import { TimelineGanttFrappe } from "./timeline-gantt-frappe";
import {
  findFirstConflictTaskId,
  shouldWarnConflictGrowth,
} from "./timeline-view-helpers";

interface TimelineViewProps {
  tableId: string;
  fields: DataFieldItem[];
  records: DataRecordItem[];
  view: DataViewItem;
  onOpenRecord: (recordId: string) => void;
  onPatchRecord: (recordId: string, fieldKey: string, value: unknown) => Promise<void>;
  onViewOptionsChange?: (options: Record<string, unknown>) => void;
}

function asFieldKey(raw: unknown): string | null {
  return typeof raw === "string" && raw.length > 0 ? raw : null;
}

function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function asScale(raw: unknown): TimelineScale {
  if (raw === "week" || raw === "month" || raw === "quarter") {
    return raw;
  }
  return "week";
}

export function TimelineView({
  tableId,
  fields,
  records,
  view,
  onOpenRecord,
  onPatchRecord,
  onViewOptionsChange,
}: TimelineViewProps) {
  const [scale, setScale] = useState<TimelineScale>(
    asScale(view.viewOptions.timelineScale)
  );
  const [showConfig, setShowConfig] = useState(false);
  const [dependencies, setDependencies] = useState<TaskDependencyItem[]>([]);
  const [isDependencyLoading, setIsDependencyLoading] = useState(false);
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);
  const previousConflictCountRef = useRef<number | null>(null);

  const startDateField = asFieldKey(view.viewOptions.startDateField);
  const endDateField = asFieldKey(view.viewOptions.endDateField);
  const labelField = asFieldKey(view.viewOptions.labelField);
  const milestoneFieldKey = asFieldKey(view.viewOptions.milestoneFieldKey);
  const dependencyEnabled = view.viewOptions.dependencyEnabled !== false;

  const hasValidStartField = fields.some(
    (field) => field.key === startDateField && field.type === FieldType.DATE
  );
  const hasValidLabelField = fields.some((field) => field.key === labelField);
  const isConfigured = hasValidStartField && hasValidLabelField;

  useEffect(() => {
    setScale(asScale(view.viewOptions.timelineScale));
  }, [view.viewOptions.timelineScale]);

  useEffect(() => {
    if (!dependencyEnabled) {
      setDependencies([]);
      return;
    }

    let cancelled = false;
    setIsDependencyLoading(true);

    fetch(`/api/data-tables/${tableId}/dependencies`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        if (!cancelled) {
          setDependencies(Array.isArray(data) ? (data as TaskDependencyItem[]) : []);
        }
      })
      .catch((error) => {
        console.error("Failed to load task dependencies:", error);
        if (!cancelled) {
          setDependencies([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsDependencyLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [dependencyEnabled, tableId]);

  const handleConfigChange = useCallback(
    (key: string, value: string | null) => {
      if (!onViewOptionsChange) return;
      onViewOptionsChange({
        ...view.viewOptions,
        [key]: value,
      });
    },
    [onViewOptionsChange, view.viewOptions]
  );

  const handleToggleConfigChange = useCallback(
    (key: string, value: boolean) => {
      if (!onViewOptionsChange) return;
      onViewOptionsChange({
        ...view.viewOptions,
        [key]: value,
      });
    },
    [onViewOptionsChange, view.viewOptions]
  );

  const handleScaleChange = useCallback(
    (nextScale: TimelineScale) => {
      setScale(nextScale);
      if (!onViewOptionsChange) return;
      onViewOptionsChange({
        ...view.viewOptions,
        timelineScale: nextScale,
      });
    },
    [onViewOptionsChange, view.viewOptions]
  );

  const graph = useMemo(() => {
    if (!isConfigured || !startDateField || !labelField) {
      return { tasks: [] as TimelineTask[], links: [] as ReturnType<typeof buildTimelineGraph>["links"] };
    }

    return buildTimelineGraph({
      records,
      fields,
      dependencies: dependencyEnabled ? dependencies : [],
      config: {
        startFieldKey: startDateField,
        endFieldKey: endDateField,
        labelFieldKey: labelField,
        milestoneFieldKey,
      },
    });
  }, [
    dependencies,
    dependencyEnabled,
    endDateField,
    fields,
    isConfigured,
    labelField,
    milestoneFieldKey,
    records,
    startDateField,
  ]);

  const taskById = useMemo(
    () => new Map(graph.tasks.map((task) => [task.id, task])),
    [graph.tasks]
  );

  const conflict = useMemo(
    () => calculateTimelineConflicts(graph.tasks, graph.links),
    [graph.links, graph.tasks]
  );

  const conflictDepIdSet = useMemo(
    () => new Set(conflict.dependencyIds),
    [conflict.dependencyIds]
  );

  const conflictTaskIdSet = useMemo(
    () => new Set(conflict.recordIds),
    [conflict.recordIds]
  );

  useEffect(() => {
    const currentCount = conflict.dependencyIds.length;
    const previousCount = previousConflictCountRef.current;
    previousConflictCountRef.current = currentCount;

    if (
      shouldWarnConflictGrowth({
        previousCount,
        currentCount,
        isDependencyLoading,
      })
    ) {
      toast.warning(`依赖冲突增加到 ${currentCount} 条，请检查任务先后关系`);
    }
  }, [conflict.dependencyIds.length, isDependencyLoading]);

  const dependencyTaskIdSet = useMemo(() => {
    const ids = new Set<string>();
    for (const link of graph.links) {
      ids.add(link.predecessorTaskId);
      ids.add(link.successorTaskId);
    }
    return ids;
  }, [graph.links]);

  const frappeTasks = useMemo(
    () =>
      graph.tasks.map((task) => {
        const baseClass = task.isMilestone ? "timeline-task-milestone" : "timeline-task";
        return {
          id: task.id,
          name: task.label,
          start: formatDateOnly(task.startDate),
          end: formatDateOnly(task.isMilestone ? task.startDate : task.endDate),
          progress: 0,
          custom_class: baseClass,
        };
      }),
    [graph.tasks]
  );

  const frappeLinks = useMemo(
    () =>
      graph.links.map((link) => ({
        id: link.id,
        successorTaskId: link.successorTaskId,
        predecessorTaskId: link.predecessorTaskId,
        required: link.required,
        conflict: conflictDepIdSet.has(link.dependencyId),
      })),
    [conflictDepIdSet, graph.links]
  );

  const firstConflictTaskId = useMemo(() => {
    return findFirstConflictTaskId({
      conflictDependencyIds: conflict.dependencyIds,
      links: graph.links,
    });
  }, [conflict.dependencyIds, graph.links]);

  const handleTaskDateChange = useCallback(
    async (taskId: string, startDate: Date, endDate: Date) => {
      if (!startDateField) return;
      const task = taskById.get(taskId);
      if (!task) return;

      const nextStart = formatDateOnly(startDate);
      const nextEnd = formatDateOnly(task.isMilestone ? startDate : endDate);
      const previousStart = formatDateOnly(task.startDate);
      const previousEnd = formatDateOnly(task.isMilestone ? task.startDate : task.endDate);
      let startPatched = false;

      try {
        await onPatchRecord(task.recordId, startDateField, nextStart);
        startPatched = true;
        if (endDateField) {
          await onPatchRecord(task.recordId, endDateField, nextEnd);
        }
      } catch (error) {
        console.error("Failed to patch timeline task date:", error);
        if (startPatched) {
          try {
            await onPatchRecord(task.recordId, startDateField, previousStart);
            if (endDateField) {
              await onPatchRecord(task.recordId, endDateField, previousEnd);
            }
          } catch (rollbackError) {
            console.error("Failed to rollback timeline task date:", rollbackError);
          }
        }
        toast.error("保存任务日期失败，请重试");
      }
    },
    [endDateField, onPatchRecord, startDateField, taskById]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button
          variant={showConfig ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setShowConfig((prev) => !prev)}
        >
          <Settings2 className="h-4 w-4 mr-1" />
          配置
        </Button>
        <TimelineOptions scale={scale} onScaleChange={handleScaleChange} />
      </div>

      {showConfig && (
        <div className="rounded-md border p-3">
          <TimelineConfig
            fields={fields}
            startDateField={startDateField}
            endDateField={endDateField}
            labelField={labelField}
            milestoneFieldKey={milestoneFieldKey}
            dependencyEnabled={dependencyEnabled}
            onChange={handleConfigChange}
            onToggleChange={handleToggleConfigChange}
          />
        </div>
      )}

      {isConfigured ? (
        <div className="space-y-2">
          <TimelineGanttFrappe
            tasks={frappeTasks}
            links={frappeLinks}
            scale={scale}
            onScaleChange={handleScaleChange}
            dependencyTaskIds={[...dependencyTaskIdSet]}
            conflictTaskIds={[...conflictTaskIdSet]}
            focusTaskId={focusTaskId}
            focusNonce={focusNonce}
            onOpenRecord={onOpenRecord}
            onTaskDateChange={handleTaskDateChange}
          />
          {(isDependencyLoading || conflict.dependencyIds.length > 0) && (
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              {isDependencyLoading
                ? "正在加载依赖数据..."
                : `检测到 ${conflict.dependencyIds.length} 条依赖冲突（已高亮显示）`}
              {conflict.dependencyIds.length > 0 && firstConflictTaskId && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7"
                  onClick={() => {
                    setFocusTaskId(firstConflictTaskId);
                    setFocusNonce((prev) => prev + 1);
                  }}
                >
                  定位冲突
                </Button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          <p className="mb-3">时间线视图需要配置开始日期字段（DATE 类型）和标题字段</p>
          {!showConfig && (
            <Button variant="outline" size="sm" onClick={() => setShowConfig(true)}>
              <Settings2 className="h-4 w-4 mr-1" />
              去配置
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
