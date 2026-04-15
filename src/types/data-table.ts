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

/** Preset color palette for select options */
export const SELECT_COLORS = [
  { name: "蓝色", bg: "bg-blue-100", text: "text-blue-800", hex: "#dbeafe" },
  { name: "绿色", bg: "bg-green-100", text: "text-green-800", hex: "#dcfce7" },
  { name: "黄色", bg: "bg-yellow-100", text: "text-yellow-800", hex: "#fef9c3" },
  { name: "红色", bg: "bg-red-100", text: "text-red-800", hex: "#fee2e2" },
  { name: "紫色", bg: "bg-purple-100", text: "text-purple-800", hex: "#f3e8ff" },
  { name: "粉色", bg: "bg-pink-100", text: "text-pink-800", hex: "#fce7f3" },
  { name: "橙色", bg: "bg-orange-100", text: "text-orange-800", hex: "#ffedd5" },
  { name: "青色", bg: "bg-cyan-100", text: "text-cyan-800", hex: "#cffafe" },
  { name: "靛蓝", bg: "bg-indigo-100", text: "text-indigo-800", hex: "#e0e7ff" },
  { name: "灰色", bg: "bg-gray-100", text: "text-gray-800", hex: "#f3f4f6" },
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
    color: SELECT_COLORS[i % SELECT_COLORS.length].hex,
  }));
}

export interface FieldOptions {
  /** AUTO_NUMBER: next auto-increment value */
  nextValue?: number;
  /** SYSTEM_TIMESTAMP / SYSTEM_USER: "created" or "updated" */
  kind?: "created" | "updated";
  /** FORMULA: formula expression string */
  formula?: string;
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
