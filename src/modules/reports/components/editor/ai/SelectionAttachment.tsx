"use client";

import { X } from "lucide-react";
import type { PinnedSelection } from "@/types/editor-ai";

interface SelectionAttachmentProps {
  selection: PinnedSelection;
  onRemove: (id: string) => void;
}

export function SelectionAttachment({ selection, onRemove }: SelectionAttachmentProps) {
  const preview =
    selection.text.length > 60
      ? selection.text.slice(0, 60) + "..."
      : selection.text;

  return (
    <div className="flex items-start gap-1.5 rounded-md border border-blue-200 bg-blue-50/50 p-2 text-xs dark:border-blue-800 dark:bg-blue-950/30">
      <span className="shrink-0 text-blue-500" title="选中文本">
        📎 选中文本
        <span className="ml-1 text-muted-foreground">
          ({selection.text.length} 字)
        </span>
      </span>
      <span className="flex-1 truncate text-foreground">{preview}</span>
      <button
        type="button"
        onClick={() => onRemove(selection.id)}
        className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        title="移除"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}
