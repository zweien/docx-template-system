import { useEffect, useState } from "react";
import { useAppStore, TemplateMeta } from "../stores/app-store";
import { listTemplates, importTemplate, deleteTemplate, renameTemplate, selectDocx } from "../services/tauri-commands";
import { validateTemplate } from "../services/validation";
import { ValidationResult } from "../types";
import { ValidationPanel } from "./ValidationPanel";

export function TemplateManager() {
  const { templates, setTemplates, setCurrentView, selectTemplate, addLog } = useAppStore();
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  useEffect(() => {
    listTemplates().then(setTemplates).catch(console.error);
  }, [setTemplates]);

  const handleImport = async () => {
    const path = await selectDocx();
    if (!path) return;
    try {
      const meta = await importTemplate(path);
      setTemplates([meta, ...templates]);
      addLog(`模板导入成功: ${meta.name}`);

      const vr = await validateTemplate(meta.path);
      if (vr.issues.length > 0) {
        setValidationResult(vr);
        addLog(`模板校验: ${vr.summary.errors} 个错误, ${vr.summary.warnings} 个警告`);
      } else {
        setValidationResult(null);
      }
    } catch (e) {
      addLog(`导入失败: ${e}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除此模板？")) return;
    await deleteTemplate(id);
    setTemplates(templates.filter((t) => t.id !== id));
  };

  const handleRename = async (id: string, newName: string) => {
    await renameTemplate(id, newName);
    setTemplates(templates.map((t) => (t.id === id ? { ...t, name: newName } : t)));
  };

  const handleUse = (t: TemplateMeta) => {
    selectTemplate(t.id);
    setCurrentView("wizard");
  };

  return (
    <div className="content-page flex-1 overflow-auto">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-heading text-lg text-text">模板管理</h2>
            <p className="text-caption text-text-muted mt-1">管理和导入报告模板</p>
          </div>
          <button
            onClick={handleImport}
            className="px-4 py-2 bg-brand text-white rounded-md hover:bg-brand-hover text-[0.867rem] font-medium transition-colors"
          >
            + 导入模板
          </button>
        </div>

        {templates.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border rounded-lg bg-surface/30">
            <div className="w-12 h-12 rounded-xl bg-brand-bg text-brand-accent flex items-center justify-center mx-auto mb-4 text-xl">
              ⊞
            </div>
            <p className="text-text-secondary font-medium text-[0.867rem]">还没有导入模板</p>
            <p className="text-[0.733rem] text-text-quaternary mt-1">点击上方按钮导入 .docx 模板文件</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 card-grid">
            {templates.map((t) => (
              <TemplateCard key={t.id} template={t} onUse={handleUse} onDelete={handleDelete} onRename={handleRename} />
            ))}
          </div>
        )}

        <ValidationPanel result={validationResult} onDismiss={() => setValidationResult(null)} />
      </div>
    </div>
  );
}

function TemplateCard({
  template,
  onUse,
  onDelete,
  onRename,
}: {
  template: TemplateMeta;
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
    <div className="bg-surface rounded-lg border border-border p-4 hover:border-border-strong transition-all duration-100 group">
      <div className="flex items-start gap-3">
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
