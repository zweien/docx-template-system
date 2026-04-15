"use client";

import { useEffect, useRef } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SelectOption } from "@/types/data-table";

interface SelectCellEditorProps {
  value: string;
  options: SelectOption[];
  onCommit: (value: string) => void;
  onCancel: () => void;
}

export function SelectCellEditor({ value, options, onCommit, onCancel }: SelectCellEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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
            <SelectItem key={option.label} value={option.label}>
              <span className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: option.color }}
                />
                {option.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
