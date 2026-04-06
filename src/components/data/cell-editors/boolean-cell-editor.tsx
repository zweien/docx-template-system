"use client";

import { useEffect, useRef } from "react";

interface BooleanCellEditorProps {
  initialValue: boolean;
  onCommit: (value: boolean) => void;
}

export function BooleanCellEditor({ initialValue, onCommit }: BooleanCellEditorProps) {
  const newValue = !initialValue;
  const committed = useRef(false);

  useEffect(() => {
    if (!committed.current) {
      committed.current = true;
      onCommit(newValue);
    }
  }, [newValue, onCommit]);

  return (
    <div className="flex items-center justify-center h-8">
      <div
        className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
          newValue
            ? "bg-green-500 border-green-500"
            : "bg-white border-zinc-300"
        }`}
      >
        {newValue && (
          <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
            <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </div>
  );
}
