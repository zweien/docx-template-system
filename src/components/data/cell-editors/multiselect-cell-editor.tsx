"use client";

import { useRef, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface MultiselectCellEditorProps {
  value: string[];
  options: string[];
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

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const availableOptions = options.filter((o) => !selected.includes(o));

  return (
    <div className="relative flex flex-wrap gap-1 p-1 border border-primary rounded bg-background min-w-[200px]">
      {selected.map((item) => (
        <Badge key={item} variant="secondary" className="text-xs gap-0.5">
          {item}
          <button
            type="button"
            className="ml-0.5 hover:text-destructive"
            onClick={() => setSelected(selected.filter((s) => s !== item))}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <Input
        ref={inputRef}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (inputValue && availableOptions.includes(inputValue)) {
              setSelected([...selected, inputValue]);
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
      {/* Autocomplete dropdown */}
      {inputValue && availableOptions.filter((o) => o.toLowerCase().includes(inputValue.toLowerCase())).length > 0 && (
        <div className="absolute top-full left-0 mt-1 bg-background border rounded shadow-md z-50 max-h-32 overflow-auto">
          {availableOptions
            .filter((o) => o.toLowerCase().includes(inputValue.toLowerCase()))
            .map((option) => (
              <button
                key={option}
                type="button"
                className="block w-full text-left px-2 py-1 text-xs hover:bg-muted"
                onMouseDown={(e) => {
                  e.preventDefault(); // prevent blur
                  setSelected([...selected, option]);
                  setInputValue("");
                  inputRef.current?.focus();
                }}
              >
                {option}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
