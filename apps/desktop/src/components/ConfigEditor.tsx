import { useState } from "react";
import { BudgetConfig, SheetConfig } from "../types";

interface Props {
  config: BudgetConfig;
  onChange: (config: BudgetConfig) => void;
  onClose: () => void;
}

export function ConfigEditor({ config, onChange, onClose }: Props) {
  const [local, setLocal] = useState<BudgetConfig>(JSON.parse(JSON.stringify(config)));

  const updateSheet = (index: number, sheet: SheetConfig) => {
    const sheets = [...local.sheets];
    sheets[index] = sheet;
    setLocal({ ...local, sheets });
  };

  const addSheet = () => {
    setLocal({
      ...local,
      sheets: [...local.sheets, { name: "", sheet_name: "", id: "", columns: {} }],
    });
  };

  const removeSheet = (index: number) => {
    const sheets = local.sheets.filter((_, i) => i !== index);
    setLocal({ ...local, sheets });
  };

  const handleSave = () => {
    onChange(local);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-[800px] max-h-[80vh] flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="font-bold text-lg">编辑配置</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>
        <div className="flex-1 overflow-auto p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">报告标题</label>
            <input value={local.title} onChange={(e) => setLocal({ ...local, title: e.target.value })} className="w-full px-3 py-2 border rounded" />
          </div>
          <div>
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-medium">Sheet 映射</h4>
              <button onClick={addSheet} className="text-sm text-blue-600 hover:underline">+ 添加</button>
            </div>
            <table className="w-full text-sm border">
              <thead className="bg-gray-50"><tr><th className="px-2 py-1 text-left">Excel Sheet</th><th className="px-2 py-1 text-left">报告章节</th><th className="px-2 py-1 text-left">ID</th><th></th></tr></thead>
              <tbody>
                {local.sheets.map((sheet, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="px-2 py-1"><input value={sheet.sheet_name} onChange={(e) => updateSheet(idx, { ...sheet, sheet_name: e.target.value })} className="w-full border-none bg-transparent" /></td>
                    <td className="px-2 py-1"><input value={sheet.name} onChange={(e) => updateSheet(idx, { ...sheet, name: e.target.value })} className="w-full border-none bg-transparent" /></td>
                    <td className="px-2 py-1"><input value={sheet.id} onChange={(e) => updateSheet(idx, { ...sheet, id: e.target.value })} className="w-full border-none bg-transparent" /></td>
                    <td className="px-2 py-1"><button onClick={() => removeSheet(idx)} className="text-red-500 hover:text-red-700">删除</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border rounded hover:bg-gray-50">取消</button>
          <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">保存</button>
        </div>
      </div>
    </div>
  );
}
