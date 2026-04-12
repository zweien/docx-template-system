"use client"

import { useEffect, useState, useCallback } from "react"
import { ConversationSidebar } from "./conversation-sidebar"
import { ChatArea } from "./chat-area"
import { SettingsDialog } from "./settings-dialog"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { MessageSquarePlus, PanelLeft, PanelLeftClose } from "lucide-react"

const SELECTED_CONVERSATION_STORAGE_KEY = "agent2:selectedConversationId"

export function Agent2Layout() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [defaultModel, setDefaultModel] = useState<string>("")

  // Read from localStorage after mount to avoid hydration mismatch
  useEffect(() => {
    const stored = window.localStorage.getItem(SELECTED_CONVERSATION_STORAGE_KEY)
    if (stored) setSelectedConversationId(stored)
  }, [])

  useEffect(() => {
    if (selectedConversationId) {
      window.localStorage.setItem(SELECTED_CONVERSATION_STORAGE_KEY, selectedConversationId)
      return
    }

    window.localStorage.removeItem(SELECTED_CONVERSATION_STORAGE_KEY)
  }, [selectedConversationId])

  const handleSettingsChange = (settings: { defaultModel: string }) => {
    setDefaultModel(settings.defaultModel)
  }

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(c => !c)
  }, [])

  const handleMobileSelect = useCallback((id: string | null) => {
    if (id) setSelectedConversationId(id)
    setMobileMenuOpen(false)
  }, [])

  const handleNewConversation = useCallback(async () => {
    const res = await fetch("/api/agent2/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    })
    const data = await res.json()
    if (data.success) {
      setSelectedConversationId(data.data.id)
      setRefreshKey(k => k + 1)
      setMobileMenuOpen(false)
    }
  }, [])

  const sidebarContent = (
    <ConversationSidebar
      selectedId={selectedConversationId}
      onSelect={handleMobileSelect}
      onToggleCollapse={toggleSidebar}
      settingsOpen={settingsOpen}
      onSettingsOpenChange={setSettingsOpen}
      refreshKey={refreshKey}
    />
  )

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <div
          className={`shrink-0 border-r transition-all duration-200 h-full ${sidebarCollapsed ? "w-0 overflow-hidden" : "w-[280px]"}`}
        >
          {sidebarContent}
        </div>
      </div>

      {/* Mobile sidebar (Sheet drawer) */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-[280px] p-0 gap-0" showCloseButton={false}>
          {sidebarContent}
        </SheetContent>
      </Sheet>

      {/* Chat area */}
      <div className="flex-1 min-w-0">
        {selectedConversationId ? (
          <ChatArea
            conversationId={selectedConversationId}
            onToggleSidebar={toggleSidebar}
            sidebarCollapsed={sidebarCollapsed}
            onMobileMenuOpen={() => setMobileMenuOpen(true)}
            defaultModel={defaultModel}
          />
        ) : (
          <EmptyState
            onToggleSidebar={toggleSidebar}
            sidebarCollapsed={sidebarCollapsed}
            onMobileMenuOpen={() => setMobileMenuOpen(true)}
            onNewConversation={handleNewConversation}
          />
        )}
      </div>

      {/* Settings dialog */}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} onSettingsChange={handleSettingsChange} />
    </div>
  )
}

function EmptyState({
  onToggleSidebar,
  sidebarCollapsed,
  onMobileMenuOpen,
  onNewConversation,
}: {
  onToggleSidebar: () => void
  sidebarCollapsed: boolean
  onMobileMenuOpen: () => void
  onNewConversation: () => void
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b shrink-0">
        <Button variant="ghost" size="icon-xs" className="hidden md:inline-flex" onClick={onToggleSidebar}>
          {sidebarCollapsed ? (
            <PanelLeftClose className="size-4" />
          ) : (
            <PanelLeft className="size-4" />
          )}
        </Button>
        <Button variant="ghost" size="icon-xs" className="md:hidden" onClick={onMobileMenuOpen}>
          <PanelLeft className="size-4" />
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
