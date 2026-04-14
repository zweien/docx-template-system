"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { ModelManager } from "./model-manager"
import { McpServerManager } from "./mcp-server-manager"

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSettingsChange?: (settings: Settings) => void
}

interface Settings {
  defaultModel: string
  showReasoning: boolean
}

export function SettingsDialog({ open, onOpenChange, onSettingsChange }: SettingsDialogProps) {
  const [settings, setSettings] = useState<Settings>({
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
    onSettingsChange?.(newSettings)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>设置</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="models">
          <TabsList className="w-full">
            <TabsTrigger value="models" className="flex-1">模型管理</TabsTrigger>
            <TabsTrigger value="display" className="flex-1">显示设置</TabsTrigger>
            <TabsTrigger value="mcp" className="flex-1">MCP 服务器</TabsTrigger>
          </TabsList>
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
          <TabsContent value="mcp" className="mt-4">
            <McpServerManager />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
