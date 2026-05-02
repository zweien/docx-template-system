interface Props {
  warnings: string[];
}

export function WarningList({ warnings }: Props) {
  if (warnings.length === 0) return null;
  return (
    <div className="mt-4 p-3 bg-warning-bg border border-warning-border rounded-lg">
      <h4 className="text-ui text-warning text-[0.867rem] mb-2 flex items-center gap-1.5">
        <span className="text-sm">⚠</span>
        解析警告（{warnings.length} 条）
      </h4>
      <ul className="text-[0.8rem] text-warning/80 space-y-1">
        {warnings.map((w, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-warning/40 shrink-0">·</span>
            <span>{w}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
