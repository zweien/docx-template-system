"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface ReportDraft {
  id: string;
  title: string;
  templateName: string;
  status: string;
  updatedAt: string;
}

type Tab = "owned" | "shared";

export default function ReportDraftsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("owned");
  const [drafts, setDrafts] = useState<ReportDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports/drafts?filter=${tab}`)
      .then((r) => r.json())
      .then((json) => { if (json.success) setDrafts(json.data); })
      .finally(() => setLoading(false));
  }, [tab]);

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除此草稿？")) return;
    await fetch(`/api/reports/drafts/${id}`, { method: "DELETE" });
    setDrafts((prev) => prev.filter((d) => d.id !== id));
  };

  const startRename = (d: ReportDraft) => {
    setEditingId(d.id);
    setEditTitle(d.title);
  };

  const confirmRename = async (id: string) => {
    if (!editTitle.trim()) return;
    const res = await fetch(`/api/reports/drafts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editTitle.trim() }),
    });
    const json = await res.json();
    if (json.success) {
      setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, title: editTitle.trim() } : d)));
    }
    setEditingId(null);
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">加载中...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">报告草稿</h1>
        <Link href="/reports/templates" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          从模板创建
        </Link>
      </div>
      <div className="flex gap-4 border-b border-border">
        <button
          onClick={() => setTab("owned")}
          className={`pb-2 text-sm font-medium ${tab === "owned" ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}
        >
          我所有的
        </button>
        <button
          onClick={() => setTab("shared")}
          className={`pb-2 text-sm font-medium ${tab === "shared" ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}
        >
          别人共享给我的
        </button>
      </div>
      {drafts.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          {tab === "owned" ? "暂无报告草稿，请从模板创建" : "暂无能查看的共享草稿"}
        </div>
      ) : (
        <div className="space-y-3">
          {drafts.map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
              <div className="flex-1 min-w-0">
                {editingId === d.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") confirmRename(d.id); if (e.key === "Escape") setEditingId(null); }}
                      className="flex-1 rounded border border-border bg-transparent px-2 py-1 text-sm"
                      autoFocus
                    />
                    <button onClick={() => confirmRename(d.id)} className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90">保存</button>
                    <button onClick={() => setEditingId(null)} className="rounded border border-border px-2 py-1 text-xs hover:bg-muted">取消</button>
                  </div>
                ) : (
                  <>
                    <span className="font-medium cursor-pointer hover:text-primary hover:underline" onClick={() => router.push(`/reports/drafts/${d.id}`)}>{d.title}</span>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      模板：{d.templateName} · 更新于 {new Date(d.updatedAt).toLocaleString()}
                    </p>
                  </>
                )}
              </div>
              {tab === "owned" && (
                <div className="ml-4 flex gap-2">
                  <button onClick={() => startRename(d)} className="rounded border border-border px-3 py-1 text-xs hover:bg-muted">
                    重命名
                  </button>
                  <button onClick={() => handleDelete(d.id)} className="rounded border border-border px-3 py-1 text-xs text-destructive hover:bg-destructive/10">
                    删除
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
