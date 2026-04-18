"use client";

import { useMemo, useState, useCallback } from "react";
import { DragDropProvider, DragOverlay } from "@dnd-kit/react";
import { ChevronLeft, ChevronRight, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DataFieldItem, DataRecordItem, DataViewItem } from "@/types/data-table";
import { FieldType } from "@/generated/prisma/enums";

interface CalendarViewProps {
  fields: DataFieldItem[];
  records: DataRecordItem[];
  view: DataViewItem;
  isAdmin: boolean;
  tableId: string;
  onPatchRecord: (recordId: string, fieldKey: string, value: unknown) => Promise<void>;
  onOpenRecord: (recordId: string) => void;
  onRecordCreated?: () => void;
}

function asFieldKey(val: unknown): string | null {
  return typeof val === "string" && val.length > 0 ? val : null;
}

function toDateValue(raw: unknown): Date | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

interface CalendarEvent {
  record: DataRecordItem;
  label: string;
  startDate: Date;
  endDate: Date;
}

export function CalendarView({
  fields,
  records,
  view,
  tableId,
  isAdmin,
  onPatchRecord,
  onOpenRecord,
  onRecordCreated,
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [showConfig, setShowConfig] = useState(false);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);

  const dateField = asFieldKey(view.viewOptions.startDateField);
  const endDateField = asFieldKey(view.viewOptions.endDateField);
  const labelField = asFieldKey(view.viewOptions.labelField);

  const dateFields = useMemo(
    () => fields.filter((f) => f.type === FieldType.DATE),
    [fields]
  );

  const textFields = useMemo(
    () => fields.filter((f) => f.type === FieldType.TEXT || f.type === FieldType.NUMBER),
    [fields]
  );

  const isConfigured = !!dateField && !!labelField;

  // Build calendar events
  const events = useMemo<CalendarEvent[]>(() => {
    if (!isConfigured) return [];
    return records
      .map((record) => {
        const startDate = toDateValue(record.data[dateField!]);
        if (!startDate) return null;
        const endValue = endDateField ? toDateValue(record.data[endDateField]) : null;
        return {
          record,
          label: String(record.data[labelField!] ?? record.id),
          startDate,
          endDate: endValue ?? startDate,
        };
      })
      .filter((e): e is CalendarEvent => e !== null);
  }, [records, dateField, endDateField, labelField, isConfigured]);

  // Calendar grid calculation
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDow = (firstDay.getDay() + 6) % 7; // Monday = 0
    const totalDays = lastDay.getDate();
    const days: Date[] = [];
    for (let i = 1 - startDow; i <= totalDays; i++) {
      days.push(new Date(year, month, i));
    }
    // Pad to full weeks
    while (days.length % 7 !== 0) {
      const d = days[days.length - 1];
      days.push(new Date(year, month, d.getDate() + 1));
    }
    return days;
  }, [year, month]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const start = new Date(event.startDate.getFullYear(), event.startDate.getMonth(), event.startDate.getDate());
      const end = new Date(event.endDate.getFullYear(), event.endDate.getMonth(), event.endDate.getDate());
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = toLocalDateString(d);
        const list = map.get(key) ?? [];
        list.push(event);
        map.set(key, list);
      }
    }
    return map;
  }, [events]);

  const activeEvent = activeEventId
    ? events.find((e) => e.record.id === activeEventId) ?? null
    : null;

  const handlePrevMonth = useCallback(() => {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }, []);

  const handleNextMonth = useCallback(() => {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }, []);

  const handleToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  const handleDragStart = useCallback(
    (event: { operation: { source: { id: string | number } | null } }) => {
      setActiveEventId(String(event.operation.source?.id ?? ""));
    },
    []
  );

  const handleDragEnd = useCallback(
    (event: { operation: { source: { id: string | number } | null; target: { id: string | number } | null }; canceled: boolean }) => {
      setActiveEventId(null);
      if (event.canceled || !dateField) return;
      const sourceId = String(event.operation.source?.id ?? "");
      const targetDate = String(event.operation.target?.id ?? "");
      if (!sourceId || !targetDate) return;
      onPatchRecord(sourceId, dateField, targetDate).catch(() => {});
    },
    [dateField, onPatchRecord]
  );

  const handleDayClick = useCallback(
    async (dateStr: string) => {
      if (!isAdmin || !dateField) return;
      try {
        const res = await fetch(`/api/data-tables/${tableId}/records`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: { [dateField]: dateStr } }),
        });
        if (res.ok) onRecordCreated?.();
      } catch {}
    },
    [isAdmin, dateField, tableId, onRecordCreated]
  );

  const today = toLocalDateString(new Date());

  if (!isConfigured) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          <p className="mb-3">日历视图需要配置日期字段和标题字段</p>
          {!showConfig && (
            <Button variant="outline" size="sm" onClick={() => setShowConfig(true)}>
              <Settings2 className="h-4 w-4 mr-1" />
              去配置
            </Button>
          )}
        </div>
        {showConfig && (
          <ConfigPanel
            fields={fields}
            dateFields={dateFields}
            textFields={textFields}
            startDateField={dateField}
            endDateField={endDateField}
            labelField={labelField}
            onChange={(key, value) => {
              view.viewOptions[key] = value;
            }}
            onClose={() => setShowConfig(false)}
          />
        )}
      </div>
    );
  }

  return (
    <DragDropProvider onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex flex-col flex-1 min-h-0">
        {/* Toolbar */}
        <div className="flex items-center gap-2 mb-3">
          <Button variant="outline" size="icon-sm" onClick={handlePrevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[120px] text-center">
            {year} 年 {month + 1} 月
          </span>
          <Button variant="outline" size="icon-sm" onClick={handleNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleToday}>
            今天
          </Button>
          <div className="flex-1" />
          <Button
            variant={showConfig ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowConfig(!showConfig)}
          >
            <Settings2 className="h-4 w-4 mr-1" />
            配置
          </Button>
        </div>

        {showConfig && (
          <ConfigPanel
            fields={fields}
            dateFields={dateFields}
            textFields={textFields}
            startDateField={dateField}
            endDateField={endDateField}
            labelField={labelField}
            onChange={(key, value) => {
              view.viewOptions[key] = value;
            }}
            onClose={() => setShowConfig(false)}
          />
        )}

        {/* Calendar grid */}
        <div className="flex-1 border rounded-md overflow-hidden">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 bg-muted/50">
            {WEEKDAYS.map((d) => (
              <div key={d} className="px-2 py-1.5 text-xs font-medium text-muted-foreground text-center border-b">
                {d}
              </div>
            ))}
          </div>
          {/* Day cells */}
          <div className="grid grid-cols-7 flex-1">
            {calendarDays.map((day, i) => {
              const dateStr = toLocalDateString(day);
              const isCurrentMonth = day.getMonth() === month;
              const isToday = dateStr === today;
              const dayEvents = eventsByDate.get(dateStr) ?? [];
              const visibleEvents = dayEvents.slice(0, 3);
              const hiddenCount = dayEvents.length - visibleEvents.length;

              return (
                <div
                  key={i}
                  data-drop-id={dateStr}
                  className={`border-b border-r p-1 min-h-[80px] flex flex-col ${
                    isCurrentMonth ? "bg-background" : "bg-muted/30"
                  } ${isAdmin ? "cursor-pointer" : ""}`}
                  onClick={() => handleDayClick(dateStr)}
                >
                  <div className={`text-xs mb-0.5 px-1 ${
                    isToday ? "bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center font-bold" :
                    !isCurrentMonth ? "text-muted-foreground/50" : "text-muted-foreground"
                  }`}>
                    {day.getDate()}
                  </div>
                  <div className="flex-1 space-y-0.5 overflow-hidden">
                    {visibleEvents.map((ev) => (
                      <CalendarEventCard
                        key={ev.record.id}
                        event={ev}
                        isMultiDay={ev.startDate.getTime() !== ev.endDate.getTime()}
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenRecord(ev.record.id);
                        }}
                      />
                    ))}
                    {hiddenCount > 0 && (
                      <div className="text-[10px] text-muted-foreground px-1">
                        +{hiddenCount} 更多
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <DragOverlay>
        {activeEvent && (
          <div className="rounded bg-primary/90 text-primary-foreground px-2 py-0.5 text-xs shadow-lg opacity-80">
            {activeEvent.label}
          </div>
        )}
      </DragOverlay>
    </DragDropProvider>
  );
}

// ── Event Card ──

function CalendarEventCard({
  event,
  isMultiDay,
  onClick,
}: {
  event: CalendarEvent;
  isMultiDay: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  // Use native draggable since dnd-kit useDraggable needs hook rules
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", event.record.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className="rounded px-1 py-0.5 text-[11px] truncate cursor-grab active:cursor-grabbing bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
      onClick={onClick}
      title={isMultiDay ? `${event.label} (${toLocalDateString(event.startDate)} - ${toLocalDateString(event.endDate)})` : event.label}
    >
      {isMultiDay && "📅 "}{event.label}
    </div>
  );
}

// ── Config Panel ──

function ConfigPanel({
  dateFields,
  textFields,
  startDateField,
  endDateField,
  labelField,
  onChange,
  onClose,
}: {
  fields: DataFieldItem[];
  dateFields: DataFieldItem[];
  textFields: DataFieldItem[];
  startDateField: string | null;
  endDateField: string | null;
  labelField: string | null;
  onChange: (key: string, value: string | null) => void;
  onClose: () => void;
}) {
  return (
    <div className="border rounded-md p-4 mb-3 bg-muted/30 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">日历视图配置</span>
        <Button variant="ghost" size="sm" onClick={onClose}>
          关闭
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">日期字段 *</label>
          <select
            value={startDateField ?? ""}
            onChange={(e) => onChange("startDateField", e.target.value || null)}
            className="w-full h-8 rounded-md border bg-background px-2 text-sm"
          >
            <option value="">选择日期字段</option>
            {dateFields.map((f) => (
              <option key={f.key} value={f.key}>{f.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">标题字段 *</label>
          <select
            value={labelField ?? ""}
            onChange={(e) => onChange("labelField", e.target.value || null)}
            className="w-full h-8 rounded-md border bg-background px-2 text-sm"
          >
            <option value="">选择标题字段</option>
            {textFields.map((f) => (
              <option key={f.key} value={f.key}>{f.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">结束日期字段</label>
          <select
            value={endDateField ?? ""}
            onChange={(e) => onChange("endDateField", e.target.value || null)}
            className="w-full h-8 rounded-md border bg-background px-2 text-sm"
          >
            <option value="">无</option>
            {dateFields.map((f) => (
              <option key={f.key} value={f.key}>{f.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
