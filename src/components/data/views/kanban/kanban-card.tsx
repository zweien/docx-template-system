"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useDraggable } from "@dnd-kit/react";
import { MessageSquare } from "lucide-react";
import type { DataFieldItem, DataRecordItem } from "@/types/data-table";
import { FieldType } from "@/generated/prisma/enums";
import { formatCellValue } from "@/lib/format-cell";

interface KanbanCardProps {
  record: DataRecordItem;
  cardFields: DataFieldItem[];
  titleField: DataFieldItem;
  commentCount: number;
  onOpenRecord: (recordId: string) => void;
  onPatchRecord: (recordId: string, fieldKey: string, value: unknown) => Promise<void>;
}

export function KanbanCard({
  record,
  cardFields,
  titleField,
  commentCount,
  onOpenRecord,
  onPatchRecord,
}: KanbanCardProps) {
  const { ref, isDragging } = useDraggable({ id: record.id });
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isCommitting, setIsCommitting] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  useEffect(() => {
    if (editingField && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select();
      }
    }
  }, [editingField]);

  const commitEdit = useCallback(async () => {
    if (!editingField || isCommitting) return;
    const field = cardFields.find((f) => f.key === editingField) ?? titleField;
    const currentValue = record.data[editingField];
    const newValue = field.type === FieldType.NUMBER ? (editValue === "" ? null : Number(editValue)) : editValue;

    setEditingField(null);
    if (JSON.stringify(currentValue) === JSON.stringify(newValue)) return;

    setIsCommitting(true);
    try {
      await onPatchRecord(record.id, editingField, newValue);
    } catch {
      console.error("保存失败");
    } finally {
      setIsCommitting(false);
    }
  }, [editingField, editValue, record.id, record.data, cardFields, titleField, onPatchRecord, isCommitting]);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent, fieldKey: string) => {
      e.stopPropagation();
      const value = record.data[fieldKey];
      setEditValue(value == null ? "" : String(value));
      setEditingField(fieldKey);
    },
    [record.data]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commitEdit();
      } else if (e.key === "Escape") {
        setEditingField(null);
      }
    },
    [commitEdit]
  );

  const title = String(record.data[titleField.key] ?? "未命名记录");

  return (
    <div
      ref={ref}
      className={`w-full rounded-lg border bg-background p-3 text-left shadow-xs transition-colors hover:bg-accent cursor-grab active:cursor-grabbing ${
        isDragging ? "opacity-40" : ""
      }`}
      onClick={() => {
        if (!editingField) onOpenRecord(record.id);
      }}
    >
      {editingField === titleField.key ? (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          className="text-sm font-medium w-full rounded border px-1 py-0.5 bg-background outline-none focus:ring-1 focus:ring-primary"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <div className="flex items-start justify-between gap-2">
          <div
            className="text-sm font-medium"
            onDoubleClick={(e) => handleDoubleClick(e, titleField.key)}
          >
            {title}
          </div>
          {commentCount > 0 && (
            <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              <MessageSquare className="h-3 w-3" />
              {commentCount}
            </span>
          )}
        </div>
      )}
      <div className="mt-2 space-y-1">
        {cardFields
          .filter((field) => field.key !== titleField.key)
          .map((field) => {
            const value = record.data[field.key];
            const isEditing = editingField === field.key;

            return (
              <div key={field.id} className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                <span className="shrink-0">{field.label}:</span>
                {isEditing ? (
                  field.type === FieldType.SELECT ? (
                    <select
                      ref={inputRef as React.RefObject<HTMLSelectElement>}
                      className="text-xs rounded border px-1 py-0 bg-background outline-none focus:ring-1 focus:ring-primary"
                      value={editValue}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        setEditingField(null);
                        if (record.data[field.key] !== newValue) {
                          onPatchRecord(record.id, field.key, newValue);
                        }
                      }}
                      onBlur={() => setEditingField(null)}
                      onKeyDown={handleKeyDown}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {(field.options as string[])?.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      ref={inputRef as React.RefObject<HTMLInputElement>}
                      className="text-xs flex-1 min-w-0 rounded border px-1 py-0 bg-background outline-none focus:ring-1 focus:ring-primary"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={handleKeyDown}
                      onClick={(e) => e.stopPropagation()}
                    />
                  )
                ) : (
                  <span onDoubleClick={(e) => handleDoubleClick(e, field.key)}>
                    {formatCellValue(field, value)}
                  </span>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
