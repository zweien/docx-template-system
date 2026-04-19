"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TimelineScale } from "./timeline-options";

type FrappeGanttTask = {
  id: string;
  name: string;
  start: string;
  end: string;
  progress?: number;
  dependencies?: string;
  custom_class?: string;
};

type FrappeGanttApiTask = {
  id: string;
  _start: Date;
  _end: Date;
};

type FrappeGanttLink = {
  id: string;
  successorTaskId: string;
  predecessorTaskId: string;
  required: boolean;
  conflict: boolean;
};

interface TimelineGanttFrappeProps {
  tasks: FrappeGanttTask[];
  links: FrappeGanttLink[];
  scale: TimelineScale;
  onOpenRecord: (recordId: string) => void;
  onTaskDateChange?: (taskId: string, startDate: Date, endDate: Date) => Promise<void> | void;
}

type GanttCtor = new (
  container: HTMLElement,
  tasks: FrappeGanttTask[],
  options: {
    view_mode?: "Week" | "Month";
    on_click?: (task: FrappeGanttApiTask) => void;
    on_date_change?: (task: FrappeGanttApiTask, start: Date, end: Date) => void;
  }
) => { change_view_mode?: (mode: "Week" | "Month") => void };

const VIEW_MODE_BY_SCALE: Record<TimelineScale, "Week" | "Month"> = {
  week: "Week",
  month: "Month",
  quarter: "Month",
};

const PAN_STEP_BY_SCALE: Record<TimelineScale, number> = {
  week: 280,
  month: 420,
  quarter: 720,
};

function applyLinkStyles(container: HTMLElement, links: FrappeGanttLink[]) {
  const linkGroups = container.querySelectorAll<SVGGElement>(".gantt .arrow");
  const linkByEdge = new Map(
    links.map((link) => [`${link.predecessorTaskId}->${link.successorTaskId}`, link])
  );

  linkGroups.forEach((group, index) => {
    const from = group.getAttribute("data-from");
    const to = group.getAttribute("data-to");
    const link = (from && to ? linkByEdge.get(`${from}->${to}`) : undefined) ?? links[index];
    if (!link) return;
    const path = group.querySelector<SVGPathElement>("path");
    if (!path) return;
    path.style.stroke = link.conflict ? "#dc2626" : "#64748b";
    path.style.strokeWidth = link.conflict ? "2.5" : "1.5";
    path.style.strokeDasharray = link.required ? "none" : "4 3";
  });
}

export function TimelineGanttFrappe({
  tasks,
  links,
  scale,
  onOpenRecord,
  onTaskDateChange,
}: TimelineGanttFrappeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStateRef = useRef<{ startX: number; startScrollLeft: number } | null>(null);

  const preparedTasks = useMemo<FrappeGanttTask[]>(() => {
    const depByTask = new Map<string, string[]>();
    for (const link of links) {
      const deps = depByTask.get(link.successorTaskId) ?? [];
      deps.push(link.predecessorTaskId);
      depByTask.set(link.successorTaskId, deps);
    }

    return tasks.map((task) => ({
      ...task,
      dependencies: depByTask.get(task.id)?.join(","),
    }));
  }, [links, tasks]);

  useEffect(() => {
    if (!containerRef.current) return;

    let disposed = false;
    containerRef.current.innerHTML = "";

    const render = async () => {
      const mod = await import("frappe-gantt");
      if (disposed || !containerRef.current) return;
      const Gantt = (mod.default ?? mod) as GanttCtor;
      new Gantt(containerRef.current, preparedTasks, {
        view_mode: VIEW_MODE_BY_SCALE[scale],
        on_click: (task) => onOpenRecord(task.id),
        on_date_change: (task, start, end) => {
          void onTaskDateChange?.(task.id, start, end);
        },
      });
      if (containerRef.current) {
        applyLinkStyles(containerRef.current, links);
      }
    };

    void render();

    return () => {
      disposed = true;
    };
  }, [links, onOpenRecord, onTaskDateChange, preparedTasks, scale]);

  if (preparedTasks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        暂无可显示的时间线任务
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-background">
      <div className="flex items-center justify-end gap-1 border-b p-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            if (scrollRef.current) {
              scrollRef.current.scrollLeft -= PAN_STEP_BY_SCALE[scale];
            }
          }}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            if (scrollRef.current) {
              scrollRef.current.scrollLeft += PAN_STEP_BY_SCALE[scale];
            }
          }}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div
        ref={scrollRef}
        className="overflow-x-auto cursor-grab active:cursor-grabbing"
        onMouseDown={(event) => {
          if (!scrollRef.current) return;
          setIsPanning(true);
          panStateRef.current = {
            startX: event.clientX,
            startScrollLeft: scrollRef.current.scrollLeft,
          };
        }}
        onMouseMove={(event) => {
          if (!isPanning || !scrollRef.current || !panStateRef.current) return;
          const delta = event.clientX - panStateRef.current.startX;
          scrollRef.current.scrollLeft = panStateRef.current.startScrollLeft - delta;
        }}
        onMouseUp={() => {
          setIsPanning(false);
          panStateRef.current = null;
        }}
        onMouseLeave={() => {
          setIsPanning(false);
          panStateRef.current = null;
        }}
      >
        <div ref={containerRef} className="min-w-[960px] p-2" />
      </div>
      <style jsx global>{`
        .timeline-task-conflict .bar {
          fill: #fecaca !important;
          stroke: #dc2626 !important;
          stroke-width: 1.5px !important;
        }
        .timeline-task-milestone .bar {
          rx: 2px !important;
          ry: 2px !important;
        }
      `}</style>
    </div>
  );
}
