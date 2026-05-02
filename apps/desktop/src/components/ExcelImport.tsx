import { useState } from "react";
import { parseExcel } from "../services/api";
import { selectExcel } from "../services/tauri-commands";
import { ReportContent } from "../types";
import { useAppStore } from "../stores/app-store";
import { WarningList } from "./WarningList";
import { ConfigSelector } from "./ConfigSelector";

interface Props {
  onParsed: (content: ReportContent) => void;
  addLog: (msg: string) => void;
}

export function ExcelImport({ onParsed, addLog }: Props) {
  const { config, setWizardStep, setExcelFilePath } = useAppStore();
  const [filePath, setFilePath] = useState("");
  const [loading, setLoading] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState("");

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
    try {
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

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">导入 Excel 数据源</h2>
      <div className="flex gap-2 items-center">
        <input value={filePath} placeholder="选择 Excel 文件..." className="flex-1 px-3 py-2 border rounded bg-gray-50" readOnly />
        <button onClick={handleSelectFile} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">浏览...</button>
      </div>

      <ConfigSelector />

      {error && <div className="p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}
      <WarningList warnings={warnings} />
      <div className="flex gap-3">
        <button onClick={() => setWizardStep(0)} className="px-4 py-2 border border-gray-300 text-gray-600 rounded hover:bg-gray-50">
          上一步
        </button>
        <button onClick={handleParse} disabled={!filePath || loading} className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
          {loading ? "解析中..." : "解析并继续"}
        </button>
      </div>
    </div>
  );
}
