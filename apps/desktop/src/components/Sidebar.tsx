import { useAppStore, AppView, ThemeMode } from "../stores/app-store";

export function Sidebar() {
  const { currentView, setCurrentView, settings, updateSettings } = useAppStore();

  const items: { view: AppView; icon: string; label: string; desc: string }[] = [
    { view: "wizard", icon: "◆", label: "生成报告", desc: "四步向导" },
    { view: "templates", icon: "⊞", label: "模板管理", desc: "导入与管理" },
  ];

  const toggleTheme = () => {
    const next: ThemeMode = settings.theme === "dark" ? "light" : "dark";
    updateSettings({ theme: next });
    document.documentElement.setAttribute("data-theme", next);
  };

  const renderNav = (item: { view: AppView; icon: string; label: string; desc: string }) => {
    const active = currentView === item.view;
    return (
      <button
        key={item.view}
        onClick={() => setCurrentView(item.view)}
        className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-left transition-all duration-100 ${
          active
            ? "bg-sidebar-active-bg text-sidebar-active-text"
            : "text-sidebar-text hover:bg-sidebar-hover hover:text-text-secondary"
        }`}
      >
        <span className="w-5 text-center" style={{ fontSize: "0.93em" }}>
          <span className={active ? "text-brand-accent" : ""}>{item.icon}</span>
        </span>
        <div className="min-w-0">
          <div className="font-medium leading-tight truncate" style={{ fontSize: "0.867em" }}>{item.label}</div>
          <div className="text-text-quaternary leading-tight mt-px truncate" style={{ fontSize: "0.667em" }}>{item.desc}</div>
        </div>
      </button>
    );
  };

  return (
    <aside className="w-52 bg-sidebar-bg border-r border-sidebar-border flex flex-col shrink-0 select-none">
      {/* Logo */}
      <div className="px-4 pt-5 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-brand flex items-center justify-center text-white font-semibold" style={{ fontSize: "0.8em" }}>
            R
          </div>
          <div>
            <h1 className="font-medium text-text leading-tight" style={{ fontSize: "0.867em" }}>预算报告</h1>
            <p className="text-text-quaternary leading-tight mt-0.5 font-mono" style={{ fontSize: "0.667em" }}>v0.2.0</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2.5 space-y-px">
        <div className="font-medium text-text-quaternary uppercase tracking-wider px-2.5 py-3" style={{ fontSize: "0.667em" }}>
          功能
        </div>
        {items.map(renderNav)}
      </nav>

      {/* Bottom */}
      <div className="px-2.5 pb-2">
        <div className="border-t border-sidebar-border pt-2">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-left text-sidebar-text hover:bg-sidebar-hover hover:text-text-secondary transition-all duration-100"
            title={`切换到${settings.theme === "dark" ? "浅色" : "深色"}主题`}
          >
            <span className="w-5 text-center" style={{ fontSize: "0.93em" }}>
              {settings.theme === "dark" ? "☀" : "☽"}
            </span>
            <div className="min-w-0">
              <div className="font-medium leading-tight" style={{ fontSize: "0.867em" }}>{settings.theme === "dark" ? "浅色模式" : "深色模式"}</div>
            </div>
          </button>
          {/* Settings */}
          {(() => {
            const item = { view: "settings" as AppView, icon: "⚙", label: "设置", desc: "外观与偏好" };
            return renderNav(item);
          })()}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-sidebar-border">
        <p className="text-text-quaternary font-mono" style={{ fontSize: "0.667em" }}>Tauri 2.0 · report-engine</p>
      </div>
    </aside>
  );
}
