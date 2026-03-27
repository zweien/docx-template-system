import type { PlaceholderItem, PlaceholderSnapshotItem } from "./placeholder";

export interface TemplateListItem {
  id: string;
  name: string;
  fileName: string;
  originalFileName: string;
  fileSize: number;
  status: string; // TemplateStatus enum value
  createdAt: string; // ISO date string
  categoryName: string | null;
  tags: { id: string; name: string }[];
}

export interface TemplateDetail extends TemplateListItem {
  description: string | null;
  createdById: string;
  placeholders: PlaceholderItem[];
}

// 模板字段映射类型（存储为 JSON）
// Key: 占位符的 key，Value: 数据表字段 key 或 null（表示「不映射」）
export type TemplateFieldMapping = Record<string, string | null>;

// 扩展 TemplateDetail 包含关联信息
export interface TemplateWithRelation extends TemplateDetail {
  categoryId: string | null;
  dataTableId: string | null;
  dataTable?: {
    id: string;
    name: string;
  };
  fieldMapping: TemplateFieldMapping | null;
  currentVersion?: {
    id: string;
    version: number;
    publishedAt: string;
    publishedByName: string;
  } | null;
}

// 版本列表项
export interface TemplateVersionListItem {
  version: number;
  fileName: string;
  originalFileName: string;
  fileSize: number;
  publishedAt: string;
  publishedByName: string;
  placeholderCount: number;
}

// 版本详情
export interface TemplateVersionDetail extends TemplateVersionListItem {
  id: string;
  placeholderSnapshot: PlaceholderSnapshotItem[];
  dataTableId: string | null;
  dataTable?: { id: string; name: string };
  fieldMapping: TemplateFieldMapping | null;
}

// ========== Category & Tag Types ==========

export interface CategoryItem {
  id: string;
  name: string;
  sortOrder: number;
  _count: { templates: number };
}

export interface TagItem {
  id: string;
  name: string;
  _count: { templates: number };
}

