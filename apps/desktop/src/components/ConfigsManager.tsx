import { useState } from "react";
import JSZip from "jszip";
import { useAppStore } from "../stores/app-store";
import {
  listConfigs,
  saveConfig,
  deleteConfig,
  exportConfig,
  importConfigFromJson,
  selectExcel,
  readFileBase64,
} from "../services/tauri-commands";
import { BudgetConfig, ConfigMeta } from "../types";
import { ConfigEditor } from "./ConfigEditor";

export function ConfigsManager() {
  const {
    configs,
    setConfigs,
    setConfig,
    selectConfigId,
    setExcelFilePath,
    setCurrentView,
    addLog,
  } = useAppStore();
  const [editingConfig, setEditingConfig] = useState<BudgetConfig | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleCreate = () => {
    setEditingConfig({
      title: "新配置方案",
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
        },
      ],
    });
    setEditingId(null);
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
        addLog(`导入配置: ${meta.title}`);
      } catch (e) {
        addLog(`导入失败: ${e}`);
      }
    };
    input.click();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除此配置方案？")) return;
    try {
      await deleteConfig(id);
      setConfigs(await listConfigs());
      addLog("配置已删除");
    } catch (e) {
      addLog(`删除失败: ${e}`);
    }
  };

  const handleExport = async (meta: ConfigMeta) => {
    try {
      const json = await exportConfig(meta.id);
      const config = JSON.parse(json);
      const zip = new JSZip();
      zip.file(`${meta.title}.json`, json);
      if (config.excel_path) {
        const base64 = await readFileBase64(config.excel_path);
        const xlsxName = config.excel_path.split("/").pop() || "data.xlsx";
        zip.file(xlsxName, base64, { base64: true });
      }
      const blob = await zip.generateAsync({ type: "base64" });
      const { saveDataAs } = await import("../services/tauri-commands");
      await saveDataAs(`${meta.title}.zip`, blob, true);
      addLog("已导出为 ZIP");
    } catch (e) {
      addLog(`导出失败: ${e}`);
    }
  };

  const handleEdit = async (meta: ConfigMeta) => {
    try {
      const json = await exportConfig(meta.id);
      setEditingConfig(JSON.parse(json));
      setEditingId(meta.id);
    } catch (e) {
      addLog(`加载配置失败: ${e}`);
    }
  };

  const handleBindExcel = async (meta: ConfigMeta) => {
    const path = await selectExcel();
    if (!path) return;
    try {
      const json = await exportConfig(meta.id);
      const config = JSON.parse(json);
      config.excel_path = path;
      await saveConfig(meta.id, config);
      setConfigs(await listConfigs());
      addLog(`已绑定 Excel: ${path.split("/").pop()}`);
    } catch (e) {
      addLog(`绑定失败: ${e}`);
    }
  };

  const handleRename = async (id: string, newName: string) => {
    try {
      const json = await exportConfig(id);
      const config = JSON.parse(json);
      config.title = newName;
      await saveConfig(id, config);
      setConfigs(await listConfigs());
      addLog(`已重命名: ${newName}`);
    } catch (e) {
      addLog(`重命名失败: ${e}`);
    }
  };

  const handleSelectConfig = async (meta: ConfigMeta) => {
    try {
      const json = await exportConfig(meta.id);
      const config = JSON.parse(json);
      setConfig(config);
      selectConfigId(meta.id);
      if (config.excel_path) {
        setExcelFilePath(config.excel_path);
      }
      setCurrentView("wizard");
    } catch (e) {
      addLog(`加载失败: ${e}`);
    }
  };

  return (
    <div className="flex-1 p-8 overflow-auto">
      <div className="max-w-3xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-heading text-lg text-text">配置方案</h2>
            <p className="text-caption text-text-muted mt-1">
              管理 Excel 映射配置，绑定数据文件后可直接使用
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleImport}
              className="px-4 py-2 bg-surface border border-border text-text-secondary rounded-md hover:bg-surface-hover text-[0.867rem] transition-colors"
            >
              导入配置
            </button>
            <button
              onClick={handleCreate}
              className="px-4 py-2 bg-brand text-white rounded-md hover:bg-brand-hover text-[0.867rem] font-medium transition-colors"
            >
              + 新建配置
            </button>
          </div>
        </div>

        {configs.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border rounded-lg bg-surface/30">
            <div className="w-12 h-12 rounded-xl bg-brand-bg text-brand-accent flex items-center justify-center mx-auto mb-4 text-xl">
              ▤
            </div>
            <p className="text-text-secondary font-medium text-[0.867rem]">
              还没有配置方案
            </p>
            <p className="text-[0.733rem] text-text-quaternary mt-1">
              点击上方按钮新建或导入配置
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {configs.map((c) => (
              <ConfigCard
                key={c.id}
                meta={c}
                onSelect={handleSelectConfig}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onExport={handleExport}
                onBindExcel={handleBindExcel}
                onRename={handleRename}
              />
            ))}
          </div>
        )}
      </div>

      {editingConfig && (
        <ConfigEditor
          config={editingConfig}
          onChange={(c) => {
            setEditingConfig(c);
            saveConfig(editingId, c).then((meta) => {
              listConfigs().then(setConfigs);
              selectConfigId(meta.id);
              addLog(`配置已保存: ${meta.title}`);
            });
          }}
          onClose={() => {
            setEditingConfig(null);
            setEditingId(null);
          }}
        />
      )}
    </div>
  );
}

function ConfigCard({
  meta,
  onSelect,
  onEdit,
  onDelete,
  onExport,
  onBindExcel,
  onRename,
}: {
  meta: ConfigMeta;
  onSelect: (meta: ConfigMeta) => void;
  onEdit: (meta: ConfigMeta) => void;
  onDelete: (id: string) => void;
  onExport: (meta: ConfigMeta) => void;
  onBindExcel: (meta: ConfigMeta) => void;
  onRename: (id: string, newName: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(meta.title);
  const sizeKb = (meta.size / 1024).toFixed(1);

  const handleSaveName = () => {
    if (name.trim() && name !== meta.title) {
      onRename(meta.id, name.trim());
    }
    setEditing(false);
  };

  return (
    <div className="bg-surface rounded-lg border border-border p-4 hover:border-border-strong transition-all duration-100 group">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-md bg-brand-bg text-brand-accent flex items-center justify-center text-[0.733rem] font-bold shrink-0">
          ▤
        </div>
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
              autoFocus
              className="text-ui text-[0.867rem] text-text w-full border-b border-brand-accent outline-none bg-transparent py-0.5"
            />
          ) : (
            <h3
              className="text-ui text-[0.867rem] text-text truncate cursor-pointer hover:text-brand-accent transition-colors"
              onDoubleClick={() => setEditing(true)}
              title="双击编辑名称"
            >
              {meta.title}
            </h3>
          )}
          <p className="text-[0.667rem] text-text-quaternary mt-0.5 font-mono">
            {sizeKb} KB · .json · {meta.updated_at ? new Date(parseInt(meta.updated_at) * 1000).toLocaleDateString() : ""}
          </p>
          {meta.excel_path && (
            <p className="text-[0.667rem] text-brand-accent mt-0.5 truncate" title={meta.excel_path}>
              📊 {meta.excel_path.split("/").pop()}
            </p>
          )}
        </div>
        <button
          onClick={() => onDelete(meta.id)}
          className="text-text-quaternary/30 hover:text-danger text-[0.733rem] opacity-0 group-hover:opacity-100 transition-opacity"
        >
          ✕
        </button>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => onSelect(meta)}
          className="px-3 py-1.5 bg-brand text-white rounded-md text-[0.8rem] font-medium hover:bg-brand-hover transition-colors"
        >
          使用
        </button>
        <span className="text-border">|</span>
        <button
          onClick={() => onEdit(meta)}
          className="text-text-muted hover:text-text text-[0.8rem] transition-colors"
        >
          编辑
        </button>
        <button
          onClick={() => onBindExcel(meta)}
          className="text-text-muted hover:text-text text-[0.8rem] transition-colors"
        >
          绑定 Excel
        </button>
        <button
          onClick={() => onExport(meta)}
          className="text-text-muted hover:text-text text-[0.8rem] transition-colors"
        >
          导出
        </button>
      </div>
    </div>
  );
}
