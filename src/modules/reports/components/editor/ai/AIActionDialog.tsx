"use client";

import { useCallback } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { useEditorAIStore } from "./useEditorAIStore";
import { AIActionPopover } from "./AIActionPopover";
import { useAIActions } from "./useAIActions";

interface AIActionDialogProps {
  editor: any;
  onOpenSidebar: () => void;
  onEditAction: (action: any) => void;
  onCreateAction: () => void;
}

export function AIActionDialog({
  editor,
  onOpenSidebar,
  onEditAction,
  onCreateAction,
}: AIActionDialogProps) {
  const {
    actionDialogOpen,
    actionDialogSelection,
    actionDialogBlockIds,
    actionDialogContext,
    actionDialogExecuting,
    closeActionDialog,
    setActionDialogExecuting,
  } = useEditorAIStore();

  const { globalActions, userActions } = useAIActions();

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open && actionDialogExecuting) return;
      if (!open) closeActionDialog();
    },
    [actionDialogExecuting, closeActionDialog],
  );

  const handleOpenSidebar = useCallback(() => {
    closeActionDialog();
    onOpenSidebar();
  }, [closeActionDialog, onOpenSidebar]);

  const handleEditAction = useCallback(
    (action: any) => {
      closeActionDialog();
      onEditAction(action);
    },
    [closeActionDialog, onEditAction],
  );

  const handleCreateAction = useCallback(() => {
    closeActionDialog();
    onCreateAction();
  }, [closeActionDialog, onCreateAction]);

  const handleClose = useCallback(
    (open: boolean) => {
      if (!open) {
        setActionDialogExecuting(false);
      }
      handleOpenChange(open);
    },
    [handleOpenChange, setActionDialogExecuting],
  );

  return (
    <Dialog open={actionDialogOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm p-0 gap-0">
        <AIActionPopover
          globalActions={globalActions}
          userActions={userActions}
          selection={actionDialogSelection}
          selectedBlockIds={actionDialogBlockIds}
          context={actionDialogContext}
          editor={editor}
          executing={actionDialogExecuting}
          onExecutingChange={setActionDialogExecuting}
          onOpenSidebar={handleOpenSidebar}
          onEditAction={handleEditAction}
          onCreateAction={handleCreateAction}
        />
      </DialogContent>
    </Dialog>
  );
}
