"use client";

import { Button } from "@/components/ui/button";

export type TimelineScale = "week" | "month" | "quarter";

interface TimelineOptionsProps {
  scale: TimelineScale;
  onScaleChange: (scale: TimelineScale) => void;
}

const OPTIONS: Array<{ value: TimelineScale; label: string }> = [
  { value: "week", label: "周" },
  { value: "month", label: "月" },
  { value: "quarter", label: "季度" },
];

export function TimelineOptions({ scale, onScaleChange }: TimelineOptionsProps) {
  return (
    <div className="flex items-center gap-1 rounded-md border p-1">
      {OPTIONS.map((option) => (
        <Button
          key={option.value}
          type="button"
          variant={scale === option.value ? "secondary" : "ghost"}
          size="sm"
          data-active={scale === option.value}
          onClick={() => onScaleChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
