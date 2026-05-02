import { create } from "zustand";
import type { BudgetConfig, ReportContent } from "../types";

export type AppView = "wizard" | "templates" | "configs";

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
  config: BudgetConfig | null;
  setConfig: (config: BudgetConfig | null) => void;
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

  config: null,
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
