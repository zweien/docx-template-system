"use client"

import { useState } from "react"
import { ConversationSidebar } from "./conversation-sidebar"
import { ChatArea } from "./chat-area"
import { SettingsDialog } from "./settings-dialog"
import { Button } from "@/components/ui/button"
import { MessageSquarePlus, PanelLeft, PanelLeftClose } from "lucide-react"

export function Agent2Layout() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Sidebar */}
      <div
        className={`shrink-0 border-r transition-all duration-200 ${sidebarCollapsed ? "w-0 overflow-hidden" : "w-[280px]"}`}
      >
        <ConversationSidebar
          selectedId={selectedConversationId}
          onSelect={setSelectedConversationId}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          settingsOpen={settingsOpen}
          onSettingsOpenChange={setSettingsOpen}
          refreshKey={refreshKey}
        />
      </div>

      {/* Chat area */}
      <div className="flex-1 min-w-0">
        {selectedConversationId ? (
          <ChatArea
            conversationId={selectedConversationId}
            onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
            sidebarCollapsed={sidebarCollapsed}
          />
        ) : (
          <EmptyState
            onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
            sidebarCollapsed={sidebarCollapsed}
            onNewConversation={async () => {
              const res = await fetch("/api/agent2/conversations", { method: "POST" })
              const data = await res.json()
              if (data.success) {
                setSelectedConversationId(data.data.id)
                setRefreshKey(k => k + 1)
              }
            }}
          />
        )}
      </div>

      {/* Settings dialog */}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}

function EmptyState({
  onToggleSidebar,
  sidebarCollapsed,
  onNewConversation,
}: {
  onToggleSidebar: () => void
  sidebarCollapsed: boolean
  onNewConversation: () => void
}) {
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
      </div>

      {/* Centered empty state */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
        <div className="size-16 rounded-2xl bg-muted flex items-center justify-center">
          <MessageSquarePlus className="size-8 text-muted-foreground" />
        </div>
        <div className="text-center space-y-1">
          <h2 className="text-lg font-semibold">AI 助手</h2>
          <p className="text-sm text-muted-foreground">
            开始一段新对话，或从左侧选择已有对话
          </p>
        </div>
        <Button onClick={onNewConversation}>
          <MessageSquarePlus className="size-4" />
          新建对话
        </Button>
      </div>
    </div>
  )
}
