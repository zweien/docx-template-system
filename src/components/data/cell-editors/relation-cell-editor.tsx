"use client";

import { useRef, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

interface RelationCellEditorProps {
  value: string | null;
  onCommit: (value: string | null) => void;
  onCancel: () => void;
}

export function RelationCellEditor({ value, onCommit, onCancel }: RelationCellEditorProps) {
  const [draft, setDraft] = useState(value ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <Input
      ref={inputRef}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); onCommit(draft || null); }
        if (e.key === "Escape") { e.preventDefault(); onCancel(); }
      }}
      onBlur={() => onCommit(draft || null)}
      className="h-8 text-sm border-primary"
      placeholder="输入关联记录 ID..."
    />
  );
}
