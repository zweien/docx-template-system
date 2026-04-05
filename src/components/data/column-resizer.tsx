"use client";

import { useCallback } from "react";

const MIN_WIDTH = 60;
const MAX_WIDTH = 600;

interface ColumnResizerProps {
  fieldKey: string;
  currentWidth: number;
  onWidthChange: (fieldKey: string, newWidth: number) => void;
  onDoubleClick: (fieldKey: string) => void;
}

export function ColumnResizer({
  fieldKey,
  currentWidth,
  onWidthChange,
  onDoubleClick,
}: ColumnResizerProps) {
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const startX = e.clientX;
      const startWidth = currentWidth;

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX;
        const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta));
        onWidthChange(fieldKey, newWidth);
      };

      const handleMouseUp = () => {
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [fieldKey, currentWidth, onWidthChange]
  );

  const handleDblClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onDoubleClick(fieldKey);
    },
    [fieldKey, onDoubleClick]
  );

  return (
    <div
      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 active:bg-primary transition-colors"
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDblClick}
    />
  );
}
