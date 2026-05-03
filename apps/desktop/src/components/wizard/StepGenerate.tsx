import { useState } from "react";
import { useAppStore } from "../../stores/app-store";
import { parseExcel, renderReport } from "../../services/api";
import { openReport, saveReportAs, getAppDataDir } from "../../services/tauri-commands";
import { crossValidate } from "../../services/validation";
import { ValidationResult } from "../../types";
import { ValidationPanel } from "../ValidationPanel";

export function StepGenerate() {
  const {
    excelContent,
    excelFilePath,
    templates,
    selectedTemplateId,
    config,
    setExcelContent,
    setOutputReportPath,
    addLog,
    setWizardStep,
  } = useAppStore();

  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);
  const [tempPath, setTempPath] = useState<string | null>(null);
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  const template = templates.find((t) => t.id === selectedTemplateId);

  const handleGenerate = async () => {
    if (!template) return;
    setGenerating(true);
    setError(null);
    setValidationResult(null);
    addLog("开始生成报告...");

    try {
      // Cross-validate all inputs
      if (excelFilePath && template) {
        addLog("校验文件...");
        const crossVal = await crossValidate(template.path, excelFilePath, config);
        setValidationResult(crossVal);
        if (!crossVal.canProceed) {
          setError(`校验失败: ${crossVal.summary.errors} 个错误`);
          addLog(`校验失败: ${crossVal.summary.errors} 个错误, ${crossVal.summary.warnings} 个警告`);
          setGenerating(false);
          return;
        }
        if (crossVal.issues.length > 0) {
          addLog(`校验通过，有 ${crossVal.summary.warnings} 个警告`);
        }
      }
      let content = excelContent;
      if (excelFilePath) {
        addLog("使用当前配置重新解析数据...");
        const parseRes = await parseExcel({
          input_path: excelFilePath,
          config,
        });
        if (parseRes.success && parseRes.content) {
          content = parseRes.content;
          setExcelContent(content);
          addLog(`重新解析完成: ${content.sections?.length || 0} 个章节`);
        } else {
          addLog(`重新解析失败，使用缓存数据: ${parseRes.error?.message}`);
        }
      }

      if (!content) {
        setError("没有可用的报告数据");
        return;
      }

      const appDir = await getAppDataDir();
      const res = await renderReport({
        content,
        template_path: template.path,
        output_dir: `${appDir}/temp-${Date.now()}`,
      });

      if (res.success && res.output_path) {
        setTempPath(res.output_path);
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

  const handleSaveAs = async () => {
    if (!tempPath) return;
    try {
      const name = `${template?.name || "报告"}_${new Date().toISOString().slice(0, 10)}.docx`;
      addLog("选择保存位置...");
      const dest = await saveReportAs(tempPath, name);
      if (dest) {
        setSavedPath(dest);
        setOutputReportPath(dest);
        addLog(`报告已保存到: ${dest}`);
      }
    } catch (e) {
      addLog(`保存失败: ${e}`);
      setError(`保存失败: ${e}`);
    }
  };

  const handleOpen = async () => {
    const path = savedPath || tempPath;
    if (!path) return;
    try {
      await openReport(path);
    } catch (e) {
      addLog(`打开失败: ${e}`);
      setError(`打开报告失败: ${e}`);
    }
  };

  const displayPath = savedPath || tempPath;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-heading text-lg text-text">生成报告</h2>
        <p className="text-caption text-text-muted mt-1">确认信息后生成 Word 文档报告</p>
      </div>

      {/* Summary */}
      <div className="bg-surface rounded-lg border border-border divide-y divide-border-subtle">
        <div className="px-4 py-2.5 flex items-center justify-between">
          <span className="text-[0.733rem] text-text-quaternary">模板</span>
          <span className="text-[0.867rem] text-text font-medium">{template?.name || "未选择"}</span>
        </div>
        <div className="px-4 py-2.5 flex items-center justify-between">
          <span className="text-[0.733rem] text-text-quaternary">配置</span>
          <span className="text-[0.867rem] text-text font-medium">{config?.title || "默认"}</span>
        </div>
        <div className="px-4 py-2.5 flex items-center justify-between">
          <span className="text-[0.733rem] text-text-quaternary">数据章节</span>
          <span className="text-[0.867rem] text-text font-medium font-mono">{excelContent?.sections?.length || 0} 个</span>
        </div>
      </div>

      {!done && !generating && (
        <div className="flex gap-3">
          <button onClick={() => setWizardStep(2)} className="px-4 py-2 bg-surface border border-border text-text-secondary rounded-md hover:bg-surface-hover text-[0.867rem] transition-colors">
            ← 上一步
          </button>
          <button
            onClick={handleGenerate}
            disabled={!excelContent || !template}
            className="flex-1 py-2 bg-brand text-white rounded-md hover:bg-brand-hover font-medium text-[0.867rem] disabled:bg-surface disabled:text-text-quaternary disabled:border disabled:border-border transition-colors"
          >
            生成 .docx 报告
          </button>
        </div>
      )}

      {generating && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-7 w-7 border-2 border-brand-accent border-t-transparent mb-3" />
          <p className="text-[0.867rem] text-text-muted">正在生成报告...</p>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-danger-bg border border-danger-border rounded-lg text-[0.867rem] text-danger">
          {error}
        </div>
      )}

      <ValidationPanel result={validationResult} />

      {done && displayPath && (
        <div className="bg-success-bg border border-success-border rounded-lg p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-success text-white flex items-center justify-center text-[0.667rem]">✓</div>
            <span className="text-ui text-[0.867rem] text-text">
              {savedPath ? "报告已保存" : "报告生成成功"}
            </span>
          </div>
          <p className="text-[0.733rem] text-text-quaternary break-all pl-7 font-mono">{displayPath}</p>
          <div className="flex gap-2 flex-wrap pl-7 pt-1">
            {!savedPath && (
              <button onClick={handleSaveAs} className="px-3 py-1.5 bg-brand text-white rounded-md hover:bg-brand-hover text-[0.8rem] font-medium transition-colors">
                另存为...
              </button>
            )}
            {savedPath && (
              <button onClick={handleOpen} className="px-3 py-1.5 bg-success text-white rounded-md hover:brightness-110 text-[0.8rem] font-medium transition-colors">
                打开报告
              </button>
            )}
            <button onClick={handleSaveAs} className="px-3 py-1.5 bg-surface border border-border text-text-secondary rounded-md hover:bg-surface-hover text-[0.8rem] transition-colors">
              {savedPath ? "另存一份" : "保存到其他位置"}
            </button>
            <button onClick={() => setWizardStep(0)} className="px-3 py-1.5 bg-surface border border-border text-text-secondary rounded-md hover:bg-surface-hover text-[0.8rem] transition-colors">
              重新开始
            </button>
          </div>
          {!savedPath && (
            <p className="text-[0.667rem] text-text-quaternary pl-7">提示：请先"另存为"选择保存位置，然后打开报告</p>
          )}
        </div>
      )}
    </div>
  );
}
