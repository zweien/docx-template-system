import { useAppStore } from "../../stores/app-store";
import { listTemplates, selectDocx, importTemplate } from "../../services/tauri-commands";
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

  const handleNext = () => {
    if (selectedTemplateId) {
      setWizardStep(1);
    }
  };

  const selected = templates.find((t) => t.id === selectedTemplateId);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">选择报告模板</h2>

      {templates.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-3xl mb-3">📄</p>
          <p>还没有导入模板</p>
          <button
            onClick={handleImport}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            导入 .docx 模板
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {templates.map((t) => (
              <div
                key={t.id}
                onClick={() => selectTemplate(t.id)}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedTemplateId === t.id
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <p className="font-medium text-sm truncate">{t.name}</p>
                <p className="text-xs text-gray-400 mt-1">{(t.size / 1024).toFixed(1)} KB</p>
              </div>
            ))}
            <div
              onClick={handleImport}
              className="p-3 rounded-lg border border-dashed border-gray-300 cursor-pointer hover:border-blue-400 hover:bg-blue-50 flex items-center justify-center text-gray-400 hover:text-blue-500"
            >
              <span className="text-sm">+ 导入新模板</span>
            </div>
          </div>

          {selected && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-gray-600">
                已选择: <span className="font-medium">{selected.name}</span>
              </p>
              <button
                onClick={handleNext}
                className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                下一步：导入数据
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
