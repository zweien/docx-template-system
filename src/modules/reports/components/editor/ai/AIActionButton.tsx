"use client";

import { useState, useCallback } from "react";
import { Sparkles, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { EditorAIActionItem } from "@/types/editor-ai";
import { useAIActions } from "./useAIActions";
import { AIActionPopover } from "./AIActionPopover";

interface AIActionButtonProps {
  editor: any;
  onOpenSidebar: () => void;
  onEditAction: (action: EditorAIActionItem) => void;
  onCreateAction: () => void;
}

function getSelection(editor: any): string {
  try {
    const selectionState = editor.getSelection();
    if (!selectionState) return "";

    const blocks = editor.topLevelBlocks;
    const selectedBlocks = blocks.filter(
      (block: any) =>
        block.id === selectionState.block ||
        (selectionState.block &&
          selectionState.end &&
          block.id >= selectionState.block &&
          block.id <= selectionState.end),
    );

    // Fallback: if no blocks matched by ID range, collect text from focused block
    if (selectedBlocks.length === 0) {
      const focused = editor.focusBlock;
      if (focused) {
        const content = focused.content?.find((c: any) => c.type === "text");
        return content?.text ?? "";
      }
      return "";
    }

    return selectedBlocks
      .map((block: any) => {
        const textContent = block.content?.filter((c: any) => c.type === "text");
        return textContent?.map((c: any) => c.text).join("") ?? "";
      })
      .join("\n");
  } catch {
    return "";
  }
}

function getContext(editor: any): string {
  try {
    const blocks = editor.topLevelBlocks ?? [];
    const text = blocks
      .slice(0, 5)
      .map((block: any) => {
        const textContent = block.content?.filter((c: any) => c.type === "text");
        return textContent?.map((c: any) => c.text).join("") ?? "";
      })
      .filter(Boolean)
      .join("\n");
    return text.slice(0, 1000);
  } catch {
    return "";
  }
}

export function AIActionButton({
  editor,
  onOpenSidebar,
  onEditAction,
  onCreateAction,
}: AIActionButtonProps) {
  const { globalActions, userActions, loading } = useAIActions();
  const [open, setOpen] = useState(false);

  const selection = getSelection(editor);
  const context = getContext(editor);

  const handleOpenSidebar = useCallback(() => {
    setOpen(false);
    onOpenSidebar();
  }, [onOpenSidebar]);

  const handleEditAction = useCallback(
    (action: EditorAIActionItem) => {
      setOpen(false);
      onEditAction(action);
    },
    [onEditAction],
  );

  const handleCreateAction = useCallback(() => {
    setOpen(false);
    onCreateAction();
  }, [onCreateAction]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            title="AI 助手"
          />
        }
      >
        <Sparkles className="size-4" />
        <span>▾</span>
      </PopoverTrigger>
      <PopoverContent side="bottom" sideOffset={8}>
        <AIActionPopover
          globalActions={globalActions}
          userActions={userActions}
          selection={selection}
          context={context}
          onOpenSidebar={handleOpenSidebar}
          onEditAction={handleEditAction}
          onCreateAction={handleCreateAction}
        />
      </PopoverContent>
    </Popover>
  );
}
