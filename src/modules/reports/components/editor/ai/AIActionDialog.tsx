"use client";

import { useState, useCallback } from "react";
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
    closeActionDialog,
  } = useEditorAIStore();

  const { globalActions, userActions } = useAIActions();
  const [executing, setExecuting] = useState(false);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open && executing) return;
      if (!open) closeActionDialog();
    },
    [executing, closeActionDialog],
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

  // Reset executing when dialog closes
  const handleClose = useCallback(
    (open: boolean) => {
      if (!open) {
        setExecuting(false);
      }
      handleOpenChange(open);
    },
    [handleOpenChange],
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
          executing={executing}
          onExecutingChange={setExecuting}
          onOpenSidebar={handleOpenSidebar}
          onEditAction={handleEditAction}
          onCreateAction={handleCreateAction}
        />
      </DialogContent>
    </Dialog>
  );
}
