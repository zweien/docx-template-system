"use client"

import { Button } from "@/components/ui/button"
import { PanelLeft, PanelLeftClose } from "lucide-react"

interface ChatAreaProps {
  conversationId: string
  onToggleSidebar: () => void
  sidebarCollapsed: boolean
}

export function ChatArea({
  conversationId,
  onToggleSidebar,
  sidebarCollapsed,
}: ChatAreaProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b shrink-0">
        <Button variant="ghost" size="icon-xs" onClick={onToggleSidebar}>
          {sidebarCollapsed ? (
            <PanelLeftClose className="size-4" />
          ) : (
            <PanelLeft className="size-4" />
          )}
        </Button>
        <span className="text-sm font-medium">对话</span>
      </div>

      {/* Chat content placeholder */}
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        对话加载中...
      </div>
    </div>
  )
}
