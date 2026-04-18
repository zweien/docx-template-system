"use client";

import { useRef, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

interface CurrencyCellEditorProps {
  initialValue: string;
  currencySymbol: string;
  decimals: number;
  onCommit: (value: string) => void;
  onCancel: () => void;
}

const SYMBOLS: Record<string, string> = {
  CNY: "\u00a5",
  USD: "$",
  EUR: "\u20ac",
};

export function CurrencyCellEditor({
  initialValue,
  currencySymbol,
  decimals,
  onCommit,
  onCancel,
}: CurrencyCellEditorProps) {
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

  const symbol = SYMBOLS[currencySymbol] ?? currencySymbol;
  const step = decimals > 0 ? String(Math.pow(10, -decimals)) : "1";

  return (
    <div className="flex items-center h-8">
      <span className="px-1.5 text-sm text-muted-foreground bg-muted border border-r-0 border-primary rounded-l-md h-8 flex items-center">
        {symbol}
      </span>
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
        className="h-8 text-sm border-primary rounded-l-none w-[120px]"
      />
    </div>
  );
}
