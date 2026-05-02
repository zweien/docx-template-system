import { useState } from "react";
import { useAppStore, DEFAULT_CONFIG } from "../stores/app-store";
import { saveConfig, deleteConfig, exportConfig, importConfigFromJson, listConfigs } from "../services/tauri-commands";
import { ConfigEditor } from "./ConfigEditor";

export function ConfigSelector() {
  const { config, setConfig, configs, setConfigs, selectedConfigId, selectConfigId, addLog } = useAppStore();
  const [showEditor, setShowEditor] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSelect = async (id: string | null) => {
    selectConfigId(id);
    if (!id) {
      setConfig(DEFAULT_CONFIG);
      return;
    }
    const meta = configs.find((c) => c.id === id);
    if (!meta) return;
    try {
      const json = await exportConfig(id);
      const parsed = JSON.parse(json);
      setConfig(parsed);
      addLog(`切换配置: ${meta.title}`);
    } catch (e) {
      addLog(`加载配置失败: ${e}`);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const meta = await saveConfig(selectedConfigId, config);
      selectConfigId(meta.id);
      const updated = await listConfigs();
      setConfigs(updated);
      addLog(`配置已保存: ${meta.title}`);
    } catch (e) {
      addLog(`保存失败: ${e}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedConfigId) return;
    if (!confirm("确定删除此配置方案？")) return;
    try {
      await deleteConfig(selectedConfigId);
      selectConfigId(null);
      setConfig(DEFAULT_CONFIG);
      const updated = await listConfigs();
      setConfigs(updated);
      addLog("配置已删除");
    } catch (e) {
      addLog(`删除失败: ${e}`);
    }
  };

  const handleExport = async () => {
    const id = selectedConfigId;
    if (!id) {
      addLog("请先保存配置后再导出");
      return;
    }
    try {
      const json = await exportConfig(id);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${config.title || "config"}.json`;
      a.click();
      URL.revokeObjectURL(url);
      addLog("配置已导出");
    } catch (e) {
      addLog(`导出失败: ${e}`);
    }
  };

  const handleImport = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const meta = await importConfigFromJson(text);
        const updated = await listConfigs();
        setConfigs(updated);
        selectConfigId(meta.id);
        const parsed = JSON.parse(text);
        setConfig(parsed);
        addLog(`导入配置: ${meta.title}`);
      } catch (e) {
        addLog(`导入失败: ${e}`);
      }
    };
    input.click();
  };

  return (
    <>
      <div className="bg-surface rounded-lg border border-border p-2.5 flex items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-[10px] text-text-quaternary shrink-0 uppercase tracking-wider">配置方案</span>
          <select
            value={selectedConfigId || ""}
            onChange={(e) => handleSelect(e.target.value || null)}
            className="flex-1 max-w-[200px] px-2 py-1.5 border border-border rounded-md text-[13px] bg-surface text-text focus:border-brand-accent focus:outline-none"
          >
            <option value="">默认配置</option>
            {configs.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
          <span className="text-[10px] text-text-quaternary shrink-0 font-mono">{config.sheets.length} 个 Sheet</span>
        </div>
        <div className="flex items-center gap-1 text-[12px] border-l border-border pl-3">
          <button onClick={handleSave} disabled={saving} className="text-brand-accent hover:text-brand-hover font-medium disabled:opacity-40 transition-colors">
            {saving ? "..." : "保存"}
          </button>
          <span className="text-border">|</span>
          <button onClick={() => setShowEditor(true)} className="text-text-muted hover:text-text transition-colors">
            编辑
          </button>
          {selectedConfigId && (
            <>
              <span className="text-border">|</span>
              <button onClick={handleDelete} className="text-text-quaternary hover:text-danger transition-colors">删除</button>
            </>
          )}
          <span className="text-border">|</span>
          <button onClick={handleExport} className="text-text-quaternary hover:text-text transition-colors">导出</button>
          <button onClick={handleImport} className="text-text-quaternary hover:text-text transition-colors">导入</button>
        </div>
      </div>

      {showEditor && (
        <ConfigEditor
          config={config}
          onChange={setConfig}
          onClose={() => setShowEditor(false)}
        />
      )}
    </>
  );
}
