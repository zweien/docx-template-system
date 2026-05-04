import { useState, useEffect } from "react";
import { useAppStore } from "../stores/app-store";
import { listConfigs, exportConfig, selectExcel } from "../services/tauri-commands";
import { validateExcelData } from "../services/api";
import type { BudgetConfig, ConfigMeta, ExcelValidationResponse, SheetValidationResult, SummaryValidationResult } from "../types";

type ConfigSource = "saved" | "import";

export function DataValidation() {
  const { addLog } = useAppStore();

  // Config source
  const [configSource, setConfigSource] = useState<ConfigSource>("saved");
  const [savedConfigs, setSavedConfigs] = useState<ConfigMeta[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
  const [importedConfig, setImportedConfig] = useState<BudgetConfig | null>(null);
  const [importFileName, setImportFileName] = useState<string>("");

  // Excel file
  const [excelPath, setExcelPath] = useState<string | null>(null);
  const [excelFileName, setExcelFileName] = useState<string>("");

  // Results
  const [results, setResults] = useState<ExcelValidationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [loadedSavedConfig, setLoadedSavedConfig] = useState<BudgetConfig | null>(null);

  useEffect(() => {
    listConfigs().then(setSavedConfigs).catch(() => {});
  }, []);

  const handleSelectSavedConfig = async (id: string) => {
    setSelectedConfigId(id);
    try {
      const json = await exportConfig(id);
      setLoadedSavedConfig(JSON.parse(json));
    } catch {
      setLoadedSavedConfig(null);
    }
  };

  const handleImportJson = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const cfg = JSON.parse(e.target?.result as string) as BudgetConfig;
          setImportedConfig(cfg);
          setImportFileName(file.name);
          addLog(`配置导入成功: ${cfg.title}`, "success");
        } catch {
          addLog("JSON 解析失败", "error");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleSelectExcel = async () => {
    const path = await selectExcel();
    if (path) {
      setExcelPath(path);
      const parts = path.replace(/\\/g, "/").split("/");
      setExcelFileName(parts[parts.length - 1]);
    }
  };

  const handleValidate = async () => {
    const config = configSource === "saved" ? loadedSavedConfig : importedConfig;
    if (!config || !excelPath) return;

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const res = await validateExcelData({ input_path: excelPath, config });
      setResults(res);
      if (res.success) {
        addLog(`校验完成: ${res.overall_pass ? "通过" : "未通过"}, ${res.total_errors} 个错误, ${res.total_warnings} 个警告`, "warn");
      } else {
        addLog(`校验失败: ${res.error?.message || "未知错误"}`, "error");
      }
    } catch (e) {
      setError(String(e));
      addLog(`校验请求失败: ${e}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const currentConfig = configSource === "saved" ? loadedSavedConfig : importedConfig;
  const canValidate = currentConfig && excelPath;

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-5xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-heading text-lg text-text">数据校验</h2>
          <p className="text-caption text-text-muted mt-1">校验 Excel 数据是否符合配置要求，输出详细校验报告</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
          {/* Left Panel: Config + Excel Selection */}
          <div className="space-y-4">
            {/* Config Source */}
            <section className="bg-surface rounded-lg border border-border p-5">
              <h3 className="text-ui text-sm text-text mb-3">配置来源</h3>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <button
                  onClick={() => setConfigSource("saved")}
                  className={`py-2 rounded-md border text-[0.8rem] font-medium transition-colors ${
                    configSource === "saved"
                      ? "border-brand-border bg-brand-bg text-brand-accent"
                      : "border-border text-text-muted hover:border-border-strong"
                  }`}
                >
                  已保存配置
                </button>
                <button
                  onClick={() => setConfigSource("import")}
                  className={`py-2 rounded-md border text-[0.8rem] font-medium transition-colors ${
                    configSource === "import"
                      ? "border-brand-border bg-brand-bg text-brand-accent"
                      : "border-border text-text-muted hover:border-border-strong"
                  }`}
                >
                  导入 JSON
                </button>
              </div>

              {configSource === "saved" ? (
                savedConfigs.length === 0 ? (
                  <p className="text-[0.8rem] text-text-quaternary">暂无已保存的配置</p>
                ) : (
                  <select
                    value={selectedConfigId || ""}
                    onChange={(e) => e.target.value && handleSelectSavedConfig(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-border bg-canvas text-text text-[0.867rem] outline-none focus:border-brand-border"
                  >
                    <option value="">选择配置...</option>
                    {savedConfigs.map((c) => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                )
              ) : (
                <div>
                  <button
                    onClick={handleImportJson}
                    className="w-full px-3 py-2 rounded-md border border-dashed border-border hover:border-brand-border text-[0.867rem] text-text-muted hover:text-brand-accent transition-colors"
                  >
                    {importFileName ? `✓ ${importFileName}` : "选择 JSON 配置文件"}
                  </button>
                </div>
              )}

              {currentConfig && (
                <div className="mt-3 p-2.5 bg-canvas rounded-md border border-border-subtle">
                  <p className="text-[0.8rem] text-text-secondary font-medium">{currentConfig.title}</p>
                  <p className="text-[0.667rem] text-text-quaternary mt-0.5">
                    {currentConfig.sheets.length} 个数据 sheet
                    {currentConfig.summary ? " + 汇总" : ""}
                  </p>
                </div>
              )}
            </section>

            {/* Excel Selection */}
            <section className="bg-surface rounded-lg border border-border p-5">
              <h3 className="text-ui text-sm text-text mb-3">Excel 文件</h3>
              <button
                onClick={handleSelectExcel}
                className="w-full px-3 py-2 rounded-md border border-dashed border-border hover:border-brand-border text-[0.867rem] text-text-muted hover:text-brand-accent transition-colors text-left"
              >
                {excelFileName ? `✓ ${excelFileName}` : "选择 Excel 文件 (.xlsx)"}
              </button>
            </section>

            {/* Validate Button */}
            <button
              onClick={handleValidate}
              disabled={!canValidate || loading}
              className={`w-full py-2.5 rounded-md text-[0.9rem] font-medium transition-colors ${
                canValidate && !loading
                  ? "bg-brand text-white hover:bg-brand-hover"
                  : "bg-border text-text-quaternary cursor-not-allowed"
              }`}
            >
              {loading ? "校验中..." : "开始校验"}
            </button>

            {error && (
              <div className="p-3 bg-danger-bg border border-danger-border rounded-lg text-[0.8rem] text-danger">
                {error}
              </div>
            )}
          </div>

          {/* Right Panel: Results */}
          <div>
            {results ? (
              <ValidationResults results={results} />
            ) : !loading ? (
              <div className="flex items-center justify-center h-64 border border-dashed border-border rounded-lg bg-surface/30">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-xl bg-brand-bg text-brand-accent flex items-center justify-center mx-auto mb-3 text-xl">✓</div>
                  <p className="text-[0.867rem] text-text-secondary">选择配置和 Excel 文件后开始校验</p>
                  <p className="text-[0.733rem] text-text-quaternary mt-1">校验结果将在此处显示</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 border border-border rounded-lg bg-surface/30">
                <div className="flex items-center gap-2 text-brand-accent">
                  <span className="animate-spin">⟳</span>
                  <span className="text-[0.9rem]">正在校验...</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Results Display ──

function ValidationResults({ results }: { results: ExcelValidationResponse }) {
  if (!results.success) {
    return (
      <div className="p-4 bg-danger-bg border border-danger-border rounded-lg">
        <h3 className="text-danger font-medium text-[0.9rem]">校验失败</h3>
        <p className="text-[0.8rem] text-danger/80 mt-1">{results.error?.message || "未知错误"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Overall Status */}
      <div className={`p-4 rounded-lg border ${
        results.overall_pass
          ? "bg-success-bg border-success-border"
          : "bg-danger-bg border-danger-border"
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`text-lg ${results.overall_pass ? "text-success" : "text-danger"}`}>
              {results.overall_pass ? "✓" : "✕"}
            </span>
            <span className={`font-medium text-[0.95rem] ${results.overall_pass ? "text-success" : "text-danger"}`}>
              {results.overall_pass ? "校验通过" : "校验未通过"}
            </span>
          </div>
          <div className="flex gap-3 text-[0.8rem]">
            <span className="text-text-secondary">配置: <span className="font-medium">{results.config_title}</span></span>
            {results.total_errors > 0 && (
              <span className="text-danger">{results.total_errors} 个错误</span>
            )}
            {results.total_warnings > 0 && (
              <span className="text-warning">{results.total_warnings} 个警告</span>
            )}
          </div>
        </div>
        <div className="mt-2 text-[0.733rem] text-text-quaternary">
          Excel 包含 {results.excel_sheets.length} 个 sheet: {results.excel_sheets.join(", ")}
        </div>
        {results.missing_sheets.length > 0 && (
          <div className="mt-2 text-[0.8rem] text-danger">
            缺失 sheet: {results.missing_sheets.join(", ")}
          </div>
        )}
      </div>

      {/* Summary Sheet */}
      {results.summary && <SummarySheetCard result={results.summary} />}

      {/* Detail Sheets */}
      {results.sheets.map((sr) => (
        <SheetResultCard key={sr.sheet_name} result={sr} />
      ))}
    </div>
  );
}

function SummarySheetCard({ result }: { result: SummaryValidationResult }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className={`bg-surface rounded-lg border ${result.found ? "border-border" : "border-danger-border"}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-2">
          <span className={`text-sm ${result.found ? "text-success" : "text-danger"}`}>
            {result.found ? "✓" : "✕"}
          </span>
          <span className="text-[0.9rem] font-medium text-text">
            汇总: {result.sheet_name}
          </span>
          <span className="text-[0.733rem] text-text-quaternary px-1.5 py-0.5 bg-canvas rounded">
            {result.mode}
          </span>
        </div>
        <span className="text-[0.8rem] text-text-quaternary">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-2 border-t border-border-subtle pt-3">
          {!result.found ? (
            <p className="text-[0.8rem] text-danger">Sheet 不存在</p>
          ) : (
            <>
              {result.key_column_found !== null && (
                <div className="flex gap-4 text-[0.8rem]">
                  <span className={result.key_column_found ? "text-success" : "text-danger"}>
                    键列{result.key_column_found ? "✓" : "✕"}
                  </span>
                  {result.value_column_found !== null && (
                    <span className={result.value_column_found ? "text-success" : "text-danger"}>
                      值列{result.value_column_found ? "✓" : "✕"}
                    </span>
                  )}
                </div>
              )}
              <p className="text-[0.8rem] text-text-secondary">
                成功映射: <span className="font-mono font-medium">{result.mapped_count}</span> 个键值对
              </p>

              {/* Mapped values table */}
              {Object.keys(result.mapped_values).length > 0 && (
                <div className="border border-border rounded-md overflow-hidden">
                  <table className="w-full text-[0.8rem]">
                    <thead className="bg-canvas">
                      <tr>
                        <th className="px-3 py-1.5 text-left text-text-quaternary font-medium">键</th>
                        <th className="px-3 py-1.5 text-left text-text-quaternary font-medium">值</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(result.mapped_values).map(([key, value]) => (
                        <tr key={key} className="border-t border-border-subtle">
                          <td className="px-3 py-1 font-mono text-text-secondary">{key}</td>
                          <td className="px-3 py-1 text-text">{value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {result.missing_keys.length > 0 && (
                <div>
                  <p className="text-[0.8rem] text-warning mb-1">缺失值 ({result.missing_keys.length}):</p>
                  <div className="flex flex-wrap gap-1">
                    {result.missing_keys.slice(0, 20).map((k) => (
                      <span key={k} className="text-[0.733rem] px-1.5 py-0.5 bg-warning-bg text-warning rounded">
                        {k}
                      </span>
                    ))}
                    {result.missing_keys.length > 20 && (
                      <span className="text-[0.733rem] text-text-quaternary">...等 {result.missing_keys.length} 个</span>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SheetResultCard({ result }: { result: SheetValidationResult }) {
  const [expanded, setExpanded] = useState(true);

  if (!result.found) {
    return (
      <div className="p-4 bg-danger-bg/30 rounded-lg border border-danger-border">
        <div className="flex items-center gap-2">
          <span className="text-danger text-sm">✕</span>
          <span className="text-[0.9rem] font-medium text-danger">{result.sheet_name}</span>
          <span className="text-[0.8rem] text-danger/80">— Sheet 不存在</span>
        </div>
      </div>
    );
  }

  const hasIssues = result.missing_columns.length > 0 || result.empty_cells.length > 0 || result.numeric_violations.length > 0;

  return (
    <div className={`bg-surface rounded-lg border ${hasIssues ? "border-warning-border" : "border-border"}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-2">
          <span className={`text-sm ${hasIssues ? "text-warning" : "text-success"}`}>
            {hasIssues ? "⚠" : "✓"}
          </span>
          <span className="text-[0.9rem] font-medium text-text">{result.sheet_name}</span>
          <span className="text-[0.733rem] text-text-quaternary">
            {result.total_rows} 行 · 填充率 {(result.fill_rate * 100).toFixed(1)}%
          </span>
        </div>
        <span className="text-[0.8rem] text-text-quaternary">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border-subtle pt-3">
          {/* Column Status */}
          {(result.missing_columns.length > 0 || result.extra_columns.length > 0) && (
            <div>
              <p className="text-[0.8rem] text-text-secondary mb-1.5">列状态</p>
              <div className="flex flex-wrap gap-1">
                {result.missing_columns.map((c) => (
                  <span key={c} className="text-[0.733rem] px-1.5 py-0.5 bg-danger-bg text-danger rounded">
                    ✕ {c}
                  </span>
                ))}
                {result.extra_columns.map((c) => (
                  <span key={c} className="text-[0.733rem] px-1.5 py-0.5 bg-canvas text-text-quaternary rounded">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Fill Rate Bar */}
          <div>
            <div className="flex items-center justify-between text-[0.8rem] mb-1">
              <span className="text-text-secondary">填充率</span>
              <span className="font-mono text-text-secondary">{(result.fill_rate * 100).toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-canvas rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  result.fill_rate >= 0.9 ? "bg-success" : result.fill_rate >= 0.7 ? "bg-warning" : "bg-danger"
                }`}
                style={{ width: `${result.fill_rate * 100}%` }}
              />
            </div>
          </div>

          {/* Empty Cells */}
          {result.empty_cells.length > 0 && (
            <div>
              <p className="text-[0.8rem] text-warning mb-1.5">空单元格 ({result.empty_cells.length})</p>
              <div className="max-h-40 overflow-auto border border-border rounded-md">
                <table className="w-full text-[0.733rem]">
                  <thead className="bg-canvas sticky top-0">
                    <tr>
                      <th className="px-2 py-1 text-left text-text-quaternary font-medium">行号</th>
                      <th className="px-2 py-1 text-left text-text-quaternary font-medium">列名</th>
                      <th className="px-2 py-1 text-left text-text-quaternary font-medium">字段</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.empty_cells.slice(0, 100).map((c, i) => (
                      <tr key={i} className="border-t border-border-subtle">
                        <td className="px-2 py-0.5 font-mono text-text-secondary">{c.row}</td>
                        <td className="px-2 py-0.5 text-text-secondary">{c.column}</td>
                        <td className="px-2 py-0.5 text-text-quaternary font-mono">{c.field}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {result.empty_cells.length > 100 && (
                  <p className="text-[0.667rem] text-text-quaternary p-2 text-center">
                    显示前 100 条，共 {result.empty_cells.length} 条
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Numeric Violations */}
          {result.numeric_violations.length > 0 && (
            <div>
              <p className="text-[0.8rem] text-danger mb-1.5">数值违规 ({result.numeric_violations.length})</p>
              <div className="max-h-32 overflow-auto border border-border rounded-md">
                <table className="w-full text-[0.733rem]">
                  <thead className="bg-canvas sticky top-0">
                    <tr>
                      <th className="px-2 py-1 text-left text-text-quaternary font-medium">行号</th>
                      <th className="px-2 py-1 text-left text-text-quaternary font-medium">列名</th>
                      <th className="px-2 py-1 text-left text-text-quaternary font-medium">值</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.numeric_violations.slice(0, 50).map((v, i) => (
                      <tr key={i} className="border-t border-border-subtle">
                        <td className="px-2 py-0.5 font-mono text-text-secondary">{v.row}</td>
                        <td className="px-2 py-0.5 text-text-secondary">{v.column}</td>
                        <td className="px-2 py-0.5 text-danger font-mono">{v.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Image Summary */}
          {result.image_summary && (
            <p className="text-[0.8rem] text-text-secondary">
              图片: {result.image_summary.total_images} 张，分布在 {result.image_summary.rows_with_images} 行
            </p>
          )}

          {/* Unique Values */}
          {Object.keys(result.unique_values).length > 0 && (
            <details>
              <summary className="text-[0.8rem] text-text-muted cursor-pointer hover:text-text-secondary">
                唯一值统计
              </summary>
              <div className="mt-2 space-y-1.5 pl-2">
                {Object.entries(result.unique_values).map(([field, values]) => (
                  <div key={field}>
                    <span className="text-[0.733rem] font-mono text-text-quaternary">{field}</span>
                    <span className="text-[0.667rem] text-text-quaternary"> ({values.length}):</span>
                    <span className="text-[0.733rem] text-text-secondary ml-1">
                      {values.slice(0, 10).join(", ")}
                      {values.length > 10 ? " ..." : ""}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="p-2.5 bg-warning-bg border border-warning-border rounded-md">
              {result.warnings.map((w, i) => (
                <p key={i} className="text-[0.733rem] text-warning">⚠ {w}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
