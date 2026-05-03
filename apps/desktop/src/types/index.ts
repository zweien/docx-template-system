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
