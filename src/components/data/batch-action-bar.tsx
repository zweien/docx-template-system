"use client";

import { Button } from "@/components/ui/button";
import { Trash2, Pencil, X } from "lucide-react";

interface BatchActionBarProps {
  selectedCount: number;
  onBatchDelete: () => void;
  onBatchEdit: () => void;
  onClearSelection: () => void;
}

export function BatchActionBar({
  selectedCount,
  onBatchDelete,
  onBatchEdit,
  onClearSelection,
}: BatchActionBarProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border rounded-md text-sm">
      <span className="font-medium">已选择 {selectedCount} 条</span>
      <div className="h-4 w-px bg-border" />
      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={onBatchDelete}>
        <Trash2 className="h-3 w-3" />
        批量删除
      </Button>
      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={onBatchEdit}>
        <Pencil className="h-3 w-3" />
        批量编辑
      </Button>
      <div className="h-4 w-px bg-border" />
      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onClearSelection}>
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
