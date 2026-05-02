import { useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { Wizard } from "./components/Wizard";
import { LogPanel } from "./components/LogPanel";
import { TemplateManager } from "./components/TemplateManager";
import { useAppStore } from "./stores/app-store";
import { listTemplates } from "./services/tauri-commands";

export default function App() {
  const { currentView, sidecarReady, setSidecarReady, setTemplates, addLog } = useAppStore();

  useEffect(() => {
    // Check sidecar health
    const check = async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("get_sidecar_port");
        setSidecarReady(true);
        addLog("Sidecar 服务已就绪");
      } catch {
        addLog("等待 Sidecar 启动...");
        setTimeout(check, 2000);
      }
    };
    check();

    // Load templates
    listTemplates().then(setTemplates).catch(() => {});
  }, [setSidecarReady, setTemplates, addLog]);

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
