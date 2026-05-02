import { useAppStore } from "../../stores/app-store";

export function StepConfigure() {
  const { excelContent, templates, selectedTemplateId, config, setWizardStep, addLog } =
    useAppStore();

  const template = templates.find((t) => t.id === selectedTemplateId);

  const handleNext = () => {
    addLog("配置确认，准备生成报告");
    setWizardStep(3);
  };

  if (!excelContent) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold">配置与预览</h2>
        <p className="text-gray-400">请先完成上一步的数据导入</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">配置与预览</h2>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">模板</h3>
          <p className="text-gray-800">{template?.name || "未选择"}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">配置方案</h3>
          <p className="text-gray-800">{config?.title || "默认配置"}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border p-4">
        <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">
          数据预览 ({excelContent.sections?.length || 0} 个章节)
        </h3>
        {excelContent.sections?.map((section, i) => (
          <div key={section.id || i} className="flex items-center justify-between py-2 border-b last:border-0">
            <span className="text-gray-700">{section.name}</span>
            <span className="text-sm text-gray-400">{section.blocks?.length || 0} 个内容块</span>
          </div>
        ))}
        {excelContent.extra_context && Object.keys(excelContent.extra_context).length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs text-gray-500 mb-1">附加上下文变量</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(excelContent.extra_context).map(([k, v]) => (
                <span key={k} className="text-xs bg-gray-100 px-2 py-1 rounded">
                  {k}: {String(v).slice(0, 30)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleNext}
          className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          下一步：生成报告
        </button>
      </div>
    </div>
  );
}
