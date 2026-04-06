"use client";

import { useRef, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

interface UrlCellEditorProps {
  initialValue: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}

export function UrlCellEditor({ initialValue, onCommit, onCancel }: UrlCellEditorProps) {
  const [draft, setDraft] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleCommit = (value: string) => {
    if (value === "" || value === initialValue) {
      onCommit(value);
      return;
    }
    if (!/^https?:\/\/.+/.test(value)) {
      setError("请输入有效的 URL");
      return;
    }
    onCommit(value);
  };

  return (
    <div className="px-1">
      <Input
        ref={inputRef}
        value={draft}
        onChange={(e) => { setDraft(e.target.value); setError(null); }}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); handleCommit(draft); }
          if (e.key === "Escape") { e.preventDefault(); onCancel(); }
          if (e.key === "Tab") { e.preventDefault(); handleCommit(draft); }
        }}
        onBlur={() => handleCommit(draft)}
        placeholder="https://..."
        className={`h-8 text-sm ${error ? "border-red-500" : "border-primary"}`}
      />
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  );
}
