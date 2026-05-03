import { useEffect, useState } from "react";
import { useAppStore, AppView, ThemeMode } from "../stores/app-store";

type ModalType = "help" | "changelog" | "about" | null;

const NARROW_BREAKPOINT = 768;

export function Sidebar() {
  const { currentView, setCurrentView, settings, updateSettings } = useAppStore();
  const [collapsed, setCollapsed] = useState(false);
  const [modal, setModal] = useState<ModalType>(null);
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const check = () => {
      const narrow = window.innerWidth < NARROW_BREAKPOINT;
      setIsNarrow(narrow);
      if (narrow) setCollapsed(true);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const handleNavClick = (view: AppView) => {
    setCurrentView(view);
    if (isNarrow) setCollapsed(true);
  };

  const items: { view: AppView; icon: string; label: string; desc: string }[] = [
    { view: "wizard", icon: "◆", label: "生成报告", desc: "四步向导" },
    { view: "templates", icon: "⊞", label: "模板管理", desc: "导入与管理" },
    { view: "configs", icon: "▤", label: "配置方案", desc: "管理与编辑" },
  ];

  const toggleTheme = () => {
    const next: ThemeMode = settings.theme === "dark" ? "light" : "dark";
    updateSettings({ theme: next });
    document.documentElement.setAttribute("data-theme", next);
  };

  const renderNavItem = (item: { view: AppView; icon: string; label: string; desc: string }) => {
    const active = currentView === item.view;
    return (
      <button
        key={item.view}
        onClick={() => handleNavClick(item.view)}
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
  };

  const renderFooterLink = (icon: string, label: string, onClick: () => void) => (
    <button
      onClick={onClick}
      className="text-text-quaternary hover:text-text-secondary transition-colors"
      style={{ fontSize: "0.667em" }}
      title={collapsed ? label : undefined}
    >
      {collapsed ? icon : <>{icon} {label}</>}
    </button>
  );

  return (
    <>
      {/* Overlay backdrop for narrow screens when sidebar is expanded */}
      {isNarrow && !collapsed && (
        <div className="sidebar-collapsed-overlay" onClick={() => setCollapsed(true)} />
      )}
      <aside
        className={`bg-sidebar-bg border-r border-sidebar-border flex flex-col shrink-0 select-none sidebar-transition ${
          isNarrow && collapsed
            ? "w-12"
            : collapsed
            ? "w-12"
            : "w-52"
        } ${isNarrow && !collapsed ? "fixed left-0 top-0 bottom-0 z-50" : "relative"}`}
      >
        {/* Logo */}
        <div className={`flex items-center ${collapsed ? "justify-center px-0" : "gap-2.5 px-4"} pt-5 pb-4`}>
          <img src="/favicon.png" alt="Logo" className="w-7 h-7 rounded-md shrink-0" />
          {!collapsed && (
            <div>
              <h1 className="font-medium text-text leading-tight" style={{ fontSize: "0.867em" }}>预算报告</h1>
              <p className="text-text-quaternary leading-tight mt-0.5 font-mono" style={{ fontSize: "0.667em" }}>v0.6.1</p>
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
            {renderNavItem({ view: "settings", icon: "⚙", label: "设置", desc: "外观与偏好" })}
          </div>
        </div>

        {/* Footer */}
        <div className={`border-t border-sidebar-border py-2 ${collapsed ? "px-1.5 flex flex-col items-center gap-1" : "px-4 flex items-center gap-3 justify-center"}`}>
          {renderFooterLink("?", "帮助", () => setModal("help"))}
          {!collapsed && <span className="text-sidebar-border">·</span>}
          {renderFooterLink("♣", "更新", () => setModal("changelog"))}
          {!collapsed && <span className="text-sidebar-border">·</span>}
          {renderFooterLink("i", "关于", () => setModal("about"))}
        </div>
      </aside>

      {/* Modals */}
      {modal && <SidebarModal type={modal} onClose={() => setModal(null)} />}
    </>
  );
}

function SidebarModal({ type, onClose }: { type: ModalType; onClose: () => void }) {
  const titles: Record<string, string> = { help: "帮助文档", changelog: "更新日志", about: "关于" };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="modal-panel bg-panel rounded-lg border border-border shadow-2xl w-[520px] max-h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3.5 border-b border-border flex justify-between items-center">
          <h3 className="text-ui text-[0.933rem] text-text">{titles[type!]}</h3>
          <button onClick={onClose} className="w-6 h-6 rounded-md hover:bg-surface-hover flex items-center justify-center text-text-quaternary hover:text-text transition-colors text-lg">&times;</button>
        </div>
        <div className="flex-1 overflow-auto p-5">
          {type === "help" && <HelpContent />}
          {type === "changelog" && <ChangelogContent />}
          {type === "about" && <AboutContent />}
        </div>
      </div>
    </div>
  );
}

function HelpContent() {
  const steps = [
    { title: "1. 选择模板", desc: "导入或选择一个 .docx 模板文件，模板中包含 {{ 占位符 }}" },
    { title: "2. 导入 Excel", desc: "选择包含预算数据的 Excel 文件，系统会根据配置方案解析数据" },
    { title: "3. 配置预览", desc: "查看配置方案、数据映射和解析结果，确认无误后继续" },
    { title: "4. 生成报告", desc: "点击生成按钮，系统将数据填入模板并输出 .docx 报告" },
  ];

  return (
    <div className="space-y-4">
      <p className="text-[0.867rem] text-text-secondary">预算报告生成器通过四步向导完成报告生成：</p>
      <div className="space-y-3">
        {steps.map((s) => (
          <div key={s.title} className="flex gap-3">
            <div className="w-5 h-5 rounded-sm bg-brand-bg text-brand-accent text-[0.6rem] font-bold flex items-center justify-center shrink-0 mt-0.5">{s.title[0]}</div>
            <div>
              <div className="font-medium text-[0.867rem] text-text">{s.title}</div>
              <div className="text-[0.8rem] text-text-muted mt-0.5">{s.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-border-subtle pt-4 space-y-2">
        <h4 className="text-ui text-[0.8rem] text-text">配置方案</h4>
        <p className="text-[0.8rem] text-text-muted">配置方案定义了 Excel 数据到报告模板的映射规则，包括汇总页配置、Sheet 映射、列映射等。可以保存多套配置，在不同场景下切换使用。</p>
      </div>

      <div className="border-t border-border-subtle pt-4 space-y-2">
        <h4 className="text-ui text-[0.8rem] text-text">快捷键</h4>
        <div className="grid grid-cols-2 gap-2 text-[0.8rem]">
          <span className="text-text-muted">侧边栏收缩</span>
          <span className="text-text font-mono text-right">◂ 按钮</span>
          <span className="text-text-muted">主题切换</span>
          <span className="text-text font-mono text-right">侧边栏 ☀/☽ 按钮</span>
        </div>
      </div>
    </div>
  );
}

function ChangelogContent() {
  const versions = [
    { ver: "0.6.1", date: "2026-05-03", changes: [
      { type: "feat", text: "响应式布局增强：窄窗口自适应侧边栏、卡片网格、模态框" },
      { type: "feat", text: "配置方案管理页面：卡片管理、绑定 xlsx、ZIP 导出" },
      { type: "feat", text: "示例文件下载（Excel/配置），原生保存对话框" },
      { type: "feat", text: "卡片信息统一：文件大小、日期、双击重命名" },
      { type: "fix", text: "修复配置编辑器双重 JSON 序列化导致内容消失" },
    ]},
    { ver: "0.5.0", date: "2026-05-03", changes: [
      { type: "fix", text: "Sidecar 生命周期优化：健康检查通过后才设置端口" },
      { type: "feat", text: "进程存活检测与自动重启：sidecar 崩溃后自动恢复" },
      { type: "feat", text: "API 请求重试机制：最多 3 次重试，共享 HTTP 客户端" },
      { type: "fix", text: "生产模式移除 PYTHONPATH，修复 PyInstaller 导入冲突" },
      { type: "feat", text: "Windows NSIS 单文件安装包支持" },
    ]},
    { ver: "0.4.0", date: "2026-05-02", changes: [
      { type: "feat", text: "GitHub Actions CI/CD：desktop-v* tag 自动构建 Windows MSI" },
      { type: "feat", text: "应用图标：使用 favicon.png 作为 Logo" },
      { type: "feat", text: "关于信息：显示 IDRL 开发团队" },
      { type: "feat", text: "帮助文档、更新日志、关于弹窗" },
      { type: "feat", text: "可拖拽调整大小的日志面板" },
      { type: "fix", text: "修复 sidecar 在 Windows 上的可执行文件兼容性" },
    ]},
    { ver: "0.3.0", date: "2026-05-02", changes: [
      { type: "feat", text: "Linear 风格深色优先设计系统，Inter 字体" },
      { type: "feat", text: "设置视图：字体大小控制（12-28px 快捷选项 + 滑块）" },
      { type: "feat", text: "深色/浅色主题切换，侧边栏快捷按钮" },
      { type: "feat", text: "可收缩侧边栏，图标模式" },
      { type: "feat", text: "配置管理持久化，完整可视化编辑器" },
      { type: "feat", text: "导入/导出配置方案" },
    ]},
    { ver: "0.2.0", date: "2026-05-01", changes: [
      { type: "feat", text: "初始桌面应用，Tauri 2.0 + React" },
      { type: "feat", text: "四步向导：选模板 → 导数据 → 配置 → 生成" },
      { type: "feat", text: "模板管理：导入、重命名、删除 .docx 模板" },
      { type: "feat", text: "Python sidecar 后端服务" },
    ]},
  ];

  const typeColor: Record<string, string> = {
    feat: "text-brand-accent",
    fix: "text-success",
    perf: "text-warning",
  };

  return (
    <div className="space-y-6">
      {versions.map((v) => (
        <div key={v.ver}>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="font-mono font-medium text-[0.933rem] text-text">{v.ver}</span>
            <span className="text-[0.733rem] text-text-quaternary">{v.date}</span>
          </div>
          <ul className="space-y-1.5 pl-1">
            {v.changes.map((c, i) => (
              <li key={i} className="flex gap-2 text-[0.8rem]">
                <span className={`font-mono font-bold ${typeColor[c.type] || "text-text-muted"}`}>{c.type}</span>
                <span className="text-text-secondary">{c.text}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function AboutContent() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <img src="/favicon.png" alt="Logo" className="w-12 h-12 rounded-xl" />
        <div>
          <h4 className="text-[1rem] font-medium text-text">预算报告生成器</h4>
          <p className="font-mono text-[0.8rem] text-text-quaternary mt-0.5">Budget Report Generator</p>
        </div>
      </div>

      <div className="bg-surface rounded-md border border-border p-4 space-y-2 text-[0.8rem]">
        <div className="flex justify-between">
          <span className="text-text-muted">版本</span>
          <span className="font-mono text-text">0.6.1</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">前端引擎</span>
          <span className="font-mono text-text">Tauri 2.0 + React 18</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">后端服务</span>
          <span className="font-mono text-text">report-engine (Python)</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">UI 框架</span>
          <span className="font-mono text-text">Tailwind CSS v4</span>
        </div>
      </div>

      <p className="text-[0.8rem] text-text-muted leading-relaxed">
        基于 docx 模板的预算报告生成工具。通过配置映射规则，将 Excel 数据自动填入 Word 模板，快速生成规范的预算报告文档。
      </p>

      <div className="border-t border-border pt-4">
        <div className="flex justify-between text-[0.8rem]">
          <span className="text-text-muted">开发团队</span>
          <span className="font-mono text-text font-medium">IDRL</span>
        </div>
      </div>
    </div>
  );
}
