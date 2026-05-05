import { useCallback, useEffect, useRef, useState } from "react";
import { useAppStore } from "../stores/app-store";

interface LogEntry {
  time: string;
  msg: string;
  type: "info" | "success" | "warn" | "error";
}

interface Props {
  logs: LogEntry[];
  onClear: () => void;
}

const MIN_HEIGHT = 28;
const MAX_HEIGHT = 480;

const LOG_STYLES: Record<string, { icon: string; color: string; bg: string }> = {
  info: { icon: "ℹ", color: "text-text-muted", bg: "" },
  success: { icon: "✓", color: "text-success", bg: "" },
  warn: { icon: "⚠", color: "text-warning", bg: "" },
  error: { icon: "✕", color: "text-danger", bg: "" },
};

export function LogPanel({ logs, onClear }: Props) {
  const { settings } = useAppStore();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [height, setHeight] = useState(144);
  const [dragging, setDragging] = useState(false);
  const recentLogs = logs.slice(-200);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    const startY = e.clientY;
    const startH = height;

    const onMove = (ev: MouseEvent) => {
      const delta = startY - ev.clientY;
      const next = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startH + delta));
      setHeight(next);
    };

    const onUp = () => {
      setDragging(false);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [height]);

  const logFontSize = Math.max(9, settings.fontSize * 0.73);

  const errorCount = logs.filter((l) => l.type === "error").length;
  const warnCount = logs.filter((l) => l.type === "warn").length;

  return (
    <div
      className="bg-panel text-text-secondary font-mono flex flex-col shrink-0 border-t border-border"
      style={{ height: collapsed ? MIN_HEIGHT : height }}
    >
      {/* Drag handle */}
      {!collapsed && (
        <div
          onMouseDown={handleDragStart}
          className={`h-1.5 cursor-row-resize flex items-center justify-center transition-colors ${
            dragging ? "bg-brand-accent/20" : "hover:bg-border-strong"
          }`}
        >
          <div className={`w-8 h-0.5 rounded-full transition-colors ${dragging ? "bg-brand-accent" : "bg-border-strong"}`} />
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center px-3 h-7 border-b border-border-subtle">
        <button onClick={() => setCollapsed(!collapsed)} className="text-text-quaternary hover:text-text-secondary flex items-center gap-1.5 transition-colors">
          <span className={`transition-transform duration-100 ${collapsed ? "rotate-180" : ""}`}>▾</span>
          <span>日志</span>
          {logs.length > 0 && (
            <span className="bg-surface text-text-muted px-1.5 py-px rounded-sm border border-border-subtle">
              {logs.length}
              {errorCount > 0 && <span className="text-danger ml-1">{errorCount}</span>}
              {warnCount > 0 && <span className="text-warning ml-0.5">{warnCount}</span>}
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

      {/* Content */}
      {!collapsed && (
        <div className="flex-1 overflow-auto px-3 py-1" style={{ fontSize: `${logFontSize}px`, lineHeight: `${logFontSize * 1.6}px` }}>
          {recentLogs.map((log, i) => {
            const style = LOG_STYLES[log.type] || LOG_STYLES.info;
            return (
              <div key={i} className="whitespace-nowrap flex gap-1.5">
                <span className="text-text-quaternary shrink-0">{log.time}</span>
                <span className={`shrink-0 ${style.color}`}>{style.icon}</span>
                <span className={style.color}>{log.msg}</span>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}
