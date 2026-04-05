"use client";

import { useRef, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

interface FileCellEditorProps {
  initialValue: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}

export function FileCellEditor({ initialValue, onCommit, onCancel }: FileCellEditorProps) {
  const [draft, setDraft] = useState(initialValue);
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
        if (e.key === "Enter") { e.preventDefault(); onCommit(draft); }
        if (e.key === "Escape") { e.preventDefault(); onCancel(); }
        if (e.key === "Tab") { e.preventDefault(); onCommit(draft); }
      }}
      onBlur={() => onCommit(draft)}
      placeholder="文件路径..."
      className="h-8 text-sm border-primary w-[100px]"
    />
  );
}
