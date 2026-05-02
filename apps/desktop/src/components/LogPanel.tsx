interface Props {
  logs: string[];
  onClear: () => void;
}

export function LogPanel({ logs, onClear }: Props) {
  const recentLogs = logs.slice(-100);

  return (
    <div className="h-32 bg-gray-900 text-gray-100 p-2 overflow-auto font-mono text-xs flex flex-col">
      <div className="flex justify-end mb-1">
        <button
          onClick={onClear}
          className="text-gray-400 hover:text-gray-100 text-xs px-2 py-0.5 rounded hover:bg-gray-700 transition-colors"
        >
          清空日志
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        {recentLogs.map((log, i) => (
          <div key={i}>{log}</div>
        ))}
      </div>
    </div>
  );
}
