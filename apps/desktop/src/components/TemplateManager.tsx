import { useEffect, useState } from "react";
import { useAppStore, TemplateMeta } from "../stores/app-store";
import { listTemplates, importTemplate, deleteTemplate, renameTemplate, selectDocx } from "../services/tauri-commands";

export function TemplateManager() {
  const { templates, setTemplates, setCurrentView, selectTemplate, addLog } = useAppStore();

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
    <div className="flex-1 p-8 overflow-auto">
      <div className="max-w-3xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-heading text-lg text-text">模板管理</h2>
            <p className="text-caption text-text-muted mt-1">管理和导入报告模板</p>
          </div>
          <button
            onClick={handleImport}
            className="px-4 py-2 bg-brand text-white rounded-md hover:bg-brand-hover text-[13px] font-medium transition-colors"
          >
            + 导入模板
          </button>
        </div>

        {templates.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border rounded-lg bg-surface/30">
            <div className="w-12 h-12 rounded-xl bg-brand-bg text-brand-accent flex items-center justify-center mx-auto mb-4 text-xl">
              ⊞
            </div>
            <p className="text-text-secondary font-medium text-[13px]">还没有导入模板</p>
            <p className="text-[11px] text-text-quaternary mt-1">点击上方按钮导入 .docx 模板文件</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {templates.map((t) => (
              <TemplateCard key={t.id} template={t} onUse={handleUse} onDelete={handleDelete} onRename={handleRename} />
            ))}
          </div>
        )}
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
        <div className="w-8 h-8 rounded-md bg-brand-bg text-brand-accent flex items-center justify-center text-[11px] font-bold shrink-0">
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
              className="text-ui text-[13px] text-text w-full border-b border-brand-accent outline-none bg-transparent py-0.5"
            />
          ) : (
            <h3
              className="text-ui text-[13px] text-text truncate cursor-pointer hover:text-brand-accent transition-colors"
              onDoubleClick={() => setEditing(true)}
              title="双击编辑名称"
            >
              {template.name}
            </h3>
          )}
          <p className="text-[10px] text-text-quaternary mt-0.5 font-mono">{sizeKb} KB · .docx</p>
        </div>
        <button
          onClick={() => onDelete(template.id)}
          className="text-text-quaternary/30 hover:text-danger text-[11px] opacity-0 group-hover:opacity-100 transition-opacity"
        >
          ✕
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => onUse(template)}
          className="px-3 py-1.5 bg-brand text-white rounded-md text-[12px] font-medium hover:bg-brand-hover transition-colors"
        >
          使用此模板
        </button>
        <button
          onClick={() => setEditing(true)}
          className="px-3 py-1.5 bg-surface-hover border border-border text-text-secondary rounded-md text-[12px] hover:bg-surface-active transition-colors"
        >
          重命名
        </button>
      </div>
    </div>
  );
}
