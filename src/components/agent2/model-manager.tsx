"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Trash2, Plus } from "lucide-react"

interface Model {
  id: string
  name: string
  providerId: string
  modelId: string
  baseUrl: string
  isGlobal: boolean
}

interface ModelManagerProps {
  settings: { defaultModel: string }
  onUpdateSettings: (updates: Record<string, unknown>) => void
}

function loadModels(): Promise<Model[]> {
  return fetch("/api/agent2/models")
    .then(r => r.json())
    .then(data => (data.success ? data.data : []))
}

export function ModelManager({ settings, onUpdateSettings }: ModelManagerProps) {
  const [models, setModels] = useState<Model[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ name: "", providerId: "custom", modelId: "", baseUrl: "", apiKey: "" })

  useEffect(() => {
    loadModels().then(setModels)
  }, [])

  const handleAdd = async () => {
    const res = await fetch("/api/agent2/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (data.success) {
      setAddOpen(false)
      setForm({ name: "", providerId: "custom", modelId: "", baseUrl: "", apiKey: "" })
      loadModels().then(setModels)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除此模型？")) return
    await fetch(`/api/agent2/models/${id}`, { method: "DELETE" })
    loadModels().then(setModels)
  }

  const globalModels = models.filter(m => m.isGlobal)
  const userModels = models.filter(m => !m.isGlobal)

  return (
    <div className="space-y-4">
      {/* Default model selector */}
      <div>
        <p className="text-sm font-medium mb-2">默认模型</p>
        <select
          value={settings.defaultModel}
          onChange={(e) => onUpdateSettings({ defaultModel: e.target.value })}
          className="w-full h-8 rounded-md border bg-background px-2 text-sm"
        >
          {models.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>

      {/* Global models */}
      {globalModels.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2">全局模型</p>
          <div className="space-y-1">
            {globalModels.map(m => (
              <div key={m.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-sm">
                <div>
                  <p className="font-medium">{m.name}</p>
                  <p className="text-xs text-muted-foreground">{m.modelId}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User models */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium">自定义模型</p>
          <Button variant="ghost" size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="size-3 mr-1" /> 添加
          </Button>
        </div>
        <div className="space-y-1">
          {userModels.map(m => (
            <div key={m.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-sm">
              <div>
                <p className="font-medium">{m.name}</p>
                <p className="text-xs text-muted-foreground">{m.baseUrl}</p>
              </div>
              <Button variant="ghost" size="icon-xs" onClick={() => handleDelete(m.id)}>
                <Trash2 className="size-3 text-destructive" />
              </Button>
            </div>
          ))}
          {userModels.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">暂无自定义模型</p>
          )}
        </div>
      </div>

      {/* Add model dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加自定义模型</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="模型名称" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <Input placeholder="模型 ID (如 gpt-4o)" value={form.modelId} onChange={e => setForm(f => ({ ...f, modelId: e.target.value }))} />
            <Input placeholder="Base URL (如 https://api.openai.com/v1)" value={form.baseUrl} onChange={e => setForm(f => ({ ...f, baseUrl: e.target.value }))} />
            <Input type="password" placeholder="API Key (可选)" value={form.apiKey} onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>取消</Button>
            <Button onClick={handleAdd} disabled={!form.name || !form.modelId || !form.baseUrl}>添加</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
