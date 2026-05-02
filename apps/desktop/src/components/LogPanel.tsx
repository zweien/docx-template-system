import { useEffect, useRef } from "react";

interface Props {
  logs: string[];
  onClear: () => void;
}

export function LogPanel({ logs, onClear }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const recentLogs = logs.slice(-200);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

  return (
    <div className="bg-gray-900 text-gray-100 font-mono text-xs flex flex-col shrink-0 h-36">
      <div className="flex justify-between items-center px-2 py-1 border-b border-gray-700">
        <span className="text-gray-500">日志</span>
        <button
          onClick={onClear}
          className="text-gray-400 hover:text-gray-100 text-xs px-2 py-0.5 rounded hover:bg-gray-700 transition-colors"
        >
          清空
        </button>
      </div>
      <div className="flex-1 overflow-auto px-2 py-1">
        {recentLogs.map((log, i) => (
          <div key={i} className="leading-5 whitespace-nowrap">{log}</div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
