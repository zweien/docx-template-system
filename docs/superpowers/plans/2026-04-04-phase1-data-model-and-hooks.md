# Phase 1: 数据模型更新 + 统一数据 Hook + 共享格式化工具

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 扩展 Prisma schema 添加 ViewType enum 和 DataView 新列；更新 TypeScript 类型和 validator；更新 service 层支持多排序和 viewOptions；提取 `formatCellValue` 到共享工具；创建 `useTableData` hook 作为所有视图的统一数据层。

**Architecture:** 数据模型变更通过 `prisma db push` 应用。service 层 `mapViewItem` 在读取时归一化旧格式 `sortBy`（单对象 -> 数组）。`useTableData` hook 封装数据获取、CRUD、视图配置、URL 同步和搜索防抖，替代 `record-table.tsx` 中的内联状态管理。

**Tech Stack:** Prisma v7, PostgreSQL, React 19 hooks, zod, Next.js v16 (searchParams as Promise)

> **实施状态：** Phase 1 所有任务已在 `feat/enhance-data-table` 分支上实施完毕。代码已存在于当前代码库中，以下步骤仅供参考和回归验证。

---

## File Structure

```
prisma/
  schema.prisma                        # MODIFY: add ViewType enum, DataView columns
src/types/
  data-table.ts                        # MODIFY: add ViewType, update types
src/validators/
  data-table.ts                        # MODIFY: add new schemas
src/lib/
  format-cell.ts                       # CREATE: shared cell formatting
  services/
    data-view.service.ts               # MODIFY: normalize sortBy, mapViewItem updates
    data-record.service.ts             # MODIFY: multi-sort support
src/hooks/
  use-table-data.ts                    # CREATE: main unified data hook
src/app/api/data-tables/[id]/views/
  route.ts                             # MODIFY: accept new view fields
src/app/api/data-tables/[id]/views/[viewId]/
  route.ts                             # MODIFY: accept new view fields
```

---

### Task 1: 扩展 Prisma Schema — 添加 ViewType enum 和 DataView 新列

**Files:**
- Modify: `prisma/schema.prisma`

- [x] **Step 1: 在 `prisma/schema.prisma` 中添加 ViewType enum 和更新 DataView model**

在 `FieldType` enum 之后、`RelationCardinality` enum 之前添加 ViewType enum：

```prisma
enum ViewType {
  GRID
  KANBAN
  GALLERY
  TIMELINE
}
```

更新 `DataView` model：

```prisma
model DataView {
  id            String   @id @default(cuid())
  tableId       String
  name          String
  type          ViewType @default(GRID)
  isDefault     Boolean  @default(false)
  filters       Json?
  sortBy        Json?
  visibleFields Json?
  fieldOrder    Json?
  groupBy       String?
  viewOptions   Json?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  table         DataTable @relation(fields: [tableId], references: [id], onDelete: Cascade)

  @@unique([tableId, name])
}
```

- [x] **Step 2: 推送 schema 变更到数据库**

Run: `npx prisma db push`

Expected: Schema synced, no errors. Existing DataView rows 自动获得 `type=GRID`, `groupBy=null`, `viewOptions=null`。

- [x] **Step 3: 重新生成 Prisma client**

Run: `npx prisma generate`

- [x] **Step 4: Commit**

```bash
git add prisma/schema.prisma src/generated/prisma/
git commit -m "feat(data): add ViewType enum and DataView columns (type, groupBy, viewOptions)"
```

---

### Task 2: 更新 TypeScript 类型

**Files:**
- Modify: `src/types/data-table.ts`

- [x] **Step 1: 添加 ViewType、更新 DataViewConfig 和 DataViewItem**

在文件末尾的 View Types 区域，做以下修改：

```typescript
import {
  FieldType as PrismaFieldType,
  RelationCardinality as PrismaRelationCardinality,
  ViewType as PrismaViewType,
} from "@/generated/prisma/enums";

// 在 FieldType 类型之后添加
export type ViewType = PrismaViewType;

// 更新 SortConfig（不变）
export interface SortConfig {
  fieldKey: string;
  order: 'asc' | 'desc';
}

// 更新 DataViewConfig — sortBy 改为数组，新增 groupBy 和 viewOptions
export interface DataViewConfig {
  filters: FilterCondition[];
  sortBy: SortConfig[];           // 改为数组（原为 SortConfig | null）
  visibleFields: string[];
  fieldOrder: string[];
  groupBy: string | null;         // 新增
  viewOptions: Record<string, unknown>; // 新增
}

// 更新 DataViewItem — 新增 type 字段，config 嵌套
export interface DataViewItem {
  id: string;
  tableId: string;
  name: string;
  type: ViewType;                 // 新增
  isDefault: boolean;
  filters: FilterCondition[];
  sortBy: SortConfig[];           // 改为数组
  visibleFields: string[];
  fieldOrder: string[];
  groupBy: string | null;         // 新增
  viewOptions: Record<string, unknown>; // 新增
  createdAt: Date;
  updatedAt: Date;
}
```

注意：保持 `DataViewItem` 扁平结构（filters/sortBy/visibleFields/fieldOrder 直接在顶层），与现有的 `mapViewItem` 和前端消费方式兼容，避免大规模重构。同时保持向后兼容 — 旧代码读取 `view.sortBy` 时仍然是数组，只是从单个对象变成了数组。

- [x] **Step 2: 验证类型检查通过**

Run: `npx tsc --noEmit`

Expected: 可能有现有文件类型不匹配的错误（因为 `sortBy` 从 `SortConfig | null` 变为 `SortConfig[]`），这些会在 Task 3 和 Task 4 中修复。

- [x] **Step 3: Commit**

```bash
git add src/types/data-table.ts
git commit -m "feat(data): add ViewType, update DataViewConfig/DataViewItem for multi-sort and viewOptions"
```

---

### Task 3: 更新 Validator 和 Service 层

**Files:**
- Modify: `src/validators/data-table.ts`
- Modify: `src/lib/services/data-view.service.ts`
- Modify: `src/lib/services/data-record.service.ts`

- [x] **Step 1: 在 `src/validators/data-table.ts` 中添加新 schema**

在文件末尾的 `// ========== Type Exports` 之前添加：

```typescript
// ========== View Type Schemas ==========

export const viewTypeSchema = z.nativeEnum(
  await import("@/generated/prisma/enums").then(m => m.ViewType)
);

// 简化：直接使用 enum 值
export const viewTypeNameSchema = z.enum(["GRID", "KANBAN", "GALLERY", "TIMELINE"]);

export const patchFieldSchema = z.object({
  fieldKey: z.string().regex(/^[a-z][a-z0-9_]*$/),
  value: z.unknown(),
});

export const sortConfigSchema = z.object({
  fieldKey: z.string(),
  order: z.enum(["asc", "desc"]),
});

export const filterConditionSchema = z.object({
  fieldKey: z.string(),
  op: z.enum(["eq", "ne", "gt", "lt", "gte", "lte", "contains", "isempty", "isnotempty"]),
  value: z.union([z.string(), z.number()]),
});

export const reorderSchema = z.object({
  recordIds: z.array(z.string()).min(1).max(200),
});

// 在 Type Exports 区域添加
export type PatchFieldInput = z.infer<typeof patchFieldSchema>;
export type ReorderInput = z.infer<typeof reorderSchema>;
```

- [x] **Step 2: 更新 `src/lib/services/data-view.service.ts`**

修改 import 类型 — 将 `SortConfig` 改为 `SortConfig[]`：

```typescript
import type { DataViewItem, FilterCondition, SortConfig, ServiceResult, ViewType } from "@/types/data-table";
```

添加 `normalizeSortBy` 辅助函数（在 `mapViewItem` 之前）：

```typescript
// 归一化旧格式 sortBy（单对象 -> 数组）
function normalizeSortBy(raw: unknown): SortConfig[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  // Legacy format: single SortConfig object -> wrap in array
  return [raw as SortConfig];
}
```

更新 `mapViewItem` 函数：

```typescript
function mapViewItem(row: {
  id: string;
  tableId: string;
  name: string;
  type: unknown;
  isDefault: boolean;
  filters: unknown;
  sortBy: unknown;
  visibleFields: unknown;
  fieldOrder: unknown;
  groupBy: unknown;
  viewOptions: unknown;
  createdAt: Date;
  updatedAt: Date;
}): DataViewItem {
  return {
    id: row.id,
    tableId: row.tableId,
    name: row.name,
    type: (row.type as ViewType) ?? "GRID",
    isDefault: row.isDefault,
    filters: (row.filters as FilterCondition[]) ?? [],
    sortBy: normalizeSortBy(row.sortBy),
    visibleFields: (row.visibleFields as string[]) ?? [],
    fieldOrder: (row.fieldOrder as string[]) ?? [],
    groupBy: (row.groupBy as string | null) ?? null,
    viewOptions: (row.viewOptions as Record<string, unknown>) ?? {},
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
```

更新 `createView` 函数签名和 body，添加新字段：

```typescript
export async function createView(
  tableId: string,
  data: {
    name: string;
    type?: ViewType;
    isDefault?: boolean;
    filters?: FilterCondition[];
    sortBy?: SortConfig[] | null;
    visibleFields?: string[];
    fieldOrder?: string[];
    groupBy?: string | null;
    viewOptions?: Record<string, unknown>;
  }
): Promise<ServiceResult<DataViewItem>> {
  try {
    const view = await db.dataView.create({
      data: {
        tableId,
        name: data.name,
        type: data.type ?? "GRID",
        isDefault: data.isDefault ?? false,
        filters: toJsonValue(data.filters ?? []),
        sortBy: !data.sortBy ? Prisma.JsonNull : toJsonValue(data.sortBy),
        visibleFields: toJsonValue(data.visibleFields ?? []),
        fieldOrder: toJsonValue(data.fieldOrder ?? []),
        groupBy: data.groupBy ?? null,
        viewOptions: data.viewOptions ? toJsonValue(data.viewOptions) : Prisma.JsonNull,
      },
    });
    return { success: true, data: mapViewItem(view) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建视图失败";
    if (message.includes("Unique")) {
      return { success: false, error: { code: "DUPLICATE", message: "视图名称已存在" } };
    }
    return { success: false, error: { code: "CREATE_FAILED", message } };
  }
}
```

更新 `updateView` 函数签名和 body：

```typescript
export async function updateView(
  viewId: string,
  data: Partial<{
    name: string;
    type: ViewType;
    isDefault: boolean;
    filters: FilterCondition[];
    sortBy: SortConfig[] | null;
    visibleFields: string[];
    fieldOrder: string[];
    groupBy: string | null;
    viewOptions: Record<string, unknown>;
  }>
): Promise<ServiceResult<DataViewItem>> {
  try {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;
    if (data.filters !== undefined) updateData.filters = toJsonValue(data.filters);
    if (data.sortBy !== undefined) updateData.sortBy = !data.sortBy ? Prisma.JsonNull : toJsonValue(data.sortBy);
    if (data.visibleFields !== undefined) updateData.visibleFields = toJsonValue(data.visibleFields);
    if (data.fieldOrder !== undefined) updateData.fieldOrder = toJsonValue(data.fieldOrder);
    if (data.groupBy !== undefined) updateData.groupBy = data.groupBy;
    if (data.viewOptions !== undefined) updateData.viewOptions = toJsonValue(data.viewOptions);

    const view = await db.dataView.update({
      where: { id: viewId },
      data: updateData,
    });
    return { success: true, data: mapViewItem(view) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新视图失败";
    return { success: false, error: { code: "UPDATE_FAILED", message } };
  }
}
```

- [x] **Step 3: 更新 `src/lib/services/data-record.service.ts` — 支持多排序**

修改 `listRecords` 函数中 `sortBy` 参数类型（从 `SortConfig | null` 改为 `SortConfig[]`）和排序逻辑：

在函数参数类型中：
```typescript
sortBy?: SortConfig[] | null;    // 改为数组
```

替换内存排序逻辑（原来只处理单个 SortConfig，现在处理数组）：

```typescript
// 多字段排序支持
if (filters.sortBy && filters.sortBy.length > 0) {
  const sorts = filters.sortBy;
  processedRecords = [...processedRecords].sort((a, b) => {
    for (const { fieldKey, order } of sorts) {
      const fieldDef = tableResult.data.fields.find(f => f.key === fieldKey);
      if (!fieldDef) continue;

      const aVal = a.data[fieldKey];
      const bVal = b.data[fieldKey];

      const aDisplay = typeof aVal === "object" && aVal !== null && "display" in aVal
        ? (aVal as { display: unknown }).display
        : aVal;
      const bDisplay = typeof bVal === "object" && bVal !== null && "display" in bVal
        ? (bVal as { display: unknown }).display
        : bVal;

      const aNum = Number(aDisplay);
      const bNum = Number(bDisplay);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        const cmp = aNum - bNum;
        if (cmp !== 0) return order === "asc" ? cmp : -cmp;
        continue;
      }
      const aStr = String(aDisplay ?? "");
      const bStr = String(bDisplay ?? "");
      const cmp = aStr.localeCompare(bStr);
      if (cmp !== 0) return order === "asc" ? cmp : -cmp;
    }
    return 0;
  });
}
```

同时更新 API 路由中的 `viewSortBy` 传递（在 `src/app/api/data-tables/[id]/records/route.ts`）：

```typescript
// 将 viewSortBy 类型改为 SortConfig[]
let viewSortBy: SortConfig[] | null | undefined;
// ...
if (viewResult.success) {
  viewSortBy = viewResult.data.sortBy.length > 0 ? viewResult.data.sortBy : undefined;
}
```

- [x] **Step 4: 更新 view API 路由 schema**

在 `src/app/api/data-tables/[id]/views/route.ts` 中更新 `createViewSchema`：

```typescript
const createViewSchema = z.object({
  name: z.string().min(1, "视图名称不能为空"),
  type: z.enum(["GRID", "KANBAN", "GALLERY", "TIMELINE"]).optional(),
  isDefault: z.boolean().optional(),
  filters: z.array(z.object({
    fieldKey: z.string(),
    op: z.enum(["eq", "ne", "gt", "lt", "gte", "lte", "contains", "isempty", "isnotempty"]),
    value: z.union([z.string(), z.number()]),
  })).optional(),
  sortBy: z.array(z.object({
    fieldKey: z.string(),
    order: z.enum(["asc", "desc"]),
  })).nullable().optional(),
  visibleFields: z.array(z.string()).optional(),
  fieldOrder: z.array(z.string()).optional(),
  groupBy: z.string().nullable().optional(),
  viewOptions: z.record(z.unknown()).optional(),
});
```

同样更新 `src/app/api/data-tables/[id]/views/[viewId]/route.ts` 中的 `updateViewSchema`：

```typescript
const updateViewSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(["GRID", "KANBAN", "GALLERY", "TIMELINE"]).optional(),
  isDefault: z.boolean().optional(),
  filters: z.array(z.object({
    fieldKey: z.string(),
    op: z.enum(["eq", "ne", "gt", "lt", "gte", "lte", "contains", "isempty", "isnotempty"]),
    value: z.union([z.string(), z.number()]),
  })).optional(),
  sortBy: z.array(z.object({
    fieldKey: z.string(),
    order: z.enum(["asc", "desc"]),
  })).nullable().optional(),
  visibleFields: z.array(z.string()).optional(),
  fieldOrder: z.array(z.string()).optional(),
  groupBy: z.string().nullable().optional(),
  viewOptions: z.record(z.unknown()).optional(),
});
```

- [x] **Step 5: 运行类型检查**

Run: `npx tsc --noEmit`

Expected: 所有类型错误已修复（除了前端组件中消费 `sortBy` 的地方可能需要后续 Task 处理）。

- [x] **Step 6: 运行现有测试**

Run: `npx vitest run src/lib/services/data-record.service.test.ts`

Expected: 所有测试通过。注意：data-record.service.test.ts 中的 mock 可能需要更新 sortBy 格式（从单对象改为数组）。data-view.service 目前没有测试文件。

- [x] **Step 7: Commit**

```bash
git add src/validators/data-table.ts src/lib/services/data-view.service.ts src/lib/services/data-record.service.ts src/app/api/data-tables/
git commit -m "feat(data): update validators, services, and API routes for multi-sort, viewOptions, and ViewType"
```

---

### Task 4: 提取共享格式化工具 `format-cell.ts`

**Files:**
- Create: `src/lib/format-cell.ts`

- [x] **Step 1: 创建 `src/lib/format-cell.ts`**

从 `record-table.tsx` 中提取 `formatCellValue` 函数，改为独立导出：

```typescript
import { Badge } from "@/components/ui/badge";
import { FieldType } from "@/generated/prisma/enums";
import type { DataFieldItem, RelationSubtableValueItem } from "@/types/data-table";
import type { ReactNode } from "react";

/**
 * Format a cell value for display based on field type.
 * Shared across all view components (grid, kanban, gallery, timeline).
 */
export function formatCellValue(
  field: DataFieldItem,
  value: unknown
): ReactNode {
  if (value === null || value === undefined || value === "") {
    return <span className="text-zinc-400">-</span>;
  }

  switch (field.type) {
    case FieldType.NUMBER:
      return typeof value === "number"
        ? value.toLocaleString()
        : String(value);
    case FieldType.DATE:
      try {
        const date = new Date(value as string);
        return date.toLocaleDateString("zh-CN");
      } catch {
        return String(value);
      }
    case FieldType.SELECT:
      return <Badge variant="secondary">{String(value)}</Badge>;
    case FieldType.MULTISELECT:
      if (Array.isArray(value)) {
        return (
          <div className="flex flex-wrap gap-1">
            {value.map((v, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {v}
              </Badge>
            ))}
          </div>
        );
      }
      return String(value);
    case FieldType.EMAIL:
      return (
        <a
          href={`mailto:${value}`}
          className="text-blue-600 hover:underline"
        >
          {String(value)}
        </a>
      );
    case FieldType.PHONE:
      return <span className="font-mono">{String(value)}</span>;
    case FieldType.RELATION: {
      const displayValue =
        (value as Record<string, unknown>)?.display ?? value;
      return <Badge variant="outline">{String(displayValue)}</Badge>;
    }
    case FieldType.RELATION_SUBTABLE: {
      const relationItems = (Array.isArray(value) ? [...value] : [value]).filter(
        (item): item is RelationSubtableValueItem =>
          Boolean(item) &&
          typeof item === "object" &&
          "targetRecordId" in item
      );
      const items = [...relationItems].sort(
        (left, right) => left.sortOrder - right.sortOrder
      );

      if (items.length === 0) {
        return <span className="text-zinc-400">-</span>;
      }

      const visibleItems = items.slice(0, 3);
      const hiddenCount = items.length - visibleItems.length;

      return (
        <div className="flex flex-wrap gap-1">
          {visibleItems.map((item) => (
            <Badge
              key={`${item.targetRecordId}-${item.sortOrder}`}
              variant="outline"
              className="text-xs"
            >
              {String(item.displayValue ?? item.targetRecordId)}
            </Badge>
          ))}
          {hiddenCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              +{hiddenCount}
            </Badge>
          )}
        </div>
      );
    }
    default:
      return String(value);
  }
}

/**
 * Get a plain text representation of a cell value (no React elements).
 * Useful for kanban card titles, gallery labels, etc.
 */
export function formatCellText(field: DataFieldItem, value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (field.type === FieldType.RELATION) {
    const display = (value as Record<string, unknown>)?.display ?? value;
    return String(display);
  }
  if (field.type === FieldType.DATE) {
    try {
      return new Date(value as string).toLocaleDateString("zh-CN");
    } catch {
      return String(value);
    }
  }
  return String(value);
}
```

- [x] **Step 2: 在 `record-table.tsx` 中替换内联 `formatCellValue`**

在 `src/components/data/record-table.tsx` 中：
1. 删除组件内的 `formatCellValue` 方法定义（约 287-377 行）
2. 添加 import: `import { formatCellValue } from "@/lib/format-cell";`

- [x] **Step 3: 验证类型检查通过**

Run: `npx tsc --noEmit`

- [x] **Step 4: Commit**

```bash
git add src/lib/format-cell.ts src/components/data/record-table.tsx
git commit -m "refactor(data): extract formatCellValue to shared format-cell utility"
```

---

### Task 5: 创建 `useTableData` 统一数据 Hook

**Files:**
- Create: `src/hooks/use-table-data.ts`

- [x] **Step 1: 创建 `src/hooks/use-table-data.ts`**

这个 hook 封装了当前 `record-table.tsx` 中的所有数据逻辑：数据获取、搜索防抖、视图切换、URL 同步、CRUD 操作。

```typescript
"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type {
  DataFieldItem,
  DataRecordItem,
  DataViewItem,
  FilterCondition,
  SortConfig,
  DataViewConfig,
  PaginatedRecords,
} from "@/types/data-table";
import { useDebouncedCallback } from "@/hooks/use-debounce";

export interface UseTableDataOptions {
  tableId: string;
  fields: DataFieldItem[];
  pageSize?: number;
}

export interface UseTableDataReturn {
  // Data
  records: DataRecordItem[];
  totalCount: number;
  totalPages: number;
  isLoading: boolean;

  // Pagination
  page: number;
  setPage: (p: number) => void;

  // Search
  search: string;
  searchInput: string;
  setSearchInput: (v: string) => void;

  // View
  viewId: string | null;
  views: DataViewItem[];
  currentView: DataViewItem | null;
  switchView: (viewId: string | null) => void;
  refreshViews: () => Promise<void>;

  // View config
  currentConfig: DataViewConfig;
  setFilters: (filters: FilterCondition[]) => void;
  setSorts: (sorts: SortConfig[]) => void;
  setVisibleFields: (fields: string[]) => void;
  setFieldOrder: (order: string[]) => void;
  setGroupBy: (fieldKey: string | null) => void;

  // CRUD
  deleteRecord: (recordId: string) => Promise<void>;
  deletingIds: Set<string>;

  // Refresh
  refresh: () => void;
}

export function useTableData({
  tableId,
  fields,
  pageSize = 20,
}: UseTableDataOptions): UseTableDataReturn {
  const router = useRouter();
  const searchParams = useSearchParams();
  const refreshRef = useRef(0);

  // Search
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [searchInput, setSearchInput] = useState(searchParams.get("search") ?? "");

  const debouncedSetSearch = useDebouncedCallback(
    (value: unknown) => {
      const v = value as string;
      setSearch(v);
      const params = new URLSearchParams(searchParams.toString());
      if (v) params.set("search", v);
      else params.delete("search");
      params.delete("page");
      router.replace(`/data/${tableId}?${params.toString()}`, { scroll: false });
    },
    300
  );

  const handleSearchInputChange = (value: string) => {
    setSearchInput(value);
    debouncedSetSearch(value);
  };

  // Pagination
  const page = parseInt(searchParams.get("page") ?? "1");

  const setPage = useCallback(
    (p: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", String(p));
      if (search) params.set("search", search);
      if (viewId) params.set("viewId", viewId);
      router.push(`/data/${tableId}?${params.toString()}`);
    },
    [searchParams, search, tableId, router, viewId]
  );

  // View state
  const [viewId, setViewId] = useState<string | null>(
    searchParams.get("viewId") ?? null
  );
  const [views, setViews] = useState<DataViewItem[]>([]);
  const [filters, setFiltersState] = useState<FilterCondition[]>([]);
  const [sorts, setSortsState] = useState<SortConfig[]>([]);
  const [visibleFields, setVisibleFieldsState] = useState<string[]>(() =>
    fields.map((f) => f.key)
  );
  const [fieldOrder, setFieldOrderState] = useState<string[]>(() =>
    fields.map((f) => f.key)
  );
  const [groupBy, setGroupByState] = useState<string | null>(null);

  // Data
  const [data, setData] = useState<PaginatedRecords | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const currentView = useMemo(
    () => views.find((v) => v.id === viewId) ?? null,
    [views, viewId]
  );

  const currentConfig = useMemo<DataViewConfig>(
    () => ({
      filters,
      sortBy: sorts,
      visibleFields,
      fieldOrder,
      groupBy,
      viewOptions: {},
    }),
    [filters, sorts, visibleFields, fieldOrder, groupBy]
  );

  // Ordered visible fields
  const orderedVisibleFields = useMemo(
    () => fieldOrder.filter((key) => visibleFields.includes(key)),
    [fieldOrder, visibleFields]
  );

  // Fetch views
  const refreshViews = useCallback(async () => {
    try {
      const res = await fetch(`/api/data-tables/${tableId}/views`);
      if (!res.ok) return;
      const result = await res.json();
      if (result.success) {
        setViews(result.data);
      }
    } catch {
      // Silently fail
    }
  }, [tableId]);

  useEffect(() => {
    refreshViews();
  }, [refreshViews]);

  // Load view config when viewId changes
  useEffect(() => {
    if (!viewId) {
      setFiltersState([]);
      setSortsState([]);
      setVisibleFieldsState(fields.map((f) => f.key));
      setFieldOrderState(fields.map((f) => f.key));
      setGroupByState(null);
      return;
    }

    let cancelled = false;
    async function loadView() {
      try {
        const res = await fetch(`/api/data-tables/${tableId}/views/${viewId}`);
        if (!res.ok) return;
        const result = await res.json();
        if (!cancelled && result.success) {
          const view = result.data;
          setFiltersState(view.filters ?? []);
          setSortsState(view.sortBy ?? []);
          if (view.visibleFields?.length) setVisibleFieldsState(view.visibleFields);
          if (view.fieldOrder?.length) setFieldOrderState(view.fieldOrder);
          setGroupByState(view.groupBy ?? null);
        }
      } catch {
        // Silently fail
      }
    }

    loadView();
    return () => { cancelled = true; };
  }, [viewId, tableId, fields]);

  // Fetch data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search) params.set("search", search);
      if (viewId) params.set("viewId", viewId);
      if (filters.length > 0) params.set("filterConditions", JSON.stringify(filters));
      if (sorts.length > 0) params.set("sortBy", JSON.stringify(sorts));

      const response = await fetch(`/api/data-tables/${tableId}/records?${params}`);
      const result = await response.json();

      if (response.ok) {
        setData(result);
      }
    } catch (error) {
      console.error("获取记录失败:", error);
    } finally {
      setIsLoading(false);
    }
  }, [tableId, page, pageSize, search, viewId, filters, sorts]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshRef.current]);

  // Sync viewId to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (viewId) params.set("viewId", viewId);
    else params.delete("viewId");
    const newUrl = `/data/${tableId}?${params.toString()}`;
    const currentUrl = `/data/${tableId}?${searchParams.toString()}`;
    if (newUrl !== currentUrl) {
      router.replace(newUrl, { scroll: false });
    }
  }, [viewId]); // eslint-disable-line react-hooks/exhaustive-deps

  // View actions
  const switchView = useCallback(
    (newViewId: string | null) => {
      setViewId(newViewId);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (newViewId) params.set("viewId", newViewId);
      router.push(`/data/${tableId}?${params.toString()}`);
    },
    [search, tableId, router]
  );

  // Config setters
  const setFilters = useCallback((f: FilterCondition[]) => setFiltersState(f), []);
  const setSorts = useCallback((s: SortConfig[]) => setSortsState(s), []);
  const setVisibleFields = useCallback((f: string[]) => setVisibleFieldsState(f), []);
  const setFieldOrder = useCallback((o: string[]) => setFieldOrderState(o), []);
  const setGroupBy = useCallback((g: string | null) => setGroupByState(g), []);

  // CRUD
  const deleteRecord = useCallback(
    async (recordId: string) => {
      if (!confirm("确定要删除这条记录吗？")) return;
      const recordToDelete = data?.records.find((r) => r.id === recordId);
      if (!recordToDelete) return;

      setDeletingIds((prev) => new Set(prev).add(recordId));

      // Optimistic delete
      setData((prev) =>
        prev
          ? { ...prev, records: prev.records.filter((r) => r.id !== recordId), total: prev.total - 1 }
          : null
      );

      try {
        const response = await fetch(`/api/data-tables/${tableId}/records/${recordId}`, {
          method: "DELETE",
        });
        if (!response.ok) throw new Error("删除失败");
      } catch (error) {
        // Rollback
        setData((prev) =>
          prev
            ? { ...prev, records: [...prev.records, recordToDelete], total: prev.total + 1 }
            : null
        );
        console.error("删除失败:", error);
        alert("删除失败，请重试");
      } finally {
        setDeletingIds((prev) => {
          const next = new Set(prev);
          next.delete(recordId);
          return next;
        });
      }
    },
    [data, tableId]
  );

  // Refresh
  const refresh = useCallback(() => {
    refreshRef.current += 1;
  }, []);

  return {
    records: data?.records ?? [],
    totalCount: data?.total ?? 0,
    totalPages: data?.totalPages ?? 0,
    isLoading,
    page,
    setPage,
    search,
    searchInput,
    setSearchInput: handleSearchInputChange,
    viewId,
    views,
    currentView,
    switchView,
    refreshViews,
    currentConfig,
    setFilters,
    setSorts,
    setVisibleFields,
    setFieldOrder,
    setGroupBy,
    deleteRecord,
    deletingIds,
    refresh,
  };
}
```

- [x] **Step 2: 验证类型检查通过**

Run: `npx tsc --noEmit`

- [x] **Step 3: Commit**

```bash
git add src/hooks/use-table-data.ts
git commit -m "feat(data): add useTableData unified data hook for all views"
```

---

### Task 6: 重构 `record-table.tsx` 使用 `useTableData` hook

**Files:**
- Modify: `src/components/data/record-table.tsx`

- [x] **Step 1: 重构 `record-table.tsx`**

将组件从 575 行缩减为 ~200 行的纯渲染组件，所有数据逻辑委托给 `useTableData`。

替换整个文件内容：

```typescript
"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import type { DataFieldItem } from "@/types/data-table";
import { ColumnHeader } from "@/components/data/column-header";
import { FieldConfigPopover } from "@/components/data/field-config-popover";
import { ViewSelector } from "@/components/data/view-selector";
import { SaveViewDialog } from "@/components/data/save-view-dialog";
import { TableSkeleton } from "@/components/ui/skeleton";
import { formatCellValue } from "@/lib/format-cell";
import { useTableData } from "@/hooks/use-table-data";
import { useDebouncedCallback } from "@/hooks/use-debounce";

interface RecordTableProps {
  tableId: string;
  fields: DataFieldItem[];
  isAdmin: boolean;
}

export function RecordTable({ tableId, fields, isAdmin }: RecordTableProps) {
  const {
    records,
    totalCount,
    totalPages,
    isLoading,
    page,
    search,
    searchInput,
    setSearchInput,
    viewId,
    currentConfig,
    setFilters,
    setSorts,
    setVisibleFields,
    setFieldOrder,
    deleteRecord,
    deletingIds,
    switchView,
    refreshViews,
  } = useTableData({ tableId, fields });

  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  // Ordered visible fields for rendering
  const orderedVisibleFields = useMemo(
    () => currentConfig.fieldOrder.filter((key) => currentConfig.visibleFields.includes(key)),
    [currentConfig.fieldOrder, currentConfig.visibleFields]
  );

  const handleFilterChange = (filter: import("@/types/data-table").FilterCondition | null, fieldKey: string) => {
    const updated = filter
      ? [...currentConfig.filters.filter((f) => f.fieldKey !== fieldKey), filter]
      : currentConfig.filters.filter((f) => f.fieldKey !== fieldKey);
    setFilters(updated);
  };

  const handleSortChange = (sort: import("@/types/data-table").SortConfig | null) => {
    if (sort) {
      // Replace sort for the same field, or add new
      const existing = currentConfig.sortBy.filter((s) => s.fieldKey !== sort.fieldKey);
      setSorts([...existing, sort]);
    } else {
      // Clear all sorts (when user clears from column header)
      setSorts([]);
    }
  };

  const handleFieldConfigChange = (newVisibleFields: string[], newFieldOrder: string[]) => {
    setVisibleFields(newVisibleFields);
    setFieldOrder(newFieldOrder);
  };

  const handleSaveView = () => {
    setSaveDialogOpen(true);
  };

  const handleViewSaved = (savedViewId: string) => {
    switchView(savedViewId);
  };

  if (fields.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-500">
        请先配置字段
        {isAdmin && (
          <Link href={`/data/${tableId}/fields`} className="ml-2 text-blue-600 hover:underline">
            前往配置
          </Link>
        )}
      </div>
    );
  }

  const colCount = orderedVisibleFields.length + 1;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <ViewSelector
            tableId={tableId}
            currentViewId={viewId}
            onViewChange={switchView}
            onSaveNewView={handleSaveView}
          />
          <form onSubmit={(e) => { e.preventDefault(); }} className="flex-1 sm:flex-none">
            <Input
              placeholder="搜索记录..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="h-9 w-full sm:w-[200px]"
            />
          </form>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <FieldConfigPopover
            fields={fields}
            visibleFields={currentConfig.visibleFields}
            fieldOrder={currentConfig.fieldOrder}
            onChange={handleFieldConfigChange}
          />
          {isAdmin && (
            <Link href={`/data/${tableId}/new`}>
              <Button size="sm" className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-1" />
                新建记录
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {orderedVisibleFields.map((fieldKey) => {
                const field = fields.find((f) => f.key === fieldKey);
                if (!field) return null;
                return (
                  <TableHead key={field.id}>
                    <ColumnHeader
                      field={field}
                      filter={currentConfig.filters.find((f) => f.fieldKey === fieldKey) ?? null}
                      sort={
                        currentConfig.sortBy.find((s) => s.fieldKey === fieldKey) ?? null
                      }
                      onFilterChange={(filter) => handleFilterChange(filter, fieldKey)}
                      onSortChange={handleSortChange}
                    />
                  </TableHead>
                );
              })}
              <TableHead className="w-[100px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={colCount} className="p-0 border-0">
                  <TableSkeleton rows={5} columns={orderedVisibleFields.length} />
                </TableCell>
              </TableRow>
            ) : records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colCount} className="text-center py-8">
                  暂无记录
                </TableCell>
              </TableRow>
            ) : (
              records.map((record) => (
                <TableRow key={record.id}>
                  {orderedVisibleFields.map((fieldKey) => {
                    const field = fields.find((f) => f.key === fieldKey);
                    if (!field) return null;
                    return (
                      <TableCell key={field.id} className="max-w-[200px] truncate">
                        {formatCellValue(field, record.data[field.key])}
                      </TableCell>
                    );
                  })}
                  <TableCell>
                    <div className="flex gap-1">
                      {isAdmin && (
                        <>
                          <Link href={`/data/${tableId}/${record.id}/edit`}>
                            <Button variant="ghost" size="sm" className="h-8 px-2">
                              编辑
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-red-600"
                            onClick={() => deleteRecord(record.id)}
                            disabled={deletingIds.has(record.id)}
                          >
                            {deletingIds.has(record.id) ? "删除中..." : "删除"}
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-zinc-500">
          <span>共 {totalCount} 条记录</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/data/${tableId}?page=${page - 1}${search ? `&search=${search}` : ""}${viewId ? `&viewId=${viewId}` : ""}`}
              >
                <Button variant="outline" size="sm">上一页</Button>
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/data/${tableId}?page=${page + 1}${search ? `&search=${search}` : ""}${viewId ? `&viewId=${viewId}` : ""}`}
              >
                <Button variant="outline" size="sm">下一页</Button>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Save View Dialog */}
      <SaveViewDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        tableId={tableId}
        currentConfig={currentConfig}
        onSaved={handleViewSaved}
      />
    </div>
  );
}
```

- [x] **Step 2: 更新 `column-header.tsx` 的 sort 类型兼容**

当前 `ColumnHeader` 的 `onSortChange` 回调参数是 `SortConfig | null`。在多排序模式下，它只负责通知父组件单个字段的排序变化，父组件（`record-table.tsx`）负责管理排序数组。所以 `ColumnHeader` 接口不需要改变。

- [x] **Step 3: 更新 `view-selector.tsx` 中 sortBy 的读取**

在 `view-selector.tsx` 中，`view.sortBy` 现在是 `SortConfig[]`。更新排序图标显示逻辑：

```typescript
{view.sortBy.length > 0 && (
  view.sortBy[0].order === "asc" ? (
    <ArrowUp className="h-3 w-3 text-muted-foreground" />
  ) : (
    <ArrowDown className="h-3 w-3 text-muted-foreground" />
  )
)}
```

- [x] **Step 4: 更新 `save-view-dialog.tsx` 中 sortBy 的摘要**

```typescript
const sortSummary = currentConfig.sortBy.length > 0
  ? currentConfig.sortBy.map(s => `${s.fieldKey} ${s.order === "asc" ? "升序" : "降序"}`).join(", ")
  : "无";
```

- [x] **Step 5: 运行类型检查**

Run: `npx tsc --noEmit`

Expected: 所有类型错误已修复。

- [x] **Step 6: 手动测试**

Run: `npm run dev`

测试步骤：
1. 打开一个数据表详情页
2. 验证记录列表正常加载
3. 验证搜索功能正常
4. 验证视图切换正常（包括已有视图）
5. 验证列排序和筛选正常
6. 验证分页正常
7. 验证删除记录正常（乐观更新 + 回滚）

- [x] **Step 7: Commit**

```bash
git add src/components/data/record-table.tsx src/components/data/view-selector.tsx src/components/data/save-view-dialog.tsx
git commit -m "refactor(data): simplify record-table using useTableData hook, update view-selector/save-dialog for multi-sort"
```

---

### Task 7: 更新现有测试

**Files:**
- Modify: `src/lib/services/data-record.service.test.ts`（如有 sortBy 相关 mock）

- [x] **Step 1: 检查并更新测试中的 sortBy 格式**

在 `data-record.service.test.ts` 中搜索所有 `sortBy` 引用，将单对象格式改为数组格式：

如果测试中有类似：
```typescript
sortBy: { fieldKey: "name", order: "asc" }
```

改为：
```typescript
sortBy: [{ fieldKey: "name", order: "asc" }]
```

如果测试中没有涉及 sortBy，则跳过此步骤。

- [x] **Step 2: 运行所有数据相关测试**

Run: `npx vitest run src/lib/services/data-`

Expected: 所有测试通过。

- [x] **Step 3: 运行完整测试套件**

Run: `npx vitest run`

Expected: 所有测试通过。

- [x] **Step 4: Commit（如有变更）**

```bash
git add src/lib/services/data-record.service.test.ts
git commit -m "test(data): update sortBy mock format to array for multi-sort support"
```

---

## Summary

Phase 1 完成后：

- Prisma schema 包含 `ViewType` enum 和 DataView 新列（`type`, `groupBy`, `viewOptions`）
- TypeScript 类型系统支持多排序和视图类型
- Service 层归一化旧格式 sortBy
- `formatCellValue` 提取为共享工具函数
- `useTableData` hook 作为统一数据层
- `record-table.tsx` 简化为纯渲染组件
- 所有现有功能保持正常工作

下一步：Phase 2（Grid 增强）或 Phase 3（视图切换器 + 记录详情抽屉）可并行开始。
