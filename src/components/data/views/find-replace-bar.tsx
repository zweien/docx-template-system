"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, ChevronUp, ChevronDown, Replace } from "lucide-react";
import { formatCellText } from "@/lib/format-cell";
import type { DataFieldItem } from "@/types/data-table";
import { FieldType } from "@/generated/prisma/enums";

/** Field types where find-replace should not write back */
const SKIP_REPLACE_TYPES: Set<string> = new Set([
  FieldType.RELATION,
  FieldType.RELATION_SUBTABLE,
  FieldType.COUNT,
  FieldType.LOOKUP,
  FieldType.ROLLUP,
  FieldType.FORMULA,
  FieldType.FILE,
  FieldType.BOOLEAN,
]);

interface FindResult {
  /** Index in flatRecords (the full array including group rows) */
  flatRowIndex: number;
  /** Index in orderedVisibleFields */
  colIndex: number;
  recordId: string;
  fieldKey: string;
}

function isSameResult(a: FindResult, b: FindResult) {
  return (
    a.flatRowIndex === b.flatRowIndex &&
    a.colIndex === b.colIndex &&
    a.recordId === b.recordId &&
    a.fieldKey === b.fieldKey
  );
}

function isSameResultsArray(a: FindResult[], b: FindResult[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!isSameResult(a[i], b[i])) return false;
  }
  return true;
}

interface FindReplaceBarProps {
  open: boolean;
  onClose: () => void;
  /** Full flatRecords array — each entry is null for group rows, or { id, data } for data rows */
  rows: Array<{ id: string; data: Record<string, unknown> } | null>;
  fieldKeys: string[];
  fields: DataFieldItem[];
  onNavigateTo: (flatRowIndex: number, colIndex: number) => void;
  onReplace: (recordId: string, fieldKey: string, newValue: string) => void;
}

export function FindReplaceBar({
  open,
  onClose,
  rows,
  fieldKeys,
  fields,
  onNavigateTo,
  onReplace,
}: FindReplaceBarProps) {
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [showReplace, setShowReplace] = useState(false);
  const [results, setResults] = useState<FindResult[]>([]);
  const [currentIdx, setCurrentIdx] = useState(-1);
  const findInputRef = useRef<HTMLInputElement>(null);
  const onNavigateToRef = useRef(onNavigateTo);

  useEffect(() => {
    onNavigateToRef.current = onNavigateTo;
  }, [onNavigateTo]);

  // Build field map for lookup during search
  const fieldMap = useMemo(() => {
    const map = new Map<string, DataFieldItem>();
    for (const field of fields) {
      map.set(field.key, field);
    }
    return map;
  }, [fields]);

  // Perform search — rows[] is indexed identically to flatRecords
  const doSearch = useCallback(
    (query: string) => {
      if (!query) {
        setResults((prev) => (prev.length === 0 ? prev : []));
        setCurrentIdx((prev) => (prev === -1 ? prev : -1));
        return;
      }
      const lower = query.toLowerCase();
      const found: FindResult[] = [];
      for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        if (!row?.data) continue; // skip group rows / nulls
        for (let c = 0; c < fieldKeys.length; c++) {
          const fieldKey = fieldKeys[c];
          const field = fieldMap.get(fieldKey);
          const rawValue = row.data[fieldKey];
          // Use formatCellText to get searchable text that matches display
          const val = field ? formatCellText(field, rawValue) : String(rawValue ?? "");
          if (val.toLowerCase().includes(lower)) {
            found.push({ flatRowIndex: r, colIndex: c, recordId: row.id, fieldKey: fieldKey });
          }
        }
      }
      setResults((prev) => (isSameResultsArray(prev, found) ? prev : found));
      setCurrentIdx((prev) => {
        const next = found.length > 0 ? 0 : -1;
        return prev === next ? prev : next;
      });
    },
    [rows, fieldKeys, fieldMap]
  );

  // Search on text change
  useEffect(() => {
    doSearch(findText);
  }, [findText, doSearch]);

  // Navigate to current result
  useEffect(() => {
    if (currentIdx >= 0 && currentIdx < results.length) {
      const r = results[currentIdx];
      onNavigateToRef.current(r.flatRowIndex, r.colIndex);
    }
  }, [currentIdx, results]);

  // Focus input on open / reset on close
  useEffect(() => {
    if (open) {
      setTimeout(() => findInputRef.current?.focus(), 50);
    } else {
      setFindText("");
      setReplaceText("");
      setShowReplace(false);
      setResults([]);
      setCurrentIdx(-1);
    }
  }, [open]);

  const goNext = useCallback(() => {
    if (results.length === 0) return;
    setCurrentIdx((prev) => (prev + 1) % results.length);
  }, [results]);

  const goPrev = useCallback(() => {
    if (results.length === 0) return;
    setCurrentIdx((prev) => (prev - 1 + results.length) % results.length);
  }, [results]);

  const handleReplaceCurrent = useCallback(() => {
    if (currentIdx < 0 || currentIdx >= results.length) return;
    const r = results[currentIdx];
    const row = rows[r.flatRowIndex];
    if (!row) return;
    const field = fieldMap.get(r.fieldKey);
    if (field && SKIP_REPLACE_TYPES.has(field.type)) return;
    const displayVal = field ? formatCellText(field, row.data[r.fieldKey]) : String(row.data[r.fieldKey] ?? "");
    const newVal = displayVal.replace(new RegExp(escapeRegex(findText), "gi"), replaceText);
    onReplace(r.recordId, r.fieldKey, newVal);
    setTimeout(() => doSearch(findText), 100);
  }, [currentIdx, results, rows, fieldMap, findText, replaceText, onReplace, doSearch]);

  const handleReplaceAll = useCallback(() => {
    for (const r of results) {
      const row = rows[r.flatRowIndex];
      if (!row) continue;
      const field = fieldMap.get(r.fieldKey);
      if (field && SKIP_REPLACE_TYPES.has(field.type)) continue;
      const displayVal = field ? formatCellText(field, row.data[r.fieldKey]) : String(row.data[r.fieldKey] ?? "");
      const newVal = displayVal.replace(new RegExp(escapeRegex(findText), "gi"), replaceText);
      if (displayVal !== newVal) {
        onReplace(r.recordId, r.fieldKey, newVal);
      }
    }
    setTimeout(() => doSearch(findText), 100);
  }, [results, rows, fieldMap, findText, replaceText, onReplace, doSearch]);

  // Keyboard: Enter = next, Shift+Enter = prev, Escape = close
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) goPrev();
        else goNext();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [goNext, goPrev, onClose]
  );

  if (!open) return null;

  return (
    <div
      className="fixed bottom-3 left-2 right-2 z-50 rounded-lg border bg-background p-2 shadow-lg md:bottom-auto md:left-auto md:right-4 md:top-20 md:w-[420px]"
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={() => setShowReplace(!showReplace)}
          title="替换"
        >
          <Replace className="h-3 w-3" />
        </Button>
        <Input
          ref={findInputRef}
          value={findText}
          onChange={(e) => setFindText(e.target.value)}
          placeholder="查找..."
          className="h-7 text-sm flex-1"
        />
        <span className="text-xs text-muted-foreground whitespace-nowrap min-w-[60px] text-center">
          {results.length > 0 ? `${currentIdx + 1}/${results.length}` : findText ? "0/0" : ""}
        </span>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={goPrev} disabled={results.length === 0}>
          <ChevronUp className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={goNext} disabled={results.length === 0}>
          <ChevronDown className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onClose}>
          <X className="h-3 w-3" />
        </Button>
      </div>
      {showReplace && (
        <div className="flex items-center gap-1">
          <div className="w-6 shrink-0" />
          <Input
            value={replaceText}
            onChange={(e) => setReplaceText(e.target.value)}
            placeholder="替换为..."
            className="h-7 text-sm flex-1"
          />
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs px-2"
            onClick={handleReplaceCurrent}
            disabled={currentIdx < 0}
          >
            替换
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs px-2"
            onClick={handleReplaceAll}
            disabled={results.length === 0}
          >
            全部
          </Button>
        </div>
      )}
    </div>
  );
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
