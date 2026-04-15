"use client";

import { useRef, useState, useCallback } from "react";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DataFieldItem } from "@/types/data-table";

interface FormFieldItemProps {
  field: DataFieldItem;
  index: number;
  groupId: string;
  onDrop: (fieldKey: string, toIndex: number) => void;
}

const FIELD_TYPE_LABELS: Record<string, string> = {
  TEXT: "文本",
  NUMBER: "数字",
  DATE: "日期",
  SELECT: "单选",
  MULTISELECT: "多选",
  EMAIL: "邮箱",
  PHONE: "电话",
  URL: "链接",
  BOOLEAN: "布尔",
  FILE: "附件",
  RELATION: "关联",
};

export function FormFieldItem({
  field,
  index,
  groupId,
  onDrop,
}: FormFieldItemProps) {
  const [dragOver, setDragOver] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData("text/plain", JSON.stringify({ fieldKey: field.key, groupId }));
      e.dataTransfer.effectAllowed = "move";
      if (ref.current) {
        ref.current.style.opacity = "0.5";
      }
    },
    [field.key, groupId]
  );

  const handleDragEnd = useCallback(() => {
    if (ref.current) {
      ref.current.style.opacity = "1";
    }
    setDragOver(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleDrop_ = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      try {
        const data = JSON.parse(e.dataTransfer.getData("text/plain"));
        if (data.fieldKey) {
          onDrop(data.fieldKey, index);
        }
      } catch {
        /* ignore invalid data */
      }
    },
    [index, onDrop]
  );

  return (
    <div
      ref={ref}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop_}
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 rounded-md border text-sm cursor-grab active:cursor-grabbing transition-colors",
        dragOver
          ? "border-primary bg-primary/5"
          : "border-transparent hover:bg-muted"
      )}
    >
      <GripVertical className="size-4 text-muted-foreground shrink-0" />
      <span className="flex-1 truncate">{field.label}</span>
      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
        {FIELD_TYPE_LABELS[field.type] ?? field.type}
      </span>
      {field.required && (
        <span className="text-xs text-destructive">*</span>
      )}
    </div>
  );
}
