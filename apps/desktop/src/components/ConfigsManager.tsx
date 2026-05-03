import { useState } from "react";
import { useAppStore } from "../stores/app-store";
import {
  listConfigs,
  saveConfig,
  deleteConfig,
  exportConfig,
  importConfigFromJson,
  selectExcel,
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

  const handleExport = async (id: string, title: string) => {
    try {
      const json = await exportConfig(id);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title}.json`;
      a.click();
      URL.revokeObjectURL(url);
      addLog("配置已导出");
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
      await saveConfig(meta.id, JSON.stringify(config));
      setConfigs(await listConfigs());
      addLog(`已绑定 Excel: ${path.split("/").pop()}`);
    } catch (e) {
      addLog(`绑定失败: ${e}`);
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
            saveConfig(editingId, JSON.stringify(c)).then((meta) => {
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
}: {
  meta: ConfigMeta;
  onSelect: (meta: ConfigMeta) => void;
  onEdit: (meta: ConfigMeta) => void;
  onDelete: (id: string) => void;
  onExport: (id: string, title: string) => void;
  onBindExcel: (meta: ConfigMeta) => void;
}) {
  return (
    <div className="bg-surface rounded-lg border border-border p-4 hover:border-border-strong transition-all duration-100 group">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-md bg-brand-bg text-brand-accent flex items-center justify-center text-[0.733rem] font-bold shrink-0">
          ▤
        </div>
        <div className="flex-1 min-w-0">
          <h3
            className="text-ui text-[0.867rem] text-text truncate cursor-pointer hover:text-brand-accent transition-colors"
            onClick={() => onSelect(meta)}
            title="点击使用此配置"
          >
            {meta.title}
          </h3>
          <p className="text-[0.667rem] text-text-quaternary mt-0.5 font-mono">
            {meta.updated_at
              ? new Date(parseInt(meta.updated_at) * 1000).toLocaleDateString()
              : ""}
          </p>
        </div>
        <button
          onClick={() => onDelete(meta.id)}
          className="text-text-quaternary/30 hover:text-danger text-[0.733rem] opacity-0 group-hover:opacity-100 transition-opacity"
        >
          ✕
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <button
          onClick={() => onSelect(meta)}
          className="px-3 py-1.5 bg-brand text-white rounded-md text-[0.8rem] font-medium hover:bg-brand-hover transition-colors"
        >
          使用
        </button>
        <button
          onClick={() => onEdit(meta)}
          className="px-3 py-1.5 bg-surface-hover border border-border text-text-secondary rounded-md text-[0.8rem] hover:bg-surface-active transition-colors"
        >
          编辑
        </button>
        <button
          onClick={() => onBindExcel(meta)}
          className="px-3 py-1.5 bg-surface-hover border border-border text-text-secondary rounded-md text-[0.8rem] hover:bg-surface-active transition-colors"
        >
          绑定 Excel
        </button>
        <button
          onClick={() => onExport(meta.id, meta.title)}
          className="px-3 py-1.5 bg-surface-hover border border-border text-text-secondary rounded-md text-[0.8rem] hover:bg-surface-active transition-colors"
        >
          导出
        </button>
      </div>
    </div>
  );
}
