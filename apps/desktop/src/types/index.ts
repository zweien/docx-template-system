export * from "./validation";

export interface ParseRequest {
  input_path: string;
  config: BudgetConfig;
}

export interface ParseResponse {
  success: boolean;
  content?: ReportContent;
  warnings: string[];
  error?: ApiError;
}

export interface ReportContent {
  title: string;
  sections: Section[];
  extra_context?: Record<string, string>;
}

export interface Section {
  name: string;
  id: string;
  blocks: Block[];
}

export interface Block {
  type: string;
  [key: string]: unknown;
}

export interface BudgetConfig {
  title: string;
  summary?: SummaryConfig;
  sheets: SheetConfig[];
  excel_path?: string;
}

export interface ConfigMeta {
  id: string;
  title: string;
  updated_at: string;
  size: number;
  excel_path?: string;
}

export interface SummaryConfig {
  sheet_name: string;
  mode: "table" | "cell_map";
  header_row?: number;
  key_column?: string;
  value_column?: string;
  prefix?: string;
  description_column?: string;
  description_prefix?: string;
  mappings?: Record<string, string>;
}

export interface DetailField {
  field: string;
  label: string;
}

export interface SheetConfig {
  name: string;
  sheet_name: string;
  id: string;
  columns: Record<string, string>;
  table_columns?: string[];
  detail_fields?: DetailField[];
  image_columns?: string[];
  heading_level?: number;
  item_heading_level?: number;
  header_row?: number;
  enabled?: boolean;
  summary_key?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface RenderRequest {
  content: ReportContent;
  template_path: string;
  output_dir: string;
}

export interface RenderResponse {
  success: boolean;
  output_path?: string;
  error?: ApiError;
}

export interface SheetValidationResult {
  sheet_name: string;
  found: boolean;
  missing_columns: string[];
  extra_columns: string[];
  total_rows: number;
  empty_cells: { row: number; column: string; field: string }[];
  fill_rate: number;
  numeric_violations: { row: number; column: string; value: string }[];
  unique_values: Record<string, string[]>;
  image_summary: { total_images: number; rows_with_images: number } | null;
  warnings: string[];
}

export interface SummaryValidationResult {
  sheet_name: string;
  found: boolean;
  mode: string;
  key_column_found: boolean | null;
  value_column_found: boolean | null;
  mapped_count: number;
  missing_keys: string[];
  mapped_values: Record<string, string>;
}

export interface ExcelValidationResponse {
  success: boolean;
  config_title: string;
  excel_sheets: string[];
  missing_sheets: string[];
  summary: SummaryValidationResult | null;
  sheets: SheetValidationResult[];
  overall_pass: boolean;
  total_errors: number;
  total_warnings: number;
  error?: ApiError;
}

// ── Merge Excel ──

export interface SheetMergeInfo {
  sheet_name: string;
  header_row: string[];
  data_row_count: number;
  has_images: boolean;
  column_count: number;
}

export interface FileMergeInfo {
  file_path: string;
  file_name: string;
  sheets: SheetMergeInfo[];
}

export interface MergeInfoResponse {
  success: boolean;
  files: FileMergeInfo[];
  common_sheets: string[];
  error?: ApiError;
}

export interface MergeExcelRequest {
  base_file: string;
  source_files: string[];
  selected_sheets: string[];
  output_path: string;
}

export interface SheetMismatchDetail {
  sheet_name: string;
  file_name: string;
  base_headers: string[];
  file_headers: string[];
  missing_in_file: string[];
  extra_in_file: string[];
}

export interface MergeExcelResponse {
  success: boolean;
  output_path?: string;
  total_rows_added: number;
  sheet_summary: Record<string, number>;
  mismatches: SheetMismatchDetail[];
  warnings: string[];
  error?: ApiError;
}
