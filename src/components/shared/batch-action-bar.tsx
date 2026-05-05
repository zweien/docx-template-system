"use client";

import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export interface BatchAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "destructive";
}

interface SharedBatchActionBarProps {
  selectedCount: number;
  actions: BatchAction[];
  onClearSelection: () => void;
}

export function SharedBatchActionBar({
  selectedCount,
  actions,
  onClearSelection,
}: SharedBatchActionBarProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border rounded-md text-sm">
      <span className="font-medium">已选择 {selectedCount} 条</span>
      <div className="h-4 w-px bg-border" />
      {actions.map((action) => (
        <Button
          key={action.label}
          variant="ghost"
          size="sm"
          className={`h-7 text-xs gap-1 ${action.variant === "destructive" ? "text-destructive hover:text-destructive" : ""}`}
          onClick={action.onClick}
        >
          {action.icon}
          {action.label}
        </Button>
      ))}
      <div className="h-4 w-px bg-border" />
      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onClearSelection}>
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
