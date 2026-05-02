import { create } from "zustand";
import type { BudgetConfig, ConfigMeta, ReportContent } from "../types";
import { listConfigs as listConfigsCmd } from "../services/tauri-commands";

export type AppView = "wizard" | "templates" | "configs" | "settings";
export type ThemeMode = "light" | "dark";

export interface AppSettings {
  fontSize: number;
  theme: ThemeMode;
}

export const DEFAULT_CONFIG: BudgetConfig = {
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

export interface TemplateMeta {
  id: string;
  name: string;
  filename: string;
  path: string;
  size: number;
  imported_at: string;
}

interface AppState {
  // Navigation
  currentView: AppView;
  setCurrentView: (view: AppView) => void;

  // Templates
  templates: TemplateMeta[];
  selectedTemplateId: string | null;
  setTemplates: (templates: TemplateMeta[]) => void;
  selectTemplate: (id: string | null) => void;

  // Wizard
  wizardStep: number;
  setWizardStep: (step: number) => void;

  // Data
  config: BudgetConfig;
  setConfig: (config: BudgetConfig) => void;
  configs: ConfigMeta[];
  selectedConfigId: string | null;
  setConfigs: (configs: ConfigMeta[]) => void;
  selectConfigId: (id: string | null) => void;
  loadConfigs: () => Promise<void>;
  excelContent: ReportContent | null;
  setExcelContent: (content: ReportContent | null) => void;
  excelFilePath: string | null;
  setExcelFilePath: (path: string | null) => void;
  outputReportPath: string | null;
  setOutputReportPath: (path: string | null) => void;

  // Sidecar
  sidecarReady: boolean;
  setSidecarReady: (ready: boolean) => void;
  sidecarPort: number | null;
  setSidecarPort: (port: number | null) => void;

  // Settings
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => void;

  // Logs
  logs: string[];
  addLog: (msg: string) => void;
  clearLogs: () => void;
}

const SETTINGS_KEY = "app-settings";

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw) as AppSettings;
  } catch { /* ignore */ }
  return { fontSize: 15, theme: "dark" };
}

export const useAppStore = create<AppState>((set) => ({
  currentView: "wizard",
  setCurrentView: (view) => set({ currentView: view }),

  templates: [],
  selectedTemplateId: null,
  setTemplates: (templates) => set({ templates }),
  selectTemplate: (id) => set({ selectedTemplateId: id }),

  wizardStep: 0,
  setWizardStep: (step) => set({ wizardStep: step }),

  config: DEFAULT_CONFIG,
  setConfig: (config) => set({ config }),
  configs: [],
  selectedConfigId: null,
  setConfigs: (configs) => set({ configs }),
  selectConfigId: (id) => set({ selectedConfigId: id }),
  loadConfigs: async () => {
    try {
      const configs = await listConfigsCmd();
      set({ configs });
    } catch { /* ignore */ }
  },
  excelContent: null,
  setExcelContent: (content) => set({ excelContent: content }),
  excelFilePath: null,
  setExcelFilePath: (path) => set({ excelFilePath: path }),
  outputReportPath: null,
  setOutputReportPath: (path) => set({ outputReportPath: path }),

  sidecarReady: false,
  setSidecarReady: (ready) => set({ sidecarReady: ready }),
  sidecarPort: null,
  setSidecarPort: (port) => set({ sidecarPort: port }),

  settings: loadSettings(),
  updateSettings: (partial) =>
    set((state) => {
      const settings = { ...state.settings, ...partial };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      return { settings };
    }),

  logs: [],
  addLog: (msg) =>
    set((state) => ({
      logs: [...state.logs, `[${new Date().toLocaleTimeString()}] ${msg}`],
    })),
  clearLogs: () => set({ logs: [] }),
}));
