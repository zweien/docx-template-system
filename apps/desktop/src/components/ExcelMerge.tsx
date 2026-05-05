import { useState } from "react";
import { useAppStore } from "../stores/app-store";
import { getMergeInfo, mergeExcel } from "../services/api";
import { selectExcelFiles, selectXlsxSave, openReport } from "../services/tauri-commands";
import type { FileMergeInfo, MergeExcelResponse, SheetMismatchDetail } from "../types";

type Phase = "select" | "sheets" | "result";

export function ExcelMerge() {
  const { addLog } = useAppStore();

  const [phase, setPhase] = useState<Phase>("select");
  const [files, setFiles] = useState<string[]>([]);
  const [baseFile, setBaseFile] = useState<string | null>(null);
  const [filesInfo, setFilesInfo] = useState<FileMergeInfo[]>([]);
  const [commonSheets, setCommonSheets] = useState<string[]>([]);
  const [selectedSheets, setSelectedSheets] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MergeExcelResponse | null>(null);

  const fileName = (p: string) => p.replace(/\\/g, "/").split("/").pop() || p;

  // ── Phase 1: 文件选择 ──

  const handleAddFiles = async () => {
    const paths = await selectExcelFiles();
    if (!paths) return;
    const newFiles = [...new Set([...files, ...paths])];
    setFiles(newFiles);
    if (!baseFile && newFiles.length > 0) setBaseFile(newFiles[0]);
  };

  const handleRemoveFile = (path: string) => {
    const next = files.filter((f) => f !== path);
    setFiles(next);
    if (baseFile === path) setBaseFile(next[0] || null);
  };

  const handleAnalyze = async () => {
    if (files.length < 2 || !baseFile) return;
    setLoading(true);
    addLog(`分析 ${files.length} 个文件...`);
    try {
      const res = await getMergeInfo(files);
      if (!res.success) {
        addLog(`分析失败: ${res.error?.message}`, "error");
        setLoading(false);
        return;
      }
      setFilesInfo(res.files);
      setCommonSheets(res.common_sheets);
      // 默认全选所有共有 sheet
      const defaults = new Set(res.common_sheets);
      setSelectedSheets(defaults);
      setPhase("sheets");
      addLog(`发现 ${res.common_sheets.length} 个共有 sheet`, "success");
    } catch (e) {
      addLog(`分析失败: ${e}`, "error");
    }
    setLoading(false);
  };

  // ── Phase 2: Sheet 选择 ──

  const toggleSheet = (name: string) => {
    const next = new Set(selectedSheets);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setSelectedSheets(next);
  };

  const selectAll = () => setSelectedSheets(new Set(commonSheets));
  const deselectAll = () => setSelectedSheets(new Set());

  const handleMerge = async () => {
    if (selectedSheets.size === 0 || !baseFile) return;

    const outputPath = await selectXlsxSave(`合并结果_${fileName(baseFile)}`);
    if (!outputPath) return;

    setLoading(true);
    addLog(`开始合并 ${selectedSheets.size} 个 sheet...`);

    const sourceFiles = files.filter((f) => f !== baseFile);
    try {
      const res = await mergeExcel({
        base_file: baseFile,
        source_files: sourceFiles,
        selected_sheets: [...selectedSheets],
        output_path: outputPath,
      });
      setResult(res);
      setPhase("result");
      if (res.success) {
        addLog(`合并完成: 共追加 ${res.total_rows_added} 行`, "success");
        for (const w of res.warnings) addLog(w, "warn");
      } else {
        addLog(`合并失败: ${res.error?.message}`, "error");
      }
    } catch (e) {
      addLog(`合并失败: ${e}`, "error");
    }
    setLoading(false);
  };

  const handleReset = () => {
    setPhase("select");
    setFiles([]);
    setBaseFile(null);
    setFilesInfo([]);
    setCommonSheets([]);
    setSelectedSheets(new Set());
    setResult(null);
  };

  // ── Render ──

  return (
    <div className="content-page flex-1 overflow-auto">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-heading text-lg text-text">合并表格</h2>
            <p className="text-caption text-text-muted mt-1">将多个 Excel 文件的数据按 sheet 合并</p>
          </div>
          {phase !== "select" && (
            <button onClick={handleReset} className="px-3 py-1.5 bg-surface border border-border text-text-secondary rounded-md text-[0.8rem] hover:bg-surface-hover transition-colors">
              重新开始
            </button>
          )}
        </div>

        {phase === "select" && renderFileSelect()}
        {phase === "sheets" && renderSheetSelect()}
        {phase === "result" && renderResult()}
      </div>
    </div>
  );

  // ── Phase 1 UI ──

  function renderFileSelect() {
    return (
      <div className="space-y-4">
        <button onClick={handleAddFiles} className="px-4 py-2 bg-brand text-white rounded-md hover:bg-brand-hover text-[0.867rem] font-medium transition-colors">
          + 添加文件
        </button>

        {files.length > 0 && (
          <div className="space-y-2">
            <p className="text-[0.8rem] text-text-muted">选择一个文件作为基准（参考结构），其余文件的数据将追加到基准文件中：</p>
            {files.map((f) => {
              const isBase = f === baseFile;
              return (
                <div key={f} onClick={() => setBaseFile(f)} className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                  isBase ? "border-brand-border bg-brand-bg" : "border-border bg-surface hover:border-border-strong"
                }`}>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    isBase ? "border-brand-accent" : "border-border-strong"
                  }`}>
                    {isBase && <div className="w-2 h-2 rounded-full bg-brand-accent" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[0.867rem] text-text truncate">{fileName(f)}</div>
                    <div className="text-[0.733rem] text-text-quaternary">
                      {isBase ? "基准文件" : "合并来源"}
                    </div>
                  </div>
                  {files.length > 1 && (
                    <button onClick={() => handleRemoveFile(f)} className="text-text-quaternary hover:text-danger text-[0.733rem] transition-colors">
                      移除
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {files.length >= 2 && baseFile && (
          <button onClick={handleAnalyze} disabled={loading} className="px-4 py-2 bg-brand text-white rounded-md hover:bg-brand-hover text-[0.867rem] font-medium transition-colors disabled:opacity-40">
            {loading ? "分析中..." : "分析文件结构"}
          </button>
        )}
      </div>
    );
  }

  // ── Phase 2 UI ──

  function renderSheetSelect() {
    const baseInfo = filesInfo.find((f) => f.file_path === baseFile);
    if (!baseInfo) return null;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-[0.867rem] text-text-secondary">
            共有 <span className="font-medium text-text">{commonSheets.length}</span> 个 sheet，已选 <span className="font-medium text-brand-accent">{selectedSheets.size}</span> 个
          </span>
          <div className="flex gap-2 ml-auto">
            <button onClick={selectAll} className="text-[0.733rem] text-brand-accent hover:text-brand-hover transition-colors">全选</button>
            <button onClick={deselectAll} className="text-[0.733rem] text-text-quaternary hover:text-text-secondary transition-colors">取消全选</button>
          </div>
        </div>

        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-[0.8rem]">
            <thead>
              <tr className="bg-surface-hover border-b border-border">
                <th className="w-8 px-2 py-2 text-center"></th>
                <th className="text-left px-3 py-2 text-text-muted font-medium">Sheet</th>
                <th className="text-left px-3 py-2 text-text-muted font-medium">表头</th>
                <th className="text-center px-3 py-2 text-text-muted font-medium">行数</th>
                <th className="text-center px-3 py-2 text-text-muted font-medium">图片</th>
              </tr>
            </thead>
            <tbody>
              {commonSheets.map((sheetName) => {
                const checked = selectedSheets.has(sheetName);
                const baseSheet = baseInfo.sheets.find((s) => s.sheet_name === sheetName);
                const headerPreview = baseSheet?.header_row.filter((h) => h).slice(0, 4).join(", ") || "-";
                const maxRowInfo = filesInfo.reduce((max, fi) => {
                  const s = fi.sheets.find((si) => si.sheet_name === sheetName);
                  return Math.max(max, s?.data_row_count || 0);
                }, 0);
                const anyImages = filesInfo.some((fi) => fi.sheets.find((s) => s.sheet_name === sheetName)?.has_images);

                return (
                  <tr key={sheetName} className={`border-b border-border-subtle transition-colors ${checked ? "bg-brand-bg/30" : "hover:bg-surface-hover/50"}`}>
                    <td className="px-2 py-2 text-center">
                      <input type="checkbox" checked={checked} onChange={() => toggleSheet(sheetName)} />
                    </td>
                    <td className="px-3 py-2 text-text font-medium">{sheetName}</td>
                    <td className="px-3 py-2 text-text-muted max-w-[200px] truncate">{headerPreview}</td>
                    <td className="px-3 py-2 text-center text-text-secondary">{maxRowInfo}</td>
                    <td className="px-3 py-2 text-center">{anyImages ? <span className="text-brand-accent">📷</span> : <span className="text-text-quaternary">-</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <button onClick={handleMerge} disabled={loading || selectedSheets.size === 0} className="px-4 py-2 bg-brand text-white rounded-md hover:bg-brand-hover text-[0.867rem] font-medium transition-colors disabled:opacity-40">
          {loading ? "合并中..." : `合并 ${selectedSheets.size} 个 Sheet`}
        </button>
      </div>
    );
  }

  // ── Phase 3 UI ──

  function renderResult() {
    if (!result) return null;

    return (
      <div className="space-y-4">
        {result.success ? (
          <div className="bg-success/10 border border-success/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-success font-medium">✓ 合并成功</span>
              <span className="text-[0.8rem] text-text-muted">共追加 {result.total_rows_added} 行数据</span>
            </div>
            <p className="text-[0.8rem] text-text-secondary font-mono truncate">{result.output_path}</p>
            {result.output_path && (
              <button onClick={() => openReport(result.output_path!)} className="mt-2 px-3 py-1.5 bg-brand text-white rounded-md text-[0.8rem] font-medium hover:bg-brand-hover transition-colors">
                打开文件
              </button>
            )}
          </div>
        ) : (
          <div className="bg-danger/10 border border-danger/30 rounded-lg p-4">
            <span className="text-danger font-medium">✕ 合并失败</span>
            <p className="text-[0.8rem] text-text-secondary mt-1">{result.error?.message}</p>
          </div>
        )}

        {Object.keys(result.sheet_summary).length > 0 && (
          <div className="bg-surface rounded-lg border border-border p-4">
            <h4 className="text-[0.867rem] font-medium text-text mb-2">Sheet 明细</h4>
            <div className="space-y-1">
              {Object.entries(result.sheet_summary).map(([sheet, rows]) => (
                <div key={sheet} className="flex justify-between text-[0.8rem]">
                  <span className="text-text-secondary">{sheet}</span>
                  <span className="text-text-muted">+{rows} 行</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {result.mismatches.length > 0 && <MismatchReport mismatches={result.mismatches} />}

        {result.warnings.length > 0 && (
          <div className="bg-surface rounded-lg border border-border p-4">
            <h4 className="text-[0.867rem] font-medium text-text mb-2">提示</h4>
            <ul className="space-y-1">
              {result.warnings.map((w, i) => (
                <li key={i} className="text-[0.8rem] text-warning">⚠ {w}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }
}

function MismatchReport({ mismatches }: { mismatches: SheetMismatchDetail[] }) {
  return (
    <div className="bg-surface rounded-lg border border-border p-4">
      <h4 className="text-[0.867rem] font-medium text-text mb-2">字段不匹配</h4>
      <div className="space-y-3">
        {mismatches.map((m, i) => (
          <div key={i} className="border border-border-subtle rounded-md p-3">
            <div className="text-[0.8rem] text-text-secondary mb-1">
              <span className="font-medium text-text">{m.sheet_name}</span>
              <span className="text-text-quaternary"> — {m.file_name}</span>
            </div>
            {m.missing_in_file.length > 0 && (
              <div className="text-[0.733rem] text-danger">
                缺少: {m.missing_in_file.join(", ")}
              </div>
            )}
            {m.extra_in_file.length > 0 && (
              <div className="text-[0.733rem] text-warning">
                多出: {m.extra_in_file.join(", ")}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
