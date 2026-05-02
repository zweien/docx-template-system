import { useState } from "react";
import type { BudgetConfig, SheetConfig, SummaryConfig } from "../types";

interface Props {
  config: BudgetConfig;
  onChange: (config: BudgetConfig) => void;
  onClose: () => void;
}

type Tab = "basic" | "summary" | "sheets";

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
    // Sync table_columns and detail_fields references
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
    // Also remove from table_columns and detail_fields
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
      // Insert in column-order position to preserve order
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
      // Insert in column-order position
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

    // Also swap positions in table_columns
    const table_columns = [...(sheet.table_columns || [])];
    const ti = table_columns.indexOf(movedKey);
    const tj = table_columns.indexOf(swappedKey);
    if (ti !== -1 && tj !== -1) {
      [table_columns[ti], table_columns[tj]] = [table_columns[tj], table_columns[ti]];
    }

    // Also swap positions in detail_fields
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-[860px] max-h-[85vh] flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="font-bold text-lg">编辑配置</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl">&times;</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
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
              <label className="block text-sm font-medium mb-1">报告标题</label>
              <input
                value={local.title}
                onChange={(e) => setLocal({ ...local, title: e.target.value })}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
          )}

          {/* ── Summary Tab ── */}
          {tab === "summary" && (
            <div className="space-y-4">
              <label className="flex items-center gap-2">
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
                  className="rounded"
                />
                <span className="text-sm font-medium">启用汇总页</span>
              </label>

              {local.summary && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Excel Sheet</label>
                      <input
                        value={local.summary.sheet_name}
                        onChange={(e) => updateSummary({ sheet_name: e.target.value })}
                        className="w-full px-3 py-2 border rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">模式</label>
                      <select
                        value={local.summary.mode}
                        onChange={(e) => updateSummary({ mode: e.target.value as "table" | "cell_map" })}
                        className="w-full px-3 py-2 border rounded bg-white"
                      >
                        <option value="table">表格模式 (table)</option>
                        <option value="cell_map">单元格映射 (cell_map)</option>
                      </select>
                    </div>
                  </div>

                  {local.summary.mode === "table" && (
                    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                      <h4 className="text-sm font-semibold text-gray-600">表格模式配置</h4>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">表头行号</label>
                          <input
                            type="number"
                            value={local.summary.header_row ?? 1}
                            onChange={(e) => updateSummary({ header_row: parseInt(e.target.value) || 1 })}
                            className="w-full px-3 py-2 border rounded"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">键列</label>
                          <input
                            value={local.summary.key_column || ""}
                            onChange={(e) => updateSummary({ key_column: e.target.value })}
                            className="w-full px-3 py-2 border rounded"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">值列</label>
                          <input
                            value={local.summary.value_column || ""}
                            onChange={(e) => updateSummary({ value_column: e.target.value })}
                            className="w-full px-3 py-2 border rounded"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">变量前缀</label>
                        <input
                          value={local.summary.prefix || ""}
                          onChange={(e) => updateSummary({ prefix: e.target.value })}
                          className="w-full px-3 py-2 border rounded"
                          placeholder="SUMMARY_"
                        />
                      </div>
                    </div>
                  )}

                  {local.summary.mode === "cell_map" && (
                    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <h4 className="text-sm font-semibold text-gray-600">单元格映射</h4>
                        <button onClick={addMapping} className="text-sm text-blue-600 hover:underline">+ 添加映射</button>
                      </div>
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-2 py-1 text-left">键 (Key)</th>
                            <th className="px-2 py-1 text-left">值 (Value)</th>
                            <th className="w-16"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(local.summary.mappings || {}).map(([key, value], idx) => (
                            <tr key={idx} className="border-t">
                              <td className="px-2 py-1">
                                <input
                                  value={key}
                                  onChange={(e) => updateMappingKey(key, e.target.value)}
                                  className="w-full border-none bg-transparent"
                                />
                              </td>
                              <td className="px-2 py-1">
                                <input
                                  value={value}
                                  onChange={(e) => updateMappingValue(key, e.target.value)}
                                  className="w-full border-none bg-transparent"
                                />
                              </td>
                              <td className="px-2 py-1">
                                <button onClick={() => removeMapping(key)} className="text-red-500 hover:text-red-700">&times;</button>
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
            <div className="space-y-4">
              {local.sheets.map((sheet, sheetIdx) => (
                <div key={sheetIdx} className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium text-gray-700">
                      Sheet {sheetIdx + 1}: {sheet.name || "(未命名)"}
                    </h4>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => moveSheet(sheetIdx, -1)}
                        disabled={sheetIdx === 0}
                        className="text-gray-400 hover:text-gray-700 disabled:opacity-30 text-sm"
                        title="上移"
                      >▲</button>
                      <button
                        onClick={() => moveSheet(sheetIdx, 1)}
                        disabled={sheetIdx === local.sheets.length - 1}
                        className="text-gray-400 hover:text-gray-700 disabled:opacity-30 text-sm"
                        title="下移"
                      >▼</button>
                      <button onClick={() => removeSheet(sheetIdx)} className="text-red-500 hover:text-red-700 text-sm">
                        删除
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">章节名称</label>
                      <input
                        value={sheet.name}
                        onChange={(e) => updateSheet(sheetIdx, { name: e.target.value })}
                        className="w-full px-2 py-1 border rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Excel Sheet</label>
                      <input
                        value={sheet.sheet_name}
                        onChange={(e) => updateSheet(sheetIdx, { sheet_name: e.target.value })}
                        className="w-full px-2 py-1 border rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">章节 ID</label>
                      <input
                        value={sheet.id}
                        onChange={(e) => updateSheet(sheetIdx, { id: e.target.value })}
                        className="w-full px-2 py-1 border rounded text-sm"
                      />
                    </div>
                  </div>

                  {/* Column mappings */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-gray-500 font-medium">列映射</span>
                      <button onClick={() => addColumnMapping(sheetIdx)} className="text-xs text-blue-600 hover:underline">
                        + 添加列
                      </button>
                    </div>
                    {/* Header */}
                    <div className="grid grid-cols-[1fr_1fr_40px_40px_24px_24px_24px] gap-1 mb-1 px-1">
                      <span className="text-[10px] text-gray-400 uppercase">字段名</span>
                      <span className="text-[10px] text-gray-400 uppercase">Excel 列名</span>
                      <span className="text-[10px] text-gray-400 uppercase text-center" title="表格列">表格</span>
                      <span className="text-[10px] text-gray-400 uppercase text-center" title="详情字段">详情</span>
                      <span></span><span></span><span></span>
                    </div>
                    {Object.entries(sheet.columns).map(([key, value], colIdx) => (
                      <div key={colIdx} className="grid grid-cols-[1fr_1fr_40px_40px_24px_24px_24px] gap-1 mb-1 items-center">
                        <input
                          value={key}
                          onChange={(e) => updateColumnKey(sheetIdx, key, e.target.value)}
                          className="px-2 py-1 border rounded text-xs bg-white"
                          placeholder="字段名"
                        />
                        <input
                          value={value}
                          onChange={(e) => updateColumnValue(sheetIdx, key, e.target.value)}
                          className="px-2 py-1 border rounded text-xs bg-white"
                          placeholder="Excel 列名"
                        />
                        <label className="flex justify-center">
                          <input
                            type="checkbox"
                            checked={(sheet.table_columns || []).includes(key)}
                            onChange={() => toggleTableColumn(sheetIdx, key)}
                            title="作为表格列显示"
                            className="rounded"
                          />
                        </label>
                        <label className="flex justify-center">
                          <input
                            type="checkbox"
                            checked={(sheet.detail_fields || []).some((d) => d.field === key)}
                            onChange={() => toggleDetailField(sheetIdx, key, value)}
                            title="作为详情字段"
                            className="rounded"
                          />
                        </label>
                        <button
                          onClick={() => moveColumn(sheetIdx, colIdx, -1)}
                          disabled={colIdx === 0}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-20 text-xs text-center"
                          title="上移"
                        >▲</button>
                        <button
                          onClick={() => moveColumn(sheetIdx, colIdx, 1)}
                          disabled={colIdx === Object.keys(sheet.columns).length - 1}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-20 text-xs text-center"
                          title="下移"
                        >▼</button>
                        <button onClick={() => removeColumn(sheetIdx, key)} className="text-red-400 hover:text-red-600 text-center">&times;</button>
                      </div>
                    ))}
                    {Object.keys(sheet.columns).length === 0 && (
                      <p className="text-xs text-gray-400 py-1">暂无列映射</p>
                    )}
                  </div>

                  {/* Image columns */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-gray-500 font-medium">图片列</span>
                      <button onClick={() => addImageColumn(sheetIdx)} className="text-xs text-blue-600 hover:underline">
                        + 添加
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(sheet.image_columns || []).map((col, colIdx) => (
                        <div key={colIdx} className="flex items-center gap-1">
                          <input
                            value={col}
                            onChange={(e) => updateImageColumn(sheetIdx, colIdx, e.target.value)}
                            className="px-2 py-1 border rounded text-xs bg-white w-32"
                          />
                          <button onClick={() => removeImageColumn(sheetIdx, colIdx)} className="text-red-400 hover:text-red-600">&times;</button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={addSheet} className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors">
                + 添加 Sheet
              </button>
            </div>
          )}
        </div>

        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border rounded hover:bg-gray-50">取消</button>
          <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">保存</button>
        </div>
      </div>
    </div>
  );
}
