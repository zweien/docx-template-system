import { FieldType } from "@/generated/prisma/enums";

// ========== Field Types ==========

export interface DataFieldItem {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[]; // SELECT/MULTISELECT 选项列表
  relationTo?: string; // RELATION 目标表 ID
  displayField?: string; // RELATION 显示字段
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
}

// ========== Record Types ==========

export interface DataRecordItem {
  id: string;
  tableId: string;
  data: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  createdByName: string;
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
