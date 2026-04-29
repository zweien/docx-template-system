export function Sidebar() {
  return (
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h1 className="font-bold text-gray-800">预算报告生成器</h1>
      </div>
      <nav className="flex-1 p-2">
        <div className="text-xs font-semibold text-gray-500 uppercase px-2 py-2">工作区</div>
        <div className="px-2 py-1.5 bg-blue-50 text-blue-700 rounded cursor-pointer">▸ 2026 科研预算</div>
      </nav>
      <div className="p-2 border-t border-gray-200">
        <div className="px-2 py-1.5 text-gray-600 cursor-pointer hover:bg-gray-50 rounded text-sm">⚙ 配置管理</div>
        <div className="px-2 py-1.5 text-gray-600 cursor-pointer hover:bg-gray-50 rounded text-sm">📄 模板管理</div>
      </div>
    </aside>
  );
}
