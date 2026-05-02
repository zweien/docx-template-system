import { useAppStore } from "../../stores/app-store";
import { ConfigSelector } from "../ConfigSelector";

export function StepConfigure() {
  const { config, excelContent, templates, selectedTemplateId, setWizardStep, addLog } =
    useAppStore();

  const template = templates.find((t) => t.id === selectedTemplateId);

  const handleNext = () => {
    addLog("配置确认，准备生成报告");
    setWizardStep(3);
  };

  if (!excelContent) {
    return (
      <div className="space-y-4">
        <h2 className="text-heading text-lg text-text">配置与预览</h2>
        <p className="text-caption text-text-quaternary">请先完成上一步的数据导入</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-heading text-lg text-text">配置与预览</h2>
        <p className="text-caption text-text-muted mt-1">确认配置方案和数据映射，预览解析结果</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2">
        <div className="px-3.5 py-2.5 bg-surface rounded-lg border border-border">
          <div className="text-[0.667rem] text-text-quaternary uppercase tracking-wider">模板</div>
          <div className="text-[0.867rem] font-medium text-text mt-0.5">{template?.name || "未选择"}</div>
        </div>
        <div className="px-3.5 py-2.5 bg-surface rounded-lg border border-border">
          <div className="text-[0.667rem] text-text-quaternary uppercase tracking-wider">报告标题</div>
          <div className="text-[0.867rem] font-medium text-text mt-0.5">{config.title}</div>
        </div>
      </div>

      <ConfigSelector />

      {/* Summary config */}
      {config.summary && (
        <div className="bg-brand-bg rounded-lg border border-brand-border p-3.5">
          <div className="text-ui text-[0.733rem] text-brand-accent mb-2">汇总页</div>
          <div className="flex gap-5 text-[0.8rem] text-text-secondary">
            <span>Sheet: <span className="text-text font-medium">{config.summary.sheet_name}</span></span>
            <span>模式: <span className="text-text font-medium">{config.summary.mode === "table" ? "表格" : "单元格映射"}</span></span>
            {config.summary.mode === "table" && (
              <>
                <span>键列: <span className="text-text font-medium">{config.summary.key_column}</span></span>
                <span>值列: <span className="text-text font-medium">{config.summary.value_column}</span></span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Sheet configs */}
      <div className="bg-surface rounded-lg border border-border overflow-hidden">
        <div className="px-3.5 py-2 border-b border-border-subtle">
          <span className="text-ui text-[0.733rem] text-text-quaternary">
            Sheet 配置 ({config.sheets.length})
          </span>
        </div>
        <div className="divide-y divide-border-subtle">
          {config.sheets.map((sheet, idx) => {
            const allCols = Object.entries(sheet.columns);
            const tableCols = sheet.table_columns || [];
            const detailCols = sheet.detail_fields || [];
            const imgCols = sheet.image_columns || [];
            const section = excelContent.sections?.find(
              (s) => s.id === sheet.id || s.name === sheet.name
            );

            return (
              <div key={idx} className="px-3.5 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-sm bg-surface-hover text-text-quaternary text-[0.6rem] font-mono font-bold flex items-center justify-center">{idx + 1}</span>
                    <span className="font-medium text-[0.867rem] text-text">{sheet.name}</span>
                    <span className="text-[0.667rem] text-text-quaternary bg-surface-hover px-1.5 py-px rounded-sm font-mono">{sheet.sheet_name}</span>
                  </div>
                  {section && (
                    <span className="text-[0.667rem] text-text-quaternary font-mono">
                      {section.blocks?.length || 0} 块
                    </span>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[0.733rem]">
                    <thead>
                      <tr className="text-text-quaternary">
                        <th className="text-left font-normal pb-1 w-6">#</th>
                        <th className="text-left font-normal pb-1">字段</th>
                        <th className="text-left font-normal pb-1">Excel 列</th>
                        <th className="text-center font-normal pb-1 w-10">表格</th>
                        <th className="text-center font-normal pb-1 w-10">详情</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allCols.map(([key, label]) => {
                        const isTable = tableCols.includes(key);
                        const isDetail = detailCols.some((d) => d.field === key);
                        return (
                          <tr key={key} className="border-t border-border-subtle">
                            <td className="py-1 text-text-quaternary font-mono">{tableCols.indexOf(key) >= 0 ? tableCols.indexOf(key) + 1 : ""}</td>
                            <td className="py-1 font-mono text-text-muted">{key}</td>
                            <td className="py-1 text-text">{label}</td>
                            <td className="py-1 text-center">{isTable ? <span className="text-success">✓</span> : <span className="text-text-quaternary/30">·</span>}</td>
                            <td className="py-1 text-center">{isDetail ? <span className="text-brand-accent">✓</span> : <span className="text-text-quaternary/30">·</span>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {(imgCols.length > 0 || sheet.heading_level != null) && (
                  <div className="flex gap-4 text-[0.667rem] text-text-quaternary">
                    {imgCols.length > 0 && <span>图片列: {imgCols.join(", ")}</span>}
                    {sheet.heading_level != null && <span>标题级别: {sheet.heading_level}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Extra context */}
      {excelContent.extra_context && Object.keys(excelContent.extra_context).length > 0 && (
        <div className="bg-surface rounded-lg border border-border p-3.5">
          <div className="text-ui text-[0.733rem] text-text-quaternary mb-2">附加上下文变量</div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(excelContent.extra_context).map(([k, v]) => (
              <span key={k} className="text-[0.667rem] bg-surface-hover text-text-secondary px-2 py-1 rounded-sm border border-border-subtle font-mono">
                {k}: {String(v).slice(0, 40)}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-between pt-1">
        <button onClick={() => setWizardStep(1)} className="px-4 py-2 bg-surface border border-border text-text-secondary rounded-md hover:bg-surface-hover text-[0.867rem] transition-colors">
          ← 上一步
        </button>
        <button onClick={handleNext} className="px-5 py-2 bg-brand text-white rounded-md hover:bg-brand-hover text-[0.867rem] font-medium transition-colors">
          下一步：生成报告 →
        </button>
      </div>
    </div>
  );
}
