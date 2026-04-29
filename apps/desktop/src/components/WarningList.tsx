interface Props {
  warnings: string[];
}

export function WarningList({ warnings }: Props) {
  if (warnings.length === 0) return null;
  return (
    <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
      <h4 className="font-semibold text-yellow-800 mb-2">
        ⚠ 解析警告（{warnings.length} 条）
      </h4>
      <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
        {warnings.map((w, i) => (
          <li key={i}>{w}</li>
        ))}
      </ul>
    </div>
  );
}
