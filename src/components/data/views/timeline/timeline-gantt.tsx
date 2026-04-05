"use client";

import type { DataRecordItem } from "@/types/data-table";
import type { TimelineScale } from "./timeline-options";

interface TimelineBarItem {
  record: DataRecordItem;
  label: string;
  startDate: Date;
  endDate: Date;
}

interface TimelineGanttProps {
  items: TimelineBarItem[];
  scale: TimelineScale;
  onOpenRecord: (recordId: string) => void;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const COLUMN_WIDTH_BY_SCALE: Record<TimelineScale, number> = {
  day: 32,
  week: 18,
  month: 8,
};

function getTimelineRange(items: TimelineBarItem[]): { min: Date; max: Date } {
  const minTime = Math.min(...items.map((item) => item.startDate.getTime()), Date.now());
  const maxTime = Math.max(...items.map((item) => item.endDate.getTime()), Date.now() + MS_PER_DAY);
  return { min: new Date(minTime), max: new Date(maxTime) };
}

function toDayOffset(date: Date, minDate: Date): number {
  return Math.max(0, Math.floor((date.getTime() - minDate.getTime()) / MS_PER_DAY));
}

export function TimelineGantt({ items, scale, onOpenRecord }: TimelineGanttProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        暂无可显示的日期记录
      </div>
    );
  }

  const { min, max } = getTimelineRange(items);
  const columnWidth = COLUMN_WIDTH_BY_SCALE[scale];
  const totalDays = toDayOffset(max, min) + 2;
  const svgWidth = Math.max(960, totalDays * columnWidth + 240);
  const svgHeight = items.length * 48 + 64;
  const todayX = 220 + toDayOffset(new Date(), min) * columnWidth;

  return (
    <div className="overflow-x-auto rounded-lg border bg-background">
      <svg width={svgWidth} height={svgHeight} role="img" aria-label="时间线甘特图">
        {/* Today marker */}
        <line
          data-testid="timeline-today-marker"
          x1={todayX}
          x2={todayX}
          y1={0}
          y2={svgHeight}
          stroke="#ef4444"
          strokeDasharray="4 4"
        />

        {items.map((item, index) => {
          const y = index * 48 + 24;
          const x = 220 + toDayOffset(item.startDate, min) * columnWidth;
          const width = Math.max(
            columnWidth,
            (toDayOffset(item.endDate, min) - toDayOffset(item.startDate, min) + 1) * columnWidth
          );

          return (
            <g key={item.record.id}>
              <foreignObject x={4} y={y} width={208} height={24}>
                <div
                  className="h-full flex items-center text-xs truncate"
                  title={item.label}
                >
                  {item.label}
                </div>
              </foreignObject>
              <rect
                data-testid={`timeline-bar-${item.record.id}`}
                x={x}
                y={y}
                width={width}
                height={24}
                rx={8}
                fill="#2563eb"
                opacity={0.85}
                onClick={() => onOpenRecord(item.record.id)}
              >
                <title>
                  {item.label} · {item.startDate.toLocaleDateString("zh-CN")} -{" "}
                  {item.endDate.toLocaleDateString("zh-CN")}
                </title>
              </rect>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
