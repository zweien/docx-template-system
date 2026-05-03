import { invoke } from "@tauri-apps/api/core";
import type { BudgetConfig, ValidationIssue, ValidationResult } from "../types";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

function makeResult(issues: ValidationIssue[]): ValidationResult {
  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  const info = issues.filter((i) => i.severity === "info").length;
  return { issues, canProceed: errors === 0, summary: { errors, warnings, info } };
}

function mapSidecarIssues(raw: any[]): ValidationIssue[] {
  return (raw || []).map((i: any) => ({
    severity: i.severity || "warning",
    source: i.source || "config",
    code: i.code || "UNKNOWN",
    message: i.message || "",
    location: i.location,
    suggestion: i.suggestion,
  }));
}

/** Pure frontend config validation — no sidecar call */
export function validateConfigLocal(config: BudgetConfig): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!config.title?.trim()) {
    issues.push({ severity: "error", source: "config", code: "MISSING_TITLE", message: "配置缺少报告标题", location: { field: "title" } });
  }

  if (!config.sheets?.length) {
    issues.push({ severity: "warning", source: "config", code: "NO_SHEETS", message: "配置没有定义任何数据工作表", location: { field: "sheets" } });
    return makeResult(issues);
  }

  const seenIds = new Set<string>();
  config.sheets.forEach((sheet, i) => {
    const prefix = `sheets[${i}]`;
    if (!sheet.name) issues.push({ severity: "error", source: "config", code: "MISSING_FIELD", message: `第 ${i + 1} 个工作表缺少 name`, location: { field: `${prefix}.name` } });
    if (!sheet.sheet_name) issues.push({ severity: "error", source: "config", code: "MISSING_FIELD", message: `工作表 '${sheet.name || i}' 缺少 sheet_name`, location: { field: `${prefix}.sheet_name` } });
    if (!sheet.id) issues.push({ severity: "error", source: "config", code: "MISSING_FIELD", message: `工作表 '${sheet.name || i}' 缺少 id`, location: { field: `${prefix}.id` } });
    if (sheet.id && seenIds.has(sheet.id)) {
      issues.push({ severity: "error", source: "config", code: "DUPLICATE_ID", message: `重复的工作表 id: ${sheet.id}`, location: { field: `${prefix}.id` } });
    }
    if (sheet.id) seenIds.add(sheet.id);
    if (!sheet.columns || Object.keys(sheet.columns).length === 0) {
      issues.push({ severity: "warning", source: "config", code: "NO_COLUMNS", message: `工作表 '${sheet.name || i}' 没有列映射`, location: { field: `${prefix}.columns` } });
    }
  });

  return makeResult(issues);
}

/** Sidecar: validate DOCX template structure */
export async function validateTemplate(templatePath: string): Promise<ValidationResult> {
  if (!isTauri) return makeResult([]);
  const result = await invoke<string>("sidecar_post", {
    path: "/api/validate-template",
    body: JSON.stringify({ template_path: templatePath }),
  });
  const data = JSON.parse(result);
  return makeResult(mapSidecarIssues(data.issues));
}

/** Sidecar: validate Excel structure against config */
export async function validateExcel(
  excelPath: string,
  config: BudgetConfig,
): Promise<ValidationResult & { availableSheets: string[]; sheetColumns: Record<string, string[]> }> {
  if (!isTauri) return { ...makeResult([]), availableSheets: [], sheetColumns: {} };
  const result = await invoke<string>("sidecar_post", {
    path: "/api/validate-excel",
    body: JSON.stringify({ input_path: excelPath, config }),
  });
  const data = JSON.parse(result);
  return {
    ...makeResult(mapSidecarIssues(data.issues)),
    availableSheets: data.available_sheets || [],
    sheetColumns: data.sheet_columns || {},
  };
}

/** Sidecar: cross-validate template + Excel + config */
export async function crossValidate(
  templatePath: string,
  excelPath: string,
  config: BudgetConfig,
): Promise<ValidationResult> {
  if (!isTauri) return makeResult([]);
  const result = await invoke<string>("sidecar_post", {
    path: "/api/cross-validate",
    body: JSON.stringify({ template_path: templatePath, excel_path: excelPath, config }),
  });
  const data = JSON.parse(result);
  return makeResult(mapSidecarIssues(data.issues));
}
