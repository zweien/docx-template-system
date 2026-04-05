"use client";

import type { DataFieldItem, DataRecordItem } from "@/types/data-table";

interface KanbanCardProps {
  record: DataRecordItem;
  cardFields: DataFieldItem[];
  titleField: DataFieldItem;
  onOpenRecord: (recordId: string) => void;
}

export function KanbanCard({
  record,
  cardFields,
  titleField,
  onOpenRecord,
}: KanbanCardProps) {
  const title = String(record.data[titleField.key] ?? "未命名记录");

  return (
    <div
      className="w-full rounded-lg border bg-background p-3 text-left shadow-xs transition-colors hover:bg-accent cursor-pointer"
      onClick={() => onOpenRecord(record.id)}
    >
      <div className="text-sm font-medium">{title}</div>
      <div className="mt-2 space-y-1">
        {cardFields
          .filter((field) => field.key !== titleField.key)
          .map((field) => (
            <div key={field.id} className="text-xs text-muted-foreground">
              <span className="mr-1">{field.label}:</span>
              <span>{String(record.data[field.key] ?? "-")}</span>
            </div>
          ))}
      </div>
    </div>
  );
}
