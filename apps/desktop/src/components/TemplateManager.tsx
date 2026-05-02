import { useEffect } from "react";
import { useAppStore, TemplateMeta } from "../stores/app-store";
import { listTemplates, importTemplate, deleteTemplate, selectDocx } from "../services/tauri-commands";

export function TemplateManager() {
  const { templates, setTemplates, setCurrentView, selectTemplate } = useAppStore();

  useEffect(() => {
    listTemplates().then(setTemplates).catch(console.error);
  }, [setTemplates]);

  const handleImport = async () => {
    const path = await selectDocx();
    if (!path) return;
    try {
      const meta = await importTemplate(path);
      setTemplates([meta, ...templates]);
    } catch (e) {
      console.error("Import failed:", e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除此模板？")) return;
    await deleteTemplate(id);
    setTemplates(templates.filter((t) => t.id !== id));
  };

  const handleUse = (t: TemplateMeta) => {
    selectTemplate(t.id);
    setCurrentView("wizard");
  };

  return (
    <div className="flex-1 p-6 overflow-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">模板管理</h2>
        <button
          onClick={handleImport}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
        >
          + 导入模板
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📄</p>
          <p>还没有导入模板</p>
          <p className="text-sm mt-1">点击上方按钮导入 .docx 模板文件</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <TemplateCard key={t.id} template={t} onUse={handleUse} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

function TemplateCard({
  template,
  onUse,
  onDelete,
}: {
  template: TemplateMeta;
  onUse: (t: TemplateMeta) => void;
  onDelete: (id: string) => void;
}) {
  const sizeKb = (template.size / 1024).toFixed(1);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-800 truncate">{template.name}</h3>
          <p className="text-xs text-gray-400 mt-1">{sizeKb} KB</p>
        </div>
        <button
          onClick={() => onDelete(template.id)}
          className="text-gray-300 hover:text-red-500 text-sm ml-2"
        >
          ✕
        </button>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => onUse(template)}
          className="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700"
        >
          使用此模板
        </button>
      </div>
    </div>
  );
}
