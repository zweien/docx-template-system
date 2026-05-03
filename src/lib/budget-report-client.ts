/** report-engine 预算报告 API 客户端。 */

const REPORT_ENGINE_URL =
  process.env.NEXT_PUBLIC_REPORT_ENGINE_URL || "http://localhost:8066";

export interface ValidationResult {
  success: boolean;
  config_title: string;
  excel_sheets: string[];
  missing_sheets: string[];
  summary: {
    sheet_name: string;
    found: boolean;
    mode: string;
    mapped_count: number;
    missing_keys: string[];
  } | null;
  sheets: {
    sheet_name: string;
    found: boolean;
    missing_columns: string[];
    extra_columns: string[];
    total_rows: number;
    empty_cells: { row: number; column: string; field: string }[];
    fill_rate: number;
    numeric_violations: { row: number; column: string; value: string }[];
    image_summary: { total_images: number; rows_with_images: number } | null;
    warnings: string[];
  }[];
  overall_pass: boolean;
  total_errors: number;
  total_warnings: number;
  error: { code: string; message: string } | null;
}

export interface ParseResult {
  success: boolean;
  content: {
    title: string;
    sections: {
      name: string;
      id: string;
      blocks: { type: string; [key: string]: unknown }[];
    }[];
    extra_context: Record<string, string>;
  } | null;
  warnings: string[];
  error: { code: string; message: string } | null;
}

export async function validateBudgetExcel(
  file: File,
  config: Record<string, unknown>,
): Promise<ValidationResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("config", JSON.stringify(config));

  const res = await fetch(`${REPORT_ENGINE_URL}/validate-excel`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(`Validate failed: ${res.statusText}`);
  return res.json();
}

export async function parseBudgetExcel(
  file: File,
  config: Record<string, unknown>,
  sessionId: string,
): Promise<ParseResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("config", JSON.stringify(config));
  form.append("session_id", sessionId);

  const res = await fetch(`${REPORT_ENGINE_URL}/parse-excel`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(`Parse failed: ${res.statusText}`);
  return res.json();
}

export async function uploadBudgetTemplate(
  file: File,
): Promise<{ path: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${REPORT_ENGINE_URL}/upload-template`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(`Upload template failed: ${res.statusText}`);
  return res.json();
}

export async function renderBudgetReport(
  content: Record<string, unknown>,
  templatePath: string,
  sessionId: string,
  filename = "budget_report.docx",
): Promise<Blob> {
  const res = await fetch(`${REPORT_ENGINE_URL}/render-budget`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content,
      template_path: templatePath,
      session_id: sessionId,
      output_filename: filename,
    }),
  });
  if (!res.ok) throw new Error(`Render failed: ${res.statusText}`);
  return res.blob();
}

export async function listBudgetConfigs(): Promise<
  { id: string; name: string }[]
> {
  const res = await fetch("/budget-configs/index.json");
  if (!res.ok) return [];
  return res.json();
}

export async function fetchBudgetConfig(
  id: string,
): Promise<Record<string, unknown>> {
  const res = await fetch(`/budget-configs/${id}`);
  if (!res.ok) throw new Error(`Config not found: ${id}`);
  return res.json();
}
