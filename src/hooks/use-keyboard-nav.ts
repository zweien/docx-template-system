"use client";

import { useCallback, useRef } from "react";

export interface ActiveCell {
  rowIndex: number;
  colIndex: number;
}

interface UseKeyboardNavOptions {
  rowCount: number;
  colCount: number;
  editingCell: unknown | null;
  onMoveTo: (cell: ActiveCell) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onClearCell: () => void;
  onCopyCell: () => string | null;
  onPasteCell: (text: string) => void;
  isGroupRow?: (rowIndex: number) => boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onEditNavigate?: (direction: "left" | "right" | "down") => void;
}

export function useKeyboardNav({
  rowCount,
  colCount,
  editingCell,
  onMoveTo,
  onStartEdit,
  onCancelEdit,
  onClearCell,
  onCopyCell,
  onPasteCell,
  isGroupRow,
  onUndo,
  onRedo,
  onEditNavigate,
}: UseKeyboardNavOptions) {
  const activeCellRef = useRef<ActiveCell | null>(null);

  const setActiveCell = useCallback((cell: ActiveCell | null) => {
    activeCellRef.current = cell;
  }, []);

  const skipGroupRow = useCallback(
    (targetRow: number, direction: 1 | -1): number => {
      let row = targetRow;
      while (row >= 0 && row < rowCount) {
        if (!isGroupRow?.(row)) return row;
        row += direction;
      }
      return targetRow;
    },
    [rowCount, isGroupRow]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "z") {
        e.preventDefault();
        onUndo?.();
        return;
      }
      if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "Z") || ((e.ctrlKey || e.metaKey) && e.key === "y")) {
        e.preventDefault();
        onRedo?.();
        return;
      }

      if (editingCell) {
        // During editing, handle Tab/Enter for navigation after commit
        if (e.key === "Tab") {
          e.preventDefault();
          onEditNavigate?.(e.shiftKey ? "left" : "right");
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          onEditNavigate?.("down");
          return;
        }
        return;
      }

      const active = activeCellRef.current;

      // Arrow keys initialize activeCell
      if (
        !active &&
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
      ) {
        const startRow = skipGroupRow(0, 1);
        activeCellRef.current = { rowIndex: startRow, colIndex: 0 };
        onMoveTo(activeCellRef.current);
        e.preventDefault();
        return;
      }

      if (!active) return;

      const maxRow = rowCount - 1;
      const maxCol = colCount - 1;

      switch (e.key) {
        case "ArrowUp": {
          const next = skipGroupRow(active.rowIndex - 1, -1);
          if (next >= 0) {
            activeCellRef.current = { ...active, rowIndex: next };
            onMoveTo(activeCellRef.current);
          }
          e.preventDefault();
          break;
        }
        case "ArrowDown": {
          const next = skipGroupRow(active.rowIndex + 1, 1);
          if (next <= maxRow) {
            activeCellRef.current = { ...active, rowIndex: next };
            onMoveTo(activeCellRef.current);
          }
          e.preventDefault();
          break;
        }
        case "ArrowRight":
          if (active.colIndex < maxCol) {
            activeCellRef.current = {
              ...active,
              colIndex: active.colIndex + 1,
            };
          } else if (active.rowIndex < maxRow) {
            const next = skipGroupRow(active.rowIndex + 1, 1);
            activeCellRef.current = { rowIndex: next, colIndex: 0 };
          }
          onMoveTo(activeCellRef.current!);
          e.preventDefault();
          break;
        case "ArrowLeft":
          if (active.colIndex > 0) {
            activeCellRef.current = {
              ...active,
              colIndex: active.colIndex - 1,
            };
          } else if (active.rowIndex > 0) {
            const next = skipGroupRow(active.rowIndex - 1, -1);
            activeCellRef.current = { rowIndex: next, colIndex: maxCol };
          }
          onMoveTo(activeCellRef.current!);
          e.preventDefault();
          break;
        case "Tab":
          if (e.shiftKey) {
            if (active.colIndex > 0) {
              activeCellRef.current = {
                ...active,
                colIndex: active.colIndex - 1,
              };
            } else if (active.rowIndex > 0) {
              const next = skipGroupRow(active.rowIndex - 1, -1);
              activeCellRef.current = { rowIndex: next, colIndex: maxCol };
            }
          } else {
            if (active.colIndex < maxCol) {
              activeCellRef.current = {
                ...active,
                colIndex: active.colIndex + 1,
              };
            } else if (active.rowIndex < maxRow) {
              const next = skipGroupRow(active.rowIndex + 1, 1);
              activeCellRef.current = { rowIndex: next, colIndex: 0 };
            }
          }
          onMoveTo(activeCellRef.current!);
          e.preventDefault();
          break;
        case "Enter":
        case "F2":
          onStartEdit();
          e.preventDefault();
          break;
        case "Escape":
          activeCellRef.current = null;
          onCancelEdit();
          e.preventDefault();
          break;
        case "Delete":
        case "Backspace":
          onClearCell();
          e.preventDefault();
          break;
        default:
          if ((e.ctrlKey || e.metaKey) && e.key === "c") {
            const text = onCopyCell();
            if (text !== null) navigator.clipboard.writeText(text);
            e.preventDefault();
          }
          if ((e.ctrlKey || e.metaKey) && e.key === "v") {
            navigator.clipboard
              .readText()
              .then((text) => {
                if (text) onPasteCell(text);
              })
              .catch(() => {});
            e.preventDefault();
          }
      }
    },
    [
      editingCell,
      rowCount,
      colCount,
      onMoveTo,
      onStartEdit,
      onCancelEdit,
      onClearCell,
      onCopyCell,
      onPasteCell,
      skipGroupRow,
      onUndo,
      onRedo,
      onEditNavigate,
    ]
  );

  return { handleKeyDown, setActiveCell };
}
