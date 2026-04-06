"use client";

import { useRef, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import type { DataFieldItem } from "@/types/data-table";

interface FormulaEditorProps {
  initialValue: string;
  fields: DataFieldItem[];
  onChange: (formula: string) => void;
  error?: string | null;
  livePreview?: unknown;
}

export function FormulaEditor({
  initialValue,
  fields,
  onChange,
  error,
  livePreview,
}: FormulaEditorProps) {
  const [draft, setDraft] = useState(initialValue);
  const [showFieldPicker, setShowFieldPicker] = useState(false);
  const [pickerFilter, setPickerFilter] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const editableFields = fields.filter(
    (f) => f.type !== "FORMULA" && f.type !== "RELATION_SUBTABLE"
  );

  const filteredFields = pickerFilter
    ? editableFields.filter(
        (f) =>
          f.key.toLowerCase().includes(pickerFilter.toLowerCase()) ||
          f.label.toLowerCase().includes(pickerFilter.toLowerCase())
      )
    : editableFields;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "{") {
        e.preventDefault();
        setShowFieldPicker(true);
        setPickerFilter("");
      }
      if (e.key === "Escape") {
        setShowFieldPicker(false);
      }
    },
    []
  );

  const insertField = useCallback(
    (field: DataFieldItem) => {
      const input = inputRef.current;
      if (!input) return;
      const cursorPos = input.selectionStart ?? draft.length;
      const newDraft =
        draft.slice(0, cursorPos) +
        `{ ${field.key} }` +
        draft.slice(cursorPos);
      setDraft(newDraft);
      onChange(newDraft);
      setShowFieldPicker(false);
      const newPos = cursorPos + field.key.length + 4;
      setTimeout(() => {
        input.setSelectionRange(newPos, newPos);
        input.focus();
      }, 0);
    },
    [draft, onChange]
  );

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            onChange(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          placeholder='例: { price } * { quantity }'
          className={`font-mono text-sm ${error ? "border-red-500" : ""}`}
        />
        {showFieldPicker && (
          <div className="absolute z-50 top-full mt-1 w-64 max-h-48 overflow-auto border rounded-md bg-background shadow-md">
            <div className="p-1">
              <Input
                placeholder="搜索字段..."
                value={pickerFilter}
                onChange={(e) => setPickerFilter(e.target.value)}
                className="h-7 text-xs"
                autoFocus
              />
            </div>
            {filteredFields.map((field) => (
              <button
                key={field.key}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted/50 flex items-center gap-2"
                onClick={() => insertField(field)}
              >
                <span className="font-mono text-xs text-muted-foreground">{field.key}</span>
                <span>{field.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      {livePreview !== undefined && !error && (
        <p className="text-xs text-muted-foreground">
          预览结果: {String(livePreview)}
        </p>
      )}
    </div>
  );
}
