import { useState } from "react";
import { parseExcel } from "../services/api";
import { selectExcel } from "../services/tauri-commands";
import { ReportContent, BudgetConfig } from "../types";
import { WarningList } from "./WarningList";

interface Props {
  onParsed: (content: ReportContent) => void;
  addLog: (msg: string) => void;
}

const DEFAULT_CONFIG: BudgetConfig = {
  title: "预算报告",
  summary: {
    sheet_name: "汇总页",
    mode: "table",
    header_row: 1,
    key_column: "科目",
    value_column: "金额（元）",
    prefix: "SUMMARY_",
  },
  sheets: [
    {
      name: "设备费明细",
      sheet_name: "设备费",
      id: "equipment_fee",
      columns: {
        name: "名称",
        spec: "规格",
        unit_price: "单价",
        quantity: "数量",
        amount: "经费",
        reason: "购置理由",
        basis: "测算依据",
      },
      image_columns: ["报价截图"],
    },
  ],
};

export function ExcelImport({ onParsed, addLog }: Props) {
  const [filePath, setFilePath] = useState("");
  const [loading, setLoading] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState("");

  const handleSelectFile = async () => {
    const path = await selectExcel();
    if (path) {
      setFilePath(path);
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
        config: DEFAULT_CONFIG,
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
      {error && <div className="p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}
      <WarningList warnings={warnings} />
      <button onClick={handleParse} disabled={!filePath || loading} className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
        {loading ? "解析中..." : "下一步：解析 Excel"}
      </button>
    </div>
  );
}
