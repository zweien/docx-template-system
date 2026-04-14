"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, ChevronUp, ChevronDown, Replace } from "lucide-react";

interface FindResult {
  rowIndex: number;
  colIndex: number;
}

interface FindReplaceBarProps {
  open: boolean;
  onClose: () => void;
  records: { id: string; data: Record<string, unknown> }[];
  fieldKeys: string[];
  isGroupRow?: (rowIndex: number) => boolean;
  onNavigateTo: (rowIndex: number, colIndex: number) => void;
  onReplace: (recordId: string, fieldKey: string, oldValue: string, newValue: string) => void;
}

export function FindReplaceBar({
  open,
  onClose,
  records,
  fieldKeys,
  isGroupRow,
  onNavigateTo,
  onReplace,
}: FindReplaceBarProps) {
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [showReplace, setShowReplace] = useState(false);
  const [results, setResults] = useState<FindResult[]>([]);
  const [currentIdx, setCurrentIdx] = useState(-1);
  const findInputRef = useRef<HTMLInputElement>(null);

  // Perform search
  const doSearch = useCallback(
    (query: string) => {
      if (!query) {
        setResults([]);
        setCurrentIdx(-1);
        return;
      }
      const lower = query.toLowerCase();
      const found: FindResult[] = [];
      for (let r = 0; r < records.length; r++) {
        if (isGroupRow?.(r)) continue;
        const record = records[r];
        if (!record?.data) continue;
        for (let c = 0; c < fieldKeys.length; c++) {
          const val = String(record.data[fieldKeys[c]] ?? "");
          if (val.toLowerCase().includes(lower)) {
            found.push({ rowIndex: r, colIndex: c });
          }
        }
      }
      setResults(found);
      setCurrentIdx(found.length > 0 ? 0 : -1);
    },
    [records, fieldKeys, isGroupRow]
  );

  // Search on text change
  useEffect(() => {
    doSearch(findText);
  }, [findText, doSearch]);

  // Navigate to current result
  useEffect(() => {
    if (currentIdx >= 0 && currentIdx < results.length) {
      const r = results[currentIdx];
      onNavigateTo(r.rowIndex, r.colIndex);
    }
  }, [currentIdx, results, onNavigateTo]);

  // Focus input on open
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
    const record = records[r.rowIndex];
    if (!record) return;
    const fieldKey = fieldKeys[r.colIndex];
    const oldVal = String(record.data[fieldKey] ?? "");
    const newVal = oldVal.replace(new RegExp(escapeRegex(findText), "gi"), replaceText);
    onReplace(record.id, fieldKey, oldVal, newVal);
    // Re-search after replace
    setTimeout(() => doSearch(findText), 100);
  }, [currentIdx, results, records, fieldKeys, findText, replaceText, onReplace, doSearch]);

  const handleReplaceAll = useCallback(() => {
    for (const r of results) {
      const record = records[r.rowIndex];
      if (!record) continue;
      const fieldKey = fieldKeys[r.colIndex];
      const oldVal = String(record.data[fieldKey] ?? "");
      const newVal = oldVal.replace(new RegExp(escapeRegex(findText), "gi"), replaceText);
      if (oldVal !== newVal) {
        onReplace(record.id, fieldKey, oldVal, newVal);
      }
    }
    setTimeout(() => doSearch(findText), 100);
  }, [results, records, fieldKeys, findText, replaceText, onReplace, doSearch]);

  // Keyboard shortcut: Enter = next, Shift+Enter = prev, Escape = close
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
      className="absolute top-0 right-0 z-50 bg-background border rounded-bl-lg shadow-lg p-2 flex flex-col gap-2 min-w-[360px]"
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
