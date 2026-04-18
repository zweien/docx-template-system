"use client";

import { useDroppable } from "@dnd-kit/react";
import type { DataFieldItem, DataRecordItem } from "@/types/data-table";
import { KanbanCard } from "./kanban-card";

interface KanbanColumnProps {
  label: string;
  records: DataRecordItem[];
  cardFields: DataFieldItem[];
  titleField: DataFieldItem;
  commentCounts: Record<string, number>;
  onOpenRecord: (recordId: string) => void;
  onPatchRecord: (recordId: string, fieldKey: string, value: unknown) => Promise<void>;
}

export function KanbanColumn({
  label,
  records,
  cardFields,
  titleField,
  commentCounts,
  onOpenRecord,
  onPatchRecord,
}: KanbanColumnProps) {
  const { ref, isDropTarget } = useDroppable({ id: label });

  return (
    <section
      ref={ref}
      className={`min-w-[280px] flex-1 rounded-xl border bg-muted/30 p-3 transition-colors ${
        isDropTarget ? "border-primary/50 bg-primary/5" : ""
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{label}</h3>
        <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground">
          {records.length}
        </span>
      </div>
      <div className="space-y-2">
        {records.map((record) => (
          <KanbanCard
            key={record.id}
            record={record}
            cardFields={cardFields}
            titleField={titleField}
            commentCount={commentCounts[record.id] ?? 0}
            onOpenRecord={onOpenRecord}
            onPatchRecord={onPatchRecord}
          />
        ))}
      </div>
    </section>
  );
}
