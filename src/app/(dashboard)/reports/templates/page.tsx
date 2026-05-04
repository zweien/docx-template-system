"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PromptMeta {
  target: string;
  prompt: string;
  mode: string;
  level: string;
}

interface ReportTemplate {
  id: string;
  name: string;
  originalFilename: string;
  createdAt: string;
  parsedStructure?: {
    prompts?: PromptMeta[];
  };
}

export default function ReportTemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const [promptDialogOpen, setPromptDialogOpen] = useState(false);
  const [promptTemplateId, setPromptTemplateId] = useState<string | null>(null);
  const [prompts, setPrompts] = useState<PromptMeta[]>([]);

  useEffect(() => {
    fetch("/api/reports/templates")
      .then((r) => r.json())
      .then((json) => { if (json.success) setTemplates(json.data); })
      .finally(() => setLoading(false));
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/reports/templates", { method: "POST", body: formData });
    const json = await res.json();
    if (json.success) setTemplates((prev) => [json.data, ...prev]);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除此模板？")) return;
    await fetch(`/api/reports/templates/${id}`, { method: "DELETE" });
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  const handleCreateDraft = async (templateId: string) => {
    const res = await fetch("/api/reports/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId }),
    });
    const json = await res.json();
    if (json.success) {
      router.push(`/reports/drafts/${json.data.id}`);
    }
  };

  const startRename = (t: ReportTemplate) => {
    setEditingId(t.id);
    setEditName(t.name);
  };

  const confirmRename = async (id: string) => {
    if (!editName.trim()) return;
    const res = await fetch(`/api/reports/templates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim() }),
    });
    const json = await res.json();
    if (json.success) {
      setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, name: editName.trim() } : t)));
    }
    setEditingId(null);
  };

  const openPromptDialog = (template: ReportTemplate) => {
    setPromptTemplateId(template.id);
    setPrompts(template.parsedStructure?.prompts || []);
    setPromptDialogOpen(true);
  };

  const addPrompt = () => {
    setPrompts((prev) => [
      ...prev,
      { target: "", prompt: "", mode: "auto", level: "section" },
    ]);
  };

  const removePrompt = (index: number) => {
    setPrompts((prev) => prev.filter((_, i) => i !== index));
  };

  const updatePrompt = (index: number, field: keyof PromptMeta, value: string) => {
    setPrompts((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  };

  const savePrompts = async () => {
    if (!promptTemplateId) return;
    const res = await fetch(`/api/reports/templates/${promptTemplateId}/prompts`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompts }),
    });
    const json = await res.json();
    if (json.success) {
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === promptTemplateId
            ? { ...t, parsedStructure: { ...t.parsedStructure, prompts } }
            : t
        )
      );
      setPromptDialogOpen(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">加载中...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">报告模板</h1>
        <label className="cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          上传模板
          <input type="file" accept=".docx" onChange={handleUpload} className="hidden" />
        </label>
      </div>
      {templates.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">暂无报告模板，请上传 .docx 模板文件</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <div key={t.id} className="rounded-lg border border-border bg-card p-4">
              {editingId === t.id ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") confirmRename(t.id); if (e.key === "Escape") setEditingId(null); }}
                    className="flex-1 rounded border border-border bg-transparent px-2 py-1 text-sm"
                    autoFocus
                  />
                  <button onClick={() => confirmRename(t.id)} className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90">保存</button>
                  <button onClick={() => setEditingId(null)} className="rounded border border-border px-2 py-1 text-xs hover:bg-muted">取消</button>
                </div>
              ) : (
                <h3 className="font-medium cursor-pointer hover:text-primary" onClick={() => startRename(t)} title="点击重命名">{t.name}</h3>
              )}
              <p className="mt-1 text-sm text-muted-foreground">{t.originalFilename}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => handleCreateDraft(t.id)} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90">
                  创建报告
                </button>
                <button onClick={() => openPromptDialog(t)} className="rounded border border-border px-3 py-1 text-xs hover:bg-muted">
                  配置
                </button>
                <button onClick={() => handleDelete(t.id)} className="rounded border border-border px-3 py-1 text-xs text-destructive hover:bg-destructive/10">
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={promptDialogOpen} onOpenChange={setPromptDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>PROMPT 配置</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-4">
            {prompts.length === 0 && (
              <p className="text-sm text-muted-foreground">暂无 PROMPT，点击添加</p>
            )}
            {prompts.map((p, idx) => (
              <div key={idx} className="rounded border border-border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="目标章节"
                    value={p.target}
                    onChange={(e) => updatePrompt(idx, "target", e.target.value)}
                    className="flex-1 text-sm"
                  />
                  <Select value={p.mode} onValueChange={(v) => v && updatePrompt(idx, "mode" as keyof PromptMeta, v)}>
                    <SelectTrigger className="w-28 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">auto</SelectItem>
                      <SelectItem value="interactive">interactive</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={p.level} onValueChange={(v) => v && updatePrompt(idx, "level" as keyof PromptMeta, v)}>
                    <SelectTrigger className="w-28 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="section">section</SelectItem>
                      <SelectItem value="paragraph">paragraph</SelectItem>
                    </SelectContent>
                  </Select>
                  <button onClick={() => removePrompt(idx)} className="text-xs text-destructive hover:underline px-1">
                    删除
                  </button>
                </div>
                <Textarea
                  placeholder="提示内容"
                  value={p.prompt}
                  onChange={(e) => updatePrompt(idx, "prompt", e.target.value)}
                  className="text-sm min-h-[60px]"
                />
              </div>
            ))}
            <button onClick={addPrompt} className="w-full rounded border border-dashed border-border py-2 text-sm text-muted-foreground hover:bg-muted">
              + 添加 PROMPT
            </button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromptDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={savePrompts}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
