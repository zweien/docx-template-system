import { useAppStore, AppView } from "../stores/app-store";

export function Sidebar() {
  const { currentView, setCurrentView } = useAppStore();

  const navItem = (view: AppView, icon: string, label: string) => (
    <div
      onClick={() => setCurrentView(view)}
      className={`px-3 py-2 rounded cursor-pointer text-sm flex items-center gap-2 ${
        currentView === view
          ? "bg-blue-50 text-blue-700 font-medium"
          : "text-gray-600 hover:bg-gray-50"
      }`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </div>
  );

  return (
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h1 className="font-bold text-gray-800 text-lg">预算报告生成器</h1>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        <div className="text-xs font-semibold text-gray-400 uppercase px-3 py-2">功能</div>
        {navItem("wizard", "🪄", "生成报告")}
        {navItem("templates", "📄", "模板管理")}
      </nav>
      <div className="p-3 border-t border-gray-200">
        <p className="text-xs text-gray-400">v0.1.0</p>
      </div>
    </aside>
  );
}
