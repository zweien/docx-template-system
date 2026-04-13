"use client";

import { useState, useCallback, useRef } from "react";

export interface EditingCell {
  recordId: string;
  fieldKey: string;
}

export interface UseInlineEditOptions {
  tableId: string;
  onCommit: (recordId: string, fieldKey: string, value: unknown) => Promise<void>;
}

export interface UseInlineEditReturn {
  editingCell: EditingCell | null;
  startEditing: (recordId: string, fieldKey: string) => void;
  commitEdit: (value: unknown) => Promise<void>;
  cancelEdit: () => void;
  isCommitting: boolean;
}

export function useInlineEdit({
  tableId: _tableId,
  onCommit,
}: UseInlineEditOptions): UseInlineEditReturn {
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  // Ref guard prevents double-commits from stale closures (e.g. onBlur during navigation)
  const isCommittingRef = useRef(false);

  const startEditing = useCallback((recordId: string, fieldKey: string) => {
    setEditingCell({ recordId, fieldKey });
  }, []);

  const commitEdit = useCallback(
    async (value: unknown) => {
      if (!editingCell || isCommittingRef.current) return;

      const currentCell = editingCell;
      isCommittingRef.current = true;
      setIsCommitting(true);
      try {
        await onCommitRef.current(currentCell.recordId, currentCell.fieldKey, value);
        // Only clear if editingCell hasn't been changed by navigation
        setEditingCell((prev) =>
          prev?.recordId === currentCell.recordId && prev?.fieldKey === currentCell.fieldKey
            ? null
            : prev
        );
      } catch (error) {
        console.error("内联编辑保存失败:", error);
        // Keep editing on error so user can retry
      } finally {
        isCommittingRef.current = false;
        setIsCommitting(false);
      }
    },
    [editingCell]
  );

  const cancelEdit = useCallback(() => {
    setEditingCell(null);
  }, []);

  return {
    editingCell,
    startEditing,
    commitEdit,
    cancelEdit,
    isCommitting,
  };
}
