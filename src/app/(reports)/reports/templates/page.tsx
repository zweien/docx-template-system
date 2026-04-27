"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface ReportTemplate {
  id: string;
  name: string;
  originalFilename: string;
  createdAt: string;
}

export default function ReportTemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

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
              <div className="mt-3 flex gap-2">
                <button onClick={() => handleCreateDraft(t.id)} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90">
                  创建报告
                </button>
                <button onClick={() => handleDelete(t.id)} className="rounded border border-border px-3 py-1 text-xs text-destructive hover:bg-destructive/10">
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
