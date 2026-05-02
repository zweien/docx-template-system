import { useState } from "react";
import { useAppStore, AppView, ThemeMode } from "../stores/app-store";

export function Sidebar() {
  const { currentView, setCurrentView, settings, updateSettings } = useAppStore();
  const [collapsed, setCollapsed] = useState(false);

  const items: { view: AppView; icon: string; label: string; desc: string }[] = [
    { view: "wizard", icon: "◆", label: "生成报告", desc: "四步向导" },
    { view: "templates", icon: "⊞", label: "模板管理", desc: "导入与管理" },
  ];

  const toggleTheme = () => {
    const next: ThemeMode = settings.theme === "dark" ? "light" : "dark";
    updateSettings({ theme: next });
    document.documentElement.setAttribute("data-theme", next);
  };

  const renderNavItem = (item: { view: AppView; icon: string; label: string; desc: string }) => {
    const active = currentView === item.view;
    const btn = (
      <button
        key={item.view}
        onClick={() => setCurrentView(item.view)}
        className={`w-full flex items-center rounded-md transition-all duration-150 ${
          collapsed ? "justify-center px-0 py-2" : "gap-2.5 px-2.5 py-1.5 text-left"
        } ${
          active
            ? "bg-sidebar-active-bg text-sidebar-active-text"
            : "text-sidebar-text hover:bg-sidebar-hover hover:text-text-secondary"
        }`}
        title={collapsed ? item.label : undefined}
      >
        <span className={`shrink-0 ${collapsed ? "" : "w-5 text-center"}`} style={{ fontSize: "0.93em" }}>
          <span className={active ? "text-brand-accent" : ""}>{item.icon}</span>
        </span>
        {!collapsed && (
          <div className="min-w-0">
            <div className="font-medium leading-tight truncate" style={{ fontSize: "0.867em" }}>{item.label}</div>
            <div className="text-text-quaternary leading-tight mt-px truncate" style={{ fontSize: "0.667em" }}>{item.desc}</div>
          </div>
        )}
      </button>
    );
    return btn;
  };

  return (
    <aside
      className={`bg-sidebar-bg border-r border-sidebar-border flex flex-col shrink-0 select-none transition-all duration-200 ${
        collapsed ? "w-12" : "w-52"
      }`}
    >
      {/* Logo */}
      <div className={`flex items-center ${collapsed ? "justify-center px-0" : "gap-2.5 px-4"} pt-5 pb-4`}>
        <div className="w-7 h-7 rounded-md bg-brand flex items-center justify-center text-white font-semibold shrink-0" style={{ fontSize: "0.8em" }}>
          R
        </div>
        {!collapsed && (
          <div>
            <h1 className="font-medium text-text leading-tight" style={{ fontSize: "0.867em" }}>预算报告</h1>
            <p className="text-text-quaternary leading-tight mt-0.5 font-mono" style={{ fontSize: "0.667em" }}>v0.3.0</p>
          </div>
        )}
      </div>

      {/* Collapse toggle */}
      <div className={`flex ${collapsed ? "justify-center" : "justify-end"} ${collapsed ? "px-0" : "px-3"} -mt-1 mb-1`}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-5 h-5 rounded flex items-center justify-center text-text-quaternary hover:text-text-secondary hover:bg-sidebar-hover transition-all duration-100"
          title={collapsed ? "展开侧边栏" : "收起侧边栏"}
        >
          <span className={`transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}>◂</span>
        </button>
      </div>

      {/* Nav */}
      <nav className={`flex-1 ${collapsed ? "px-1.5" : "px-2.5"} space-y-px`}>
        {!collapsed && (
          <div className="font-medium text-text-quaternary uppercase tracking-wider px-2.5 py-3" style={{ fontSize: "0.667em" }}>
            功能
          </div>
        )}
        {items.map(renderNavItem)}
      </nav>

      {/* Bottom */}
      <div className={`${collapsed ? "px-1.5" : "px-2.5"} pb-2`}>
        <div className="border-t border-sidebar-border pt-2 space-y-px">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className={`w-full flex items-center rounded-md text-sidebar-text hover:bg-sidebar-hover hover:text-text-secondary transition-all duration-150 ${
              collapsed ? "justify-center px-0 py-2" : "gap-2.5 px-2.5 py-1.5 text-left"
            }`}
            title={collapsed ? (settings.theme === "dark" ? "切换浅色" : "切换深色") : undefined}
          >
            <span className={`shrink-0 ${collapsed ? "" : "w-5 text-center"}`} style={{ fontSize: "0.93em" }}>
              {settings.theme === "dark" ? "☀" : "☽"}
            </span>
            {!collapsed && (
              <div className="min-w-0">
                <div className="font-medium leading-tight" style={{ fontSize: "0.867em" }}>{settings.theme === "dark" ? "浅色模式" : "深色模式"}</div>
              </div>
            )}
          </button>
          {/* Settings */}
          {renderNavItem({ view: "settings", icon: "⚙", label: "设置", desc: "外观与偏好" })}
        </div>
      </div>

      {/* Footer */}
      {!collapsed && (
        <div className="px-4 py-2.5 border-t border-sidebar-border">
          <p className="text-text-quaternary font-mono" style={{ fontSize: "0.667em" }}>Tauri 2.0 · report-engine</p>
        </div>
      )}
    </aside>
  );
}
