import {
  FieldType as PrismaFieldType,
  RelationCardinality as PrismaRelationCardinality,
  ViewType as PrismaViewType,
} from "@/generated/prisma/enums";

// ========== Field Types ==========

export type FieldType = PrismaFieldType;
export type RelationCardinality = PrismaRelationCardinality;
export type ViewType = PrismaViewType;

export interface RelationSchemaField {
  key: string;
  label: string;
  type: Exclude<FieldType, "RELATION" | "RELATION_SUBTABLE">;
  required: boolean;
  options?: string[];
  sortOrder: number;
}

export interface RelationSubtableValueItem {
  targetRecordId: string;
  displayValue?: string;
  attributes: Record<string, unknown>;
  sortOrder: number;
}

export interface BusinessKeyConfig {
  fieldKeys: string[];
}

export interface RelationSchemaConfig {
  version: 1;
  fields: RelationSchemaField[];
}

// ========== Field Options (stored in DataField.options JSON) ==========

/** A single option for SELECT / MULTISELECT fields */
export interface SelectOption {
  label: string;
  color: string;
}

/** Preset color palette for select options (bg = background, fg = text) */
export const SELECT_COLORS = [
  { name: "蓝色", bg: "#dbeafe", fg: "#1e40af" },
  { name: "绿色", bg: "#dcfce7", fg: "#166534" },
  { name: "黄色", bg: "#fef9c3", fg: "#854d0e" },
  { name: "红色", bg: "#fee2e2", fg: "#991b1b" },
  { name: "紫色", bg: "#f3e8ff", fg: "#6b21a8" },
  { name: "粉色", bg: "#fce7f3", fg: "#9d174d" },
  { name: "橙色", bg: "#ffedd5", fg: "#9a3412" },
  { name: "青色", bg: "#cffafe", fg: "#155e75" },
  { name: "靛蓝", bg: "#e0e7ff", fg: "#3730a3" },
  { name: "灰色", bg: "#f3f4f6", fg: "#374151" },
] as const;

/** Parse field.options into SelectOption[] with backward compatibility */
export function parseSelectOptions(raw: unknown): SelectOption[] {
  if (!Array.isArray(raw)) return [];
  if (raw.length === 0) return [];
  // New format: { label, color }[]
  if (typeof raw[0] === "object" && raw[0] !== null && "color" in raw[0]) {
    return raw as SelectOption[];
  }
  // Legacy format: string[] → auto-assign colors
  return (raw as string[]).map((label, i) => ({
    label,
    color: SELECT_COLORS[i % SELECT_COLORS.length].bg,
  }));
}

export interface FieldOptions {
  /** AUTO_NUMBER: next auto-increment value */
  nextValue?: number;
  /** SYSTEM_TIMESTAMP / SYSTEM_USER: "created" or "updated" */
  kind?: "created" | "updated";
  /** FORMULA: formula expression string */
  formula?: string;
  /** COUNT: ID of the RELATION or RELATION_SUBTABLE field to count */
  countSourceFieldId?: string;
  /** LOOKUP: source relation field ID */
  lookupSourceFieldId?: string;
  /** LOOKUP: target field key in the related table to read from */
  lookupTargetFieldKey?: string;
}

export function parseFieldOptions(raw: unknown): FieldOptions {
  if (!raw || typeof raw !== "object") return {};
  return raw as FieldOptions;
}

export interface DataFieldItem {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: unknown; // SELECT/MULTISELECT: string[], FORMULA: { formula: string }, etc.
  relationTo?: string; // RELATION 目标表 ID
  displayField?: string; // RELATION 显示字段
  relationCardinality?: RelationCardinality | null;
  inverseRelationCardinality?: RelationCardinality | null;
  inverseFieldId?: string | null;
  inverseFieldKey?: string | null;
  isSystemManagedInverse?: boolean;
  relationSchema?: RelationSchemaConfig | null;
  defaultValue?: string;
  sortOrder: number;
}

// ========== Table Types ==========

export interface DataTableListItem {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  fieldCount: number;
  recordCount: number;
  createdAt: Date;
}

export interface DataTableDetail extends DataTableListItem {
  fields: DataFieldItem[];
  businessKeys?: string[];
}

// ========== Record Types ==========

export interface DataRecordItem{
  id: string;
  tableId: string;
  data: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  createdByName: string;
  updatedByName: string | null;
}

export interface PaginatedRecords {
  records: DataRecordItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ========== Import/Export Types ==========

export interface FieldMapping {
  [excelColumn: string]: string | null; // excel列名 -> 字段key 或 null(不导入)
}

export interface ImportPreview {
  columns: string[]; // Excel 列名
  rows: Record<string, unknown>[]; // 预览数据(前5行)
  totalRows: number;
}

export interface ImportResult {
  success: boolean;
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
}

// ========== Service Result Types ==========

export type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

// ========== Bundle Export/Import Types (version 2.0) ==========

export interface BundleField {
  key: string;
  label: string;
  type: string;
  required: boolean;
  sortOrder: number;
  options: unknown;
  defaultValue: string | null;
  /** Target table NAME (portable) instead of table ID */
  relationTo?: string | null;
  displayField?: string | null;
  relationCardinality?: string | null;
  inverseRelationCardinality?: string | null;
  relationSchema?: RelationSchemaConfig | null;
}

export interface BundleTable {
  name: string;
  description: string | null;
  icon: string | null;
  businessKeys: string[];
  fields: BundleField[];
  records: Record<string, unknown>[];
}

export interface ExportBundle {
  version: "2.0";
  exportedAt: string;
  rootTable: string;
  tables: Record<string, BundleTable>;
}

export interface BundleImportResult {
  tables: Array<{
    tableName: string;
    tableId: string;
    fieldCount: number;
    recordCount: number;
  }>;
  relationLinksCreated: number;
  errors: Array<{ tableName: string; message: string }>;
}

// ========== View Types ==========

export type FilterOperator =
  | 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte'
  | 'contains' | 'notcontains' | 'startswith' | 'endswith'
  | 'isempty' | 'isnotempty'
  | 'between' | 'in' | 'notin';

export interface FilterCondition {
  fieldKey: string;
  op: FilterOperator;
  value: string | number | (string | number)[] | { min: number | string; max: number | string };
}

export interface FilterGroup {
  operator: "AND" | "OR"
  conditions: FilterCondition[]
}

export interface ConditionalFormatRule {
  id: string
  name?: string
  condition: FilterCondition
  backgroundColor: string
  textColor?: string
  scope: "row" | "cell"
}

export type AggregateType =
  | "count"
  | "sum"
  | "avg"
  | "min"
  | "max"
  | "earliest"
  | "latest"
  | "checked"
  | "unchecked";

export interface SummaryRowData {
  [fieldKey: string]: {
    value: number | string;
    type: AggregateType;
  };
}

/** Normalize legacy flat FilterCondition[] to FilterGroup[] */
export function normalizeFilters(
  filters: FilterCondition[] | FilterGroup[] | null | undefined
): FilterGroup[] {
  if (!filters || filters.length === 0) return []
  // Detect new format: FilterGroup has "conditions" property
  if ("conditions" in filters[0]) {
    return filters as FilterGroup[]
  }
  // Legacy format: flat FilterCondition[] — wrap in single AND group
  return [{ operator: "AND", conditions: filters as FilterCondition[] }]
}

export interface SortConfig {
  fieldKey: string;
  order: 'asc' | 'desc';
}

export interface DataViewConfig {
  filters: FilterGroup[];
  sortBy: SortConfig[];
  visibleFields: string[];
  fieldOrder: string[];
  groupBy: string | null;
  viewOptions: Record<string, unknown>;
}

export interface DataViewItem {
  id: string;
  tableId: string;
  name: string;
  type: ViewType;
  isDefault: boolean;
  filters: FilterGroup[];
  sortBy: SortConfig[];
  visibleFields: string[];
  fieldOrder: string[];
  groupBy: string | null;
  viewOptions: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// ========== Form View Types ==========

export interface FormFieldGroup {
  id: string;
  title: string;
  fieldKeys: string[];
}

export interface FormViewOptions {
  formTitle: string;
  formDescription: string;
  submitButtonText: string;
  successMessage: string;
  allowMultipleSubmissions: boolean;
  layout: {
    version: 1;
    groups: FormFieldGroup[];
  };
}

export interface FormShareTokenItem {
  id: string;
  token: string;
  viewId: string;
  label: string | null;
  isActive: boolean;
  createdAt: string;
  expiresAt: string | null;
  submissionCount: number;
  url?: string;
}
