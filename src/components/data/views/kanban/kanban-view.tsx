"use client";

import { useMemo } from "react";
import type { DataFieldItem, DataRecordItem, DataViewItem } from "@/types/data-table";
import { FieldType } from "@/generated/prisma/enums";
import { KanbanColumn } from "./kanban-column";

interface KanbanViewProps {
  fields: DataFieldItem[];
  records: DataRecordItem[];
  view: DataViewItem;
  isAdmin: boolean;
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

export function KanbanView({
  fields,
  records,
  view,
  onPatchRecord,
  onOpenRecord,
}: KanbanViewProps) {
  const groupField = resolveGroupField(view, fields);

  if (!groupField) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        看板视图需要配置一个 SELECT 类型的分组字段。
        <br />在视图设置中设置 groupByField 或 groupBy。
      </div>
    );
  }

  const cardFieldKeys = Array.isArray(view.viewOptions.cardFields)
    ? view.viewOptions.cardFields.filter((key): key is string => typeof key === "string")
    : fields.map((field) => field.key);
  const cardFields = cardFieldKeys
    .map((fieldKey) => fields.find((field) => field.key === fieldKey))
    .filter((field): field is DataFieldItem => Boolean(field));
  const titleField = resolveTitleField(cardFields.length > 0 ? cardFields : fields);

  const groupedRecords = useMemo(() => {
    const groups = new Map<string, DataRecordItem[]>();
    for (const option of groupField.options ?? []) {
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

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {[...groupedRecords.entries()].map(([label, columnRecords]) => (
        <KanbanColumn
          key={label}
          label={label}
          records={columnRecords}
          cardFields={cardFields.length > 0 ? cardFields : fields}
          titleField={titleField}
          onOpenRecord={onOpenRecord}
        />
      ))}
    </div>
  );
}
