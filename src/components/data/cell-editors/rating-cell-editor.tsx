"use client";

import { useRef, useState, useCallback } from "react";

interface RatingCellEditorProps {
  initialValue: number | null;
  maxStars: number;
  allowHalf: boolean;
  onCommit: (value: number | null) => void;
  onCancel: () => void;
}

export function RatingCellEditor({
  initialValue,
  maxStars,
  allowHalf,
  onCommit,
  onCancel,
}: RatingCellEditorProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(initialValue);
  const committed = useRef(false);

  const commit = useCallback(
    (value: number | null) => {
      if (committed.current) return;
      committed.current = true;
      onCommit(value);
    },
    [onCommit]
  );

  const handleClick = (starIndex: number, e: React.MouseEvent<HTMLButtonElement>) => {
    let value: number;
    if (allowHalf) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      value = x < rect.width / 2 ? starIndex - 0.5 : starIndex;
    } else {
      value = starIndex;
    }

    if (value === selected) {
      setSelected(null);
      commit(null);
    } else {
      setSelected(value);
      commit(value);
    }
  };

  const handleBlur = useCallback(() => {
    commit(selected);
  }, [commit, selected]);

  const displayValue = hovered ?? selected ?? 0;

  return (
    <div
      className="flex items-center gap-0.5 h-8 px-1"
      tabIndex={0}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === "Escape") { e.preventDefault(); committed.current = true; onCancel(); }
        if (e.key === "Tab") { e.preventDefault(); commit(selected); }
      }}
    >
      {Array.from({ length: maxStars }, (_, i) => {
        const starIndex = i + 1;
        const filled = displayValue >= starIndex;
        const halfFilled = allowHalf && !filled && displayValue >= starIndex - 0.5;

        return (
          <button
            key={i}
            type="button"
            className="p-0 border-0 bg-transparent cursor-pointer"
            onClick={(e) => handleClick(starIndex, e)}
            onMouseEnter={() => setHovered(starIndex)}
            onMouseLeave={() => setHovered(null)}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill={filled ? "#f59e0b" : halfFilled ? "url(#half)" : "none"}
              stroke={filled || halfFilled ? "#f59e0b" : "#d1d5db"}
              strokeWidth="1"
            >
              {halfFilled && (
                <defs>
                  <linearGradient id="half">
                    <stop offset="50%" stopColor="#f59e0b" />
                    <stop offset="50%" stopColor="transparent" />
                  </linearGradient>
                </defs>
              )}
              <path d="M8 1l2.245 4.548 5.021.73-3.633 3.54.858 5.002L8 12.346 3.51 14.82l.858-5.002L.735 6.278l5.021-.73L8 1z" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
