"use client";

import { useRef, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

interface PhoneCellEditorProps {
  initialValue: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}

export function PhoneCellEditor({ initialValue, onCommit, onCancel }: PhoneCellEditorProps) {
  const [draft, setDraft] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <Input
      ref={inputRef}
      type="tel"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); onCommit(draft); }
        if (e.key === "Escape") { e.preventDefault(); onCancel(); }
        if (e.key === "Tab") { e.preventDefault(); onCommit(draft); }
      }}
      onBlur={() => onCommit(draft)}
      className="h-8 text-sm border-primary w-[150px]"
    />
  );
}
