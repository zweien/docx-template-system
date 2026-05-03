export type ValidationSeverity = "error" | "warning" | "info";
export type ValidationSource = "template" | "excel" | "config" | "cross_validation";

export interface ValidationIssue {
  severity: ValidationSeverity;
  source: ValidationSource;
  code: string;
  message: string;
  location?: {
    sheet?: string;
    column?: string;
    field?: string;
    placeholder?: string;
    flag?: string;
  };
  suggestion?: string;
}

export function makeValidationResult(issues: ValidationIssue[]): ValidationResult {
  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  const info = issues.filter((i) => i.severity === "info").length;
  return { issues, canProceed: errors === 0, summary: { errors, warnings, info } };
}

export interface ValidationResult {
  issues: ValidationIssue[];
  canProceed: boolean;
  summary: {
    errors: number;
    warnings: number;
    info: number;
  };
}
