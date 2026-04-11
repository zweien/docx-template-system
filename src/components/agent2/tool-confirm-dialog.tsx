"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"

interface DetailPreview {
  title: string
  type: "record" | "paper" | "template" | "code" | "generic"
  fields?: Array<{ label: string; value: string }>
  summary?: string
  recordCount?: number
  items?: Array<{ id: string; label: string }>
}

interface ToolConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  toolName: string
  toolInput: Record<string, unknown>
  riskMessage: string
  token: string
  detailPreview?: DetailPreview | null
  onConfirm: (result: unknown) => void
  onReject: () => void
}

function DetailPreviewCard({ preview }: { preview: DetailPreview }) {
  return (
    <div className="rounded-md border bg-muted/50 p-3 space-y-2">
      <p className="text-sm font-medium">{preview.title}</p>
      {preview.fields && preview.fields.length > 0 && (
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          {preview.fields.map((field, i) => (
            <span key={i} className="contents">
              <span className="text-muted-foreground whitespace-nowrap">{field.label}:</span>
              <span className="break-all">{field.value}</span>
            </span>
          ))}
        </div>
      )}
      {preview.summary && (
        <p className="text-xs text-muted-foreground">{preview.summary}</p>
      )}
      {preview.items && preview.items.length > 0 && (
        <ul className="text-xs text-muted-foreground space-y-0.5">
          {preview.items.map((item) => (
            <li key={item.id} className="truncate">
              {item.label}
            </li>
          ))}
          {(preview.recordCount ?? 0) > preview.items.length && (
            <li className="italic">
              ...共 {preview.recordCount} 条
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

export function ToolConfirmDialog({
  open, onOpenChange, toolName, toolInput, riskMessage, token,
  detailPreview, onConfirm, onReject,
}: ToolConfirmDialogProps) {
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
            <code className="text-sm bg-muted px-2 py-1 rounded">
              {toolName.startsWith("mcp__") ? (
                <>{toolName} <span className="text-xs text-muted-foreground">[外部工具]</span></>
              ) : (
                toolName
              )}
            </code>
          </div>
          {detailPreview ? (
            <div>
              <p className="text-sm font-medium mb-1">操作对象</p>
              <DetailPreviewCard preview={detailPreview} />
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium mb-1">参数</p>
              <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-40">
                {JSON.stringify(toolInput, null, 2)}
              </pre>
            </div>
          )}
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
