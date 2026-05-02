import { useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { Wizard } from "./components/Wizard";
import { LogPanel } from "./components/LogPanel";
import { TemplateManager } from "./components/TemplateManager";
import { useAppStore } from "./stores/app-store";
import { listTemplates } from "./services/tauri-commands";
import { detectSidecarPortBrowser } from "./services/api";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export default function App() {
  const { currentView, sidecarReady, setSidecarReady, setSidecarPort, setTemplates, addLog } = useAppStore();

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
  }, [setSidecarReady, setSidecarPort, setTemplates, addLog]);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {!sidecarReady && (
          <div className="bg-yellow-50 text-yellow-700 text-sm px-4 py-2 text-center">
            正在启动后端服务...
          </div>
        )}
        {currentView === "wizard" && <Wizard />}
        {currentView === "templates" && <TemplateManager />}
        <LogPanel logs={useAppStore.getState().logs} />
      </div>
    </div>
  );
}
