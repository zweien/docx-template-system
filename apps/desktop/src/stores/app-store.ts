import { create } from "zustand";
import type { BudgetConfig, ReportContent } from "../types";

export type AppView = "wizard" | "templates" | "configs";

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
  excelContent: ReportContent | null;
  setExcelContent: (content: ReportContent | null) => void;
  outputReportPath: string | null;
  setOutputReportPath: (path: string | null) => void;

  // Sidecar
  sidecarReady: boolean;
  setSidecarReady: (ready: boolean) => void;
  sidecarPort: number | null;
  setSidecarPort: (port: number | null) => void;

  // Logs
  logs: string[];
  addLog: (msg: string) => void;
  clearLogs: () => void;
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
  excelContent: null,
  setExcelContent: (content) => set({ excelContent: content }),
  outputReportPath: null,
  setOutputReportPath: (path) => set({ outputReportPath: path }),

  sidecarReady: false,
  setSidecarReady: (ready) => set({ sidecarReady: ready }),
  sidecarPort: null,
  setSidecarPort: (port) => set({ sidecarPort: port }),

  logs: [],
  addLog: (msg) =>
    set((state) => ({
      logs: [...state.logs, `[${new Date().toLocaleTimeString()}] ${msg}`],
    })),
  clearLogs: () => set({ logs: [] }),
}));
