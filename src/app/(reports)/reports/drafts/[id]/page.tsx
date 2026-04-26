"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useReportDraftStore } from "@/modules/reports/stores/report-draft-store";
import { SectionEditor } from "@/modules/reports/components/editor/SectionEditor";
import { OutlinePanel } from "@/modules/reports/components/editor/OutlinePanel";
import type { ReportTemplateStructure } from "@/modules/reports/types";

export default function ReportEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const {
    draft, activeSection, saveStatus,
    loadDraft, setActiveSection, updateSection,
    updateContext, updateTitle, toggleSection, save, exportDocx,
  } = useReportDraftStore();

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDraft(params.id).finally(() => setLoading(false));
  }, [params.id, loadDraft]);

  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      const { isDirty, save: doSave } = useReportDraftStore.getState();
      if (isDirty) doSave();
    }, 3000);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [save]);

  if (loading) return <div className="p-8 text-center text-muted-foreground">加载中...</div>;
  if (!draft) return <div className="p-8 text-center text-destructive">草稿不存在</div>;

  const structure = draft.template.parsedStructure as unknown as ReportTemplateStructure;
  const sections = structure.sections || [];
  const currentBlocks = draft.sections[activeSection] || [];

  return (
    <div className="flex h-[calc(100vh-8rem)] -m-4 sm:-m-6">
      {/* 左侧：章节面板 */}
      <div className="w-60 shrink-0 border-r border-border bg-card overflow-y-auto">
        <div className="p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">章节</h3>
          <div className="space-y-1">
            {sections.map((sec) => (
              <div key={sec.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!draft.sectionEnabled[sec.id]}
                  onChange={() => { toggleSection(sec.id); scheduleAutoSave(); }}
                  className="rounded border-border"
                />
                <button
                  onClick={() => setActiveSection(sec.id)}
                  className={`flex-1 text-left text-sm px-2 py-1 rounded ${
                    activeSection === sec.id ? "bg-primary/10 text-primary" : "hover:bg-muted"
                  }`}
                >
                  {sec.title || sec.id}
                </button>
              </div>
            ))}
          </div>

          {structure.context_vars?.length > 0 && (
            <>
              <h3 className="mt-6 mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">上下文变量</h3>
              <div className="space-y-2">
                {structure.context_vars.map((key) => (
                  <div key={key}>
                    <label className="text-xs text-muted-foreground">{key}</label>
                    <input
                      type="text"
                      value={draft.context[key] || ""}
                      onChange={(e) => { updateContext(key, e.target.value); scheduleAutoSave(); }}
                      className="w-full rounded border border-border bg-transparent px-2 py-1 text-sm"
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 中间：编辑器 */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-4 flex items-center gap-4">
          <input
            type="text"
            value={draft.title}
            onChange={(e) => { updateTitle(e.target.value); scheduleAutoSave(); }}
            className="text-xl font-semibold bg-transparent border-none outline-none"
            placeholder="报告标题"
          />
          <span className="text-xs text-muted-foreground">
            {saveStatus === "saving" ? "保存中..." : saveStatus === "saved" ? "已保存" : saveStatus === "error" ? "保存失败" : ""}
          </span>
        </div>
        <SectionEditor
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          blocks={currentBlocks as any[]}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onChange={(blocks: any[]) => { updateSection(activeSection, blocks); scheduleAutoSave(); }}
        />
      </div>

      {/* 右侧：大纲面板 */}
      <div className="w-48 shrink-0 border-l border-border bg-card overflow-y-auto">
        <OutlinePanel sections={draft.sections} sectionEnabled={draft.sectionEnabled} />
      </div>

      {/* 底部操作栏 */}
      <div className="fixed bottom-0 right-0 flex items-center gap-2 border-t border-border bg-card px-6 py-3"
           style={{ left: "var(--sidebar-width, 16rem)" }}>
        <button onClick={() => router.push("/reports/drafts")} className="rounded border border-border px-4 py-1.5 text-sm hover:bg-muted">返回</button>
        <button onClick={save} className="rounded border border-border px-4 py-1.5 text-sm hover:bg-muted">保存</button>
        <button onClick={exportDocx} className="rounded bg-primary px-4 py-1.5 text-sm text-primary-foreground hover:bg-primary/90">导出 .docx</button>
      </div>
    </div>
  );
}
