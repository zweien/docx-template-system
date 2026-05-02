import { useAppStore } from "../stores/app-store";

export function Settings() {
  const { settings, updateSettings } = useAppStore();
  const { fontSize, theme } = settings;

  const handleFontSize = (size: number) => {
    updateSettings({ fontSize: size });
    document.documentElement.style.fontSize = `${size}px`;
  };

  const handleTheme = (mode: "light" | "dark") => {
    updateSettings({ theme: mode });
    document.documentElement.setAttribute("data-theme", mode);
  };

  return (
    <div className="flex-1 p-8 overflow-auto">
      <div className="max-w-xl">
        <h2 className="text-heading text-lg text-text">设置</h2>
        <p className="text-caption text-text-muted mt-1">应用外观与偏好</p>

        <div className="mt-8 space-y-4">
          {/* Font Size */}
          <section className="bg-surface rounded-lg border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-ui text-sm text-text">字体大小</h3>
                <p className="text-[0.733rem] text-text-quaternary mt-0.5">调整界面文字大小</p>
              </div>
              <span className="text-[0.733rem] font-mono text-brand-accent bg-brand-bg px-2 py-0.5 rounded">
                {fontSize}px
              </span>
            </div>
            <div className="flex gap-2 mb-4">
              {[
                { label: "小", size: 13 },
                { label: "标准", size: 15 },
                { label: "大", size: 18 },
                { label: "特大", size: 22 },
                { label: "超大", size: 28 },
              ].map((opt) => (
                <button
                  key={opt.size}
                  onClick={() => handleFontSize(opt.size)}
                  className={`flex-1 py-1.5 rounded-md border text-center transition-all duration-100 ${
                    fontSize === opt.size
                      ? "border-brand-border bg-brand-bg text-brand-accent font-medium"
                      : "border-border text-text-muted hover:border-border-strong hover:text-text-secondary"
                  }`}
                >
                  <span className="block font-medium" style={{ fontSize: `${Math.min(opt.size, 14)}px` }}>{opt.label}</span>
                  <span className="block text-[0.6rem] font-mono mt-px opacity-60">{opt.size}px</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[0.667rem] text-text-quaternary">A</span>
              <input
                type="range"
                min={12}
                max={28}
                step={1}
                value={fontSize}
                onChange={(e) => handleFontSize(Number(e.target.value))}
                className="flex-1 h-1 appearance-none bg-border rounded-full cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
                  [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand-accent [&::-webkit-slider-thumb]:cursor-pointer
                  [&::-webkit-slider-thumb]:shadow-sm"
              />
              <span className="text-sm text-text-quaternary">A</span>
            </div>
            <div className="mt-3 p-3 bg-canvas rounded-md border border-border-subtle">
              <p style={{ fontSize: `${fontSize}px` }} className="text-text-secondary leading-relaxed">
                预览文字 — 预算报告生成器
              </p>
            </div>
          </section>

          {/* Theme */}
          <section className="bg-surface rounded-lg border border-border p-5">
            <h3 className="text-ui text-sm text-text mb-1">主题</h3>
            <p className="text-[0.733rem] text-text-quaternary mb-4">选择界面配色方案</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleTheme("dark")}
                className={`relative p-4 rounded-lg border transition-all duration-100 ${
                  theme === "dark"
                    ? "border-brand-border bg-brand-bg"
                    : "border-border hover:border-border-strong"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-[#0f1011] border border-border flex items-center justify-center text-sm">
                    ☽
                  </div>
                  <div className="text-left">
                    <div className="text-[0.867rem] font-medium text-text">深色</div>
                    <div className="text-[0.667rem] text-text-quaternary">默认</div>
                  </div>
                </div>
                {theme === "dark" && (
                  <span className="absolute top-2.5 right-2.5 w-3.5 h-3.5 bg-brand rounded-full flex items-center justify-center text-white text-[0.533rem]">
                    ✓
                  </span>
                )}
              </button>
              <button
                onClick={() => handleTheme("light")}
                className={`relative p-4 rounded-lg border transition-all duration-100 ${
                  theme === "light"
                    ? "border-brand-border bg-brand-bg"
                    : "border-border hover:border-border-strong"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-[#f7f8f8] border border-border flex items-center justify-center text-sm">
                    ☀
                  </div>
                  <div className="text-left">
                    <div className="text-[0.867rem] font-medium text-text">浅色</div>
                    <div className="text-[0.667rem] text-text-quaternary">明亮</div>
                  </div>
                </div>
                {theme === "light" && (
                  <span className="absolute top-2.5 right-2.5 w-3.5 h-3.5 bg-brand rounded-full flex items-center justify-center text-white text-[0.533rem]">
                    ✓
                  </span>
                )}
              </button>
            </div>
          </section>

          {/* About */}
          <section className="bg-surface rounded-lg border border-border p-5">
            <h3 className="text-ui text-sm text-text mb-3">关于</h3>
            <div className="space-y-2 text-[0.8rem]">
              <div className="flex justify-between">
                <span className="text-text-muted">版本</span>
                <span className="font-mono text-text-secondary">0.4.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">引擎</span>
                <span className="font-mono text-text-secondary">Tauri 2.0 + React</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">后端</span>
                <span className="font-mono text-text-secondary">report-engine</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">开发团队</span>
                <span className="font-mono text-text-secondary font-medium">IDRL</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
