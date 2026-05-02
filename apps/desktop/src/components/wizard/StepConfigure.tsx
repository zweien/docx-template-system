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
        <h2 className="text-xl font-bold">配置与预览</h2>
        <p className="text-gray-400">请先完成上一步的数据导入</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">配置与预览</h2>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-sm font-semibold text-gray-500 uppercase mb-1">模板</h3>
          <p className="text-gray-800">{template?.name || "未选择"}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-sm font-semibold text-gray-500 uppercase mb-1">报告标题</h3>
          <p className="text-gray-800">{config.title}</p>
        </div>
      </div>

      <ConfigSelector />

      {/* Summary config */}
      {config.summary && (
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
          <h3 className="text-sm font-semibold text-blue-700 mb-2">汇总页配置</h3>
          <div className="grid grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-gray-500">Excel Sheet:</span>{" "}
              <span className="text-gray-800">{config.summary.sheet_name}</span>
            </div>
            <div>
              <span className="text-gray-500">模式:</span>{" "}
              <span className="text-gray-800">{config.summary.mode === "table" ? "表格" : "单元格映射"}</span>
            </div>
            {config.summary.mode === "table" && (
              <>
                <div>
                  <span className="text-gray-500">键列:</span>{" "}
                  <span className="text-gray-800">{config.summary.key_column}</span>
                </div>
                <div>
                  <span className="text-gray-500">值列:</span>{" "}
                  <span className="text-gray-800">{config.summary.value_column}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Sheet configs detail */}
      <div className="bg-white rounded-lg border">
        <div className="px-4 py-3 border-b">
          <h3 className="text-sm font-semibold text-gray-500 uppercase">
            Sheet 配置详情 ({config.sheets.length} 个)
          </h3>
        </div>
        <div className="divide-y">
          {config.sheets.map((sheet, idx) => {
            const allCols = Object.entries(sheet.columns);
            const tableCols = sheet.table_columns || [];
            const detailCols = sheet.detail_fields || [];
            const imgCols = sheet.image_columns || [];
            // Match parsed section
            const section = excelContent.sections?.find(
              (s) => s.id === sheet.id || s.name === sheet.name
            );

            return (
              <div key={idx} className="px-4 py-3 space-y-2">
                {/* Sheet header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-800">{sheet.name}</span>
                    <span className="text-xs text-gray-400">#{sheet.id}</span>
                    <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                      {sheet.sheet_name}
                    </span>
                  </div>
                  {section && (
                    <span className="text-xs text-gray-400">
                      {section.blocks?.length || 0} 个内容块 · {section.blocks?.filter((b) => b.type === "table").length || 0} 个表格
                    </span>
                  )}
                </div>

                {/* Column mapping table */}
                <div className="text-xs">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="text-gray-400">
                        <th className="text-left font-normal pb-1 w-8"></th>
                        <th className="text-left font-normal pb-1">字段</th>
                        <th className="text-left font-normal pb-1">Excel 列名</th>
                        <th className="text-center font-normal pb-1 w-10">表格</th>
                        <th className="text-center font-normal pb-1 w-10">详情</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allCols.map(([key, label]) => {
                        const isTable = tableCols.includes(key);
                        const isDetail = detailCols.some((d) => d.field === key);
                        return (
                          <tr key={key} className="border-t border-gray-100">
                            <td className="py-1 text-gray-300">{tableCols.indexOf(key) >= 0 ? tableCols.indexOf(key) + 1 : ""}</td>
                            <td className="py-1 text-gray-700 font-mono">{key}</td>
                            <td className="py-1 text-gray-600">{label}</td>
                            <td className="py-1 text-center">
                              {isTable ? <span className="text-green-600">&#10003;</span> : <span className="text-gray-300">-</span>}
                            </td>
                            <td className="py-1 text-center">
                              {isDetail ? <span className="text-blue-600">&#10003;</span> : <span className="text-gray-300">-</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Image columns & extra info */}
                {(imgCols.length > 0 || sheet.heading_level != null) && (
                  <div className="flex gap-3 text-xs text-gray-500">
                    {imgCols.length > 0 && (
                      <span>图片列: {imgCols.join(", ")}</span>
                    )}
                    {sheet.heading_level != null && (
                      <span>标题级别: {sheet.heading_level}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Extra context */}
      {excelContent.extra_context && Object.keys(excelContent.extra_context).length > 0 && (
        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">附加上下文变量</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(excelContent.extra_context).map(([k, v]) => (
              <span key={k} className="text-xs bg-gray-100 px-2 py-1 rounded">
                {k}: {String(v).slice(0, 40)}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <button
          onClick={() => setWizardStep(1)}
          className="px-4 py-2 border border-gray-300 text-gray-600 rounded hover:bg-gray-50"
        >
          上一步
        </button>
        <button
          onClick={handleNext}
          className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          下一步：生成报告
        </button>
      </div>
    </div>
  );
}
