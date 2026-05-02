import { useEffect, useRef, useState } from "react";
import { useAppStore } from "../stores/app-store";

interface Props {
  logs: string[];
  onClear: () => void;
}

export function LogPanel({ logs, onClear }: Props) {
  const { settings } = useAppStore();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const recentLogs = logs.slice(-200);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

  const logFontSize = Math.max(9, settings.fontSize * 0.73);

  return (
    <div className={`bg-panel text-text-secondary font-mono flex flex-col shrink-0 transition-all duration-150 border-t border-border ${collapsed ? "h-7" : "h-36"}`}>
      <div className="flex justify-between items-center px-3 h-7 border-b border-border-subtle">
        <button onClick={() => setCollapsed(!collapsed)} className="text-text-quaternary hover:text-text-secondary flex items-center gap-1.5 transition-colors">
          <span className={`transition-transform duration-100 ${collapsed ? "rotate-180" : ""}`}>▾</span>
          <span>日志</span>
          {logs.length > 0 && (
            <span className="bg-surface text-text-muted px-1.5 py-px rounded-sm border border-border-subtle">
              {logs.length}
            </span>
          )}
        </button>
        {!collapsed && (
          <button
            onClick={onClear}
            className="text-text-quaternary hover:text-text-secondary px-2 py-0.5 rounded-sm hover:bg-surface transition-colors"
          >
            清空
          </button>
        )}
      </div>
      {!collapsed && (
        <div className="flex-1 overflow-auto px-3 py-1" style={{ fontSize: `${logFontSize}px`, lineHeight: `${logFontSize * 1.6}px` }}>
          {recentLogs.map((log, i) => (
            <div key={i} className="whitespace-nowrap">
              <span className="text-text-quaternary">{log.slice(0, 10)}</span>
              <span className="text-text-muted">{log.slice(10)}</span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}
