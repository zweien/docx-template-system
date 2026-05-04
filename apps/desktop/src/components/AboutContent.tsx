export function AboutContent() {
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
          <span className="font-mono text-text">0.7.6</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">前端引擎</span>
          <span className="font-mono text-text">Tauri 2.0 + React 19</span>
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
