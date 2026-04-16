"use client";

import { useRef, useState, useCallback, useMemo } from "react";
import { Textarea } from "@/components/ui/textarea";
import type { DataFieldItem } from "@/types/data-table";
import { ALL_FUNCTIONS, FUNCTION_CATALOG, type FunctionEntry } from "@/lib/formula/function-catalog";

interface FormulaEditorProps {
  initialValue: string;
  fields: DataFieldItem[];
  onChange: (formula: string) => void;
  error?: string | null;
  livePreview?: unknown;
}

const TYPE_LABELS: Record<string, string> = {
  number: "数字",
  string: "文本",
  boolean: "布尔",
  date: "日期",
  any: "任意",
};

export function FormulaEditor({
  initialValue,
  fields,
  onChange,
  error,
  livePreview,
}: FormulaEditorProps) {
  const [draft, setDraft] = useState(initialValue);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerFilter, setPickerFilter] = useState("");
  const [pickerMode, setPickerMode] = useState<"field" | "function">("field");
  const [showRef, setShowRef] = useState(false);
  const [selectedFn, setSelectedFn] = useState<FunctionEntry | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const editableFields = useMemo(
    () => fields.filter((f) => f.type !== "FORMULA" && f.type !== "RELATION_SUBTABLE"),
    [fields]
  );

  // Filtered items for the picker
  const filteredFields = useMemo(() => {
    if (!pickerFilter) return editableFields;
    const q = pickerFilter.toLowerCase();
    return editableFields.filter(
      (f) => f.key.toLowerCase().includes(q) || f.label.toLowerCase().includes(q)
    );
  }, [editableFields, pickerFilter]);

  const filteredFunctions = useMemo(() => {
    if (!pickerFilter) return Array.from(ALL_FUNCTIONS.values());
    const q = pickerFilter.toUpperCase();
    return Array.from(ALL_FUNCTIONS.values()).filter((fn) =>
      fn.name.startsWith(q)
    );
  }, [pickerFilter]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "{" ) {
        e.preventDefault();
        setPickerMode("field");
        setPickerFilter("");
        setShowPicker(true);
      }
      if (e.key === "Escape") {
        setShowPicker(false);
      }
    },
    []
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setDraft(value);
      onChange(value);

      // Detect function name being typed (uppercase letters before cursor)
      const cursorPos = e.target.selectionStart ?? value.length;
      const textBeforeCursor = value.slice(0, cursorPos);
      const fnMatch = textBeforeCursor.match(/([A-Z][A-Z_]{1,})$/);
      if (fnMatch) {
        const matching = Array.from(ALL_FUNCTIONS.keys()).filter((name) =>
          name.startsWith(fnMatch[1])
        );
        if (matching.length > 0 && fnMatch[1].length >= 2) {
          setPickerMode("function");
          setPickerFilter(fnMatch[1]);
          setShowPicker(true);
          return;
        }
      }

      // If inside { }, switch to field mode
      const lastOpenBrace = textBeforeCursor.lastIndexOf("{");
      const lastCloseBrace = textBeforeCursor.lastIndexOf("}");
      if (lastOpenBrace > lastCloseBrace) {
        const innerText = textBeforeCursor.slice(lastOpenBrace + 1).trim();
        setPickerMode("field");
        setPickerFilter(innerText);
        setShowPicker(true);
      } else {
        setShowPicker(false);
      }
    },
    [onChange]
  );

  const insertField = useCallback(
    (field: DataFieldItem) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const cursorPos = textarea.selectionStart ?? draft.length;
      const textBeforeCursor = draft.slice(0, cursorPos);
      const textAfterCursor = draft.slice(cursorPos);

      // If inside { }, replace from the { to cursor
      const lastOpenBrace = textBeforeCursor.lastIndexOf("{");
      let newDraft: string;
      let newPos: number;

      if (lastOpenBrace >= 0) {
        newDraft =
          draft.slice(0, lastOpenBrace) +
          `{ ${field.key} }` +
          textAfterCursor;
        newPos = lastOpenBrace + field.key.length + 4;
      } else {
        newDraft = draft.slice(0, cursorPos) + `{ ${field.key} }` + textAfterCursor;
        newPos = cursorPos + field.key.length + 4;
      }

      setDraft(newDraft);
      onChange(newDraft);
      setShowPicker(false);
      setTimeout(() => {
        textarea.setSelectionRange(newPos, newPos);
        textarea.focus();
      }, 0);
    },
    [draft, onChange]
  );

  const insertFunction = useCallback(
    (fn: { name: string }) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const cursorPos = textarea.selectionStart ?? draft.length;
      const textBeforeCursor = draft.slice(0, cursorPos);
      const textAfterCursor = draft.slice(cursorPos);

      // If typing a function name prefix, replace it
      const fnMatch = textBeforeCursor.match(/([A-Z][A-Z_]{1,})$/);
      let newDraft: string;
      let newPos: number;

      if (fnMatch) {
        const start = cursorPos - fnMatch[1].length;
        newDraft = draft.slice(0, start) + `${fn.name}()` + textAfterCursor;
        newPos = start + fn.name.length + 1; // cursor between ()
      } else {
        newDraft = draft.slice(0, cursorPos) + `${fn.name}()` + textAfterCursor;
        newPos = cursorPos + fn.name.length + 1;
      }

      setDraft(newDraft);
      onChange(newDraft);
      setShowPicker(false);
      setTimeout(() => {
        textarea.setSelectionRange(newPos, newPos);
        textarea.focus();
      }, 0);
    },
    [draft, onChange]
  );

  const insertFromRef = useCallback(
    (fn: { name: string }) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const cursorPos = textarea.selectionStart ?? draft.length;
      const newDraft =
        draft.slice(0, cursorPos) + `${fn.name}()` + draft.slice(cursorPos);
      const newPos = cursorPos + fn.name.length + 1;
      setDraft(newDraft);
      onChange(newDraft);
      setTimeout(() => {
        textarea.setSelectionRange(newPos, newPos);
        textarea.focus();
      }, 0);
    },
    [draft, onChange]
  );

  return (
    <div className="space-y-2">
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={draft}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder='例: { price } * { quantity } 或 SUM(field1, field2)'
          className={`font-mono text-sm min-h-[80px] ${error ? "border-red-500" : ""}`}
          rows={3}
        />

        {/* Autocomplete picker */}
        {showPicker && (
          <div className="absolute z-50 top-full mt-1 w-80 max-h-52 overflow-auto border rounded-md bg-background shadow-lg">
            <div className="p-1.5 border-b">
              <input
                placeholder={pickerMode === "field" ? "搜索字段..." : "搜索函数..."}
                value={pickerFilter}
                onChange={(e) => setPickerFilter(e.target.value)}
                className="w-full h-6 text-xs bg-transparent outline-none"
                autoFocus
              />
            </div>

            {pickerMode === "field" ? (
              filteredFields.length > 0 ? (
                filteredFields.map((field) => (
                  <button
                    key={field.key}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted/50 flex items-center gap-2"
                    onClick={() => insertField(field)}
                  >
                    <span className="font-mono text-xs text-muted-foreground">
                      {field.key}
                    </span>
                    <span>{field.label}</span>
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  无匹配字段
                </div>
              )
            ) : filteredFunctions.length > 0 ? (
              filteredFunctions.map((fn) => (
                <button
                  key={fn.name}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted/50"
                  onClick={() => insertFunction(fn)}
                >
                  <div className="flex items-baseline gap-1">
                    <span className="font-mono font-medium">{fn.name}</span>
                    <span className="text-xs text-muted-foreground truncate">
                      {fn.syntax.replace(fn.name, "")}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground block">
                    {fn.description}
                  </span>
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                无匹配函数
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error */}
      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* Live preview */}
      {livePreview !== undefined && !error && (
        <p className="text-xs text-muted-foreground">
          预览结果: {String(livePreview)}
        </p>
      )}

      {/* Function reference */}
      <div className="rounded-md border">
        <button
          type="button"
          className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/30"
          onClick={() => {
            setShowRef(!showRef);
            if (showRef) setSelectedFn(null);
          }}
        >
          <span>函数参考</span>
          <span>{showRef ? "▴" : "▾"}</span>
        </button>
        {showRef && (
          <div className="border-t px-3 py-2 max-h-64 overflow-y-auto">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              {FUNCTION_CATALOG.map((cat) => (
                <div key={cat.label}>
                  <p className="font-medium text-muted-foreground mb-0.5">
                    {cat.label}
                  </p>
                  {cat.functions.map((fn) => (
                    <button
                      key={fn.name}
                      type="button"
                      className={`block w-full text-left rounded px-1 py-0.5 ${
                        selectedFn?.name === fn.name
                          ? "bg-muted font-medium text-foreground"
                          : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                      }`}
                      onClick={() =>
                        setSelectedFn(selectedFn?.name === fn.name ? null : fn)
                      }
                    >
                      <span className="font-mono">{fn.name}</span>
                      <span className="ml-1">{fn.description}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>

            {/* Detail panel */}
            {selectedFn && (
              <div className="mt-2 pt-2 border-t text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="font-mono font-medium text-sm">{selectedFn.syntax}</p>
                  <button
                    type="button"
                    className="text-primary hover:underline shrink-0 ml-2"
                    onClick={() => insertFromRef(selectedFn)}
                  >
                    插入
                  </button>
                </div>
                <p className="text-muted-foreground">{selectedFn.description}</p>
                {selectedFn.params.length > 0 && (
                  <div>
                    <p className="font-medium mb-0.5">参数:</p>
                    <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                      {selectedFn.params.map((p) => (
                        <li key={p.name}>
                          <span className="font-mono text-foreground">{p.name}</span>
                          <span className="ml-1">
                            ({TYPE_LABELS[p.type]}{p.optional ? "，可选" : ""}{p.repeated ? "，可重复" : ""})
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <p>
                  返回: <span className="text-muted-foreground">{TYPE_LABELS[selectedFn.returnType]}</span>
                </p>
                {selectedFn.example && (
                  <div>
                    <p className="font-medium mb-0.5">示例:</p>
                    <p className="font-mono bg-muted/30 rounded px-1.5 py-0.5">
                      {selectedFn.example}
                      {selectedFn.exampleResult && (
                        <span className="text-muted-foreground ml-1">
                          = {selectedFn.exampleResult}
                        </span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
