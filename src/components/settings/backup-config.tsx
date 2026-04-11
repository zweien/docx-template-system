"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Download, Loader2, Play, Trash2, RefreshCw, RotateCcw } from "lucide-react"

interface BackupMeta {
  filename: string
  size: number
  createdAt: string
}

interface BackupConfig {
  enabled: boolean
  schedule: "daily" | "weekly" | "monthly"
}

export function BackupConfig() {
  const [config, setConfig] = useState<BackupConfig>({ enabled: false, schedule: "daily" })
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null)
  const [backups, setBackups] = useState<BackupMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const [settingsRes, backupsRes] = await Promise.all([
        fetch("/api/admin/agent2/global-settings"),
        fetch("/api/admin/data-tables/backup"),
      ])
      const settingsData = await settingsRes.json()
      const backupsData = await backupsRes.json()

      if (settingsData.success) {
        setConfig(settingsData.data.backupConfig)
        setLastBackupAt(settingsData.data.lastBackupAt)
      }
      if (backupsData.success) {
        setBackups(backupsData.data)
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const saveConfig = async (updates: Partial<BackupConfig>) => {
    setSaving(true)
    try {
      const newConfig = { ...config, ...updates }
      const res = await fetch("/api/admin/agent2/global-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backupConfig: newConfig }),
      })
      const data = await res.json()
      if (data.success) {
        setConfig(newConfig)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleRunBackup = async () => {
    setRunning(true)
    try {
      const res = await fetch("/api/admin/data-tables/backup", { method: "POST" })
      const data = await res.json()
      if (data.success) {
        await load()
      } else {
        alert(data.error?.message || "备份失败")
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "备份失败")
    } finally {
      setRunning(false)
    }
  }

  const handleDelete = async (filename: string) => {
    if (!confirm(`确定删除备份 ${filename}？`)) return
    await fetch("/api/admin/data-tables/backup", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename }),
    })
    load()
  }

  const handleDownload = (filename: string) => {
    window.open(`/api/admin/data-tables/backup/${encodeURIComponent(filename)}`, "_blank")
  }

  const handleRestore = async (filename: string) => {
    if (!confirm(`确定从 ${filename} 恢复数据？\n\n这将删除当前所有数据表中的记录，并用备份数据替换。`)) return
    setRestoring(filename)
    try {
      const res = await fetch("/api/admin/data-tables/backup", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename }),
      })
      const data = await res.json()
      if (data.success) {
        const { tablesProcessed, recordsRestored, skippedTables } = data.data
        let msg = `恢复成功：处理 ${tablesProcessed} 个表，恢复 ${recordsRestored} 条记录`
        if (skippedTables.length > 0) {
          msg += `\n跳过的表（不存在）：${skippedTables.join(", ")}`
        }
        alert(msg)
      } else {
        alert(data.error?.message || "恢复失败")
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "恢复失败")
    } finally {
      setRestoring(null)
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const scheduleLabels: Record<string, string> = {
    daily: "每天",
    weekly: "每周",
    monthly: "每月",
  }

  if (loading) return <p className="text-sm text-muted-foreground">加载中...</p>

  return (
    <div className="space-y-4">
      {/* Config */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">自动备份</p>
            <p className="text-xs text-muted-foreground">
              {config.enabled
                ? `${scheduleLabels[config.schedule]}凌晨 3:00 自动备份`
                : "未启用"}
              {lastBackupAt && ` · 上次备份: ${new Date(lastBackupAt).toLocaleString("zh-CN")}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={config.schedule}
              onChange={(e) => saveConfig({ schedule: e.target.value as BackupConfig["schedule"] })}
              disabled={saving}
              className="h-8 rounded-md border bg-background px-2 text-sm"
            >
              <option value="daily">每天</option>
              <option value="weekly">每周</option>
              <option value="monthly">每月</option>
            </select>
            <Button
              variant={config.enabled ? "default" : "outline"}
              size="sm"
              onClick={() => saveConfig({ enabled: !config.enabled })}
              disabled={saving}
            >
              {config.enabled ? "已启用" : "启用"}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={handleRunBackup} disabled={running} size="sm">
            {running ? <Loader2 className="size-3 mr-1 animate-spin" /> : <Play className="size-3 mr-1" />}
            立即备份
          </Button>
          <Button variant="outline" onClick={load} size="sm">
            <RefreshCw className="size-3 mr-1" /> 刷新
          </Button>
        </div>
      </div>

      {/* Backup list */}
      <div className="space-y-1">
        {backups.map((b) => (
          <div key={b.filename} className="flex items-center gap-2 p-2 rounded-md bg-muted/50 text-sm">
            <div className="flex-1 min-w-0">
              <p className="truncate font-medium">{b.filename}</p>
              <p className="text-xs text-muted-foreground">
                {formatSize(b.size)} · {new Date(b.createdAt).toLocaleString("zh-CN")}
              </p>
            </div>
            <Button variant="ghost" size="icon-xs" onClick={() => handleDownload(b.filename)} title="下载">
              <Download className="size-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => handleRestore(b.filename)}
              disabled={restoring === b.filename}
              title="恢复"
            >
              {restoring === b.filename
                ? <Loader2 className="size-3 animate-spin" />
                : <RotateCcw className="size-3" />
              }
            </Button>
            <Button variant="ghost" size="icon-xs" onClick={() => handleDelete(b.filename)} title="删除">
              <Trash2 className="size-3 text-destructive" />
            </Button>
          </div>
        ))}
        {backups.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">暂无备份</p>
        )}
      </div>
    </div>
  )
}
