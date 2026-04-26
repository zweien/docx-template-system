"use client";

import { useEffect, useState } from "react";

interface ReportTemplate {
  id: string;
  name: string;
  originalFilename: string;
  createdAt: string;
}

export default function ReportTemplatesPage() {
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);

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
    if (json.success) window.location.href = `/reports/drafts/${json.data.id}`;
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
              <h3 className="font-medium">{t.name}</h3>
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
