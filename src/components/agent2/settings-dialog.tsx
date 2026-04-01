"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { ModelManager } from "./model-manager"

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface Settings {
  autoConfirmTools: Record<string, boolean>
  defaultModel: string
  showReasoning: boolean
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [settings, setSettings] = useState<Settings>({
    autoConfirmTools: {},
    defaultModel: "gpt-4o",
    showReasoning: true,
  })

  useEffect(() => {
    if (open) {
      fetch("/api/agent2/settings")
        .then(r => r.json())
        .then(data => {
          if (data.success) setSettings(data.data)
        })
    }
  }, [open])

  const updateSettings = async (updates: Partial<Settings>) => {
    const newSettings = { ...settings, ...updates }
    setSettings(newSettings)
    await fetch("/api/agent2/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    })
  }

  const toolCategories = [
    { key: "read", label: "查询类工具", description: "搜索、查询、聚合统计" },
    { key: "write", label: "创建类工具", description: "创建记录、生成文档" },
    { key: "delete", label: "删除类工具", description: "删除记录" },
    { key: "execute", label: "执行类工具", description: "代码执行" },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>设置</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="tools">
          <TabsList className="w-full">
            <TabsTrigger value="tools" className="flex-1">工具执行</TabsTrigger>
            <TabsTrigger value="models" className="flex-1">模型管理</TabsTrigger>
            <TabsTrigger value="display" className="flex-1">显示设置</TabsTrigger>
          </TabsList>
          <TabsContent value="tools" className="space-y-4 mt-4">
            {toolCategories.map(cat => (
              <div key={cat.key} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{cat.label}</p>
                  <p className="text-xs text-muted-foreground">{cat.description}</p>
                </div>
                <Switch
                  checked={settings.autoConfirmTools[cat.key] || false}
                  onCheckedChange={(checked: boolean) => {
                    updateSettings({
                      autoConfirmTools: { ...settings.autoConfirmTools, [cat.key]: checked },
                    })
                  }}
                />
              </div>
            ))}
          </TabsContent>
          <TabsContent value="models" className="mt-4">
            <ModelManager settings={settings} onUpdateSettings={(updates) => updateSettings(updates as Partial<Settings>)} />
          </TabsContent>
          <TabsContent value="display" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">显示推理过程</p>
                <p className="text-xs text-muted-foreground">展示 AI 的思考过程</p>
              </div>
              <Switch
                checked={settings.showReasoning}
                onCheckedChange={(checked: boolean) => updateSettings({ showReasoning: checked })}
              />
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
