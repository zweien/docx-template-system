"use client";

import { useCallback } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useEditorAIStore } from "./useEditorAIStore";

interface AIActionButtonProps {
  editor: any;
}

function extractBlockText(block: any): string {
  if (!block?.content) return "";
  return block.content
    .filter((c: any) => c.type === "text")
    .map((c: any) => c.text)
    .join("");
}

interface SelectionSnapshot {
  text: string;
  blockIds: string[];
}

function captureSelection(editor: any): SelectionSnapshot {
  try {
    const selectedText = editor.getSelectedText?.();
    const selectionState = editor.getSelection();
    const focused = editor.focusBlock;
    const blocks = editor.topLevelBlocks ?? [];

    let blockIds: string[] = [];
    let text = selectedText || "";

    // Try to resolve block IDs from BlockNote selection state
    if (selectionState) {
      const fromBlock = selectionState.from?.block ?? selectionState.block;
      const toBlock = selectionState.to?.block ?? selectionState.end ?? fromBlock;

      if (fromBlock) {
        let inRange = false;
        const matched: any[] = [];
        for (const block of blocks) {
          if (block.id === fromBlock) {
            inRange = true;
            matched.push(block);
          } else if (inRange) {
            matched.push(block);
          }
          if (block.id === toBlock) {
            break;
          }
        }
        if (matched.length > 0) {
          blockIds = matched.map((b: any) => b.id);
          if (!text) {
            text = matched.map(extractBlockText).filter(Boolean).join("\n");
          }
        }
      }
    }

    // Always use focused block as fallback for block IDs
    if (blockIds.length === 0 && focused) {
      blockIds = [focused.id];
      if (!text) {
        text = extractBlockText(focused);
      }
    }

    return { text, blockIds };
  } catch {
    return { text: "", blockIds: [] };
  }
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

export function AIActionButton({ editor }: AIActionButtonProps) {
  const openActionDialog = useEditorAIStore((s) => s.openActionDialog);

  const handleClick = useCallback(() => {
    const snap = captureSelection(editor);
    const ctx = getContext(editor);
    openActionDialog(snap.text, snap.blockIds, ctx);
  }, [editor, openActionDialog]);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-primary hover:text-primary hover:bg-primary/10"
            onClick={handleClick}
          >
            <Sparkles className="size-4" />
          </Button>
        }
      />
      <TooltipContent>AI 助手</TooltipContent>
    </Tooltip>
  );
}
