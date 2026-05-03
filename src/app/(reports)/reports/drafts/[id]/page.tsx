"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Sparkles, X, RotateCcw, Pencil, Check } from "lucide-react";
import { useReportDraftStore } from "@/modules/reports/stores/report-draft-store";
import { SectionEditor } from "@/modules/reports/components/editor/SectionEditor";
import { OutlinePanel } from "@/modules/reports/components/editor/OutlinePanel";
import { CollaborationProvider, useCollaboration } from "@/modules/reports/components/editor/CollaborationProvider";
import { OnlineUsers } from "@/modules/reports/components/editor/OnlineUsers";
import { ShareDialog } from "@/modules/reports/components/editor/ShareDialog";
import { AIChatSidebar } from "@/modules/reports/components/editor/ai/AIChatSidebar";
import { useEditorAIStore } from "@/modules/reports/components/editor/ai/useEditorAIStore";
import { AIActionForm } from "@/modules/reports/components/editor/ai/AIActionForm";
import type { EditorAIActionItem } from "@/types/editor-ai";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Streamdown } from "streamdown";
import type { ReportTemplateStructure } from "@/modules/reports/types";

function EditorContent() {
  const router = useRouter();

  // Diagnostic: capture RangeError stack to pinpoint the source
  useEffect(() => {
    const handler = (event: ErrorEvent) => {
      const err = event.error;
      if (err instanceof RangeError) {
        console.error("[DIAGNOSTIC] RangeError captured:", err.message, err.stack);
      }
    };
    window.addEventListener("error", handler);
    return () => window.removeEventListener("error", handler);
  }, []);
  const {
    draft, activeSection, saveStatus, collaboratorIds,
    setActiveSection, updateSection,
    updateContext, updateTitle, toggleSection, save, exportDocx,
    setCollaborators,
  } = useReportDraftStore();

  const collaborators = draft?.collaborators || [];

  const { getFragment, provider, synced } = useCollaboration();

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scrollTargetBlockId, setScrollTargetBlockId] = useState<string | undefined>();
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [rightWidth, setRightWidth] = useState(288);
  const [shareOpen, setShareOpen] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewText, setPreviewText] = useState("");
  const [generationError, setGenerationError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const editorRef = useRef<any>(null);
  const [editedPrompt, setEditedPrompt] = useState("");
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [rightTab, setRightTab] = useState<"outline" | "ai">("outline");
  const [aiFormOpen, setAIFormOpen] = useState(false);
  const [editingAction, setEditingAction] = useState<EditorAIActionItem | null>(null);

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

  const activeSectionMeta = sections.find((s) => s.id === activeSection);
  const activePrompt = structure.prompts?.find((p) => {
    if (p.level !== "section") return false;
    const targets = [
      activeSectionMeta?.title,
      activeSectionMeta?.id,
      activeSection,
      ...(activeSectionMeta?.template_headings?.map((h) => h.text) ?? []),
    ];
    return targets.some((t) => {
      if (!t) return false;
      return t === p.target || t.includes(p.target) || p.target.includes(t);
    });
  });

  const startGeneration = useCallback(async () => {
    if (!draft || !activeSection || !activePrompt) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsGenerating(true);
    setShowPreview(true);
    setPreviewText("");
    setGenerationError(null);

    const existingContent = editorRef.current
      ? editorRef.current.blocksToMarkdownLossy(editorRef.current.document)
      : "";

    const documentStructure = sections.map((s) => ({
      id: s.id,
      title: s.title,
    }));

    try {
      const res = await fetch(
        `/api/reports/drafts/${draft.id}/sections/${activeSection}/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: editedPrompt || activePrompt.prompt,
            target: activeSectionMeta?.title || activeSection,
            existingContent,
            context: draft.context,
            documentStructure,
          }),
          signal: abortController.signal,
        }
      );

      if (!res.ok) {
        const errText = await res.text().catch(() => "生成失败");
        throw new Error(errText);
      }

      if (!res.body) {
        throw new Error("响应体为空");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setPreviewText(text);
      }

      if (text.trim().length === 0) {
        setGenerationError("未生成有效内容，请调整提示词后重试");
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        // User cancelled — keep partial content
      } else {
        setGenerationError(
          err instanceof Error ? err.message : "生成失败，请检查网络后重试"
        );
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  }, [draft, activeSection, activePrompt, activeSectionMeta, sections, editedPrompt]);

  const cancelGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsGenerating(false);
  }, []);

  const retryGeneration = useCallback(() => {
    setGenerationError(null);
    setPreviewText("");
    startGeneration();
  }, [startGeneration]);

  const applyGenerated = useCallback(
    (mode: "append" | "replace") => {
      if (!editorRef.current || !previewText.trim()) return;

      try {
        const blocks = editorRef.current.tryParseMarkdownToBlocks(previewText);

        if (mode === "replace") {
          editorRef.current.replaceBlocks(
            editorRef.current.document,
            blocks
          );
        } else {
          const doc = editorRef.current.document;
          if (doc.length === 0) {
            editorRef.current.replaceBlocks(doc, blocks);
          } else {
            editorRef.current.insertBlocks(
              blocks,
              doc[doc.length - 1],
              "after"
            );
          }
        }

        scheduleAutoSave();
        setShowPreview(false);
        setPreviewText("");
        setGenerationError(null);
      } catch (err: unknown) {
        console.error("[Apply Generated] Markdown parse failed:", err);
        try {
          const fallbackBlocks = [
            {
              type: "paragraph",
              content: previewText,
            },
          ];
          if (mode === "replace") {
            editorRef.current.replaceBlocks(
              editorRef.current.document,
              fallbackBlocks
            );
          } else {
            const doc = editorRef.current.document;
            if (doc.length === 0) {
              editorRef.current.replaceBlocks(doc, fallbackBlocks);
            } else {
              editorRef.current.insertBlocks(
                fallbackBlocks,
                doc[doc.length - 1],
                "after"
              );
            }
          }
          scheduleAutoSave();
          setShowPreview(false);
          setPreviewText("");
        } catch (fallbackErr) {
          console.error("[Apply Generated] Fallback also failed:", fallbackErr);
        }
      }
    },
    [previewText, scheduleAutoSave]
  );

  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setShowPreview(false);
    setPreviewText("");
    setGenerationError(null);
    setIsGenerating(false);
  }, [activeSection]);

  // Sync section text to AI store for context
  useEffect(() => {
    const blocks = draft.sections[activeSection] || [];
    const text = blocks
      .map((b: any) => {
        if (!b.content || !Array.isArray(b.content)) return "";
        return b.content
          .filter((s: any) => s.type === "text")
          .map((s: any) => s.text)
          .join("");
      })
      .filter(Boolean)
      .join("\n");
    useEditorAIStore.getState().setSectionContent(text.slice(0, 4000));
  }, [activeSection, draft.sections]);

  useEffect(() => {
    setEditedPrompt(activePrompt?.prompt || "");
    setIsEditingPrompt(false);
  }, [activePrompt]);

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
              <PanelLeftClose width="14" height="14" />
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
        {activePrompt && (
          <div className="mb-4 rounded-lg border border-border bg-muted/50 p-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-primary">写作指导</span>
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">{activePrompt.mode}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="xs"
                  variant="ghost"
                  disabled={isGenerating}
                  onClick={() => setIsEditingPrompt((v) => !v)}
                >
                  {isEditingPrompt ? (
                    <>
                      <Check className="size-3 mr-1" />
                      完成
                    </>
                  ) : (
                    <>
                      <Pencil className="size-3 mr-1" />
                      编辑
                    </>
                  )}
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  disabled={isGenerating}
                  onClick={startGeneration}
                >
                  {isGenerating ? (
                    <>
                      <Spinner className="size-3 mr-1" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-3 mr-1" />
                      AI 生成
                    </>
                  )}
                </Button>
              </div>
            </div>
            {isEditingPrompt ? (
              <textarea
                className="w-full mt-1 rounded border border-border bg-background px-2 py-1.5 text-sm text-muted-foreground resize-y min-h-[60px]"
                value={editedPrompt}
                onChange={(e) => setEditedPrompt(e.target.value)}
                rows={3}
              />
            ) : (
              <p className="text-sm text-muted-foreground">{editedPrompt || activePrompt.prompt}</p>
            )}
          </div>
        )}
        {showPreview && (
          <div className="mb-4 rounded-lg border border-border bg-background p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">AI 生成预览</span>
                {isGenerating && <Spinner className="size-4" />}
              </div>
              <div className="flex items-center gap-2">
                {isGenerating ? (
                  <Button size="xs" variant="ghost" onClick={cancelGeneration}>
                    <X className="size-3 mr-1" />
                    取消
                  </Button>
                ) : generationError ? (
                  <Button size="xs" variant="ghost" onClick={retryGeneration}>
                    <RotateCcw className="size-3 mr-1" />
                    重新生成
                  </Button>
                ) : null}
              </div>
            </div>

            {generationError ? (
              <div className="text-sm text-destructive mb-3">{generationError}</div>
            ) : (
              <div className="max-h-80 overflow-y-auto mb-3">
                <div className="prose prose-sm max-w-none">
                  <Streamdown isAnimating={isGenerating}>{previewText}</Streamdown>
                  {isGenerating && previewText ? (
                    <span className="ml-1 inline-block h-4 w-2 animate-pulse rounded-sm bg-current/45 align-middle" />
                  ) : null}
                </div>
              </div>
            )}

            {!isGenerating && !generationError && previewText.trim().length > 0 && (
              <div className="flex items-center gap-2 justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => applyGenerated("append")}
                >
                  续写
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => applyGenerated("replace")}
                >
                  改写
                </Button>
              </div>
            )}
          </div>
        )}
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
          onEditorMount={(editor) => { editorRef.current = editor; }}
          onOpenAISidebar={() => { setRightTab("ai"); setRightCollapsed(false); }}
          onEditAIAction={(action) => { setEditingAction(action); setAIFormOpen(true); }}
          onCreateAIAction={() => { setEditingAction(null); setAIFormOpen(true); }}
        />
      </div>

      {/* 右侧：大纲/AI面板 */}
      {!rightCollapsed && (
        <div
          className="shrink-0 border-l border-border bg-card flex flex-col relative"
          style={{ width: rightWidth }}
        >
          {/* Drag handle on left edge */}
          <div
            className="absolute top-0 bottom-0 -left-1 z-10 w-2 cursor-col-resize group"
            onMouseDown={(e) => {
              e.preventDefault();
              const startX = e.clientX;
              const startW = rightWidth;
              document.body.style.cursor = "col-resize";
              document.body.style.userSelect = "none";
              const onMove = (ev: MouseEvent) => {
                const delta = startX - ev.clientX;
                setRightWidth(Math.min(640, Math.max(220, startW + delta)));
              };
              const cleanup = () => {
                document.body.style.cursor = "";
                document.body.style.userSelect = "";
                document.removeEventListener("mousemove", onMove);
                document.removeEventListener("mouseup", cleanup);
                window.removeEventListener("blur", cleanup);
              };
              document.addEventListener("mousemove", onMove);
              document.addEventListener("mouseup", cleanup);
              window.addEventListener("blur", cleanup);
            }}
          >
            <div className="h-full w-0.5 mx-auto bg-transparent group-hover:bg-primary/40 transition-colors" />
          </div>
          <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
            <div className="flex items-center border-b border-border">
              <button onClick={() => setRightTab("outline")} className={`flex-1 px-3 py-2 text-xs font-medium ${
                rightTab === "outline" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
              }`}>大纲</button>
              <button onClick={() => { setRightTab("ai"); }} className={`flex-1 px-3 py-2 text-xs font-medium ${
                rightTab === "ai" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
              }`}>✨ AI 助手</button>
              <button onClick={() => setRightCollapsed(true)} className="p-0.5 px-2 rounded hover:bg-muted text-muted-foreground" title="折叠">
                <PanelRightClose width="14" height="14" />
              </button>
            </div>
            {rightTab === "outline" ? (
              <OutlinePanel sections={draft.sections} sectionEnabled={draft.sectionEnabled} activeSection={activeSection} onNavigateHeading={handleNavigateHeading} collapsed={rightCollapsed} />
            ) : (
              <AIChatSidebar editorRef={editorRef} />
            )}
          </div>
        </div>
      )}

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
        onCollaboratorsChange={setCollaborators}
      />

      <AIActionForm
        open={aiFormOpen}
        onOpenChange={setAIFormOpen}
        action={editingAction}
        onSuccess={() => { setAIFormOpen(false); }}
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
