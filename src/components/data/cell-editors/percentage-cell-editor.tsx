"use client";

import { useRef, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

interface PercentageCellEditorProps {
  initialValue: string;
  decimals: number;
  onCommit: (value: string) => void;
  onCancel: () => void;
}

export function PercentageCellEditor({
  initialValue,
  decimals,
  onCommit,
  onCancel,
}: PercentageCellEditorProps) {
  const [draft, setDraft] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const committed = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleCommit = () => {
    if (committed.current) return;
    committed.current = true;
    onCommit(draft);
  };

  const step = decimals > 0 ? String(Math.pow(10, -decimals)) : "1";

  return (
    <div className="flex items-center h-8">
      <Input
        ref={inputRef}
        type="number"
        step={step}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); handleCommit(); }
          if (e.key === "Escape") { e.preventDefault(); onCancel(); }
          if (e.key === "Tab") { e.preventDefault(); handleCommit(); }
        }}
        onBlur={handleCommit}
        className="h-8 text-sm border-primary rounded-r-none w-[100px]"
      />
      <span className="px-1.5 text-sm text-muted-foreground bg-muted border border-l-0 border-primary rounded-r-md h-8 flex items-center">
        %
      </span>
    </div>
  );
}
