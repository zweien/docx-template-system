"use client";

import { useRef, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

interface DurationCellEditorProps {
  initialValue: string;
  format: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}

function secondsToDisplay(seconds: number, format: string): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (format === "hh:mm:ss") return `${pad(h)}:${pad(m)}:${pad(s)}`;
  if (format === "mm:ss") return `${pad(Math.floor(seconds / 60))}:${pad(s)}`;
  return `${pad(h)}:${pad(m)}`;
}

function parseDurationToSeconds(input: string, format: string): number | null {
  const cleaned = input.trim();
  if (!cleaned) return null;

  const parts = cleaned.split(":").map(Number);
  if (parts.some(isNaN)) return null;

  if (parts.length === 3) {
    const [h, m, s] = parts;
    return h * 3600 + m * 60 + s;
  }
  if (parts.length === 2) {
    const [a, b] = parts;
    if (format === "mm:ss") return a * 60 + b;
    return a * 3600 + b * 60;
  }
  const num = Number(cleaned);
  if (!isNaN(num)) return Math.round(num);
  return null;
}

export function DurationCellEditor({
  initialValue,
  format,
  onCommit,
  onCancel,
}: DurationCellEditorProps) {
  const initialSeconds = initialValue ? Number(initialValue) : 0;
  const initialDisplay = initialSeconds > 0 ? secondsToDisplay(initialSeconds, format) : "";

  const [draft, setDraft] = useState(initialDisplay);
  const inputRef = useRef<HTMLInputElement>(null);
  const committed = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleCommit = () => {
    if (committed.current) return;
    committed.current = true;
    const seconds = parseDurationToSeconds(draft, format);
    onCommit(seconds !== null ? String(seconds) : "");
  };

  const placeholder = format === "hh:mm:ss" ? "hh:mm:ss" : format === "mm:ss" ? "mm:ss" : "hh:mm";

  return (
    <Input
      ref={inputRef}
      type="text"
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); handleCommit(); }
        if (e.key === "Escape") { e.preventDefault(); onCancel(); }
        if (e.key === "Tab") { e.preventDefault(); handleCommit(); }
      }}
      onBlur={handleCommit}
      className="h-8 text-sm font-mono border-primary w-[120px]"
    />
  );
}
