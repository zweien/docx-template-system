"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ReportDraft {
  id: string;
  title: string;
  templateName: string;
  status: string;
  updatedAt: string;
}

type Tab = "owned" | "shared";

export default function ReportDraftsPage() {
  const [tab, setTab] = useState<Tab>("owned");
  const [drafts, setDrafts] = useState<ReportDraft[]>([]);
  const [loading, setLoading] = useState(true);

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
              <div>
                <Link href={`/reports/drafts/${d.id}`} className="font-medium hover:underline">{d.title}</Link>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  模板：{d.templateName} · 更新于 {new Date(d.updatedAt).toLocaleString()}
                </p>
              </div>
              {tab === "owned" && (
                <button onClick={() => handleDelete(d.id)} className="rounded border border-border px-3 py-1 text-xs text-destructive hover:bg-destructive/10">
                  删除
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
