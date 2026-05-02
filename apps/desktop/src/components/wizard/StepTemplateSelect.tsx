import { useState } from "react";
import { useAppStore } from "../../stores/app-store";
import { listTemplates, selectDocx, importTemplate, deleteTemplate, renameTemplate } from "../../services/tauri-commands";
import { useEffect } from "react";

export function StepTemplateSelect() {
  const { templates, setTemplates, selectedTemplateId, selectTemplate, setWizardStep, addLog } =
    useAppStore();

  useEffect(() => {
    listTemplates().then(setTemplates).catch(console.error);
  }, [setTemplates]);

  const handleImport = async () => {
    const path = await selectDocx();
    if (!path) return;
    try {
      addLog(`导入模板: ${path}`);
      const meta = await importTemplate(path);
      setTemplates([meta, ...templates]);
      selectTemplate(meta.id);
      addLog(`模板导入成功: ${meta.name}`);
    } catch (e) {
      addLog(`导入失败: ${e}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除此模板？")) return;
    await deleteTemplate(id);
    setTemplates(templates.filter((t) => t.id !== id));
    if (selectedTemplateId === id) selectTemplate(null);
  };

  const handleRename = async (id: string, newName: string) => {
    await renameTemplate(id, newName);
    setTemplates(templates.map((t) => (t.id === id ? { ...t, name: newName } : t)));
  };

  const handleNext = () => {
    if (selectedTemplateId) {
      setWizardStep(1);
    }
  };

  const selected = templates.find((t) => t.id === selectedTemplateId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-heading text-lg text-text">选择报告模板</h2>
        <p className="text-caption text-text-muted mt-1">选择或导入一个 .docx 模板文件作为报告基础</p>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-lg bg-surface/30">
          <div className="w-10 h-10 rounded-lg bg-brand-bg text-brand-accent flex items-center justify-center mx-auto mb-4 text-lg">
            ⊞
          </div>
          <p className="text-text-secondary font-medium text-[13px]">还没有导入模板</p>
          <p className="text-[11px] text-text-quaternary mt-1">点击下方按钮导入 .docx 模板文件</p>
          <button
            onClick={handleImport}
            className="mt-5 px-5 py-2 bg-brand text-white rounded-md hover:bg-brand-hover text-[13px] font-medium transition-colors"
          >
            导入模板文件
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            {templates.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                selected={selectedTemplateId === t.id}
                onSelect={() => selectTemplate(t.id)}
                onDelete={handleDelete}
                onRename={handleRename}
              />
            ))}
            <button
              onClick={handleImport}
              className="p-4 rounded-lg border border-dashed border-border hover:border-brand-border hover:bg-brand-bg flex items-center justify-center gap-2 text-text-quaternary hover:text-brand-accent transition-all duration-100 min-h-[68px]"
            >
              <span className="text-base">+</span>
              <span className="text-[13px] font-medium">导入新模板</span>
            </button>
          </div>

          {selected && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-[13px] text-text-secondary">
                已选择: <span className="font-medium text-text">{selected.name}</span>
              </p>
              <button
                onClick={handleNext}
                className="px-5 py-2 bg-brand text-white rounded-md hover:bg-brand-hover text-[13px] font-medium transition-colors"
              >
                下一步：导入数据 →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TemplateCard({
  template,
  selected,
  onSelect,
  onDelete,
  onRename,
}: {
  template: { id: string; name: string; size: number };
  selected: boolean;
  onSelect: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(template.name);

  const handleSave = () => {
    if (name.trim() && name !== template.name) onRename(template.id, name.trim());
    setEditing(false);
  };

  return (
    <div
      onClick={() => !editing && onSelect()}
      className={`p-3.5 rounded-lg border cursor-pointer transition-all duration-100 relative group ${
        selected
          ? "border-brand-border bg-brand-bg"
          : "border-border bg-surface hover:border-border-strong"
      }`}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(template.id); }}
        className="absolute top-2.5 right-2.5 text-text-quaternary/50 hover:text-danger text-[11px] opacity-0 group-hover:opacity-100 transition-opacity"
      >
        ✕
      </button>
      <div className="flex items-start gap-2.5">
        <div className={`w-8 h-8 rounded-md flex items-center justify-center text-[11px] shrink-0 ${
          selected ? "bg-brand text-white" : "bg-surface-hover text-text-muted"
        }`}>
          {selected ? "✓" : "D"}
        </div>
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleSave}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              onClick={(e) => e.stopPropagation()}
              autoFocus
              className="font-medium text-[13px] w-full border-b border-brand-accent outline-none bg-transparent py-0.5 text-text"
            />
          ) : (
            <p
              className="font-medium text-[13px] truncate pr-4 text-text"
              onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
            >
              {template.name}
            </p>
          )}
          <p className="text-[10px] text-text-quaternary mt-0.5 font-mono">{(template.size / 1024).toFixed(1)} KB · .docx</p>
        </div>
      </div>
    </div>
  );
}
