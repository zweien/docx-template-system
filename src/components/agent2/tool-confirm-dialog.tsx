"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { AlertTriangle } from "lucide-react"

interface ToolConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  toolName: string
  toolInput: Record<string, unknown>
  riskMessage: string
  token: string
  onConfirm: (result: unknown) => void
  onReject: () => void
  toolCategory: string
}

export function ToolConfirmDialog({
  open, onOpenChange, toolName, toolInput, riskMessage, token,
  onConfirm, onReject, toolCategory,
}: ToolConfirmDialogProps) {
  const [autoConfirm, setAutoConfirm] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/agent2/confirm/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved: true }),
      })
      const data = await res.json()
      if (data.success) onConfirm(data.data)
      else onReject()
    } catch {
      onReject()
    } finally {
      setLoading(false)
    }

    if (autoConfirm) {
      // Merge with existing auto-confirm settings instead of overwriting
      try {
        const settingsRes = await fetch("/api/agent2/settings")
        const settingsData = await settingsRes.json()
        const existing = settingsData.success
          ? (settingsData.data.autoConfirmTools as Record<string, boolean>)
          : {}
        await fetch("/api/agent2/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            autoConfirmTools: { ...existing, [toolCategory]: true },
          }),
        })
      } catch {
        // Best-effort — don't block the confirm flow
      }
    }
  }

  const handleReject = async () => {
    await fetch(`/api/agent2/confirm/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved: false }),
    })
    onReject()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-yellow-500" />
            确认执行操作
          </DialogTitle>
          <DialogDescription>{riskMessage}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium mb-1">工具</p>
            <code className="text-sm bg-muted px-2 py-1 rounded">{toolName}</code>
          </div>
          <div>
            <p className="text-sm font-medium mb-1">参数</p>
            <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-40">
              {JSON.stringify(toolInput, null, 2)}
            </pre>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <Checkbox
            id="auto-confirm"
            checked={autoConfirm}
            onCheckedChange={(checked: boolean) => setAutoConfirm(checked)}
          />
          <label htmlFor="auto-confirm" className="text-sm text-muted-foreground cursor-pointer">
            以后自动确认此类操作
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleReject} disabled={loading}>拒绝</Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading ? "执行中..." : "确认执行"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
