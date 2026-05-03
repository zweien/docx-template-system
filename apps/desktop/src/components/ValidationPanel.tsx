import type { ValidationIssue, ValidationResult } from "../types";

interface Props {
  result: ValidationResult | null;
  onProceed?: () => void;
  onDismiss?: () => void;
}

const sourceLabel: Record<string, string> = {
  template: "模板",
  excel: "Excel",
  config: "配置",
  cross_validation: "交叉检查",
};

export function ValidationPanel({ result, onProceed, onDismiss }: Props) {
  if (!result || result.issues.length === 0) return null;

  const errors = result.issues.filter((i) => i.severity === "error");
  const warnings = result.issues.filter((i) => i.severity === "warning");
  const infos = result.issues.filter((i) => i.severity === "info");

  return (
    <div className="space-y-3 mt-4">
      {errors.length > 0 && (
        <div className="p-3 bg-danger-bg border border-danger-border rounded-lg">
          <h4 className="text-danger text-[0.867rem] font-medium mb-2">
            错误（{errors.length}）— 必须修复才能继续
          </h4>
          <ul className="space-y-1.5">
            {errors.map((issue, i) => (
              <IssueRow key={i} issue={issue} />
            ))}
          </ul>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="p-3 bg-warning-bg border border-warning-border rounded-lg">
          <h4 className="text-warning text-[0.867rem] font-medium mb-2">
            警告（{warnings.length}）— 建议检查
          </h4>
          <ul className="space-y-1.5">
            {warnings.map((issue, i) => (
              <IssueRow key={i} issue={issue} />
            ))}
          </ul>
        </div>
      )}
      {infos.length > 0 && (
        <div className="p-3 bg-surface border border-border rounded-lg">
          <h4 className="text-text-muted text-[0.867rem] font-medium mb-2">
            提示（{infos.length}）
          </h4>
          <ul className="space-y-1.5">
            {infos.map((issue, i) => (
              <IssueRow key={i} issue={issue} />
            ))}
          </ul>
        </div>
      )}
      {result.canProceed && warnings.length > 0 && (
        <div className="flex gap-2">
          {onProceed && (
            <button onClick={onProceed} className="px-4 py-2 bg-brand text-white rounded-md hover:bg-brand-hover text-[0.867rem] font-medium transition-colors">
              忽略警告，继续
            </button>
          )}
          {onDismiss && (
            <button onClick={onDismiss} className="px-4 py-2 bg-surface border border-border text-text-secondary rounded-md hover:bg-surface-hover text-[0.867rem] transition-colors">
              返回修改
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function IssueRow({ issue }: { issue: ValidationIssue }) {
  const loc: string[] = [];
  if (issue.location?.sheet) loc.push(`Sheet: ${issue.location.sheet}`);
  if (issue.location?.column) loc.push(`列: ${issue.location.column}`);
  if (issue.location?.field) loc.push(`字段: ${issue.location.field}`);
  if (issue.location?.placeholder) loc.push(`占位符: ${issue.location.placeholder}`);

  return (
    <li className="text-[0.8rem]">
      <div className="flex items-start gap-1.5">
        <span className="shrink-0 text-text-quaternary">·</span>
        <div>
          <span className="text-text-quaternary font-mono text-[0.667rem] mr-1">[{sourceLabel[issue.source] || issue.source}]</span>
          <span>{issue.message}</span>
          {loc.length > 0 && (
            <span className="text-text-quaternary ml-2 font-mono text-[0.733rem]">
              {loc.join(" > ")}
            </span>
          )}
          {issue.suggestion && (
            <p className="text-text-quaternary text-[0.733rem] mt-0.5">建议: {issue.suggestion}</p>
          )}
        </div>
      </div>
    </li>
  );
}
