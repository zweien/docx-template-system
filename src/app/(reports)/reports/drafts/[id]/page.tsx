"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PanelLeftOpen, PanelRightOpen } from "lucide-react";
import { useReportDraftStore } from "@/modules/reports/stores/report-draft-store";
import { SectionEditor } from "@/modules/reports/components/editor/SectionEditor";
import { OutlinePanel } from "@/modules/reports/components/editor/OutlinePanel";
import { CollaborationProvider, useCollaboration } from "@/modules/reports/components/editor/CollaborationProvider";
import { OnlineUsers } from "@/modules/reports/components/editor/OnlineUsers";
import { ShareDialog } from "@/modules/reports/components/editor/ShareDialog";
import type { ReportTemplateStructure } from "@/modules/reports/types";

function EditorContent() {
  const router = useRouter();
  const {
    draft, activeSection, saveStatus, collaboratorIds,
    setActiveSection, updateSection,
    updateContext, updateTitle, toggleSection, save, exportDocx,
    setCollaboratorIds,
  } = useReportDraftStore();

  const collaborators = draft?.collaborators || [];

  const { getFragment, provider, synced } = useCollaboration();

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scrollTargetBlockId, setScrollTargetBlockId] = useState<string | undefined>();
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      const { isDirty, save: doSave } = useReportDraftStore.getState();
      if (isDirty) doSave();
    }, 3000);
  }, []);

  const handleNavigateHeading = useCallback((sectionId: string, blockId: string) => {
    if (sectionId !== activeSection) setActiveSection(sectionId);
    setScrollTargetBlockId(blockId);
  }, [activeSection, setActiveSection]);

  const importInputRef = useRef<HTMLInputElement>(null);
  const handleImportPayload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(reader.result as string);
        useReportDraftStore.getState().importPayload(payload);
        scheduleAutoSave();
      } catch {
        alert("无效的 JSON 文件");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }, [scheduleAutoSave]);

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

  if (!draft) return null;

  const structure = draft.template.parsedStructure as unknown as ReportTemplateStructure;
  const sections = structure.sections || [];
  const currentBlocks = draft.sections[activeSection] || [];

  return (
    <div className="flex h-[calc(100vh-8rem)] -m-4 sm:-m-6">
      {/* 左侧：章节面板 */}
      <div
        className={`shrink-0 border-r border-border bg-card overflow-y-auto overflow-x-hidden transition-[width] duration-200 ${leftCollapsed ? "w-0 border-r-0" : "w-60"}`}
      >
        <div className="w-60 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">章节</h3>
            <button onClick={() => setLeftCollapsed(true)} className="p-0.5 rounded hover:bg-muted text-muted-foreground" title="折叠">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
          </div>
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
      <div className="flex-1 overflow-y-auto p-6 relative">
        {/* 展开按钮 */}
        {leftCollapsed && (
          <button
            onClick={() => setLeftCollapsed(false)}
            className="absolute top-3 left-3 z-10 p-1 rounded hover:bg-muted text-muted-foreground"
            title="展开章节面板"
          >
            <PanelLeftOpen width="16" height="16" />
          </button>
        )}
        {rightCollapsed && (
          <button
            onClick={() => setRightCollapsed(false)}
            className="absolute top-3 right-3 z-10 p-1 rounded hover:bg-muted text-muted-foreground"
            title="展开大纲面板"
          >
            <PanelRightOpen width="16" height="16" />
          </button>
        )}

        <div className="mb-4 flex items-center justify-between">
          <input
            type="text"
            value={draft.title}
            onChange={(e) => { updateTitle(e.target.value); scheduleAutoSave(); }}
            className="text-xl font-semibold bg-transparent border-none outline-none"
            placeholder="报告标题"
          />
          <div className="flex items-center gap-3">
            <OnlineUsers />
            {saveStatus === "saving" ? <span className="text-xs text-muted-foreground">保存中...</span>
              : saveStatus === "saved" ? <span className="text-xs text-muted-foreground">已保存</span>
              : saveStatus === "error" ? <span className="text-xs text-destructive">保存失败</span> : null}
            <button
              onClick={() => setShareOpen(true)}
              className="text-xs px-2 py-1 rounded border border-border hover:bg-muted"
            >
              共享
            </button>
          </div>
        </div>
        <SectionEditor
          key={`${activeSection}-${synced ? 'collab' : 'local'}`}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          blocks={currentBlocks as any[]}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onChange={(blocks: any[]) => { updateSection(activeSection, blocks); scheduleAutoSave(); }}
          scrollToBlockId={scrollTargetBlockId}
          onScrolled={() => setScrollTargetBlockId(undefined)}
          collabFragment={provider ? getFragment(activeSection) : null}
          collabProvider={provider}
        />
      </div>

      {/* 右侧：大纲面板 */}
      <div
        className={`shrink-0 border-l border-border bg-card overflow-y-auto overflow-x-hidden transition-[width] duration-200 flex flex-col ${rightCollapsed ? "w-0 border-l-0" : "w-48"}`}
      >
        <div className="w-48 flex flex-col flex-1">
          <div className="flex items-center justify-end px-3 pt-3 pb-2">
            <button onClick={() => setRightCollapsed(true)} className="p-0.5 rounded hover:bg-muted text-muted-foreground" title="折叠">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </div>
          <OutlinePanel sections={draft.sections} sectionEnabled={draft.sectionEnabled} activeSection={activeSection} onNavigateHeading={handleNavigateHeading} />
        </div>
      </div>

      {/* 底部操作栏 */}
      <div className="fixed bottom-0 right-0 flex items-center gap-2 border-t border-border bg-card px-6 py-3"
           style={{ left: "var(--sidebar-width, 16rem)" }}>
        <button onClick={() => router.push("/reports/drafts")} className="rounded border border-border px-4 py-1.5 text-sm hover:bg-muted">返回</button>
        <button onClick={save} className="rounded border border-border px-4 py-1.5 text-sm hover:bg-muted">保存</button>
        <button onClick={() => importInputRef.current?.click()} className="rounded border border-border px-4 py-1.5 text-sm hover:bg-muted">导入 Payload</button>
        <input ref={importInputRef} type="file" accept=".json" onChange={handleImportPayload} className="hidden" />
        <button onClick={exportDocx} className="rounded bg-primary px-4 py-1.5 text-sm text-primary-foreground hover:bg-primary/90">导出 .docx</button>
      </div>

      <ShareDialog
        draftId={draft.id}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        collaboratorIds={collaboratorIds}
        collaborators={collaborators}
        onCollaboratorsChange={setCollaboratorIds}
      />
    </div>
  );
}

export default function ReportEditorPage() {
  const params = useParams<{ id: string }>();
  const { draft, collaboratorIds, loadDraft } = useReportDraftStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDraft(params.id).finally(() => setLoading(false));
  }, [params.id, loadDraft]);

  if (loading) return <div className="p-8 text-center text-muted-foreground">加载中...</div>;
  if (!draft) return <div className="p-8 text-center text-destructive">草稿不存在</div>;

  return (
    <CollaborationProvider draftId={draft.id} collaboratorIds={collaboratorIds}>
      <EditorContent />
    </CollaborationProvider>
  );
}
