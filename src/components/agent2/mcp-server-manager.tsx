"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Trash2, Plus, Pencil, Wifi, Power, PowerOff } from "lucide-react"
import type { Agent2McpServerItem } from "@/types/agent2"

function loadServers(): Promise<Agent2McpServerItem[]> {
  return fetch("/api/agent2/admin/mcp")
    .then(r => r.json())
    .then(data => (data.success ? data.data : []))
}

interface FormState {
  name: string
  description: string
  transportType: "stdio" | "sse" | "http"
  command: string
  args: string
  env: string
  url: string
  headers: string
  timeout: string
}

const emptyForm: FormState = {
  name: "",
  description: "",
  transportType: "sse",
  command: "",
  args: "",
  env: "",
  url: "",
  headers: "",
  timeout: "5000",
}

function buildConfig(f: FormState): Record<string, unknown> {
  const timeout = parseInt(f.timeout) || 5000
  switch (f.transportType) {
    case "stdio":
      return {
        command: f.command,
        args: f.args ? f.args.split(" ").filter(Boolean) : undefined,
        env: f.env ? JSON.parse(f.env) : undefined,
        timeout,
      }
    case "sse":
    case "http":
      return {
        url: f.url,
        headers: f.headers ? JSON.parse(f.headers) : undefined,
        timeout,
      }
  }
}

export function McpServerManager() {
  const [servers, setServers] = useState<Agent2McpServerItem[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState<FormState>({ ...emptyForm })
  const [editOpen, setEditOpen] = useState(false)
  const [editingServer, setEditingServer] = useState<Agent2McpServerItem | null>(null)
  const [editForm, setEditForm] = useState<FormState>({ ...emptyForm })
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{
    id: string
    success: boolean
    message: string
    tools?: Array<{ name: string; description?: string }>
  } | null>(null)

  const reload = () => loadServers().then(setServers)
  useEffect(() => { reload() }, [])

  const handleAdd = async () => {
    try {
      const config = buildConfig(form)
      const res = await fetch("/api/agent2/admin/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description || undefined,
          transportType: form.transportType,
          config,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setAddOpen(false)
        setForm({ ...emptyForm })
        reload()
      } else {
        alert(data.error?.message || "添加失败")
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "添加失败，请检查 JSON 格式")
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除此 MCP 服务器？")) return
    await fetch(`/api/agent2/admin/mcp/${id}`, { method: "DELETE" })
    reload()
  }

  const handleToggle = async (server: Agent2McpServerItem) => {
    await fetch(`/api/agent2/admin/mcp/${server.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !server.enabled }),
    })
    reload()
  }

  const handleEdit = (server: Agent2McpServerItem) => {
    setEditingServer(server)
    const config = server.config as Record<string, unknown>
    setEditForm({
      name: server.name,
      description: server.description || "",
      transportType: server.transportType,
      command: (config.command as string) || "",
      args: Array.isArray(config.args) ? (config.args as string[]).join(" ") : "",
      env: config.env ? JSON.stringify(config.env) : "",
      url: (config.url as string) || "",
      headers: config.headers ? JSON.stringify(config.headers) : "",
      timeout: String(config.timeout || 5000),
    })
    setEditOpen(true)
  }

  const handleEditSubmit = async () => {
    if (!editingServer) return
    try {
      const config = buildConfig(editForm)
      const res = await fetch(`/api/agent2/admin/mcp/${editingServer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          description: editForm.description || null,
          config,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setEditOpen(false)
        setEditingServer(null)
        reload()
      } else {
        alert(data.error?.message || "更新失败")
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "更新失败，请检查 JSON 格式")
    }
  }

  const handleTest = async (server: Agent2McpServerItem) => {
    setTestingId(server.id)
    setTestResult(null)
    try {
      const res = await fetch(`/api/agent2/admin/mcp/${server.id}/test`, { method: "POST" })
      const data = await res.json()
      if (data.success) {
        setTestResult({
          id: server.id,
          success: true,
          message: `连接成功，发现 ${data.data.tools.length} 个工具`,
          tools: data.data.tools,
        })
      } else {
        setTestResult({
          id: server.id,
          success: false,
          message: data.error?.message || "连接失败",
        })
      }
    } catch (error) {
      setTestResult({
        id: server.id,
        success: false,
        message: error instanceof Error ? error.message : "测试失败",
      })
    } finally {
      setTestingId(null)
    }
  }

  const renderTransportFields = (
    f: FormState,
    setF: (fn: (prev: FormState) => FormState) => void,
  ) => (
    <>
      <div>
        <label className="text-sm font-medium">传输类型</label>
        <select
          value={f.transportType}
          onChange={(e) => setF(prev => ({ ...prev, transportType: e.target.value as "stdio" | "sse" | "http" }))}
          className="w-full h-8 rounded-md border bg-background px-2 text-sm mt-1"
        >
          <option value="stdio">Stdio（本地进程）</option>
          <option value="sse">SSE（Server-Sent Events）</option>
          <option value="http">HTTP（Streamable HTTP）</option>
        </select>
      </div>
      {f.transportType === "stdio" && (
        <>
          <div>
            <label className="text-sm font-medium">命令</label>
            <Input placeholder="如 npx, node, python" value={f.command} onChange={e => setF(prev => ({ ...prev, command: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium">参数</label>
            <Input placeholder="空格分隔，可选" value={f.args} onChange={e => setF(prev => ({ ...prev, args: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium">环境变量 JSON</label>
            <Input placeholder="可选" value={f.env} onChange={e => setF(prev => ({ ...prev, env: e.target.value }))} className="mt-1" />
          </div>
        </>
      )}
      {(f.transportType === "sse" || f.transportType === "http") && (
        <>
          <div>
            <label className="text-sm font-medium">URL</label>
            <Input placeholder="如 http://localhost:3000/mcp" value={f.url} onChange={e => setF(prev => ({ ...prev, url: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium">请求头 JSON</label>
            <Input placeholder="可选" value={f.headers} onChange={e => setF(prev => ({ ...prev, headers: e.target.value }))} className="mt-1" />
          </div>
        </>
      )}
      <div>
        <label className="text-sm font-medium">连接超时 (ms)</label>
        <Input type="number" placeholder="默认 5000" value={f.timeout} onChange={e => setF(prev => ({ ...prev, timeout: e.target.value }))} className="mt-1" />
      </div>
    </>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">MCP 服务器</p>
        <Button variant="ghost" size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="size-3 mr-1" /> 添加
        </Button>
      </div>
      <div className="space-y-1">
        {servers.map(server => {
          const config = server.config as Record<string, unknown>
          return (
            <div key={server.id} className="p-2 rounded-md bg-muted/50 text-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`size-2 shrink-0 rounded-full ${server.enabled ? "bg-green-500" : "bg-muted-foreground/30"}`} />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{server.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {server.transportType.toUpperCase()} · {String(config.url || config.command || "")}
                      {server.description && ` · ${server.description}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon-xs" onClick={() => handleTest(server)} disabled={testingId === server.id} title="测试连接">
                    {testingId === server.id ? <span className="size-3 animate-spin">⟳</span> : <Wifi className="size-3" />}
                  </Button>
                  <Button variant="ghost" size="icon-xs" onClick={() => handleToggle(server)} title={server.enabled ? "禁用" : "启用"}>
                    {server.enabled ? <PowerOff className="size-3" /> : <Power className="size-3" />}
                  </Button>
                  <Button variant="ghost" size="icon-xs" onClick={() => handleEdit(server)} title="编辑">
                    <Pencil className="size-3" />
                  </Button>
                  <Button variant="ghost" size="icon-xs" onClick={() => handleDelete(server.id)} title="删除">
                    <Trash2 className="size-3 text-destructive" />
                  </Button>
                </div>
              </div>
              {testResult?.id === server.id && (
                <div className={`mt-1 text-xs ${testResult.success ? "text-green-500" : "text-destructive"}`}>
                  {testResult.message}
                  {testResult.success && testResult.tools && testResult.tools.length > 0 && (
                    <p className="text-muted-foreground mt-0.5">
                      工具: {testResult.tools.map(t => t.name).join(", ")}
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
        {servers.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">暂未配置 MCP 服务器</p>
        )}
      </div>

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>添加 MCP 服务器</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">服务器名称</label>
              <Input placeholder="如 my-mcp-server" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">描述</label>
              <Input placeholder="可选" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="mt-1" />
            </div>
            {renderTransportFields(form, setForm)}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>取消</Button>
            <Button onClick={handleAdd} disabled={!form.name || (form.transportType === "stdio" ? !form.command : !form.url)}>添加</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>编辑 MCP 服务器</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">服务器名称</label>
              <Input placeholder="如 my-mcp-server" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">描述</label>
              <Input placeholder="可选" value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} className="mt-1" />
            </div>
            {renderTransportFields(editForm, setEditForm)}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>取消</Button>
            <Button onClick={handleEditSubmit} disabled={!editForm.name || (editForm.transportType === "stdio" ? !editForm.command : !editForm.url)}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
