import { useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { Wizard } from "./components/Wizard";
import { LogPanel } from "./components/LogPanel";
import { TemplateManager } from "./components/TemplateManager";
import { ConfigsManager } from "./components/ConfigsManager";
import { Settings } from "./components/Settings";
import { useAppStore } from "./stores/app-store";
import { listTemplates } from "./services/tauri-commands";
import { detectSidecarPortBrowser } from "./services/api";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export default function App() {
  const { currentView, sidecarReady, setSidecarReady, setSidecarPort, setTemplates, loadConfigs, addLog, logs, clearLogs, settings } = useAppStore();

  useEffect(() => {
    const checkTauri = async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const info = await invoke("get_sidecar_port") as { port: number };
        setSidecarPort(info.port);
        setSidecarReady(true);
        addLog(`Sidecar 服务已就绪 (port ${info.port})`);
      } catch {
        addLog("等待 Sidecar 启动...");
        setTimeout(checkTauri, 2000);
      }
    };

    const checkBrowser = async () => {
      const port = await detectSidecarPortBrowser();
      if (port) {
        setSidecarPort(port);
        setSidecarReady(true);
        addLog(`Sidecar 服务已就绪 (port ${port}, browser mode)`);
      } else {
        addLog("等待 Sidecar 启动... (browser mode)");
        setTimeout(checkBrowser, 3000);
      }
    };

    if (isTauri) {
      checkTauri();
    } else {
      addLog("浏览器模式 — 自动检测 Sidecar 端口");
      checkBrowser();
    }

    listTemplates().then(setTemplates).catch(() => {});
    loadConfigs();

    // Apply saved settings
    document.documentElement.style.fontSize = `${settings.fontSize}px`;
    document.documentElement.setAttribute("data-theme", settings.theme);
  }, [setSidecarReady, setSidecarPort, setTemplates, loadConfigs, addLog, settings.fontSize, settings.theme]);

  return (
    <div className="flex h-screen bg-canvas">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {!sidecarReady && (
          <div className="bg-warning-bg text-warning text-xs px-4 py-1.5 flex items-center gap-2 border-b border-warning-border">
            <span className="animate-pulse">●</span>
            正在启动后端服务...
          </div>
        )}
        {currentView === "wizard" && <Wizard />}
        {currentView === "templates" && <TemplateManager />}
        {currentView === "configs" && <ConfigsManager />}
        {currentView === "settings" && <Settings />}
        <LogPanel logs={logs} onClear={clearLogs} />
      </div>
    </div>
  );
}
