import { useState } from "react";
import type { BudgetConfig, SheetConfig, SummaryConfig } from "../types";

interface Props {
  config: BudgetConfig;
  onChange: (config: BudgetConfig) => void;
  onClose: () => void;
}

type Tab = "basic" | "summary" | "sheets";

const inputCls = "w-full px-3 py-2 border border-border rounded-md text-[0.867rem] bg-surface text-text focus:border-brand-accent focus:outline-none transition-colors";
const smallInputCls = "px-2 py-1 border border-border rounded-md text-[0.8rem] bg-surface text-text focus:border-brand-accent focus:outline-none";
const labelCls = "block text-[0.733rem] text-text-quaternary mb-1";

export function ConfigEditor({ config, onChange, onClose }: Props) {
  const [local, setLocal] = useState<BudgetConfig>(JSON.parse(JSON.stringify(config)));
  const [tab, setTab] = useState<Tab>("basic");

  const handleSave = () => {
    onChange(local);
    onClose();
  };

  const updateSummary = (patch: Partial<SummaryConfig>) => {
    setLocal({ ...local, summary: { ...local.summary!, ...patch } });
  };

  const updateSheet = (index: number, patch: Partial<SheetConfig>) => {
    const sheets = local.sheets.map((s, i) => (i === index ? { ...s, ...patch } : s));
    setLocal({ ...local, sheets });
  };

  const addSheet = () => {
    setLocal({
      ...local,
      sheets: [...local.sheets, { name: "", sheet_name: "", id: "", columns: {} }],
    });
  };

  const removeSheet = (index: number) => {
    setLocal({ ...local, sheets: local.sheets.filter((_, i) => i !== index) });
  };

  const addColumnMapping = (sheetIdx: number) => {
    const sheet = local.sheets[sheetIdx];
    updateSheet(sheetIdx, { columns: { ...sheet.columns, "": "" } });
  };

  const updateColumnKey = (sheetIdx: number, oldKey: string, newKey: string) => {
    const sheet = local.sheets[sheetIdx];
    const entries = Object.entries(sheet.columns).map(([k, v]) =>
      k === oldKey ? [newKey, v] : [k, v]
    );
    const table_columns = (sheet.table_columns || []).map((c) => (c === oldKey ? newKey : c));
    const detail_fields = (sheet.detail_fields || []).map((d) =>
      d.field === oldKey ? { ...d, field: newKey } : d
    );
    updateSheet(sheetIdx, { columns: Object.fromEntries(entries), table_columns, detail_fields });
  };

  const updateColumnValue = (sheetIdx: number, key: string, value: string) => {
    const sheet = local.sheets[sheetIdx];
    updateSheet(sheetIdx, { columns: { ...sheet.columns, [key]: value } });
  };

  const removeColumn = (sheetIdx: number, key: string) => {
    const sheet = local.sheets[sheetIdx];
    const { [key]: _, ...rest } = sheet.columns;
    const table_columns = (sheet.table_columns || []).filter((c) => c !== key);
    const detail_fields = (sheet.detail_fields || []).filter((d) => d.field !== key);
    updateSheet(sheetIdx, { columns: rest, table_columns, detail_fields });
  };

  const toggleTableColumn = (sheetIdx: number, key: string) => {
    const sheet = local.sheets[sheetIdx];
    const current = sheet.table_columns || [];
    if (current.includes(key)) {
      updateSheet(sheetIdx, { table_columns: current.filter((c) => c !== key) });
    } else {
      const allKeys = Object.keys(sheet.columns);
      const insertIdx = allKeys.indexOf(key);
      const before = current.filter((c) => allKeys.indexOf(c) < insertIdx);
      const after = current.filter((c) => allKeys.indexOf(c) > insertIdx);
      updateSheet(sheetIdx, { table_columns: [...before, key, ...after] });
    }
  };

  const toggleDetailField = (sheetIdx: number, key: string, excelCol: string) => {
    const sheet = local.sheets[sheetIdx];
    const current = sheet.detail_fields || [];
    if (current.some((d) => d.field === key)) {
      updateSheet(sheetIdx, { detail_fields: current.filter((d) => d.field !== key) });
    } else {
      const allKeys = Object.keys(sheet.columns);
      const insertIdx = allKeys.indexOf(key);
      const newEntry = { field: key, label: excelCol };
      const before = current.filter((d) => allKeys.indexOf(d.field) < insertIdx);
      const after = current.filter((d) => allKeys.indexOf(d.field) > insertIdx);
      updateSheet(sheetIdx, { detail_fields: [...before, newEntry, ...after] });
    }
  };

  const moveColumn = (sheetIdx: number, fromIdx: number, direction: -1 | 1) => {
    const sheet = local.sheets[sheetIdx];
    const entries = Object.entries(sheet.columns);
    const toIdx = fromIdx + direction;
    if (toIdx < 0 || toIdx >= entries.length) return;

    const movedKey = entries[fromIdx][0];
    const swappedKey = entries[toIdx][0];

    [entries[fromIdx], entries[toIdx]] = [entries[toIdx], entries[fromIdx]];

    const table_columns = [...(sheet.table_columns || [])];
    const ti = table_columns.indexOf(movedKey);
    const tj = table_columns.indexOf(swappedKey);
    if (ti !== -1 && tj !== -1) {
      [table_columns[ti], table_columns[tj]] = [table_columns[tj], table_columns[ti]];
    }

    const detail_fields = [...(sheet.detail_fields || [])];
    const di = detail_fields.findIndex((d) => d.field === movedKey);
    const dj = detail_fields.findIndex((d) => d.field === swappedKey);
    if (di !== -1 && dj !== -1) {
      [detail_fields[di], detail_fields[dj]] = [detail_fields[dj], detail_fields[di]];
    }

    updateSheet(sheetIdx, { columns: Object.fromEntries(entries), table_columns, detail_fields });
  };

  const moveSheet = (fromIdx: number, direction: -1 | 1) => {
    const sheets = [...local.sheets];
    const toIdx = fromIdx + direction;
    if (toIdx < 0 || toIdx >= sheets.length) return;
    [sheets[fromIdx], sheets[toIdx]] = [sheets[toIdx], sheets[fromIdx]];
    setLocal({ ...local, sheets });
  };

  const addImageColumn = (sheetIdx: number) => {
    const sheet = local.sheets[sheetIdx];
    updateSheet(sheetIdx, { image_columns: [...(sheet.image_columns || []), ""] });
  };

  const updateImageColumn = (sheetIdx: number, colIdx: number, value: string) => {
    const sheet = local.sheets[sheetIdx];
    const cols = [...(sheet.image_columns || [])];
    cols[colIdx] = value;
    updateSheet(sheetIdx, { image_columns: cols });
  };

  const removeImageColumn = (sheetIdx: number, colIdx: number) => {
    const sheet = local.sheets[sheetIdx];
    const cols = (sheet.image_columns || []).filter((_, i) => i !== colIdx);
    updateSheet(sheetIdx, { image_columns: cols });
  };

  const addMapping = () => {
    const mappings = { ...(local.summary?.mappings || {}), "": "" };
    updateSummary({ mappings });
  };

  const updateMappingKey = (oldKey: string, newKey: string) => {
    const mappings = local.summary?.mappings || {};
    const entries = Object.entries(mappings).map(([k, v]) =>
      k === oldKey ? [newKey, v] : [k, v]
    );
    updateSummary({ mappings: Object.fromEntries(entries) });
  };

  const updateMappingValue = (key: string, value: string) => {
    updateSummary({ mappings: { ...(local.summary?.mappings || {}), [key]: value } });
  };

  const removeMapping = (key: string) => {
    const mappings = { ...(local.summary?.mappings || {}) };
    delete mappings[key];
    updateSummary({ mappings });
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "basic", label: "基础" },
    { key: "summary", label: "汇总页" },
    { key: "sheets", label: "Sheet 映射" },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="modal-panel bg-panel rounded-lg w-[860px] max-h-[85vh] flex flex-col border border-border shadow-2xl">
        <div className="px-5 py-3.5 border-b border-border flex justify-between items-center">
          <h3 className="text-ui text-[0.933rem] text-text">编辑配置</h3>
          <button onClick={onClose} className="w-6 h-6 rounded-md hover:bg-surface-hover flex items-center justify-center text-text-quaternary hover:text-text transition-colors text-lg">&times;</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-5">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3.5 py-2 text-[0.8rem] font-medium border-b-2 transition-colors -mb-px ${
                tab === t.key
                  ? "border-brand-accent text-brand-accent"
                  : "border-transparent text-text-quaternary hover:text-text-secondary"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto p-5 space-y-4">
          {/* ── Basic Tab ── */}
          {tab === "basic" && (
            <div>
              <label className="block text-[0.733rem] text-text-quaternary mb-1.5">报告标题</label>
              <input
                value={local.title}
                onChange={(e) => setLocal({ ...local, title: e.target.value })}
                className={inputCls}
              />
            </div>
          )}

          {/* ── Summary Tab ── */}
          {tab === "summary" && (
            <div className="space-y-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!local.summary}
                  onChange={(e) =>
                    setLocal({
                      ...local,
                      summary: e.target.checked
                        ? { sheet_name: "", mode: "table", header_row: 1, key_column: "", value_column: "", prefix: "" }
                        : undefined,
                    })
                  }
                  className="rounded accent-brand"
                />
                <span className="text-[0.867rem] font-medium text-text">启用汇总页</span>
              </label>

              {local.summary && (
                <>
                  <div className="form-grid-2 grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Excel Sheet</label>
                      <input
                        value={local.summary.sheet_name}
                        onChange={(e) => updateSummary({ sheet_name: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>模式</label>
                      <select
                        value={local.summary.mode}
                        onChange={(e) => updateSummary({ mode: e.target.value as "table" | "cell_map" })}
                        className={inputCls}
                      >
                        <option value="table">表格模式 (table)</option>
                        <option value="cell_map">单元格映射 (cell_map)</option>
                      </select>
                    </div>
                  </div>

                  {local.summary.mode === "table" && (
                    <div className="bg-surface rounded-md border border-border-subtle p-4 space-y-3">
                      <h4 className="text-ui text-[0.8rem] text-text-muted">表格模式配置</h4>
                      <div className="form-grid-3 grid grid-cols-3 gap-3">
                        <div>
                          <label className={labelCls}>表头行号</label>
                          <input
                            type="number"
                            value={local.summary.header_row ?? 1}
                            onChange={(e) => updateSummary({ header_row: parseInt(e.target.value) || 1 })}
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className={labelCls}>键列</label>
                          <input
                            value={local.summary.key_column || ""}
                            onChange={(e) => updateSummary({ key_column: e.target.value })}
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className={labelCls}>值列</label>
                          <input
                            value={local.summary.value_column || ""}
                            onChange={(e) => updateSummary({ value_column: e.target.value })}
                            className={inputCls}
                          />
                        </div>
                      </div>
                      <div>
                        <label className={labelCls}>变量前缀</label>
                        <input
                          value={local.summary.prefix || ""}
                          onChange={(e) => updateSummary({ prefix: e.target.value })}
                          className={inputCls}
                          placeholder="SUMMARY_"
                        />
                      </div>
                    </div>
                  )}

                  {local.summary.mode === "cell_map" && (
                    <div className="bg-surface rounded-md border border-border-subtle p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <h4 className="text-ui text-[0.8rem] text-text-muted">单元格映射</h4>
                        <button onClick={addMapping} className="text-[0.8rem] text-brand-accent hover:text-brand-hover transition-colors">+ 添加映射</button>
                      </div>
                      <table className="w-full text-[0.8rem]">
                        <thead>
                          <tr className="text-text-quaternary">
                            <th className="px-2 py-1 text-left font-normal">键 (Key)</th>
                            <th className="px-2 py-1 text-left font-normal">值 (Value)</th>
                            <th className="w-12"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(local.summary.mappings || {}).map(([key, value], idx) => (
                            <tr key={idx} className="border-t border-border-subtle">
                              <td className="px-2 py-1">
                                <input
                                  value={key}
                                  onChange={(e) => updateMappingKey(key, e.target.value)}
                                  className="w-full border-none bg-transparent text-text outline-none"
                                />
                              </td>
                              <td className="px-2 py-1">
                                <input
                                  value={value}
                                  onChange={(e) => updateMappingValue(key, e.target.value)}
                                  className="w-full border-none bg-transparent text-text outline-none"
                                />
                              </td>
                              <td className="px-2 py-1">
                                <button onClick={() => removeMapping(key)} className="text-danger hover:text-danger/80">&times;</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Sheets Tab ── */}
          {tab === "sheets" && (
            <div className="space-y-3">
              {local.sheets.map((sheet, sheetIdx) => (
                <div key={sheetIdx} className="bg-surface rounded-md border border-border p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-sm bg-surface-hover text-text-quaternary text-[0.6rem] font-mono font-bold flex items-center justify-center">{sheetIdx + 1}</span>
                      <h4 className="text-ui text-[0.867rem] text-text">
                        {sheet.name || "(未命名)"}
                      </h4>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => moveSheet(sheetIdx, -1)}
                        disabled={sheetIdx === 0}
                        className="text-text-quaternary hover:text-text disabled:opacity-20 text-[0.667rem]"
                        title="上移"
                      >▲</button>
                      <button
                        onClick={() => moveSheet(sheetIdx, 1)}
                        disabled={sheetIdx === local.sheets.length - 1}
                        className="text-text-quaternary hover:text-text disabled:opacity-20 text-[0.667rem]"
                        title="下移"
                      >▼</button>
                      <button onClick={() => removeSheet(sheetIdx)} className="text-danger/60 hover:text-danger text-[0.8rem] ml-1">
                        删除
                      </button>
                    </div>
                  </div>
                  <div className="form-grid-3 grid grid-cols-3 gap-3">
                    <div>
                      <label className={labelCls}>章节名称</label>
                      <input
                        value={sheet.name}
                        onChange={(e) => updateSheet(sheetIdx, { name: e.target.value })}
                        className={smallInputCls + " w-full"}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Excel Sheet</label>
                      <input
                        value={sheet.sheet_name}
                        onChange={(e) => updateSheet(sheetIdx, { sheet_name: e.target.value })}
                        className={smallInputCls + " w-full"}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>章节 ID</label>
                      <input
                        value={sheet.id}
                        onChange={(e) => updateSheet(sheetIdx, { id: e.target.value })}
                        className={smallInputCls + " w-full"}
                      />
                    </div>
                  </div>

                  {/* Column mappings */}
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-ui text-[0.733rem] text-text-quaternary">列映射</span>
                      <button onClick={() => addColumnMapping(sheetIdx)} className="text-[0.733rem] text-brand-accent hover:text-brand-hover transition-colors">
                        + 添加列
                      </button>
                    </div>
                    <div className="grid grid-cols-[1fr_1fr_36px_36px_20px_20px_20px] gap-1 mb-1 px-1">
                      <span className="text-[0.6rem] text-text-quaternary uppercase">字段名</span>
                      <span className="text-[0.6rem] text-text-quaternary uppercase">Excel 列名</span>
                      <span className="text-[0.6rem] text-text-quaternary uppercase text-center" title="表格列">表格</span>
                      <span className="text-[0.6rem] text-text-quaternary uppercase text-center" title="详情字段">详情</span>
                      <span></span><span></span><span></span>
                    </div>
                    {Object.entries(sheet.columns).map(([key, value], colIdx) => (
                      <div key={colIdx} className="grid grid-cols-[1fr_1fr_36px_36px_20px_20px_20px] gap-1 mb-1 items-center">
                        <input
                          value={key}
                          onChange={(e) => updateColumnKey(sheetIdx, key, e.target.value)}
                          className={smallInputCls}
                          placeholder="字段名"
                        />
                        <input
                          value={value}
                          onChange={(e) => updateColumnValue(sheetIdx, key, e.target.value)}
                          className={smallInputCls}
                          placeholder="Excel 列名"
                        />
                        <label className="flex justify-center">
                          <input
                            type="checkbox"
                            checked={(sheet.table_columns || []).includes(key)}
                            onChange={() => toggleTableColumn(sheetIdx, key)}
                            title="作为表格列显示"
                            className="rounded accent-brand"
                          />
                        </label>
                        <label className="flex justify-center">
                          <input
                            type="checkbox"
                            checked={(sheet.detail_fields || []).some((d) => d.field === key)}
                            onChange={() => toggleDetailField(sheetIdx, key, value)}
                            title="作为详情字段"
                            className="rounded accent-brand"
                          />
                        </label>
                        <button
                          onClick={() => moveColumn(sheetIdx, colIdx, -1)}
                          disabled={colIdx === 0}
                          className="text-text-quaternary hover:text-text disabled:opacity-20 text-[0.6rem] text-center"
                          title="上移"
                        >▲</button>
                        <button
                          onClick={() => moveColumn(sheetIdx, colIdx, 1)}
                          disabled={colIdx === Object.keys(sheet.columns).length - 1}
                          className="text-text-quaternary hover:text-text disabled:opacity-20 text-[0.6rem] text-center"
                          title="下移"
                        >▼</button>
                        <button onClick={() => removeColumn(sheetIdx, key)} className="text-danger/60 hover:text-danger text-center text-[0.8rem]">&times;</button>
                      </div>
                    ))}
                    {Object.keys(sheet.columns).length === 0 && (
                      <p className="text-[0.733rem] text-text-quaternary py-1">暂无列映射</p>
                    )}
                  </div>

                  {/* Image columns */}
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-ui text-[0.733rem] text-text-quaternary">图片列</span>
                      <button onClick={() => addImageColumn(sheetIdx)} className="text-[0.733rem] text-brand-accent hover:text-brand-hover transition-colors">
                        + 添加
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(sheet.image_columns || []).map((col, colIdx) => (
                        <div key={colIdx} className="flex items-center gap-1">
                          <input
                            value={col}
                            onChange={(e) => updateImageColumn(sheetIdx, colIdx, e.target.value)}
                            className="px-2 py-1 border border-border rounded-md text-[0.8rem] bg-surface text-text w-28 focus:border-brand-accent focus:outline-none"
                          />
                          <button onClick={() => removeImageColumn(sheetIdx, colIdx)} className="text-danger/60 hover:text-danger text-[0.8rem]">&times;</button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={addSheet} className="w-full py-2 border border-dashed border-border rounded-md text-text-quaternary hover:border-brand-border hover:text-brand-accent transition-colors text-[0.867rem]">
                + 添加 Sheet
              </button>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-surface border border-border text-text-secondary rounded-md hover:bg-surface-hover text-[0.867rem] transition-colors">取消</button>
          <button onClick={handleSave} className="px-4 py-2 bg-brand text-white rounded-md hover:bg-brand-hover text-[0.867rem] font-medium transition-colors">保存</button>
        </div>
      </div>
    </div>
  );
}
