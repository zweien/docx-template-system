"use client";

import { useCallback, useMemo, useState } from "react";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DataFieldItem, DataRecordItem, DataViewItem } from "@/types/data-table";
import { FieldType } from "@/generated/prisma/enums";
import { TimelineGantt } from "./timeline-gantt";
import { TimelineOptions, type TimelineScale } from "./timeline-options";
import { TimelineConfig } from "./timeline-config";

interface TimelineViewProps {
  fields: DataFieldItem[];
  records: DataRecordItem[];
  view: DataViewItem;
  onOpenRecord: (recordId: string) => void;
  onViewOptionsChange?: (options: Record<string, unknown>) => void;
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
  onViewOptionsChange,
}: TimelineViewProps) {
  const [scale, setScale] = useState<TimelineScale>("week");
  const [showConfig, setShowConfig] = useState(false);
  const startDateField = asFieldKey(view.viewOptions.startDateField);
  const endDateField = asFieldKey(view.viewOptions.endDateField);
  const labelField = asFieldKey(view.viewOptions.labelField);

  const hasValidStartField = fields.some(
    (field) => field.key === startDateField && field.type === FieldType.DATE
  );
  const hasValidLabelField = fields.some((field) => field.key === labelField);
  const isConfigured = hasValidStartField && hasValidLabelField;

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

  const items = useMemo(() => {
    if (!isConfigured || !startDateField || !labelField) {
      return [];
    }

    return records
      .map((record) => {
        const startDate = toDateValue(record.data[startDateField]);
        if (!startDate) return null;

        const endValue = endDateField ? toDateValue(record.data[endDateField]) : null;
        const resolvedEndDate = endValue ?? startDate;

        return {
          record,
          label: String(record.data[labelField] ?? record.id),
          startDate,
          endDate: resolvedEndDate,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((left, right) => left.startDate.getTime() - right.startDate.getTime());
  }, [endDateField, isConfigured, labelField, records, startDateField]);

  return (
    <div className="space-y-3">
      {/* Toolbar: config toggle + scale selector */}
      <div className="flex items-center justify-between">
        <Button
          variant={showConfig ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setShowConfig((prev) => !prev)}
        >
          <Settings2 className="h-4 w-4 mr-1" />
          配置
        </Button>
        <TimelineOptions scale={scale} onScaleChange={setScale} />
      </div>

      {/* Config panel */}
      {showConfig && (
        <div className="rounded-md border p-3">
          <TimelineConfig
            fields={fields}
            startDateField={startDateField}
            endDateField={endDateField}
            labelField={labelField}
            onChange={handleConfigChange}
          />
        </div>
      )}

      {/* Content */}
      {isConfigured ? (
        <TimelineGantt items={items} scale={scale} onOpenRecord={onOpenRecord} />
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
