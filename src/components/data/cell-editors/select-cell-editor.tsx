"use client";

import { useEffect, useRef } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SelectCellEditorProps {
  value: string;
  options: string[];
  onCommit: (value: string) => void;
  onCancel: () => void;
}

export function SelectCellEditor({ value, options, onCommit, onCancel }: SelectCellEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-open on mount
    const trigger = containerRef.current?.querySelector("[data-radix-collection-item]");
    if (trigger) (trigger as HTMLElement).click();
  }, []);

  return (
    <div ref={containerRef} className="w-full">
      <Select
        value={value || undefined}
        onValueChange={(v) => {
          if (v) onCommit(v);
        }}
        onOpenChange={(open) => {
          if (!open) onCancel();
        }}
        defaultOpen
      >
        <SelectTrigger className="h-8 text-sm border-primary">
          <SelectValue placeholder="选择..." />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
