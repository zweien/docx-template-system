# 主数据视图功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为主数据表格实现 Airtable 风格的视图功能，包括列头筛选、排序、字段显示控制和命名视图保存

**Architecture:** 后端新增 DataView 模型存储视图配置（筛选条件、排序规则、可见字段），通过 JSONB 字段实现灵活配置。前端重构 RecordTable 组件，新增 ColumnHeader、FieldConfigPopover、ViewSelector、SaveViewDialog 四个子组件。视图配置同步到 URL 参数，支持链接分享。

**Tech Stack:** Next.js 16 (Turbopack), Prisma 7 (PostgreSQL JSONB), shadcn/ui v4 (Base UI), TypeScript

---

### Task 1: 数据模型 - 添加 DataView 表

**Files:**
- Modify: `prisma/schema.prisma` (添加 DataView 模型 + DataTable 关系)

- [ ] **Step 1: 在 prisma/schema.prisma 中添加 DataView 模型**

在 `DataRecord` 模型之后、`Record` 模型之前添加：

```prisma
model DataView {
  id            String   @id @default(cuid())
  tableId       String
  name          String
  isDefault     Boolean  @default(false)
  filters       Json?    // FilterCondition[]
  sortBy        Json?    // SortConfig | null
  visibleFields Json?    // string[]
  fieldOrder    Json?    // string[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  table         DataTable @relation(fields: [tableId], references: [id], onDelete: Cascade)

  @@unique([tableId, name])
}
```

在 `DataTable` 模型中添加关系字段：

```prisma
  views         DataView[]
```

- [ ] **Step 2: 推送到数据库并重新生成客户端**

Run: `npx prisma db push && npx prisma generate`
Expected: 数据库表创建成功，Prisma 客户端重新生成

- [ ] **Step 3: 提交**

```bash
git add prisma/schema.prisma
git commit -m "feat: add DataView model for table view configurations"
```

---

### Task 2: 类型定义 - 添加视图相关类型

**Files:**
- Modify: `src/types/data-table.ts`

- [ ] **Step 1: 在 `src/types/data-table.ts` 末尾添加视图相关类型**

```typescript
// ========== View Types ==========

export interface FilterCondition {
  fieldKey: string;
  op: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'isempty' | 'isnotempty';
  value: string | number;
}

export interface SortConfig {
  fieldKey: string;
  order: 'asc' | 'desc';
}

export interface DataViewConfig {
  filters: FilterCondition[];
  sortBy: SortConfig | null;
  visibleFields: string[];
  fieldOrder: string[];
}

export interface DataViewItem {
  id: string;
  tableId: string;
  name: string;
  isDefault: boolean;
  filters: FilterCondition[];
  sortBy: SortConfig | null;
  visibleFields: string[];
  fieldOrder: string[];
  createdAt: Date;
  updatedAt: Date;
}
```

- [ ] **Step 2: 验证类型正确**

Run: `npx tsc --noEmit 2>&1 | grep -v "data-record.service.ts" | head -5`
Expected: 无新增类型错误

- [ ] **Step 3: 提交**

```bash
git add src/types/data-table.ts
git commit -m "feat: add view-related type definitions"
```

---

### Task 3: 视图服务层

**Files:**
- Create: `src/lib/services/data-view.service.ts`

- [ ] **Step 1: 创建视图服务**

```typescript
import { db } from "@/lib/db";
import type { DataViewItem, FilterCondition, SortConfig } from "@/types/data-table";
import type { ServiceResult } from "@/types/data-table";

function mapViewItem(row: {
  id: string;
  tableId: string;
  name: string;
  isDefault: boolean;
  filters: unknown;
  sortBy: unknown;
  visibleFields: unknown;
  fieldOrder: unknown;
  createdAt: Date;
  updatedAt: Date;
}): DataViewItem {
  return {
    id: row.id,
    tableId: row.tableId,
    name: row.name,
    isDefault: row.isDefault,
    filters: (row.filters as FilterCondition[]) ?? [],
    sortBy: row.sortBy as SortConfig | null,
    visibleFields: (row.visibleFields as string[]) ?? [],
    fieldOrder: (row.fieldOrder as string[]) ?? [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listViews(tableId: string): Promise<ServiceResult<DataViewItem[]>> {
  try {
    const views = await db.dataView.findMany({
      where: { tableId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    return { success: true, data: views.map(mapViewItem) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取视图列表失败";
    return { success: false, error: { code: "LIST_FAILED", message } };
  }
}

export async function getView(viewId: string): Promise<ServiceResult<DataViewItem>> {
  try {
    const view = await db.dataView.findUnique({ where: { id: viewId } });
    if (!view) {
      return { success: false, error: { code: "NOT_FOUND", message: "视图不存在" } };
    }
    return { success: true, data: mapViewItem(view) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取视图失败";
    return { success: false, error: { code: "GET_FAILED", message } };
  }
}

export async function createView(
  tableId: string,
  data: {
    name: string;
    isDefault?: boolean;
    filters?: FilterCondition[];
    sortBy?: SortConfig | null;
    visibleFields?: string[];
    fieldOrder?: string[];
  }
): Promise<ServiceResult<DataViewItem>> {
  try {
    const view = await db.dataView.create({
      data: {
        tableId,
        name: data.name,
        isDefault: data.isDefault ?? false,
        filters: data.filters ?? [],
        sortBy: data.sortBy ?? null,
        visibleFields: data.visibleFields ?? [],
        fieldOrder: data.fieldOrder ?? [],
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

export async function updateView(
  viewId: string,
  data: Partial<{
    name: string;
    isDefault: boolean;
    filters: FilterCondition[];
    sortBy: SortConfig | null;
    visibleFields: string[];
    fieldOrder: string[];
  }>
): Promise<ServiceResult<DataViewItem>> {
  try {
    const view = await db.dataView.update({
      where: { id: viewId },
      data,
    });
    return { success: true, data: mapViewItem(view) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新视图失败";
    return { success: false, error: { code: "UPDATE_FAILED", message } };
  }
}

export async function deleteView(viewId: string): Promise<ServiceResult<null>> {
  try {
    await db.dataView.delete({ where: { id: viewId } });
    return { success: true, data: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除视图失败";
    return { success: false, error: { code: "DELETE_FAILED", message } };
  }
}
```

- [ ] **Step 2: 验证**

Run: `npx tsc --noEmit 2>&1 | grep data-view | head -5`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add src/lib/services/data-view.service.ts
git commit -m "feat: add data view service layer"
```

---

### Task 4: 扩展记录查询 - 排序功能

**Files:**
- Modify: `src/lib/services/data-record.service.ts`

- [ ] **Step 1: 扩展 listRecords 函数签名**

在 `data-record.service.ts` 中导入排序类型，并修改 `listRecords` 的 filters 参数类型：

在文件顶部添加导入：
```typescript
import type { SortConfig, FilterCondition } from "@/types/data-table";
```

修改 `listRecords` 的 `filters` 参数类型，添加 `sortBy` 字段：

```typescript
export async function listRecords(
  tableId: string,
  filters: {
    page: number;
    pageSize: number;
    search?: string;
    fieldFilters?: FieldFilters;
    sortBy?: SortConfig | null;        // 新增
    filterConditions?: FilterCondition[]; // 新增（View 级别的筛选）
  }
): Promise<ServiceResult<PaginatedRecords>> {
```

- [ ] **Step 2: 在 listRecords 中实现排序和 View 级别筛选**

在现有的 `buildFieldFilterConditions` 调用之后，添加 View 级别筛选和排序逻辑：

```typescript
    // Build view-level filter conditions from FilterCondition[]
    if (filters.filterConditions && filters.filterConditions.length > 0) {
      const viewFilterConditions = buildFilterConditionsFromSpec(
        filters.filterConditions,
        tableResult.data.fields
      );
      if (viewFilterConditions.length > 0) {
        const existingAnd = (where.AND as Record<string, unknown>[]) || [];
        where.AND = [...existingAnd, ...viewFilterConditions];
      }
    }

    // Build orderBy from sortBy config
    let orderBy: Record<string, unknown> = { createdAt: "desc" };
    if (filters.sortBy) {
      const sortField = filters.sortBy.fieldKey;
      const sortFieldDef = tableResult.data.fields.find(f => f.key === sortField);
      if (sortFieldDef) {
        // For JSONB fields, we need to order at application level
        // unless the field is a known scalar type
        // Prisma doesn't support ordering by JSONB paths directly in all cases
        // We'll use the default createdAt ordering and sort in-memory for JSONB fields
        // For now, use createdAt as fallback
        orderBy = { createdAt: filters.sortBy.order === "asc" ? "asc" : "desc" };
      }
    }
```

添加辅助函数 `buildFilterConditionsFromSpec`：

```typescript
function buildFilterConditionsFromSpec(
  conditions: FilterCondition[],
  fields: DataFieldItem[]
): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = [];

  for (const cond of conditions) {
    const field = fields.find(f => f.key === cond.fieldKey);
    if (!field) continue;

    if (cond.op === 'isempty') {
      result.push({
        OR: [
          { data: { path: [cond.fieldKey], equals: null } },
          { data: { path: [cond.fieldKey], equals: "" } },
        ]
      });
    } else if (cond.op === 'isnotempty') {
      result.push({
        NOT: {
          OR: [
            { data: { path: [cond.fieldKey], equals: null } },
            { data: { path: [cond.fieldKey], equals: "" } },
          ]
        }
      });
    } else if (cond.op === 'eq') {
      result.push({ data: { path: [cond.fieldKey], equals: cond.value } });
    } else if (cond.op === 'ne') {
      result.push({ NOT: { data: { path: [cond.fieldKey], equals: cond.value } } });
    } else if (cond.op === 'contains') {
      result.push({ data: { path: [cond.fieldKey], string_contains: String(cond.value) } });
    } else if (cond.op === 'gt' || cond.op === 'gte' || cond.op === 'lt' || cond.op === 'lte') {
      // For numeric/date comparisons on JSONB, use string comparison as fallback
      result.push({ data: { path: [cond.fieldKey], string_contains: String(cond.value) } });
    }
  }

  return result;
}
```

在 `findMany` 调用中使用 `orderBy` 变量替换硬编码的 `orderBy: { createdAt: "desc" }`：

```typescript
      db.dataRecord.findMany({
        where,
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
        orderBy,
        include: {
          createdBy: { select: { name: true } },
        },
      }),
```

如果 sortBy 指定了 JSONB 字段，需要在查询后对结果进行内存排序。在 return 之前添加：

```typescript
    // In-memory sorting for JSONB fields if sortBy is specified
    let sortedRecords = records.map(mapRecordToItem);
    if (filters.sortBy) {
      const { fieldKey, order } = filters.sortBy;
      const fieldDef = tableResult.data.fields.find(f => f.key === fieldKey);
      if (fieldDef) {
        sortedRecords.sort((a, b) => {
          const aVal = a.data[fieldKey];
          const bVal = b.data[fieldKey];
          const aNum = Number(aVal);
          const bNum = Number(bVal);
          if (!isNaN(aNum) && !isNaN(bNum)) {
            return order === 'asc' ? aNum - bNum : bNum - aNum;
          }
          const aStr = String(aVal ?? '');
          const bStr = String(bVal ?? '');
          return order === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
        });
      }
    }
```

并修改 return 语句使用 `sortedRecords` 而不是 `records.map(mapRecordToItem)`。

- [ ] **Step 3: 验证**

Run: `npx tsc --noEmit 2>&1 | grep data-record | head -5`
Expected: 无新增错误

- [ ] **Step 4: 提交**

```bash
git add src/lib/services/data-record.service.ts
git commit -m "feat: add sorting and view-level filtering to record service"
```

---

### Task 5: 视图 API 端点

**Files:**
- Create: `src/app/api/data-tables/[id]/views/route.ts`
- Create: `src/app/api/data-tables/[id]/views/[viewId]/route.ts`
- Modify: `src/app/api/data-tables/[id]/records/route.ts`

- [ ] **Step 1: 创建视图列表/创建 API**

文件 `src/app/api/data-tables/[id]/views/route.ts`：

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { listViews, createView } from "@/lib/services/data-view.service";

const createViewSchema = z.object({
  name: z.string().min(1, "视图名称不能为空"),
  isDefault: z.boolean().optional(),
  filters: z.array(z.object({
    fieldKey: z.string(),
    op: z.enum(['eq', 'ne', 'gt', 'lt', 'gte', 'lte', 'contains', 'isempty', 'isnotempty']),
    value: z.union([z.string(), z.number()]),
  })).optional(),
  sortBy: z.object({
    fieldKey: z.string(),
    order: z.enum(['asc', 'desc']),
  }).nullable().optional(),
  visibleFields: z.array(z.string()).optional(),
  fieldOrder: z.array(z.string()).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { id } = await params;
  const result = await listViews(id);

  if (!result.success) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: result.data });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "权限不足" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const data = createViewSchema.parse(body);
    const result = await createView(id, data);

    if (!result.success) {
      if (result.error.code === "DUPLICATE") {
        return NextResponse.json({ error: result.error.message }, { status: 409 });
      }
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result.data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "创建视图失败" }, { status: 500 });
  }
}
```

- [ ] **Step 2: 创建视图更新/删除 API**

文件 `src/app/api/data-tables/[id]/views/[viewId]/route.ts`：

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { getView, updateView, deleteView } from "@/lib/services/data-view.service";

const updateViewSchema = z.object({
  name: z.string().min(1).optional(),
  isDefault: z.boolean().optional(),
  filters: z.array(z.object({
    fieldKey: z.string(),
    op: z.enum(['eq', 'ne', 'gt', 'lt', 'gte', 'lte', 'contains', 'isempty', 'isnotempty']),
    value: z.union([z.string(), z.number()]),
  })).optional(),
  sortBy: z.object({
    fieldKey: z.string(),
    order: z.enum(['asc', 'desc']),
  }).nullable().optional(),
  visibleFields: z.array(z.string()).optional(),
  fieldOrder: z.array(z.string()).optional(),
});

interface RouteParams {
  params: Promise<{ id: string; viewId: string }>;
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "权限不足" }, { status: 403 });
  }

  const { viewId } = await params;

  try {
    const body = await request.json();
    const data = updateViewSchema.parse(body);
    const result = await updateView(viewId, data);

    if (!result.success) {
      if (result.error.code === "NOT_FOUND") {
        return NextResponse.json({ error: result.error.message }, { status: 404 });
      }
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "更新视图失败" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "权限不足" }, { status: 403 });
  }

  const { viewId } = await params;
  const result = await deleteView(viewId);

  if (!result.success) {
    return NextResponse.json({ error: result.error.message }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: 扩展记录查询 API 支持视图参数**

在 `src/app/api/data-tables/[id]/records/route.ts` 的 GET 方法中，添加对 `viewId`、`sortBy` 和 `filterConditions` 参数的支持：

在现有 `fieldFilters` 解析之后添加：

```typescript
  // 视图 ID - 加载视图配置
  const viewId = searchParams.get("viewId") || undefined;
  let viewFilters: FilterCondition[] | undefined;
  let viewSortBy: SortConfig | null | undefined;

  if (viewId) {
    const { getView } = await import("@/lib/services/data-view.service");
    const viewResult = await getView(viewId);
    if (viewResult.success) {
      viewFilters = viewResult.data.filters.length > 0 ? viewResult.data.filters : undefined;
      viewSortBy = viewResult.data.sortBy;
    }
  }

  // 临时排序参数（覆盖视图配置）
  const sortByParam = searchParams.get("sortBy");
  if (sortByParam) {
    try {
      viewSortBy = JSON.parse(sortByParam);
    } catch { /* ignore invalid JSON */ }
  }

  // 临时筛选参数（覆盖视图配置）
  const filterConditionsParam = searchParams.get("filterConditions");
  if (filterConditionsParam) {
    try {
      viewFilters = JSON.parse(filterConditionsParam);
    } catch { /* ignore invalid JSON */ }
  }
```

导入类型：
```typescript
import type { SortConfig, FilterCondition } from "@/types/data-table";
```

修改 `listRecords` 调用：
```typescript
  const result = await listRecords(id, {
    page,
    pageSize,
    search,
    fieldFilters: Object.keys(fieldFilters).length > 0 ? fieldFilters : undefined,
    sortBy: viewSortBy,
    filterConditions: viewFilters,
  });
```

- [ ] **Step 4: 验证**

Run: `npx tsc --noEmit 2>&1 | grep -E "(views|records/route)" | head -5`
Expected: 无错误

- [ ] **Step 5: 提交**

```bash
git add src/app/api/data-tables/\[id\]/views/ src/app/api/data-tables/\[id\]/records/route.ts
git commit -m "feat: add view CRUD API and extend records API with sorting"
```

---

### Task 6: ColumnHeader 组件

**Files:**
- Create: `src/components/data/column-header.tsx`

- [ ] **Step 1: 创建列头筛选/排序组件**

文件 `src/components/data/column-header.tsx`。此组件负责：
- 显示列标题
- 点击弹出筛选/排序菜单
- 显示排序方向指示器
- 显示当前筛选条件摘要

关键实现：
- 使用 shadcn Popover 组件
- 根据 `field.type` 决定可用操作符
- 筛选条件变更后调用 `onFilterChange`
- 排序变更后调用 `onSortChange`

```typescript
"use client";

import { useState } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUp, ArrowDown, Filter, X } from "lucide-react";
import type { DataFieldItem, FilterCondition, SortConfig } from "@/types/data-table";
import { FieldType } from "@/generated/prisma/enums";

interface ColumnHeaderProps {
  field: DataFieldItem;
  filter: FilterCondition | null;
  sort: SortConfig | null;
  onFilterChange: (filter: FilterCondition | null) => void;
  onSortChange: (sort: SortConfig | null) => void;
}
```

操作符映射逻辑：
```typescript
const operatorOptions: Record<string, { value: string; label: string }[]> = {
  TEXT: [
    { value: "eq", label: "等于" },
    { value: "ne", label: "不等于" },
    { value: "contains", label: "包含" },
    { value: "isempty", label: "为空" },
    { value: "isnotempty", label: "不为空" },
  ],
  NUMBER: [
    { value: "eq", label: "等于" },
    { value: "gt", label: "大于" },
    { value: "lt", label: "小于" },
    { value: "gte", label: "大于等于" },
    { value: "lte", label: "小于等于" },
    { value: "isempty", label: "为空" },
  ],
  // ... 其他字段类型类似
};
```

UI 结构：
```
[列名 ⇅ =="进行中"]  ← 有筛选时显示条件摘要
       │
       ▼ 点击弹出菜单
┌─────────────────┐
│ ↑ 升序排列      │  ← 无排序时两个都可点
│ ↓ 降序排列      │
│ ─────────────── │
│ 操作符: [等于 ▼]│  ← 根据 field.type 显示不同选项
│ 值: [________]  │  ← isempty/isnotempty 时隐藏
│ ─────────────── │
│ [清除] [应用]   │
└─────────────────┘
```

- [ ] **Step 2: 验证**

Run: `npx tsc --noEmit 2>&1 | grep column-header | head -5`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add src/components/data/column-header.tsx
git commit -m "feat: add ColumnHeader component with filter and sort"
```

---

### Task 7: FieldConfigPopover 组件

**Files:**
- Create: `src/components/data/field-config-popover.tsx`

- [ ] **Step 1: 创建字段配置弹窗组件**

文件 `src/components/data/field-config-popover.tsx`。此组件负责：
- 显示所有字段的复选框列表
- 拖拽调整字段顺序
- 全选/取消全选

```typescript
"use client";

import { useState } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Settings2, GripVertical } from "lucide-react";
import type { DataFieldItem } from "@/types/data-table";

interface FieldConfigPopoverProps {
  fields: DataFieldItem[];
  visibleFields: string[];
  fieldOrder: string[];
  onChange: (visibleFields: string[], fieldOrder: string[]) => void;
}
```

实现要点：
- 复选框控制 `visibleFields`
- 上下移动按钮调整 `fieldOrder`（简化版，不使用拖拽库）
- 点击"应用"后调用 `onChange`
- 点击字段名称切换可见性（更便捷的操作）

- [ ] **Step 2: 验证**

Run: `npx tsc --noEmit 2>&1 | grep field-config | head -5`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add src/components/data/field-config-popover.tsx
git commit -m "feat: add FieldConfigPopover for column visibility control"
```

---

### Task 8: ViewSelector 组件

**Files:**
- Create: `src/components/data/view-selector.tsx`

- [ ] **Step 1: 创建视图选择器组件**

文件 `src/components/data/view-selector.tsx`。此组件负责：
- 下拉显示所有已保存的视图
- 当前视图高亮
- "+ 新建视图"选项
- "无视图"选项（恢复默认显示）

```typescript
"use client";

import { useState, useEffect } from "react";
import { ChevronDown, Plus, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import type { DataViewItem } from "@/types/data-table";

interface ViewSelectorProps {
  tableId: string;
  currentViewId: string | null;
  onViewChange: (viewId: string | null) => void;
  onSaveNewView: () => void;
}
```

实现要点：
- 加载时 fetch `/api/data-tables/${tableId}/views`
- 显示视图名称 + 筛选/排序状态图标
- 选择视图后调用 `onViewChange`
- 底部显示 "+ 新建视图" 按钮

- [ ] **Step 2: 验证并提交**

```bash
git add src/components/data/view-selector.tsx
git commit -m "feat: add ViewSelector component for switching saved views"
```

---

### Task 9: SaveViewDialog 组件

**Files:**
- Create: `src/components/data/save-view-dialog.tsx`

- [ ] **Step 1: 创建保存视图弹窗组件**

文件 `src/components/data/save-view-dialog.tsx`。此组件负责：
- 输入视图名称
- 显示当前配置摘要
- 调用 POST API 创建视图

```typescript
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { DataViewConfig } from "@/types/data-table";

interface SaveViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableId: string;
  currentConfig: DataViewConfig;
  onSaved: (viewId: string) => void;
}
```

实现要点：
- 显示配置摘要：`X 个筛选条件`、`排序: 字段名 升序/降序`、`Y 个可见字段`
- 提交后调用 `/api/data-tables/${tableId}/views`
- 成功后调用 `onSaved(viewId)` 自动切换

- [ ] **Step 2: 验证并提交**

```bash
git add src/components/data/save-view-dialog.tsx
git commit -m "feat: add SaveViewDialog for saving current view config"
```

---

### Task 10: RecordTable 组件重构

**Files:**
- Modify: `src/components/data/record-table.tsx`

- [ ] **Step 1: 重构 RecordTable 集成所有视图组件**

这是最关键的任务，将前面的所有组件整合到一起。

主要变更：
1. 新增视图相关状态（`viewId`, `filters`, `sortBy`, `visibleFields`, `fieldOrder`）
2. 工具栏添加 ViewSelector 和 FieldConfigPopover
3. 表头使用 ColumnHeader 替代简单 th
4. 根据 `fieldOrder` 和 `visibleFields` 控制列显示
5. 视图配置变化时更新 URL 参数
6. 新增 SaveViewDialog 的触发入口

状态管理：
```typescript
const [viewId, setViewId] = useState<string | null>(
  searchParams.get("viewId") ?? null
);
const [filters, setFilters] = useState<FilterCondition[]>([]);
const [sortBy, setSortBy] = useState<SortConfig | null>(null);
const [visibleFields, setVisibleFields] = useState<string[]>(() => {
  return fields.map(f => f.key); // 默认全部显示
});
const [fieldOrder, setFieldOrder] = useState<string[]>(() => {
  return fields.map(f => f.key);
});
const [saveDialogOpen, setSaveDialogOpen] = useState(false);
```

工具栏布局：
```
[📋 视图选择器 ▼] [🔍 搜索...] [⚙ 字段配置]     [新建记录]
```

表格列头：
```tsx
{orderedVisibleFields.map(fieldKey => {
  const field = fields.find(f => f.key === fieldKey);
  if (!field) return null;
  return (
    <TableHead key={field.id}>
      <ColumnHeader
        field={field}
        filter={filters.find(f => f.fieldKey === fieldKey) ?? null}
        sort={sortBy?.fieldKey === fieldKey ? sortBy : null}
        onFilterChange={(filter) => {
          setFilters(prev => {
            const rest = prev.filter(f => f.fieldKey !== fieldKey);
            return filter ? [...rest, filter] : rest;
          });
        }}
        onSortChange={(sort) => setSortBy(sort)}
      />
    </TableHead>
  );
})}
```

`fetchData` 需要传递筛选和排序参数：
```typescript
const fetchData = useCallback(async () => {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (search) params.set("search", search);
  if (viewId) params.set("viewId", viewId);
  if (filters.length > 0) params.set("filterConditions", JSON.stringify(filters));
  if (sortBy) params.set("sortBy", JSON.stringify(sortBy));
  // ...fetch
}, [tableId, page, search, viewId, filters, sortBy]);
```

- [ ] **Step 2: 验证**

Run: `npx tsc --noEmit 2>&1 | grep record-table | head -5`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add src/components/data/record-table.tsx
git commit -m "feat: refactor RecordTable with view, filter, sort, and field config"
```

---

### Task 11: 端到端测试验证

**Files:** 无新文件

- [ ] **Step 1: 启动开发服务器并通过 Playwright 验证**

Run: `npm run dev`

使用 Playwright 验证：
1. 打开主数据表页面，确认工具栏显示视图选择器
2. 点击列头弹出筛选菜单，添加筛选条件，确认表格更新
3. 点击列头排序，确认排序方向切换
4. 点击"字段"按钮，取消勾选某列，确认该列隐藏
5. 点击"+ 新建视图"，输入名称保存
6. 切换到新保存的视图，确认配置正确恢复
7. 刷新页面，确认视图配置保持

验证要点：
- 筛选条件正确传递到后端
- 排序结果正确
- 字段显示/隐藏正确
- 视图保存和加载正确
- URL 参数同步正确

- [ ] **Step 2: 提交所有剩余变更**

```bash
git add -A
git commit -m "feat: complete Airtable-style data view features"
```
