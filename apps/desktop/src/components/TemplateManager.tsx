import { useEffect, useState, useCallback } from "react";
import { useAppStore, TemplateMeta } from "../stores/app-store";
import { listTemplates, importTemplate, deleteTemplate, renameTemplate, selectDocx } from "../services/tauri-commands";
import { validateTemplate } from "../services/validation";
import { ValidationResult } from "../types";
import { ValidationPanel } from "./ValidationPanel";
import { ConfirmDialog } from "./ConfirmDialog";
import { HelpPopover } from "./HelpPopover";
import { DropZone } from "./DropZone";

export function TemplateManager() {
  const { templates, setTemplates, setCurrentView, selectTemplate, addLog } = useAppStore();
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    listTemplates().then(setTemplates).catch(console.error);
  }, [setTemplates]);

  const handleImport = async () => {
    const path = await selectDocx();
    if (!path) return;
    try {
      const meta = await importTemplate(path);
      setTemplates([meta, ...useAppStore.getState().templates]);
      addLog(`模板导入成功: ${meta.name}`, "success");

      const vr = await validateTemplate(meta.path);
      if (vr.issues.length > 0) {
        setValidationResult(vr);
        addLog(`模板校验: ${vr.summary.errors} 个错误, ${vr.summary.warnings} 个警告`, "warn");
      } else {
        setValidationResult(null);
      }
    } catch (e) {
      addLog(`导入失败: ${e}`, "error");
    }
  };

  const handleDownloadSample = async () => {
    try {
      const res = await fetch("/samples/budget_report.docx");
      const blob = await res.blob();
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => {
          const dataUrl = reader.result as string;
          resolve(dataUrl.split(",", 2)[1]);
        };
        reader.readAsDataURL(blob);
      });
      const { saveDataAs } = await import("../services/tauri-commands");
      await saveDataAs("预算报告模板.docx", base64, true);
      addLog("示例模板已下载", "success");
    } catch (e) {
      addLog(`下载失败: ${e}`, "error");
    }
  };

  const handleDelete = (id: string) => setDeleteTarget(id);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteTemplate(deleteTarget);
    setTemplates(useAppStore.getState().templates.filter((t) => t.id !== deleteTarget));
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(deleteTarget); return next; });
    setDeleteTarget(null);
  };

  const handleRename = async (id: string, newName: string) => {
    await renameTemplate(id, newName);
    setTemplates(useAppStore.getState().templates.map((t) => (t.id === id ? { ...t, name: newName } : t)));
  };

  const handleUse = (t: TemplateMeta) => {
    selectTemplate(t.id);
    setCurrentView("wizard");
  };

  const handleDrop = useCallback(async (paths: string[]) => {
    for (const path of paths) {
      try {
        const meta = await importTemplate(path);
        setTemplates([meta, ...useAppStore.getState().templates]);
        addLog(`模板导入成功: ${meta.name}`, "success");
        const vr = await validateTemplate(meta.path);
        if (vr.issues.length > 0) {
          setValidationResult(vr);
          addLog(`模板校验: ${vr.summary.errors} 个错误, ${vr.summary.warnings} 个警告`, "warn");
        }
      } catch (e) {
        addLog(`导入失败: ${e}`, "error");
      }
    }
  }, [setTemplates, addLog]);

  // ── Multi-select ──

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(templates.map((t) => t.id)));
  const deselectAll = () => setSelectedIds(new Set());

  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false);

  const handleBatchDelete = async () => {
    const ids = [...selectedIds];
    for (const id of ids) {
      try {
        await deleteTemplate(id);
      } catch (e) {
        addLog(`删除失败: ${e}`, "error");
      }
    }
    setTemplates(useAppStore.getState().templates.filter((t) => !selectedIds.has(t.id)));
    addLog(`已删除 ${ids.length} 个模板`, "success");
    setSelectedIds(new Set());
    setBatchDeleteConfirm(false);
  };

  const allSelected = templates.length > 0 && selectedIds.size === templates.length;

  return (
    <DropZone accept={[".docx"]} onDrop={handleDrop} multiple className="content-page flex-1 overflow-auto">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-heading text-lg text-text flex items-center gap-1.5">模板管理 <HelpPopover>管理报告的 .docx 模板文件。模板中可以使用 {'{{'} 占位符 {'}'} 定义动态内容区域，导入后会自动解析并校验占位符。</HelpPopover></h2>
            <p className="text-caption text-text-muted mt-1">管理和导入报告模板</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleDownloadSample}
              className="px-4 py-2 bg-surface border border-border text-text-secondary rounded-md hover:bg-surface-hover text-[0.867rem] transition-colors"
            >
              下载示例模板
            </button>
            <button
              onClick={handleImport}
              className="px-4 py-2 bg-brand text-white rounded-md hover:bg-brand-hover text-[0.867rem] font-medium transition-colors"
            >
              + 导入模板
            </button>
          </div>
        </div>

        {/* Batch action bar */}
        {templates.length > 0 && (
          <div className="flex items-center gap-3 mb-4 px-1">
            <button
              onClick={allSelected ? deselectAll : selectAll}
              className="text-[0.8rem] text-brand-accent hover:text-brand-hover font-medium transition-colors"
            >
              {allSelected ? "取消全选" : "全选"}
            </button>
            {selectedIds.size > 0 && (
              <>
                <span className="text-[0.733rem] text-text-quaternary">已选 {selectedIds.size} 项</span>
                <button
                  onClick={() => setBatchDeleteConfirm(true)}
                  className="px-3 py-1 bg-danger/10 border border-danger/30 text-danger rounded-md text-[0.8rem] font-medium hover:bg-danger/20 transition-colors"
                >
                  批量删除
                </button>
              </>
            )}
          </div>
        )}

        {templates.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border rounded-lg bg-surface/30">
            <div className="w-12 h-12 rounded-xl bg-brand-bg text-brand-accent flex items-center justify-center mx-auto mb-4 text-xl">
              ⊞
            </div>
            <p className="text-text-secondary font-medium text-[0.867rem]">还没有导入模板</p>
            <p className="text-[0.733rem] text-text-quaternary mt-1">点击上方按钮导入 .docx 模板文件，或下载示例模板</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 card-grid">
            {templates.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                selected={selectedIds.has(t.id)}
                onToggleSelect={() => toggleSelect(t.id)}
                onUse={handleUse}
                onDelete={handleDelete}
                onRename={handleRename}
              />
            ))}
          </div>
        )}

        <ValidationPanel result={validationResult} onDismiss={() => setValidationResult(null)} />
      </div>

      {deleteTarget && (
        <ConfirmDialog
          title="删除模板"
          message="确定删除此模板？此操作无法撤销。"
          confirmLabel="删除"
          danger
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {batchDeleteConfirm && (
        <ConfirmDialog
          title="批量删除"
          message={`确定删除选中的 ${selectedIds.size} 个模板？此操作无法撤销。`}
          confirmLabel="删除"
          danger
          onConfirm={handleBatchDelete}
          onCancel={() => setBatchDeleteConfirm(false)}
        />
      )}
    </DropZone>
  );
}

function TemplateCard({
  template,
  selected,
  onToggleSelect,
  onUse,
  onDelete,
  onRename,
}: {
  template: TemplateMeta;
  selected: boolean;
  onToggleSelect: () => void;
  onUse: (t: TemplateMeta) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, newName: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(template.name);
  const sizeKb = (template.size / 1024).toFixed(1);

  const handleSaveName = () => {
    if (name.trim() && name !== template.name) {
      onRename(template.id, name.trim());
    }
    setEditing(false);
  };

  return (
    <div className={`bg-surface rounded-lg border p-4 transition-all duration-100 group relative ${
      selected ? "border-brand-accent bg-brand-bg/30" : "border-border hover:border-border-strong"
    }`}>
      {/* Checkbox */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
        className={`absolute top-3 left-3 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
          selected ? "bg-brand-accent border-brand-accent" : "border-border-strong bg-canvas opacity-0 group-hover:opacity-100"
        } ${selected ? "opacity-100" : ""}`}
      >
        {selected && <span className="text-white text-[0.533rem]">✓</span>}
      </button>

      <div className="flex items-start gap-3 ml-5">
        <div className="w-8 h-8 rounded-md bg-brand-bg text-brand-accent flex items-center justify-center text-[0.733rem] font-bold shrink-0">
          D
        </div>
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
              autoFocus
              className="text-ui text-[0.867rem] text-text w-full border-b border-brand-accent outline-none bg-transparent py-0.5"
            />
          ) : (
            <h3
              className="text-ui text-[0.867rem] text-text truncate cursor-pointer hover:text-brand-accent transition-colors"
              onDoubleClick={() => setEditing(true)}
              title="双击编辑名称"
            >
              {template.name}
            </h3>
          )}
          <p className="text-[0.667rem] text-text-quaternary mt-0.5 font-mono">
            {sizeKb} KB · .docx · {template.imported_at ? new Date(parseInt(template.imported_at) * 1000).toLocaleDateString() : ""}
          </p>
        </div>
        <button
          onClick={() => onDelete(template.id)}
          className="text-text-quaternary/30 hover:text-danger text-[0.733rem] opacity-0 group-hover:opacity-100 transition-opacity"
        >
          ✕
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => onUse(template)}
          className="px-3 py-1.5 bg-brand text-white rounded-md text-[0.8rem] font-medium hover:bg-brand-hover transition-colors"
        >
          使用此模板
        </button>
        <button
          onClick={() => setEditing(true)}
          className="px-3 py-1.5 bg-surface-hover border border-border text-text-secondary rounded-md text-[0.8rem] hover:bg-surface-active transition-colors"
        >
          重命名
        </button>
      </div>
    </div>
  );
}
