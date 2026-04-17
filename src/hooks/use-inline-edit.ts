"use client";

import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";

export interface EditingCell {
  recordId: string;
  fieldKey: string;
}

export interface UseInlineEditOptions {
  tableId: string;
  onCommit: (recordId: string, fieldKey: string, value: unknown) => Promise<void>;
  isCellLockedByOther?: (recordId: string, fieldKey: string) => boolean;
  getLockOwner?: (recordId: string, fieldKey: string) => { userId: string; userName: string } | null;
  acquireCellLock?: (recordId: string, fieldKey: string) => Promise<{ acquired: boolean; lockedBy?: { userId: string; userName: string } }>;
  releaseCellLock?: (recordId: string, fieldKey: string) => Promise<void>;
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
  isCellLockedByOther,
  getLockOwner,
  acquireCellLock,
  releaseCellLock,
}: UseInlineEditOptions): UseInlineEditReturn {
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  const isCommittingRef = useRef(false);

  const startEditing = useCallback((recordId: string, fieldKey: string) => {
    if (isCellLockedByOther?.(recordId, fieldKey)) {
      const owner = getLockOwner?.(recordId, fieldKey);
      toast.error(`该单元格正在被 ${owner?.userName ?? "其他用户"} 编辑`);
      return;
    }
    if (acquireCellLock) {
      acquireCellLock(recordId, fieldKey).then((result) => {
        if (!result.acquired) {
          toast.error(`该单元格正在被 ${result.lockedBy?.userName ?? "其他用户"} 编辑`);
          return;
        }
        setEditingCell({ recordId, fieldKey });
      });
      return;
    }
    setEditingCell({ recordId, fieldKey });
  }, [isCellLockedByOther, getLockOwner, acquireCellLock]);

  const commitEdit = useCallback(
    async (value: unknown) => {
      if (!editingCell || isCommittingRef.current) return;

      const currentCell = editingCell;
      isCommittingRef.current = true;
      setIsCommitting(true);
      try {
        await onCommitRef.current(currentCell.recordId, currentCell.fieldKey, value);
        setEditingCell((prev) =>
          prev?.recordId === currentCell.recordId && prev?.fieldKey === currentCell.fieldKey
            ? null
            : prev
        );
      } catch (error) {
        console.error("内联编辑保存失败:", error);
      } finally {
        await releaseCellLock?.(currentCell.recordId, currentCell.fieldKey);
        isCommittingRef.current = false;
        setIsCommitting(false);
      }
    },
    [editingCell, releaseCellLock]
  );

  const cancelEdit = useCallback(() => {
    const cell = editingCell;
    setEditingCell(null);
    if (cell) {
      releaseCellLock?.(cell.recordId, cell.fieldKey);
    }
  }, [editingCell, releaseCellLock]);

  return {
    editingCell,
    startEditing,
    commitEdit,
    cancelEdit,
    isCommitting,
  };
}
