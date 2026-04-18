"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { DragDropProvider, DragOverlay } from "@dnd-kit/react";
import { toast } from "sonner";
import type { DataFieldItem, DataRecordItem, DataViewItem } from "@/types/data-table";
import { FieldType } from "@/generated/prisma/enums";
import { KanbanColumn } from "./kanban-column";

interface KanbanViewProps {
  fields: DataFieldItem[];
  records: DataRecordItem[];
  view: DataViewItem;
  isAdmin: boolean;
  tableId: string;
  onPatchRecord: (recordId: string, fieldKey: string, value: unknown) => Promise<void>;
  onOpenRecord: (recordId: string) => void;
}

function resolveGroupField(view: DataViewItem, fields: DataFieldItem[]): DataFieldItem | null {
  const fieldKey =
    typeof view.viewOptions.groupByField === "string"
      ? view.viewOptions.groupByField
      : view.groupBy;
  const field = fields.find((item) => item.key === fieldKey && item.type === FieldType.SELECT);
  return field ?? null;
}

function resolveTitleField(fields: DataFieldItem[]): DataFieldItem {
  return (
    fields.find((field) => field.type === FieldType.TEXT) ??
    fields[0] ?? {
      id: "fallback-title",
      key: "id",
      label: "记录",
      type: FieldType.TEXT,
      required: false,
      sortOrder: 0,
    }
  );
}

interface DragEvent {
  operation: {
    source: { id: string | number } | null;
    target: { id: string | number } | null;
  };
  canceled: boolean;
}

export function KanbanView({
  fields,
  records,
  view,
  tableId,
  onPatchRecord,
  onOpenRecord,
}: KanbanViewProps) {
  const groupField = resolveGroupField(view, fields);
  const [shouldReturn, setShouldReturn] = useState(false);
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});

  const cardFieldKeys = Array.isArray(view.viewOptions.cardFields)
    ? view.viewOptions.cardFields.filter((key): key is string => typeof key === "string")
    : fields.map((field) => field.key);
  const cardFields = cardFieldKeys
    .map((fieldKey) => fields.find((field) => field.key === fieldKey))
    .filter((field): field is DataFieldItem => Boolean(field));
  const titleField = resolveTitleField(cardFields.length > 0 ? cardFields : fields);

  const groupedRecords = useMemo(() => {
    if (!groupField) return new Map<string, DataRecordItem[]>();
    const groups = new Map<string, DataRecordItem[]>();
    for (const option of (groupField.options as string[]) ?? []) {
      groups.set(option, []);
    }
    groups.set("无值", []);

    for (const record of records) {
      const rawValue = record.data[groupField.key];
      const groupKey = typeof rawValue === "string" && rawValue.length > 0 ? rawValue : "无值";
      const bucket = groups.get(groupKey) ?? groups.get("无值");
      bucket?.push(record);
    }
    return groups;
  }, [records, groupField]);

  const recordIdsKey = records.map((r) => r.id).join(",");
  useEffect(() => {
    if (!tableId || recordIdsKey.length === 0) return;
    const ids = recordIdsKey.split(",");
    fetch(`/api/data-tables/${tableId}/records/${ids[0]}/comments?ids=${ids.join(",")}`)
      .then((res) => (res.ok ? res.json() : {}))
      .then((data: Record<string, number>) => setCommentCounts(data))
      .catch(() => {});
  }, [tableId, recordIdsKey]);

  const activeRecord = activeRecordId
    ? records.find((r) => r.id === activeRecordId) ?? null
    : null;

  const effectiveCardFields = cardFields.length > 0 ? cardFields : fields;

  const handleDragStart = useCallback(
    (event: { operation: { source: { id: string | number } | null } }) => {
      const sourceId = event.operation.source?.id;
      if (sourceId) setActiveRecordId(String(sourceId));
    },
    []
  );

  const handleDragEnd = useCallback(
    (event: DragEvent) => {
      setActiveRecordId(null);
      if (event.canceled) return;

      const sourceId = event.operation.source?.id;
      const targetId = event.operation.target?.id;
      if (!sourceId || !targetId) return;

      const recordId = String(sourceId);
      const targetGroup = String(targetId);
      const newValue = targetGroup === "无值" ? "" : targetGroup;

      const record = records.find((r) => r.id === recordId);
      if (!record || !groupField) return;
      if (record.data[groupField.key] === newValue) return;

      onPatchRecord(recordId, groupField.key, newValue).catch(() => {
        toast.error("移动失败");
      });
    },
    [records, groupField, onPatchRecord]
  );

  if (!groupField && !shouldReturn) {
    setShouldReturn(true);
  }

  if (!groupField) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        看板视图需要配置一个 SELECT 类型的分组字段。
        <br />在视图设置中设置 groupByField 或 groupBy。
      </div>
    );
  }

  return (
    <DragDropProvider onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {[...groupedRecords.entries()].map(([label, columnRecords]) => (
          <KanbanColumn
            key={label}
            label={label}
            records={columnRecords}
            cardFields={effectiveCardFields}
            titleField={titleField}
            commentCounts={commentCounts}
            onOpenRecord={onOpenRecord}
            onPatchRecord={onPatchRecord}
          />
        ))}
      </div>
      <DragOverlay>
        {activeRecord && (
          <div className="w-[280px] rounded-lg border bg-background p-3 shadow-lg opacity-80">
            <div className="text-sm font-medium">
              {String(activeRecord.data[titleField.key] ?? "未命名记录")}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {effectiveCardFields
                .filter((f) => f.key !== titleField.key)
                .slice(0, 2)
                .map((f) => String(activeRecord.data[f.key] ?? "-"))
                .join(" · ")}
            </div>
          </div>
        )}
      </DragOverlay>
    </DragDropProvider>
  );
}
