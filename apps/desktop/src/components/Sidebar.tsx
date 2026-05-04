import { useEffect, useState } from "react";
import { Rocket, FileText, Settings2, CheckSquare, Sun, Moon, Settings, CircleHelp, History, Info, PanelLeftClose, PanelLeft, type LucideIcon } from "lucide-react";
import { useAppStore, AppView, ThemeMode } from "../stores/app-store";
import { AboutContent } from "./AboutContent";

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

  const items: { view: AppView; icon: LucideIcon; label: string; desc: string }[] = [
    { view: "wizard", icon: Rocket, label: "生成报告", desc: "四步向导" },
    { view: "templates", icon: FileText, label: "模板管理", desc: "导入与管理" },
    { view: "configs", icon: Settings2, label: "配置方案", desc: "管理与编辑" },
    { view: "validation", icon: CheckSquare, label: "数据校验", desc: "Excel 校验" },
  ];

  const toggleTheme = () => {
    const next: ThemeMode = settings.theme === "dark" ? "light" : "dark";
    updateSettings({ theme: next });
    document.documentElement.setAttribute("data-theme", next);
  };

  const renderNavItem = (item: { view: AppView; icon: LucideIcon; label: string; desc: string }) => {
    const active = currentView === item.view;
    const Icon = item.icon;
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
        <span className={`shrink-0 ${active ? "text-brand-accent" : ""} ${collapsed ? "" : "w-5 flex justify-center"}`}>
          <Icon size={16} />
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

  const renderFooterLink = (Icon: LucideIcon, label: string, onClick: () => void) => (
    <button
      onClick={onClick}
      className="text-text-quaternary hover:text-text-secondary transition-colors flex items-center gap-1.5"
      title={collapsed ? label : undefined}
    >
      <Icon size={collapsed ? 14 : 13} />
      {!collapsed && <span className="text-[0.733rem]">{label}</span>}
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
              <p className="text-text-quaternary leading-tight mt-0.5 font-mono" style={{ fontSize: "0.667em" }}>v0.7.6</p>
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
            {collapsed ? <PanelLeft size={14} /> : <PanelLeftClose size={14} />}
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
              <span className={`shrink-0 ${collapsed ? "" : "w-5 flex justify-center"}`}>
                {settings.theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              </span>
              {!collapsed && (
                <div className="min-w-0">
                  <div className="font-medium leading-tight" style={{ fontSize: "0.867em" }}>{settings.theme === "dark" ? "浅色模式" : "深色模式"}</div>
                </div>
              )}
            </button>
            {renderNavItem({ view: "settings", icon: Settings, label: "设置", desc: "外观与偏好" })}
          </div>
        </div>

        {/* Footer */}
        <div className={`border-t border-sidebar-border py-2.5 ${collapsed ? "px-1.5 flex flex-col items-center gap-1.5" : "px-5 flex items-center gap-4"}`}>
          {renderFooterLink(CircleHelp, "帮助", () => setModal("help"))}
          {renderFooterLink(History, "更新", () => setModal("changelog"))}
          {renderFooterLink(Info, "关于", () => setModal("about"))}
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
    { title: "1. 选择模板", desc: "导入或选择一个 .docx 模板文件，模板中包含 {{ 占位符 }}，支持自动校验模板结构" },
    { title: "2. 导入 Excel", desc: "选择包含预算数据的 Excel 文件，系统会根据配置方案解析数据，禁用章节自动跳过" },
    { title: "3. 配置预览", desc: "查看配置方案、数据映射和解析结果，可视化编辑器支持列映射、启用开关等" },
    { title: "4. 生成报告", desc: "点击生成按钮，系统将数据填入模板并输出 .docx 报告，日志面板实时显示进度" },
  ];

  const features = [
    { title: "模板管理", desc: "导入、重命名、删除 .docx 模板，自动校验占位符和结构" },
    { title: "配置方案", desc: "管理多套 Excel 映射配置，支持 JSON 导入导出、绑定 Excel 文件、ZIP 打包导出" },
    { title: "数据校验", desc: "独立校验 Excel 数据完整性：缺失 sheet/列、空单元格、数值违规、填充率统计" },
    { title: "配置编辑器", desc: "可视化编辑配置：汇总页映射、Sheet 列映射、标题级别、表头行号、章节启用开关" },
    { title: "日志面板", desc: "可拖拽调整高度，按类型（信息/成功/警告/错误）分色显示，支持折叠和清空" },
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
        <h4 className="text-ui text-[0.8rem] text-text">功能模块</h4>
        <div className="space-y-2">
          {features.map((f) => (
            <div key={f.title}>
              <span className="font-medium text-[0.8rem] text-text">{f.title}</span>
              <span className="text-[0.8rem] text-text-muted"> — {f.desc}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-border-subtle pt-4 space-y-2">
        <h4 className="text-ui text-[0.8rem] text-text">配置方案</h4>
        <p className="text-[0.8rem] text-text-muted">配置方案定义了 Excel 数据到报告模板的映射规则，包括汇总页配置、Sheet 映射、列映射、章节启用等。支持中文标识，可保存多套配置在不同场景下切换使用。</p>
      </div>

      <div className="border-t border-border-subtle pt-4 space-y-2">
        <h4 className="text-ui text-[0.8rem] text-text">界面操作</h4>
        <div className="grid grid-cols-2 gap-2 text-[0.8rem]">
          <span className="text-text-muted">侧边栏收缩/展开</span>
          <span className="text-text font-mono text-right">◂ 按钮</span>
          <span className="text-text-muted">主题切换</span>
          <span className="text-text font-mono text-right">侧边栏 ☀/☽ 按钮</span>
          <span className="text-text-muted">字体大小</span>
          <span className="text-text font-mono text-right">设置页面滑块</span>
          <span className="text-text-muted">重命名</span>
          <span className="text-text font-mono text-right">双击卡片标题</span>
        </div>
      </div>
    </div>
  );
}

function ChangelogContent() {
  const versions = [
    { ver: "0.7.6", date: "2026-05-04", changes: [
      { type: "fix", text: "修复生成 DOCX 文档 XML 命名空间损坏问题" },
      { type: "fix", text: "修复中文占位符无法识别（Word 拆分 run）" },
      { type: "fix", text: "修复禁用章节仍出现在生成报告中的问题" },
      { type: "fix", text: "生成标题去除手动编号（适配模板自动编号）" },
      { type: "feat", text: "数据校验展示汇总页映射值" },
      { type: "feat", text: "配置编辑器支持标题级别、表头行号、启用开关" },
      { type: "feat", text: "模板导入自动校验" },
      { type: "refactor", text: "Dev 模式直接引用主项目 report-engine，统一代码维护" },
    ]},
    { ver: "0.7.5", date: "2026-05-04", changes: [
      { type: "feat", text: "更新应用图标为全新紫色 Lab Logo" },
      { type: "fix", text: "修复 Windows 打包版 Sidecar 启动失败（report_engine/budget 模块缺失）" },
      { type: "fix", text: "Sidecar 崩溃时捕获 stderr 并显示 Python 错误详情" },
    ]},
    { ver: "0.7.0", date: "2026-05-03", changes: [
      { type: "feat", text: "独立数据校验功能：根据配置校验 Excel 数据完整性" },
      { type: "feat", text: "校验报告：缺失 sheet/列、空单元格、数值违规、填充率统计" },
      { type: "feat", text: "支持已保存配置和导入 JSON 两种配置来源" },
      { type: "feat", text: "文件校验系统：导入前模板/Excel/配置自动校验" },
    ]},
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

