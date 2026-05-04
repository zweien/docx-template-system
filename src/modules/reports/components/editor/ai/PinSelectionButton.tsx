"use client";

import { useCallback } from "react";
import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useEditorAIStore } from "./useEditorAIStore";

interface PinSelectionButtonProps {
  editor: any;
  onOpenSidebar?: () => void;
}

export function PinSelectionButton({ editor, onOpenSidebar }: PinSelectionButtonProps) {
  const handleClick = useCallback(() => {
    const text = editor.getSelectedText?.();
    if (!text?.trim()) return;

    const focused = editor.focusBlock;
    const blockIds = focused ? [focused.id] : [];

    const { addPinnedSelection, sidebarOpen } = useEditorAIStore.getState();
    addPinnedSelection({ text: text.trim(), blockIds });

    if (!sidebarOpen && onOpenSidebar) {
      onOpenSidebar();
    }
  }, [editor, onOpenSidebar]);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-muted-foreground hover:text-foreground hover:bg-muted"
            onClick={handleClick}
          >
            <Bot className="size-4" />
          </Button>
        }
      />
      <TooltipContent>引用到侧边栏</TooltipContent>
    </Tooltip>
  );
}
