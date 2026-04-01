"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Plus,
  Star,
  MoreHorizontal,
  Pencil,
  Trash2,
  Settings,
  MessageSquare,
} from "lucide-react"

interface ConversationItem {
  id: string
  title: string
  isFavorite: boolean
  model: string
  createdAt: string
  updatedAt: string
}

interface ConversationSidebarProps {
  selectedId: string | null
  onSelect: (id: string | null) => void
  onToggleCollapse: () => void
  settingsOpen: boolean
  onSettingsOpenChange: (open: boolean) => void
  refreshKey: number
}

export function ConversationSidebar({
  selectedId,
  onSelect,
  onToggleCollapse,
  settingsOpen,
  onSettingsOpenChange,
  refreshKey,
}: ConversationSidebarProps) {
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/agent2/conversations")
      const data = await res.json()
      if (data.success) setConversations(data.data)
    } catch {
      // ignore fetch errors
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations, refreshKey])

  const handleNew = async () => {
    const res = await fetch("/api/agent2/conversations", { method: "POST" })
    const data = await res.json()
    if (data.success) {
      onSelect(data.data.id)
      fetchConversations()
    }
  }

  // Group conversations
  const favorites = conversations.filter(c => c.isFavorite)
  const today = conversations.filter(c => {
    if (c.isFavorite) return false
    const d = new Date(c.updatedAt)
    return d.toDateString() === new Date().toDateString()
  })
  const earlier = conversations.filter(c => {
    if (c.isFavorite) return false
    const d = new Date(c.updatedAt)
    return d.toDateString() !== new Date().toDateString()
  })

  return (
    <div className="flex flex-col h-full bg-muted/30">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b">
        <h2 className="font-semibold text-sm">AI 助手</h2>
        <Button variant="ghost" size="icon-xs" onClick={handleNew}>
          <Plus className="size-4" />
        </Button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {renderGroup("\u2B50 收藏", favorites)}
        {renderGroup("今天", today)}
        {renderGroup("更早", earlier)}
        {conversations.length === 0 && !loading && (
          <div className="text-center text-muted-foreground text-sm py-8">
            暂无对话
          </div>
        )}
      </div>

      {/* Settings button */}
      <div className="p-3 border-t">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2"
          onClick={() => onSettingsOpenChange(true)}
        >
          <Settings className="size-4" />
          设置
        </Button>
      </div>
    </div>
  )

  function renderGroup(label: string, items: ConversationItem[]) {
    if (items.length === 0) return null
    return (
      <div className="mb-3">
        <div className="text-xs text-muted-foreground px-2 py-1 font-medium">
          {label}
        </div>
        {items.map(conv => renderConversationItem(conv))}
      </div>
    )
  }

  function renderConversationItem(conv: ConversationItem) {
    // If renaming this item
    if (renamingId === conv.id) {
      return (
        <div key={conv.id} className="px-1">
          <Input
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onBlur={async () => {
              if (renameValue.trim()) {
                await fetch(`/api/agent2/conversations/${conv.id}`, {
                  method: "PATCH",
                  body: JSON.stringify({ title: renameValue.trim() }),
                  headers: { "Content-Type": "application/json" },
                })
                fetchConversations()
              }
              setRenamingId(null)
            }}
            onKeyDown={e => {
              if (e.key === "Enter") e.currentTarget.blur()
            }}
            autoFocus
            className="h-7 text-sm"
          />
        </div>
      )
    }

    return (
      <div
        key={conv.id}
        className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm cursor-pointer group ${
          selectedId === conv.id
            ? "bg-accent text-accent-foreground"
            : "hover:bg-accent/50"
        }`}
        onClick={() => onSelect(conv.id)}
      >
        <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate flex-1">{conv.title}</span>
        {conv.isFavorite && (
          <Star className="size-3 fill-yellow-400 text-yellow-400 shrink-0" />
        )}
        <DropdownMenu>
          <DropdownMenuTrigger
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            className="opacity-0 group-hover:opacity-100 shrink-0 inline-flex items-center justify-center size-6 rounded-md hover:bg-accent/50 transition-opacity"
          >
            <MoreHorizontal className="size-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="right">
            <DropdownMenuItem
              onClick={() => {
                setRenamingId(conv.id)
                setRenameValue(conv.title)
              }}
            >
              <Pencil className="size-3 mr-2" />
              重命名
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={async () => {
                await fetch(`/api/agent2/conversations/${conv.id}`, {
                  method: "PATCH",
                  body: JSON.stringify({ isFavorite: !conv.isFavorite }),
                  headers: { "Content-Type": "application/json" },
                })
                fetchConversations()
              }}
            >
              <Star className="size-3 mr-2" />
              {conv.isFavorite ? "取消收藏" : "收藏"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={async () => {
                if (!confirm("确定删除此对话？")) return
                await fetch(`/api/agent2/conversations/${conv.id}`, {
                  method: "DELETE",
                })
                if (selectedId === conv.id) onSelect(null)
                fetchConversations()
              }}
            >
              <Trash2 className="size-3 mr-2" />
              删除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  }
}
