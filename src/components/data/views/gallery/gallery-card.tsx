"use client";
/* eslint-disable @next/next/no-img-element */

import type { DataFieldItem, DataRecordItem } from "@/types/data-table";

interface GalleryCardProps {
  record: DataRecordItem;
  coverField?: DataFieldItem;
  titleField: DataFieldItem;
  detailFields: DataFieldItem[];
  onOpenRecord: (recordId: string) => void;
}

function resolveCoverInitial(title: string): string {
  const trimmed = title.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 1).toUpperCase() : "?";
}

export function GalleryCard({
  record,
  coverField,
  titleField,
  detailFields,
  onOpenRecord,
}: GalleryCardProps) {
  const title = String(record.data[titleField.key] ?? "未命名记录");
  const coverValue = coverField ? record.data[coverField.key] : null;
  const coverUrl = typeof coverValue === "string" && coverValue.length > 0 ? coverValue : null;

  return (
    <button
      type="button"
      className="overflow-hidden rounded-xl border bg-background text-left shadow-xs transition-colors hover:bg-accent"
      onClick={() => onOpenRecord(record.id)}
    >
      {coverUrl ? (
        <img src={coverUrl} alt={title} className="h-36 w-full object-cover" />
      ) : (
        <div className="flex h-36 w-full items-center justify-center bg-muted text-3xl font-semibold text-muted-foreground">
          {resolveCoverInitial(title)}
        </div>
      )}

      <div className="space-y-2 p-4">
        <div className="text-sm font-semibold">{title}</div>
        <div className="space-y-1">
          {detailFields.map((field) => (
            <div key={field.id} className="text-xs text-muted-foreground">
              {field.label}: {String(record.data[field.key] ?? "-")}
            </div>
          ))}
        </div>
      </div>
    </button>
  );
}
