"use client";

import { useMemo, useState } from "react";
import type { DataFieldItem, DataRecordItem, DataViewItem } from "@/types/data-table";
import { FieldType } from "@/generated/prisma/enums";
import { TimelineGantt } from "./timeline-gantt";
import { TimelineOptions, type TimelineScale } from "./timeline-options";

interface TimelineViewProps {
  fields: DataFieldItem[];
  records: DataRecordItem[];
  view: DataViewItem;
  onOpenRecord: (recordId: string) => void;
}

function asFieldKey(raw: unknown): string | null {
  return typeof raw === "string" && raw.length > 0 ? raw : null;
}

function toDateValue(raw: unknown): Date | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function TimelineView({
  fields,
  records,
  view,
  onOpenRecord,
}: TimelineViewProps) {
  const [scale, setScale] = useState<TimelineScale>("week");
  const startDateField = asFieldKey(view.viewOptions.startDateField);
  const endDateField = asFieldKey(view.viewOptions.endDateField);
  const labelField = asFieldKey(view.viewOptions.labelField);

  const hasValidStartField = fields.some(
    (field) => field.key === startDateField && field.type === FieldType.DATE
  );
  const hasValidLabelField = fields.some((field) => field.key === labelField);

  const items = useMemo(() => {
    if (!hasValidStartField || !hasValidLabelField || !startDateField || !labelField) {
      return [];
    }

    return records
      .map((record) => {
        const startDate = toDateValue(record.data[startDateField]);
        if (!startDate) return null;

        const resolvedEndDate =
          endDateField && toDateValue(record.data[endDateField])
            ? toDateValue(record.data[endDateField])!
            : startDate;

        return {
          record,
          label: String(record.data[labelField] ?? record.id),
          startDate,
          endDate: resolvedEndDate,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((left, right) => left.startDate.getTime() - right.startDate.getTime());
  }, [endDateField, hasValidLabelField, hasValidStartField, labelField, records, startDateField]);

  if (!hasValidStartField || !hasValidLabelField) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        时间线视图需要配置开始日期字段（DATE 类型）和标题字段
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <TimelineOptions scale={scale} onScaleChange={setScale} />
      </div>
      <TimelineGantt items={items} scale={scale} onOpenRecord={onOpenRecord} />
    </div>
  );
}
