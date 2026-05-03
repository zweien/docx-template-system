import { useState } from "react";
import { parseExcel } from "../services/api";
import { selectExcel } from "../services/tauri-commands";
import { ReportContent, ValidationResult } from "../types";
import { useAppStore } from "../stores/app-store";
import { WarningList } from "./WarningList";
import { ValidationPanel } from "./ValidationPanel";
import { ConfigSelector } from "./ConfigSelector";
import { saveDataAs } from "../services/tauri-commands";
import { validateExcel } from "../services/validation";

interface Props {
  onParsed: (content: ReportContent) => void;
  addLog: (msg: string) => void;
}

async function fetchAndSave(url: string, filename: string) {
  const res = await fetch(`http://localhost:1420${url}`);
  const blob = await res.blob();
  const reader = new FileReader();
  const base64 = await new Promise<string>((resolve) => {
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.split(",", 2)[1]);
    };
    reader.readAsDataURL(blob);
  });
  await saveDataAs(filename, base64, true);
}

async function downloadSampleXlsx() {
  await fetchAndSave("/samples/sample-budget.xlsx", "sample-budget.xlsx");
}

async function downloadSampleConfig() {
  await fetchAndSave("/samples/sample-config.json", "sample-config.json");
}

export function ExcelImport({ onParsed, addLog }: Props) {
  const { config, setWizardStep, setExcelFilePath } = useAppStore();
  const [filePath, setFilePath] = useState("");
  const [loading, setLoading] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  const handleSelectFile = async () => {
    const path = await selectExcel();
    if (path) {
      setFilePath(path);
      setExcelFilePath(path);
      setError("");
      addLog(`选择文件: ${path}`);
    }
  };

  const handleParse = async () => {
    if (!filePath) return;
    setLoading(true);
    setWarnings([]);
    setError("");
    setValidationResult(null);
    try {
      // Pre-flight validation
      const preCheck = await validateExcel(filePath, config);
      setValidationResult(preCheck);
      if (!preCheck.canProceed) {
        setError(`Excel 校验失败: ${preCheck.summary.errors} 个错误`);
        addLog(`Excel 校验失败: ${preCheck.summary.errors} 个错误, ${preCheck.summary.warnings} 个警告`);
        setLoading(false);
        return;
      }

      const res = await parseExcel({
        input_path: filePath,
        config,
      });
      if (res.success && res.content) {
        setWarnings(res.warnings);
        addLog(`解析完成: ${res.content.sections?.length || 0} 个章节`);
        if (res.warnings.length > 0) {
          addLog(`警告: ${res.warnings.length} 条`);
        }
        onParsed(res.content);
      } else {
        setError(res.error?.message || "解析失败");
        addLog(`错误: ${res.error?.message}`);
      }
    } catch (e) {
      setError(String(e));
      addLog(`异常: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const fileName = filePath ? filePath.split("/").pop() || filePath : "";

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-heading text-lg text-text">导入 Excel 数据源</h2>
        <p className="text-caption text-text-muted mt-1">选择包含预算数据的 Excel 文件，配置映射规则后解析</p>
      </div>

      {/* File picker */}
      <div className="flex gap-3 items-center">
        <button
          onClick={handleSelectFile}
          className="shrink-0 px-4 py-2 bg-brand text-white rounded-md hover:bg-brand-hover text-[0.867rem] font-medium transition-colors"
        >
          选择文件
        </button>
        <div className={`flex-1 px-3 py-2 rounded-md border text-[0.867rem] truncate ${
          filePath ? "border-border bg-surface text-text" : "border-dashed border-border text-text-quaternary bg-surface/50"
        }`}>
          {fileName || "点击选择 Excel 文件..."}
        </div>
      </div>

      {/* Sample downloads */}
      <div className="sample-bar flex items-center gap-3 px-3 py-2 bg-surface/60 rounded-md border border-dashed border-border text-[0.8rem]">
        <span className="text-text-quaternary">首次使用？下载示例文件了解格式要求：</span>
        <button
          onClick={downloadSampleXlsx}
          className="text-brand-accent hover:text-brand-hover font-medium transition-colors"
        >
          示例 Excel
        </button>
        <span className="text-border">|</span>
        <button
          onClick={downloadSampleConfig}
          className="text-brand-accent hover:text-brand-hover font-medium transition-colors"
        >
          示例配置
        </button>
      </div>

      <ConfigSelector />

      {error && (
        <div className="p-3 bg-danger-bg border border-danger-border rounded-md text-[0.867rem] text-danger">
          {error}
        </div>
      )}
      <WarningList warnings={warnings} />
      <ValidationPanel result={validationResult} onProceed={() => setValidationResult(null)} />

      <div className="flex gap-3 pt-1">
        <button onClick={() => setWizardStep(0)} className="px-4 py-2 bg-surface border border-border text-text-secondary rounded-md hover:bg-surface-hover text-[0.867rem] transition-colors">
          ← 上一步
        </button>
        <button
          onClick={handleParse}
          disabled={!filePath || loading}
          className="px-5 py-2 bg-brand text-white rounded-md hover:bg-brand-hover text-[0.867rem] font-medium disabled:bg-surface disabled:text-text-quaternary disabled:border disabled:border-border transition-colors"
        >
          {loading ? "解析中..." : "解析并继续 →"}
        </button>
      </div>
    </div>
  );
}
