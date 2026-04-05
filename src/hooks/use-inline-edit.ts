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

  const startEditing = useCallback((recordId: string, fieldKey: string) => {
    setEditingCell({ recordId, fieldKey });
  }, []);

  const commitEdit = useCallback(
    async (value: unknown) => {
      if (!editingCell || isCommitting) return;

      setIsCommitting(true);
      try {
        await onCommitRef.current(editingCell.recordId, editingCell.fieldKey, value);
        setEditingCell(null);
      } catch (error) {
        console.error("内联编辑保存失败:", error);
        // Keep editing on error so user can retry
      } finally {
        setIsCommitting(false);
      }
    },
    [editingCell, isCommitting]
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
