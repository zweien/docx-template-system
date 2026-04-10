"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Pencil, Trash2, RotateCcw } from "lucide-react"

const DEFAULT_SUGGESTIONS = [
  "帮我查看系统中有哪些数据表",
  "搜索销售记录中金额大于1000的记录",
  "帮我生成一份月度销售统计图表",
  "查看可用的文档模板",
]

export function SuggestionManager() {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [newSuggestion, setNewSuggestion] = useState("")
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editValue, setEditValue] = useState("")
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/agent2/global-settings")
      const data = await res.json()
      if (data.success) {
        setSuggestions(data.data.suggestions)
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const save = async (newList: string[]) => {
    setSaving(true)
    try {
      const res = await fetch("/api/admin/agent2/global-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestions: newList }),
      })
      const data = await res.json()
      if (data.success) {
        setSuggestions(newList)
      } else {
        alert(data.error?.message || "保存失败")
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "保存失败")
    } finally {
      setSaving(false)
    }
  }

  const handleAdd = async () => {
    if (!newSuggestion.trim()) return
    const updated = [...suggestions, newSuggestion.trim()]
    await save(updated)
    setNewSuggestion("")
  }

  const handleDelete = async (index: number) => {
    const updated = suggestions.filter((_, i) => i !== index)
    await save(updated)
  }

  const handleEdit = (index: number) => {
    setEditingIndex(index)
    setEditValue(suggestions[index])
  }

  const handleEditSave = async () => {
    if (editingIndex === null || !editValue.trim()) return
    const updated = [...suggestions]
    updated[editingIndex] = editValue.trim()
    await save(updated)
    setEditingIndex(null)
    setEditValue("")
  }

  const handleMoveUp = async (index: number) => {
    if (index === 0) return
    const updated = [...suggestions]
    ;[updated[index - 1], updated[index]] = [updated[index], updated[index - 1]]
    await save(updated)
  }

  const handleMoveDown = async (index: number) => {
    if (index === suggestions.length - 1) return
    const updated = [...suggestions]
    ;[updated[index], updated[index + 1]] = [updated[index + 1], updated[index]]
    await save(updated)
  }

  const handleReset = async () => {
    if (!confirm("确定恢复为默认建议？")) return
    await save(DEFAULT_SUGGESTIONS)
  }

  if (loading) return <p className="text-sm text-muted-foreground">加载中...</p>

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">对话建议</p>
        <Button variant="ghost" size="sm" onClick={handleReset} disabled={saving}>
          <RotateCcw className="size-3 mr-1" /> 恢复默认
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        配置新对话中显示的建议提示，最多 20 条。留空则使用默认建议。
      </p>

      <div className="space-y-1">
        {suggestions.map((s, i) => (
          <div key={i} className="flex items-center gap-1 p-2 rounded-md bg-muted/50 text-sm">
            <div className="flex flex-col shrink-0">
              <button
                onClick={() => handleMoveUp(i)}
                disabled={i === 0 || saving}
                className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs leading-none"
              >
                ▲
              </button>
              <button
                onClick={() => handleMoveDown(i)}
                disabled={i === suggestions.length - 1 || saving}
                className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs leading-none"
              >
                ▼
              </button>
            </div>
            {editingIndex === i ? (
              <div className="flex items-center gap-1 flex-1 min-w-0">
                <Input
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  className="h-7 text-sm"
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === "Enter") handleEditSave()
                    if (e.key === "Escape") setEditingIndex(null)
                  }}
                />
                <Button variant="ghost" size="sm" onClick={handleEditSave} disabled={saving}>
                  保存
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setEditingIndex(null)}>
                  取消
                </Button>
              </div>
            ) : (
              <>
                <span className="flex-1 truncate">{s}</span>
                <Button variant="ghost" size="icon-xs" onClick={() => handleEdit(i)} disabled={saving}>
                  <Pencil className="size-3" />
                </Button>
                <Button variant="ghost" size="icon-xs" onClick={() => handleDelete(i)} disabled={saving}>
                  <Trash2 className="size-3 text-destructive" />
                </Button>
              </>
            )}
          </div>
        ))}
        {suggestions.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">
            未配置建议，将使用默认建议
          </p>
        )}
      </div>

      {suggestions.length < 20 && (
        <div className="flex items-center gap-2">
          <Input
            placeholder="输入新的建议文本..."
            value={newSuggestion}
            onChange={e => setNewSuggestion(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleAdd() }}
            className="h-8 text-sm"
          />
          <Button size="sm" onClick={handleAdd} disabled={!newSuggestion.trim() || saving}>
            <Plus className="size-3 mr-1" /> 添加
          </Button>
        </div>
      )}
    </div>
  )
}
