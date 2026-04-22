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
  onScaleChange?: (scale: TimelineScale) => void;
  focusTaskId?: string | null;
  focusNonce?: number;
  onOpenRecord: (recordId: string) => void;
  onTaskDateChange?: (taskId: string, startDate: Date, endDate: Date) => Promise<void> | void;
}

type GanttCtor = new (
  container: HTMLElement,
  tasks: FrappeGanttTask[],
  options: {
    view_mode?: "Week" | "Month";
    scroll_to?: "today" | "start" | "end" | string;
    today_button?: boolean;
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

function applyMilestoneShapes(container: HTMLElement) {
  const milestoneBars = container.querySelectorAll<SVGGElement>(
    ".gantt .bar-wrapper.timeline-task-milestone"
  );

  milestoneBars.forEach((wrapper) => {
    const bar = wrapper.querySelector<SVGRectElement>(".bar");
    if (!bar) return;

    const baseX = Number(bar.getAttribute("x") ?? 0);
    const baseY = Number(bar.getAttribute("y") ?? 0);
    const baseHeight = Number(bar.getAttribute("height") ?? 0);
    const size = Math.max(10, Math.min(14, baseHeight || 14));
    const centerY = baseY + baseHeight / 2;
    const centerX = baseX + size / 2;

    bar.setAttribute("x", String(baseX));
    bar.setAttribute("y", String(centerY - size / 2));
    bar.setAttribute("width", String(size));
    bar.setAttribute("height", String(size));
    bar.setAttribute("rx", "1");
    bar.setAttribute("ry", "1");
    bar.setAttribute("transform", `rotate(45 ${centerX} ${centerY})`);

    const progress = wrapper.querySelector<SVGElement>(".bar-progress");
    if (progress) {
      progress.style.display = "none";
    }

    wrapper.querySelectorAll<SVGElement>(".handle").forEach((handle) => {
      handle.style.display = "none";
    });
  });
}

export function TimelineGanttFrappe({
  tasks,
  links,
  scale,
  onScaleChange,
  focusTaskId,
  focusNonce,
  onOpenRecord,
  onTaskDateChange,
}: TimelineGanttFrappeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStateRef = useRef<{ startX: number; startScrollLeft: number } | null>(null);
  const lastScaleWheelRef = useRef(0);

  useEffect(() => {
    if (!focusTaskId || !containerRef.current || !scrollRef.current) return;
    const safeId = focusTaskId.replace(/["\\]/g, "\\$&");
    const wrapper = containerRef.current.querySelector<SVGGElement>(
      `.gantt .bar-wrapper[data-id="${safeId}"]`
    );
    if (!wrapper) return;

    const bar = wrapper.querySelector<SVGGraphicsElement>(".bar");
    const x = Number(bar?.getAttribute("x") ?? 0);
    scrollRef.current.scrollTo({
      left: Math.max(0, x - 140),
      behavior: "smooth",
    });

    wrapper.classList.add("timeline-task-focus");
    const timer = window.setTimeout(() => {
      wrapper.classList.remove("timeline-task-focus");
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [focusNonce, focusTaskId]);

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
        scroll_to: "today",
        today_button: false,
        on_click: (task) => onOpenRecord(task.id),
        on_date_change: (task, start, end) => {
          void onTaskDateChange?.(task.id, start, end);
        },
      });
      if (containerRef.current) {
        applyLinkStyles(containerRef.current, links);
        applyMilestoneShapes(containerRef.current);
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
        onWheel={(event) => {
          const now = Date.now();
          if (now - lastScaleWheelRef.current < 150) return;
          if (Math.abs(event.deltaY) < 4) return;
          event.preventDefault();
          lastScaleWheelRef.current = now;

          const nextScale =
            event.deltaY > 0
              ? scale === "week"
                ? "month"
                : "quarter"
              : scale === "quarter"
                ? "month"
                : "week";
          if (nextScale !== scale) {
            onScaleChange?.(nextScale);
          }
        }}
      >
        <div ref={containerRef} className="min-w-[960px] p-2" />
      </div>
      <style jsx global>{`
        .timeline-task-dependent .bar {
          stroke: #2563eb !important;
          stroke-width: 1.25px !important;
        }
        .timeline-task-conflict .bar {
          fill: #fecaca !important;
          stroke: #dc2626 !important;
          stroke-width: 1.5px !important;
        }
        .timeline-task-focus .bar {
          stroke: #f97316 !important;
          stroke-width: 2px !important;
          filter: drop-shadow(0 0 4px rgba(249, 115, 22, 0.55));
        }
        .timeline-task-milestone .bar {
          fill: #f59e0b !important;
          stroke: #d97706 !important;
          stroke-width: 1.2px !important;
        }
        .gantt-container .current-highlight {
          background: #16a34a !important;
          width: 2px !important;
        }
      `}</style>
    </div>
  );
}
