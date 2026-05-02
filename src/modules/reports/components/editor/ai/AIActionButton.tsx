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
    // Try BlockNote's getSelectedText first
    const selectedText = editor.getSelectedText?.();
    if (selectedText) return selectedText;

    const selectionState = editor.getSelection();
    if (!selectionState) {
      // Fallback: get focused block text
      const focused = editor.focusBlock;
      if (focused) {
        return extractBlockText(focused);
      }
      return "";
    }

    const blocks = editor.topLevelBlocks;
    const fromBlock = selectionState.from?.block ?? selectionState.block;
    const toBlock = selectionState.to?.block ?? selectionState.end ?? fromBlock;
    if (!fromBlock) {
      const focused = editor.focusBlock;
      return focused ? extractBlockText(focused) : "";
    }

    const selectedBlocks = blocks.filter(
      (block: any) => block.id === fromBlock || (toBlock && block.id === toBlock),
    );

    if (selectedBlocks.length === 0) {
      const focused = editor.focusBlock;
      return focused ? extractBlockText(focused) : "";
    }

    return selectedBlocks.map(extractBlockText).filter(Boolean).join("\n");
  } catch {
    return "";
  }
}

function extractBlockText(block: any): string {
  if (!block?.content) return "";
  return block.content
    .filter((c: any) => c.type === "text")
    .map((c: any) => c.text)
    .join("");
}

function getContext(editor: any): string {
  try {
    const blocks = editor.topLevelBlocks ?? [];
    const text = blocks
      .slice(0, 5)
      .map(extractBlockText)
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
  const [selection, setSelection] = useState("");
  const [context, setContext] = useState("");

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        // Capture selection BEFORE the popover opens (focus shifts)
        setSelection(getSelection(editor));
        setContext(getContext(editor));
      }
      setOpen(nextOpen);
    },
    [editor],
  );

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
    <Popover open={open} onOpenChange={handleOpenChange}>
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
