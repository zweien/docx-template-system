import { useState } from "react";
import { useAppStore } from "../../stores/app-store";
import { renderReport } from "../../services/api";
import { openReport } from "../../services/tauri-commands";

export function StepGenerate() {
  const {
    excelContent,
    templates,
    selectedTemplateId,
    config,
    setOutputReportPath,
    addLog,
    setWizardStep,
  } = useAppStore();

  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);
  const [outputPath, setOutputPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const template = templates.find((t) => t.id === selectedTemplateId);

  const handleGenerate = async () => {
    if (!excelContent || !template) return;
    setGenerating(true);
    setError(null);
    addLog("开始生成报告...");

    try {
      const res = await renderReport({
        content: excelContent,
        template_path: template.path,
        output_dir: `/tmp/budget-report-${Date.now()}`,
      });

      if (res.success && res.output_path) {
        setOutputPath(res.output_path);
        setOutputReportPath(res.output_path);
        setDone(true);
        addLog(`报告生成成功: ${res.output_path}`);
      } else {
        setError(res.error?.message || "生成失败");
        addLog(`生成失败: ${res.error?.message}`);
      }
    } catch (e) {
      setError(String(e));
      addLog(`生成异常: ${e}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleOpen = async () => {
    if (outputPath) await openReport(outputPath);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">生成报告</h2>

      <div className="bg-white rounded-lg border p-4 space-y-3">
        <div className="flex justify-between">
          <span className="text-gray-500">模板</span>
          <span className="text-gray-800">{template?.name || "未选择"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">配置</span>
          <span className="text-gray-800">{config?.title || "默认"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">数据章节</span>
          <span className="text-gray-800">{excelContent?.sections?.length || 0} 个</span>
        </div>
      </div>

      {!done && !generating && (
        <button
          onClick={handleGenerate}
          disabled={!excelContent || !template}
          className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
        >
          生成 .docx 报告
        </button>
      )}

      {generating && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mb-3" />
          <p className="text-gray-600">正在生成报告...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm">{error}</div>
      )}

      {done && outputPath && (
        <div className="bg-green-50 rounded-lg p-4 space-y-3">
          <p className="text-green-700 font-medium">报告生成成功!</p>
          <p className="text-sm text-gray-600 break-all">{outputPath}</p>
          <div className="flex gap-3">
            <button
              onClick={handleOpen}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
            >
              打开报告
            </button>
            <button
              onClick={() => setWizardStep(0)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
            >
              重新开始
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
