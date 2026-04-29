interface Props {
  logs: string[];
}

export function LogPanel({ logs }: Props) {
  return (
    <div className="h-32 bg-gray-900 text-gray-100 p-2 overflow-auto font-mono text-xs">
      {logs.map((log, i) => (
        <div key={i}>{log}</div>
      ))}
    </div>
  );
}
