"use client";

import { useCallback, useRef } from "react";

export interface ActiveCell {
  rowIndex: number;
  colIndex: number;
}

export interface CellRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
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
  onCopyRange?: (range: CellRange) => void;
  onPasteRange?: (text: string, startRow: number, startCol: number) => void;
  onSelectionChange?: (range: CellRange | null) => void;
  isGroupRow?: (rowIndex: number) => boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onEditNavigate?: (direction: "left" | "right" | "down") => void;
  onExpandRecord?: () => void;
  onInsertRowBelow?: () => void;
  onCutCell?: () => string | null;
  onDuplicateRow?: () => void;
  onInsertNowDate?: () => void;
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
  onCopyRange,
  onPasteRange,
  onSelectionChange,
  isGroupRow,
  onUndo,
  onRedo,
  onEditNavigate,
  onExpandRecord,
  onInsertRowBelow,
  onCutCell,
  onDuplicateRow,
  onInsertNowDate,
}: UseKeyboardNavOptions) {
  const activeCellRef = useRef<ActiveCell | null>(null);
  const selectionRangeRef = useRef<CellRange | null>(null);

  const setActiveCell = useCallback((cell: ActiveCell | null) => {
    activeCellRef.current = cell;
  }, []);

  const setSelectionRange = useCallback((range: CellRange | null) => {
    selectionRangeRef.current = range;
    onSelectionChange?.(range);
  }, [onSelectionChange]);

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
      const shift = e.shiftKey;
      const ctrl = e.ctrlKey || e.metaKey;

      // Helper: find edge row in a direction (skipping group rows)
      const findEdgeRow = (fromRow: number, dir: 1 | -1): number => {
        let row = fromRow;
        while (true) {
          const next = row + dir;
          if (next < 0 || next > maxRow) break;
          if (!isGroupRow?.(next)) row = next;
          else break; // stop at group boundary
          // For non-Ctrl: would stop here; for Ctrl: keep going
        }
        return row;
      };

      switch (e.key) {
        case "ArrowUp": {
          let next: number;
          if (ctrl) {
            // Jump to first data row
            for (let r = 0; r <= maxRow; r++) {
              if (!isGroupRow?.(r)) { next = r; break; }
            }
            next = next!;
          } else {
            next = skipGroupRow(active.rowIndex - 1, -1);
            if (next < 0) { e.preventDefault(); break; }
          }
          activeCellRef.current = { ...active, rowIndex: next! };
          if (shift) {
            const range = selectionRangeRef.current ?? { startRow: active.rowIndex, startCol: active.colIndex, endRow: active.rowIndex, endCol: active.colIndex };
            selectionRangeRef.current = { ...range, endRow: next! };
            onSelectionChange?.(selectionRangeRef.current);
          } else {
            setSelectionRange(null);
          }
          onMoveTo(activeCellRef.current);
          e.preventDefault();
          break;
        }
        case "ArrowDown": {
          let next: number;
          if (ctrl) {
            // Jump to last data row
            next = maxRow;
            for (let r = maxRow; r >= 0; r--) {
              if (!isGroupRow?.(r)) { next = r; break; }
            }
          } else {
            next = skipGroupRow(active.rowIndex + 1, 1);
            if (next > maxRow) { e.preventDefault(); break; }
          }
          activeCellRef.current = { ...active, rowIndex: next };
          if (shift) {
            const range = selectionRangeRef.current ?? { startRow: active.rowIndex, startCol: active.colIndex, endRow: active.rowIndex, endCol: active.colIndex };
            selectionRangeRef.current = { ...range, endRow: next };
            onSelectionChange?.(selectionRangeRef.current);
          } else {
            setSelectionRange(null);
          }
          onMoveTo(activeCellRef.current);
          e.preventDefault();
          break;
        }
        case "ArrowRight":
          if (ctrl) {
            activeCellRef.current = { ...active, colIndex: maxCol };
          } else if (active.colIndex < maxCol) {
            activeCellRef.current = { ...active, colIndex: active.colIndex + 1 };
          } else if (active.rowIndex < maxRow) {
            const next = skipGroupRow(active.rowIndex + 1, 1);
            activeCellRef.current = { rowIndex: next, colIndex: 0 };
          }
          if (shift) {
            const range = selectionRangeRef.current ?? { startRow: active.rowIndex, startCol: active.colIndex, endRow: active.rowIndex, endCol: active.colIndex };
            selectionRangeRef.current = { ...range, endRow: activeCellRef.current!.rowIndex, endCol: activeCellRef.current!.colIndex };
            onSelectionChange?.(selectionRangeRef.current);
          } else {
            setSelectionRange(null);
          }
          onMoveTo(activeCellRef.current!);
          e.preventDefault();
          break;
        case "ArrowLeft":
          if (ctrl) {
            activeCellRef.current = { ...active, colIndex: 0 };
          } else if (active.colIndex > 0) {
            activeCellRef.current = { ...active, colIndex: active.colIndex - 1 };
          } else if (active.rowIndex > 0) {
            const next = skipGroupRow(active.rowIndex - 1, -1);
            activeCellRef.current = { rowIndex: next, colIndex: maxCol };
          }
          if (shift) {
            const range = selectionRangeRef.current ?? { startRow: active.rowIndex, startCol: active.colIndex, endRow: active.rowIndex, endCol: active.colIndex };
            selectionRangeRef.current = { ...range, endRow: activeCellRef.current!.rowIndex, endCol: activeCellRef.current!.colIndex };
            onSelectionChange?.(selectionRangeRef.current);
          } else {
            setSelectionRange(null);
          }
          onMoveTo(activeCellRef.current!);
          e.preventDefault();
          break;
        case "Tab":
          setSelectionRange(null);
          if (e.shiftKey) {
            if (active.colIndex > 0) {
              activeCellRef.current = { ...active, colIndex: active.colIndex - 1 };
            } else if (active.rowIndex > 0) {
              const next = skipGroupRow(active.rowIndex - 1, -1);
              activeCellRef.current = { rowIndex: next, colIndex: maxCol };
            }
          } else {
            if (active.colIndex < maxCol) {
              activeCellRef.current = { ...active, colIndex: active.colIndex + 1 };
            } else if (active.rowIndex < maxRow) {
              const next = skipGroupRow(active.rowIndex + 1, 1);
              activeCellRef.current = { rowIndex: next, colIndex: 0 };
            }
          }
          onMoveTo(activeCellRef.current!);
          e.preventDefault();
          break;
        case "Enter":
          if (shift) {
            setSelectionRange(null);
            onInsertRowBelow?.();
            e.preventDefault();
            break;
          }
          setSelectionRange(null);
          onStartEdit();
          e.preventDefault();
          break;
        case "F2":
          setSelectionRange(null);
          onStartEdit();
          e.preventDefault();
          break;
        case " ":
          if (e.shiftKey) {
            onExpandRecord?.();
            e.preventDefault();
          }
          break;
        case "Escape":
          activeCellRef.current = null;
          setSelectionRange(null);
          onCancelEdit();
          e.preventDefault();
          break;
        case "Delete":
        case "Backspace":
          onClearCell();
          e.preventDefault();
          break;
        case ";":
          if (ctrl) {
            onInsertNowDate?.();
            e.preventDefault();
          }
          break;
        default:
          if ((e.ctrlKey || e.metaKey) && e.key === "c") {
            const range = selectionRangeRef.current;
            if (range && onCopyRange) {
              onCopyRange(range);
            } else {
              const text = onCopyCell();
              if (text !== null) navigator.clipboard.writeText(text);
            }
            e.preventDefault();
          }
          if ((e.ctrlKey || e.metaKey) && e.key === "x") {
            const range = selectionRangeRef.current;
            if (range && onCopyRange) {
              onCopyRange(range);
            } else {
              const text = onCutCell?.() ?? onCopyCell();
              if (text !== null) navigator.clipboard.writeText(text);
            }
            e.preventDefault();
          }
          if ((e.ctrlKey || e.metaKey) && e.key === "d") {
            onDuplicateRow?.();
            e.preventDefault();
          }
          if ((e.ctrlKey || e.metaKey) && e.key === "v") {
            navigator.clipboard
              .readText()
              .then((text) => {
                if (!text) return;
                const range = selectionRangeRef.current;
                if (range && onPasteRange) {
                  onPasteRange(text, Math.min(range.startRow, range.endRow), Math.min(range.startCol, range.endCol));
                } else if (onPasteRange && activeCellRef.current) {
                  onPasteRange(text, activeCellRef.current.rowIndex, activeCellRef.current.colIndex);
                } else {
                  onPasteCell(text);
                }
              })
              .catch(() => {});
            e.preventDefault();
          }
      }
    },
    [
      editingCell, rowCount, colCount, onMoveTo, onStartEdit, onCancelEdit,
      onClearCell, onCopyCell, onPasteCell, onCopyRange, onPasteRange,
      onSelectionChange, skipGroupRow, onUndo, onRedo, onEditNavigate,
      onExpandRecord, onInsertRowBelow, onCutCell, onDuplicateRow, onInsertNowDate, setSelectionRange,
    ]
  );

  return { handleKeyDown, setActiveCell, setSelectionRange };
}
