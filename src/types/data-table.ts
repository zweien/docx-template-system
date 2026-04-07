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

export interface FilterCondition {
  fieldKey: string;
  op: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'isempty' | 'isnotempty';
  value: string | number;
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
