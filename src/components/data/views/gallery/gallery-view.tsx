"use client";

import type { DataFieldItem, DataRecordItem, DataViewItem } from "@/types/data-table";
import { FieldType } from "@/generated/prisma/enums";
import { GalleryCard } from "./gallery-card";

interface GalleryViewProps {
  fields: DataFieldItem[];
  records: DataRecordItem[];
  view: DataViewItem;
  onOpenRecord: (recordId: string) => void;
}

function findField(fields: DataFieldItem[], fieldKey: unknown): DataFieldItem | undefined {
  if (typeof fieldKey !== "string") return undefined;
  return fields.find((field) => field.key === fieldKey);
}

export function GalleryView({
  fields,
  records,
  view,
  onOpenRecord,
}: GalleryViewProps) {
  const titleField =
    findField(fields, view.viewOptions.primaryField) ??
    fields.find((field) => field.type === FieldType.TEXT) ??
    fields[0];
  const coverField = findField(fields, view.viewOptions.coverField);
  const detailFieldKeys = Array.isArray(view.viewOptions.cardFields)
    ? view.viewOptions.cardFields.filter((key): key is string => typeof key === "string")
    : [];
  const detailFields = detailFieldKeys
    .map((fieldKey) => fields.find((field) => field.key === fieldKey))
    .filter((field): field is DataFieldItem => Boolean(field));

  if (!titleField) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        画廊视图至少需要 1 个字段作为标题
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {records.map((record) => (
        <GalleryCard
          key={record.id}
          record={record}
          coverField={coverField}
          titleField={titleField}
          detailFields={detailFields}
          onOpenRecord={onOpenRecord}
        />
      ))}
    </div>
  );
}
