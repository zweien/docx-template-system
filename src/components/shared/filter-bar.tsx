"use client";

import { cn } from "@/lib/utils";

interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

interface FilterBarProps {
  options: readonly FilterOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function FilterBar({ options, value, onChange, className }: FilterBarProps) {
  return (
    <div
      className={cn(
        "flex gap-1 overflow-x-auto rounded-lg border border-border bg-card p-1",
        className
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-[510] transition-colors",
            value === option.value
              ? "bg-accent/20 text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {option.label}
          {option.count !== undefined && (
            <span className="text-text-dim">{option.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
