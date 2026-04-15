"use client";

import { useRef, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import type { SelectOption } from "@/types/data-table";

interface MultiselectCellEditorProps {
  value: string[];
  options: SelectOption[];
  onCommit: (value: string[]) => void;
  onCancel: () => void;
}

export function MultiselectCellEditor({
  value,
  options,
  onCommit,
  onCancel,
}: MultiselectCellEditorProps) {
  const [selected, setSelected] = useState<string[]>(value ?? []);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const colorMap = new Map(options.map((o) => [o.label, o.color]));

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const availableOptions = options.filter((o) => !selected.includes(o.label));

  return (
    <div className="relative flex flex-wrap gap-1 p-1 border border-primary rounded bg-background min-w-[200px]">
      {selected.map((item) => (
        <span
          key={item}
          className="inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium gap-0.5"
          style={{ backgroundColor: colorMap.get(item) ?? "#f3f4f6" }}
        >
          {item}
          <button
            type="button"
            className="ml-0.5 hover:text-destructive"
            onClick={() => setSelected(selected.filter((s) => s !== item))}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <Input
        ref={inputRef}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const match = availableOptions.find(
              (o) => o.label.toLowerCase() === inputValue.toLowerCase()
            );
            if (inputValue && match) {
              setSelected([...selected, match.label]);
              setInputValue("");
            }
          }
          if (e.key === "Escape") { e.preventDefault(); onCancel(); }
          if (e.key === "Backspace" && !inputValue && selected.length > 0) {
            setSelected(selected.slice(0, -1));
          }
        }}
        onBlur={() => onCommit(selected)}
        placeholder={selected.length === 0 ? "输入选项..." : ""}
        className="h-6 text-xs border-0 p-0 flex-1 min-w-[80px] focus-visible:ring-0"
      />
      {inputValue && availableOptions.filter((o) => o.label.toLowerCase().includes(inputValue.toLowerCase())).length > 0 && (
        <div className="absolute top-full left-0 mt-1 bg-background border rounded shadow-md z-50 max-h-32 overflow-auto">
          {availableOptions
            .filter((o) => o.label.toLowerCase().includes(inputValue.toLowerCase()))
            .map((option) => (
              <button
                key={option.label}
                type="button"
                className="flex items-center gap-2 w-full text-left px-2 py-1 text-xs hover:bg-muted"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setSelected([...selected, option.label]);
                  setInputValue("");
                  inputRef.current?.focus();
                }}
              >
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: option.color }}
                />
                {option.label}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
