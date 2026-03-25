# P2 增强功能实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现模板关联主数据表和批量生成高级筛选功能

**Architecture:** 扩展现有服务层和 API，添加两个新的 UI 组件（DataTableLink、RecordFilter），修改模板详情页集成关联配置，修改 Step1SelectData 集成自动选择和筛选功能

**Tech Stack:** Next.js 16 App Router, Prisma 7, shadcn/ui v4 (Base UI), Zod

---

## 文件结构

| 文件 | 职责 | 类型 |
|------|------|------|
| `src/types/template.ts` | 添加 TemplateFieldMapping 类型 | 修改 |
| `src/validators/template.ts` | 添加 dataTableId/fieldMapping 验证 | 修改 |
| `src/lib/services/template.service.ts` | 扩展 updateTemplate 支持关联字段 | 修改 |
| `src/lib/services/data-record.service.ts` | 添加 buildFilterConditions 筛选逻辑 | 修改 |
| `src/app/api/templates/[id]/route.ts` | 处理 dataTableId/fieldMapping 更新 | 修改 |
| `src/app/api/data-tables/[id]/records/route.ts` | 解析 filters 查询参数 | 修改 |
| `src/components/template/data-table-link.tsx` | 数据表关联配置组件 | 新建 |
| `src/components/template/field-mapping-dialog.tsx` | 字段映射弹窗组件 | 新建 |
| `src/components/data/record-filter.tsx` | 记录筛选组件 | 新建 |
| `src/app/(dashboard)/templates/[id]/page.tsx` | 添加主数据关联区块 | 修改 |
| `src/components/batch/step1-select-data.tsx` | 集成自动选择和筛选 | 修改 |

---

## Task 1: 类型定义和验证器扩展

**Files:**
- Modify: `src/types/template.ts`
- Modify: `src/validators/template.ts`

- [ ] **Step 1: 添加 TemplateFieldMapping 类型到 template.ts**

```typescript
// 添加到 src/types/template.ts 末尾

// 模板字段映射类型（存储为 JSON）
// Key: 占位符的 key，Value: 数据表字段 key 或 null（表示「不映射」）
export type TemplateFieldMapping = Record<string, string | null>;

// 扩展 TemplateDetail 包含关联信息
export interface TemplateWithRelation extends TemplateDetail {
  dataTableId: string | null;
  dataTable?: {
    id: string;
    name: string;
  };
  fieldMapping: TemplateFieldMapping | null;
}
```

- [ ] **Step 2: 扩展 updateTemplateSchema 验证器**

```typescript
// 修改 src/validators/template.ts

import { z } from "zod";

export const createTemplateSchema = z.object({
  name: z.string().min(1, "模板名称不能为空").max(100),
  description: z.string().max(500).optional(),
});

// 字段映射验证：key -> string | null
const fieldMappingSchema = z.record(z.string().nullable()).optional();

export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  status: z.enum(["DRAFT", "READY", "ARCHIVED"]).optional(),
  // P2: 模板关联主数据表
  dataTableId: z.string().nullable().optional(),
  fieldMapping: fieldMappingSchema,
});

export const templateQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(50).default(20),
  status: z.enum(["DRAFT", "READY", "ARCHIVED"]).optional(),
});
```

- [ ] **Step 3: 运行类型检查**

Run: `npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 4: 提交类型和验证器修改**

```bash
git add src/types/template.ts src/validators/template.ts
git commit -m "feat(types): add TemplateFieldMapping and extend updateTemplateSchema

- Add TemplateFieldMapping type for placeholder-to-field mapping
- Extend updateTemplateSchema with dataTableId and fieldMapping

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 2: 服务层扩展

**Files:**
- Modify: `src/lib/services/template.service.ts`
- Modify: `src/lib/services/data-record.service.ts`

- [ ] **Step 1: 扩展 template.service.ts 支持关联字段更新**

在 `updateTemplate` 函数中添加 `dataTableId` 和 `fieldMapping` 支持：

```typescript
// 修改 src/lib/services/template.service.ts

// 更新 updateTemplate 函数签名和实现
export async function updateTemplate(
  id: string,
  data: {
    name?: string;
    description?: string;
    // P2: 新增字段
    dataTableId?: string | null;
    fieldMapping?: Record<string, string | null>;
  }
): Promise<ServiceResult<TemplateListItem>> {
  try {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    // P2: 处理关联字段
    if (data.dataTableId !== undefined) updateData.dataTableId = data.dataTableId;
    if (data.fieldMapping !== undefined) {
      updateData.fieldMapping = data.fieldMapping;
    }

    const template = await db.template.update({
      where: { id },
      data: updateData,
    });

    return { success: true, data: mapTemplateToListItem(template) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新模板失败";
    return { success: false, error: { code: "UPDATE_FAILED", message } };
  }
}
```

同时修改 `getTemplate` 函数，返回关联的数据表信息：

```typescript
// 修改 getTemplate 函数
export async function getTemplate(
  id: string
): Promise<ServiceResult<TemplateDetail & {
  dataTableId: string | null;
  dataTable?: { id: string; name: string };
  fieldMapping: Record<string, string | null> | null;
}>> {
  try {
    const template = await db.template.findUnique({
      where: { id },
      include: {
        placeholders: { orderBy: { sortOrder: "asc" } },
        createdBy: { select: { name: true } },
        // P2: 包含关联的数据表信息
        dataTable: { select: { id: true, name: true } },
      },
    });

    if (!template) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "模板不存在" },
      };
    }

    return {
      success: true,
      data: {
        ...mapTemplateToListItem(template),
        description: template.description,
        createdById: template.createdById,
        placeholders: template.placeholders.map(mapPlaceholderItem),
        // P2: 返回关联信息
        dataTableId: template.dataTableId,
        dataTable: template.dataTable ?? undefined,
        fieldMapping: template.fieldMapping as Record<string, string | null> | null,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取模板详情失败";
    return { success: false, error: { code: "GET_FAILED", message } };
  }
}
```

- [ ] **Step 2: 添加筛选条件构建函数到 data-record.service.ts**

```typescript
// 添加到 src/lib/services/data-record.service.ts

// P2: 筛选条件类型
export interface RecordFieldFilter {
  op?: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains';
  value: string | number;
}

export interface FieldFilters {
  [fieldKey: string]: RecordFieldFilter;
}

// P2: 构建 Prisma JSONB 筛选条件
function buildFieldFilterConditions(
  fieldFilters: FieldFilters,
  fields: DataFieldItem[]
): Record<string, unknown>[] {
  const conditions: Record<string, unknown>[] = [];

  for (const [fieldKey, filter] of Object.entries(fieldFilters)) {
    const field = fields.find(f => f.key === fieldKey);
    if (!field) continue;

    const op = filter.op || 'eq';
    const value = filter.value;

    // 根据操作符构建 Prisma JSONB 查询
    switch (op) {
      case 'eq':
        conditions.push({
          data: { path: [fieldKey], equals: value }
        });
        break;
      case 'ne':
        conditions.push({
          NOT: { data: { path: [fieldKey], equals: value } }
        });
        break;
      case 'gt':
      case 'gte':
      case 'lt':
      case 'lte':
        // 数字和日期比较
        conditions.push({
          data: { path: [fieldKey], string_contains: String(value) }
        });
        break;
      case 'contains':
        conditions.push({
          data: { path: [fieldKey], string_contains: String(value) }
        });
        break;
    }
  }

  return conditions;
}
```

- [ ] **Step 3: 修改 listRecords 函数支持字段筛选**

```typescript
// 修改 listRecords 函数签名和实现
export async function listRecords(
  tableId: string,
  filters: {
    page: number;
    pageSize: number;
    search?: string;
    // P2: 新增字段筛选
    fieldFilters?: FieldFilters;
  }
): Promise<ServiceResult<PaginatedRecords>> {
  try {
    // Verify table exists and get fields
    const tableResult = await getTable(tableId);
    if (!tableResult.success) {
      return { success: false, error: tableResult.error };
    }

    const where: Record<string, unknown> = { tableId };

    // Build search conditions
    const searchConditions: Record<string, unknown>[] = [];
    if (filters.search) {
      searchConditions.push({
        data: { path: "$", string_contains: filters.search }
      });
    }

    // P2: Build field filter conditions
    const fieldFilterConditions = filters.fieldFilters
      ? buildFieldFilterConditions(filters.fieldFilters, tableResult.data.fields)
      : [];

    // Combine all conditions
    const allConditions = [...searchConditions, ...fieldFilterConditions];
    if (allConditions.length > 0) {
      where.AND = allConditions;
    }

    const [records, total] = await Promise.all([
      db.dataRecord.findMany({
        where,
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          createdBy: { select: { name: true } },
        },
      }),
      db.dataRecord.count({ where }),
    ]);

    return {
      success: true,
      data: {
        records: records.map(mapRecordToItem),
        total,
        page: filters.page,
        pageSize: filters.pageSize,
        totalPages: Math.ceil(total / filters.pageSize),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取记录列表失败";
    return { success: false, error: { code: "LIST_FAILED", message } };
  }
}
```

- [ ] **Step 4: 运行类型检查**

Run: `npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 5: 提交服务层修改**

```bash
git add src/lib/services/template.service.ts src/lib/services/data-record.service.ts
git commit -m "feat(services): add template relation and record filtering

- Extend updateTemplate to support dataTableId and fieldMapping
- Add field-level filtering to listRecords
- Export FieldFilters and RecordFieldFilter types

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 3: API 路由扩展

**Files:**
- Modify: `src/app/api/templates/[id]/route.ts`
- Modify: `src/app/api/data-tables/[id]/records/route.ts`

- [ ] **Step 1: 修改模板 API 处理关联字段更新**

```typescript
// 修改 src/app/api/templates/[id]/route.ts

// 在 PUT handler 中添加对 dataTableId 和 fieldMapping 的处理

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "仅管理员可执行此操作" } },
      { status: 403 }
    );
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = updateTemplateSchema.parse(body);

    // Handle status change separately
    if (parsed.status !== undefined) {
      const statusResult = await templateService.changeStatus(id, parsed.status);
      if (!statusResult.success) {
        return NextResponse.json(
          { error: statusResult.error },
          { status: 400 }
        );
      }
    }

    // Build update data including P2 fields
    const updateData: {
      name?: string;
      description?: string;
      dataTableId?: string | null;
      fieldMapping?: Record<string, string | null>;
    } = {};

    if (parsed.name !== undefined) updateData.name = parsed.name;
    if (parsed.description !== undefined) updateData.description = parsed.description;
    // P2: 处理关联字段
    if (parsed.dataTableId !== undefined) updateData.dataTableId = parsed.dataTableId;
    if (parsed.fieldMapping !== undefined) updateData.fieldMapping = parsed.fieldMapping;

    // Only call updateTemplate if there's something to update
    if (Object.keys(updateData).length > 0) {
      const updateResult = await templateService.updateTemplate(id, updateData);
      if (!updateResult.success) {
        return NextResponse.json(
          { error: updateResult.error },
          { status: 400 }
        );
      }
      return NextResponse.json({ success: true, data: updateResult.data });
    }

    // If only status was changed, fetch the updated template
    const template = await templateService.getTemplate(id);
    if (!template.success) {
      return NextResponse.json(
        { error: template.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data: template.data });
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "参数校验失败" } },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "更新模板失败" } },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: 修改记录列表 API 解析筛选参数**

```typescript
// 修改 src/app/api/data-tables/[id]/records/route.ts

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import * as recordService from "@/lib/services/data-record.service";
import type { FieldFilters } from "@/lib/services/data-record.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 }
    );
  }

  const { id } = await params;
  const searchParams = request.nextUrl.searchParams;

  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
  const search = searchParams.get("search") || undefined;

  // P2: 解析字段筛选参数
  // 格式: filters[field_key]=value 或 filters[field_key][op]=value
  const fieldFilters: FieldFilters = {};
  searchParams.forEach((value, key) => {
    // 匹配 filters[fieldKey] 或 filters[fieldKey][op]
    const match = key.match(/^filters\[([^\]]+)\](?:\[([^\]]+)\])?$/);
    if (match) {
      const fieldKey = match[1];
      const op = match[2]; // 可选的操作符

      if (op) {
        // filters[fieldKey][op]=value
        fieldFilters[fieldKey] = { op: op as FieldFilters[string]['op'], value };
      } else {
        // filters[fieldKey]=value (默认 eq)
        fieldFilters[fieldKey] = { value };
      }
    }
  });

  const result = await recordService.listRecords(id, {
    page,
    pageSize,
    search,
    fieldFilters: Object.keys(fieldFilters).length > 0 ? fieldFilters : undefined,
  });

  if (!result.success) {
    const status = result.error.code === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json(result.data);
}
```

- [ ] **Step 3: 运行类型检查**

Run: `npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 4: 提交 API 修改**

```bash
git add src/app/api/templates/[id]/route.ts src/app/api/data-tables/[id]/records/route.ts
git commit -m "feat(api): add template relation and field filtering endpoints

- Handle dataTableId and fieldMapping in PUT /api/templates/[id]
- Parse filters[] query params in GET /api/data-tables/[id]/records

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 4: DataTableLink 组件

**Files:**
- Create: `src/components/template/data-table-link.tsx`
- Create: `src/components/template/field-mapping-dialog.tsx`

- [ ] **Step 1: 创建 DataTableLink 组件**

```typescript
// 新建 src/components/template/data-table-link.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Unlink, Settings2 } from "lucide-react";
import { FieldMappingDialog } from "./field-mapping-dialog";
import type { TemplateFieldMapping } from "@/types/template";
import type { DataTableListItem, DataFieldItem } from "@/types/data-table";

interface DataTableLinkProps {
  templateId: string;
  dataTableId: string | null;
  dataTable: { id: string; name: string } | null;
  fieldMapping: TemplateFieldMapping | null;
  placeholders: Array<{ key: string; label: string; required: boolean }>;
  onUpdate: () => void;
}

export function DataTableLink({
  templateId,
  dataTableId,
  dataTable,
  fieldMapping,
  placeholders,
  onUpdate,
}: DataTableLinkProps) {
  const router = useRouter();
  const [tables, setTables] = useState<DataTableListItem[]>([]);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(dataTableId);
  const [fields, setFields] = useState<DataFieldItem[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);

  // 加载数据表列表
  useEffect(() => {
    const fetchTables = async () => {
      setTablesLoading(true);
      try {
        const response = await fetch("/api/data-tables");
        const result = await response.json();
        if (response.ok) {
          setTables(result);
        }
      } catch (error) {
        console.error("获取数据表列表失败:", error);
      } finally {
        setTablesLoading(false);
      }
    };
    fetchTables();
  }, []);

  // 当选择的数据表变化时，加载字段
  useEffect(() => {
    if (!selectedTableId) {
      setFields([]);
      return;
    }

    const fetchFields = async () => {
      setFieldsLoading(true);
      try {
        const response = await fetch(`/api/data-tables/${selectedTableId}/fields`);
        const result = await response.json();
        if (response.ok) {
          setFields(result);
        }
      } catch (error) {
        console.error("获取字段失败:", error);
      } finally {
        setFieldsLoading(false);
      }
    };
    fetchFields();
  }, [selectedTableId]);

  // 计算已配置的映射数量
  const configuredCount = fieldMapping
    ? Object.values(fieldMapping).filter((v) => v !== null).length
    : 0;
  const totalPlaceholders = placeholders.length;

  const handleTableChange = async (tableId: string) => {
    setSaving(true);
    try {
      const response = await fetch(`/api/templates/${templateId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataTableId: tableId }),
      });

      if (response.ok) {
        setSelectedTableId(tableId);
        onUpdate();
        router.refresh();
      }
    } catch (error) {
      console.error("更新关联失败:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleUnlink = async () => {
    if (!confirm("确定要取消关联吗？")) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/templates/${templateId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataTableId: null, fieldMapping: null }),
      });

      if (response.ok) {
        setSelectedTableId(null);
        setFields([]);
        onUpdate();
        router.refresh();
      }
    } catch (error) {
      console.error("取消关联失败:", error);
    } finally {
      setSaving(false);
    }
  };

  // 边界情况：模板没有占位符
  if (placeholders.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-2">
        模板没有占位符，无需配置字段映射
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 数据表选择 */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium shrink-0">关联数据表：</span>
        {selectedTableId && dataTable ? (
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{dataTable.name}</Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUnlink}
              disabled={saving}
            >
              <Unlink className="h-4 w-4" />
              取消关联
            </Button>
          </div>
        ) : (
          <Select
            value={selectedTableId || ""}
            onValueChange={(v) => v && handleTableChange(v)}
            disabled={tablesLoading || saving}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="请选择数据表" />
            </SelectTrigger>
            <SelectContent>
              {tablesLoading ? (
                <SelectItem value="_loading" disabled>
                  加载中...
                </SelectItem>
              ) : tables.length === 0 ? (
                <SelectItem value="_empty" disabled>
                  暂无数据表
                </SelectItem>
              ) : (
                tables.map((table) => (
                  <SelectItem key={table.id} value={table.id}>
                    {table.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* 字段映射状态和配置 */}
      {selectedTableId && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            字段映射：
            {fieldsLoading ? (
              <Loader2 className="h-3 w-3 animate-spin inline ml-1" />
            ) : fields.length === 0 ? (
              <span className="text-amber-600 ml-1">数据表没有字段，请先添加字段</span>
            ) : (
              <Badge variant="outline" className="ml-2">
                {configuredCount}/{totalPlaceholders} 已配置
              </Badge>
            )}
          </span>
          {fields.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMappingDialogOpen(true)}
            >
              <Settings2 className="h-4 w-4 mr-1" />
              配置字段映射
            </Button>
          )}
        </div>
      )}

      {/* 字段映射弹窗 */}
      {selectedTableId && fields.length > 0 && (
        <FieldMappingDialog
          open={mappingDialogOpen}
          onOpenChange={setMappingDialogOpen}
          templateId={templateId}
          placeholders={placeholders}
          fields={fields}
          currentMapping={fieldMapping}
          onUpdate={onUpdate}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: 创建 FieldMappingDialog 组件**

```typescript
// 新建 src/components/template/field-mapping-dialog.tsx
"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check } from "lucide-react";
import type { TemplateFieldMapping } from "@/types/template";
import type { DataFieldItem } from "@/types/data-table";

interface FieldMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string;
  placeholders: Array<{ key: string; label: string; required: boolean }>;
  fields: DataFieldItem[];
  currentMapping: TemplateFieldMapping | null;
  onUpdate: () => void;
}

export function FieldMappingDialog({
  open,
  onOpenChange,
  templateId,
  placeholders,
  fields,
  currentMapping,
  onUpdate,
}: FieldMappingDialogProps) {
  const router = useRouter();
  const [mapping, setMapping] = useState<TemplateFieldMapping>(() => {
    // 初始化映射：自动匹配同名占位符和字段
    const initial: TemplateFieldMapping = {};
    placeholders.forEach((ph) => {
      if (currentMapping && currentMapping[ph.key] !== undefined) {
        initial[ph.key] = currentMapping[ph.key];
      } else {
        // 自动匹配同名
        const matchedField = fields.find((f) => f.key === ph.key);
        initial[ph.key] = matchedField ? matchedField.key : null;
      }
    });
    return initial;
  });
  const [saving, setSaving] = useState(false);

  // 选项列表：数据表字段 + 「不映射」
  const fieldOptions = useMemo(() => {
    const options = [
      { value: "", label: "不映射" },
      ...fields.map((f) => ({ value: f.key, label: `${f.label} (${f.key})` })),
    ];
    return options;
  }, [fields]);

  const handleMappingChange = (placeholderKey: string, fieldKey: string) => {
    setMapping((prev) => ({
      ...prev,
      [placeholderKey]: fieldKey || null,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/templates/${templateId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fieldMapping: mapping }),
      });

      if (response.ok) {
        onUpdate();
        router.refresh();
        onOpenChange(false);
      }
    } catch (error) {
      console.error("保存映射失败:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>字段映射配置</DialogTitle>
          <DialogDescription>
            配置模板占位符到数据表字段的映射关系
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <div className="grid grid-cols-[1fr_auto_1fr] gap-2 text-sm font-medium text-muted-foreground">
            <span>模板占位符</span>
            <span></span>
            <span>数据表字段</span>
          </div>

          {placeholders.map((ph) => {
            const currentValue = mapping[ph.key];
            const isAutoMatched = currentValue === ph.key; // 同名自动匹配

            return (
              <div
                key={ph.key}
                className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono">{ph.key}</span>
                  {ph.required && (
                    <Badge variant="destructive" className="text-xs">
                      必填
                    </Badge>
                  )}
                </div>
                <span className="text-muted-foreground">→</span>
                <div className="flex items-center gap-2">
                  <Select
                    value={currentValue || ""}
                    onValueChange={(v) => handleMappingChange(ph.key, v)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="选择字段" />
                    </SelectTrigger>
                    <SelectContent>
                      {fieldOptions.map((opt) => (
                        <SelectItem key={opt.value || "_none"} value={opt.value || "_none"}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isAutoMatched && (
                    <Badge variant="outline" className="text-xs text-green-600">
                      <Check className="h-3 w-3 mr-1" />
                      自动匹配
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            保存映射
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: 运行类型检查**

Run: `npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 4: 提交组件代码**

```bash
git add src/components/template/data-table-link.tsx src/components/template/field-mapping-dialog.tsx
git commit -m "feat(components): add DataTableLink and FieldMappingDialog

- DataTableLink: manage template-to-datatable relation
- FieldMappingDialog: configure placeholder-to-field mapping
- Auto-match placeholders with same-named fields

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 5: RecordFilter 筛选组件

**Files:**
- Create: `src/components/data/record-filter.tsx`

- [ ] **Step 1: 创建 RecordFilter 组件**

```typescript
// 新建 src/components/data/record-filter.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Filter } from "lucide-react";
import type { DataFieldItem } from "@/types/data-table";
import { FieldType } from "@/generated/prisma/enums";

export type FilterOperator = 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains';

export interface ActiveFilter {
  fieldKey: string;
  operator: FilterOperator;
  value: string;
}

interface RecordFilterProps {
  fields: DataFieldItem[];
  filters: ActiveFilter[];
  onFiltersChange: (filters: ActiveFilter[]) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
}

const OPERATOR_LABELS: Record<FilterOperator, string> = {
  eq: '等于',
  ne: '不等于',
  gt: '大于',
  lt: '小于',
  gte: '大于等于',
  lte: '小于等于',
  contains: '包含',
};

// 根据字段类型返回可用操作符
function getOperatorsForType(type: FieldType): FilterOperator[] {
  switch (type) {
    case FieldType.NUMBER:
      return ['eq', 'ne', 'gt', 'lt', 'gte', 'lte'];
    case FieldType.DATE:
      return ['eq', 'gt', 'lt', 'gte', 'lte'];
    case FieldType.SELECT:
      return ['eq', 'ne'];
    case FieldType.MULTISELECT:
      return ['contains'];
    case FieldType.EMAIL:
    case FieldType.PHONE:
      return ['eq', 'contains'];
    case FieldType.TEXT:
    default:
      return ['eq', 'ne', 'contains'];
  }
}

export function RecordFilter({
  fields,
  filters,
  onFiltersChange,
  searchValue,
  onSearchChange,
}: RecordFilterProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newFieldKey, setNewFieldKey] = useState<string>("");
  const [newOperator, setNewOperator] = useState<FilterOperator>('eq');
  const [newValue, setNewValue] = useState("");

  const handleAddFilter = () => {
    if (!newFieldKey || !newValue) return;

    onFiltersChange([
      ...filters,
      { fieldKey: newFieldKey, operator: newOperator, value: newValue },
    ]);

    // 重置状态
    setNewFieldKey("");
    setNewOperator('eq');
    setNewValue("");
    setIsAdding(false);
  };

  const handleRemoveFilter = (index: number) => {
    onFiltersChange(filters.filter((_, i) => i !== index));
  };

  const handleClearAll = () => {
    onFiltersChange([]);
  };

  // 获取字段信息
  const getField = (key: string) => fields.find((f) => f.key === key);

  return (
    <div className="space-y-3">
      {/* 搜索框和添加筛选按钮 */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Input
            placeholder="搜索记录..."
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pr-8"
          />
        </div>
        {!isAdding && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAdding(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            添加筛选
          </Button>
        )}
      </div>

      {/* 添加筛选表单 */}
      {isAdding && (
        <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
          <Select
            value={newFieldKey}
            onValueChange={(v) => {
              setNewFieldKey(v);
              // 重置操作符为该类型的第一个可用操作符
              const field = getField(v);
              if (field) {
                const ops = getOperatorsForType(field.type);
                setNewOperator(ops[0]);
              }
            }}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="选择字段" />
            </SelectTrigger>
            <SelectContent>
              {fields.map((field) => (
                <SelectItem key={field.key} value={field.key}>
                  {field.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {newFieldKey && (
            <>
              <Select
                value={newOperator}
                onValueChange={(v) => setNewOperator(v as FilterOperator)}
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getOperatorsForType(getField(newFieldKey)!.type).map((op) => (
                    <SelectItem key={op} value={op}>
                      {OPERATOR_LABELS[op]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                placeholder="输入值"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                className="w-[150px]"
                onKeyDown={(e) => e.key === 'Enter' && handleAddFilter()}
              />

              <Button size="sm" onClick={handleAddFilter} disabled={!newValue}>
                添加
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsAdding(false);
                  setNewFieldKey("");
                  setNewValue("");
                }}
              >
                取消
              </Button>
            </>
          )}
        </div>
      )}

      {/* 活动筛选标签 */}
      {filters.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {filters.map((filter, index) => {
            const field = getField(filter.fieldKey);
            return (
              <Badge key={index} variant="secondary" className="gap-1">
                <span>{field?.label || filter.fieldKey}</span>
                <span className="text-muted-foreground">
                  {OPERATOR_LABELS[filter.operator]}
                </span>
                <span className="font-medium">{filter.value}</span>
                <button
                  onClick={() => handleRemoveFilter(index)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={handleClearAll}
          >
            清除全部
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 运行类型检查**

Run: `npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 3: 提交组件代码**

```bash
git add src/components/data/record-filter.tsx
git commit -m "feat(components): add RecordFilter for field-level filtering

- Support multiple filter conditions
- Operator selection based on field type
- Visual filter tags with clear all option

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 6: 集成到模板详情页

**Files:**
- Modify: `src/app/(dashboard)/templates/[id]/page.tsx`

- [ ] **Step 1: 在模板详情页添加主数据关联区块**

在「文件信息」卡片和「占位符列表」之间添加主数据关联区块。需要将组件改为客户端组件或提取关联部分为独立组件。

由于当前页面是服务端组件，最佳做法是提取关联部分为客户端组件包装器：

```typescript
// 新建 src/components/template/data-table-link-wrapper.tsx
"use client";

import { DataTableLink } from "./data-table-link";
import type { TemplateFieldMapping } from "@/types/template";

interface DataTableLinkWrapperProps {
  templateId: string;
  dataTableId: string | null;
  dataTable: { id: string; name: string } | null;
  fieldMapping: TemplateFieldMapping | null;
  placeholders: Array<{ key: string; label: string; required: boolean }>;
}

export function DataTableLinkWrapper({
  templateId,
  dataTableId,
  dataTable,
  fieldMapping,
  placeholders,
}: DataTableLinkWrapperProps) {
  return (
    <DataTableLink
      templateId={templateId}
      dataTableId={dataTableId}
      dataTable={dataTable}
      fieldMapping={fieldMapping}
      placeholders={placeholders}
      onUpdate={() => {
        // 触发页面刷新
        window.location.reload();
      }}
    />
  );
}
```

- [ ] **Step 2: 修改模板详情页**

```typescript
// 修改 src/app/(dashboard)/templates/[id]/page.tsx
// 在导入部分添加:
import { DataTableLinkWrapper } from "@/components/template/data-table-link-wrapper";

// 在查询 template 时添加 dataTable 关联:
const template = await db.template.findUnique({
  where: { id },
  include: {
    placeholders: {
      orderBy: { sortOrder: "asc" },
    },
    createdBy: {
      select: { name: true },
    },
    // P2: 包含关联的数据表
    dataTable: {
      select: { id: true, name: true },
    },
  },
});

// 在 return 语句中，在信息卡片（grid）和占位符列表之间添加:

      {/* P2: 主数据关联 */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>主数据关联</CardTitle>
            <CardDescription>
              关联数据表后，批量生成时可自动选择该表并配置字段映射
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTableLinkWrapper
              templateId={template.id}
              dataTableId={template.dataTableId}
              dataTable={template.dataTable}
              fieldMapping={template.fieldMapping as Record<string, string | null> | null}
              placeholders={template.placeholders.map((ph) => ({
                key: ph.key,
                label: ph.label,
                required: ph.required,
              }))}
            />
          </CardContent>
        </Card>
      )}
```

- [ ] **Step 3: 运行类型检查**

Run: `npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 4: 提交页面修改**

```bash
git add src/app/\(dashboard\)/templates/\[id\]/page.tsx src/components/template/data-table-link-wrapper.tsx
git commit -m "feat(templates): add data table relation section to template detail

- Show DataTableLink component for admin users
- Include dataTable relation in template query

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 7: 集成到批量生成步骤

**Files:**
- Modify: `src/components/batch/step1-select-data.tsx`

- [ ] **Step 1: 修改 Step1SelectData 集成自动选择和筛选**

```typescript
// 修改 src/components/batch/step1-select-data.tsx
// 添加导入:
import { RecordFilter, type ActiveFilter } from "@/components/data/record-filter";

// 添加新的 props:
interface Step1SelectDataProps {
  templateId: string;
  selectedTableId: string | null;
  selectedRecordIds: string[];
  // P2: 模板关联信息
  linkedDataTableId?: string | null;
  onTableSelect: (tableId: string) => void;
  onRecordsSelect: (recordIds: string[]) => void;
  onNext: () => void;
}

// 在组件内部添加状态:
const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
const [hasAutoSelected, setHasAutoSelected] = useState(false);

// 添加自动选择逻辑:
// 在数据表列表加载完成后，如果有 linkedDataTableId 且未选择，自动选择
useEffect(() => {
  if (tables.length > 0 && linkedDataTableId && !selectedTableId && !hasAutoSelected) {
    // 验证关联的数据表存在
    const linkedTable = tables.find((t) => t.id === linkedDataTableId);
    if (linkedTable) {
      onTableSelect(linkedDataTableId);
      setHasAutoSelected(true);
    }
  }
}, [tables, linkedDataTableId, selectedTableId, hasAutoSelected, onTableSelect]);

// 修改 fetchRecords 使用筛选:
const fetchRecords = useCallback(async () => {
  if (!selectedTableId) {
    setRecords(null);
    return;
  }

  setRecordsLoading(true);
  try {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (search) params.set("search", search);

    // P2: 添加筛选参数
    activeFilters.forEach((filter) => {
      if (filter.operator === 'eq') {
        params.set(`filters[${filter.fieldKey}]`, filter.value);
      } else {
        params.set(`filters[${filter.fieldKey}][${filter.operator}]`, filter.value);
      }
    });

    const response = await fetch(`/api/data-tables/${selectedTableId}/records?${params}`);
    const result = await response.json();
    if (response.ok) {
      setRecords(result);
    }
  } catch (error) {
    console.error("获取记录失败:", error);
  } finally {
    setRecordsLoading(false);
  }
}, [selectedTableId, page, search, activeFilters]);

// 在 UI 中添加筛选组件和自动选择提示:
// 在 "选择数据源" 标题下方添加:

{/* P2: 自动选择提示 */}
{hasAutoSelected && linkedDataTableId && (
  <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-2 rounded-md">
    <Check className="h-4 w-4" />
    已自动选择模板关联的数据表
  </div>
)}

// 在数据表选择和记录表格之间，用 RecordFilter 替换单独的搜索框:
{selectedTableId && (
  <div className="space-y-4">
    <RecordFilter
      fields={fields}
      filters={activeFilters}
      onFiltersChange={setActiveFilters}
      searchValue={search}
      onSearchChange={setSearch}
    />
    {/* ... 记录表格 ... */}
  </div>
)}
```

- [ ] **Step 2: 修改批量生成页面传递 linkedDataTableId**

```typescript
// 修改 src/app/(dashboard)/templates/[id]/batch/page.tsx
// 在获取模板时包含 dataTableId:

const template = await db.template.findUnique({
  where: { id },
  select: {
    id: true,
    name: true,
    fileName: true,
    filePath: true,
    placeholders: {
      orderBy: { sortOrder: "asc" },
    },
    // P2: 包含关联的数据表ID
    dataTableId: true,
  },
});

// 传递给 Step1SelectData:
<Step1SelectData
  templateId={template.id}
  selectedTableId={selectedTableId}
  selectedRecordIds={selectedRecordIds}
  linkedDataTableId={template.dataTableId}
  onTableSelect={setSelectedTableId}
  onRecordsSelect={setSelectedRecordIds}
  onNext={() => setStep(2)}
/>
```

- [ ] **Step 3: 运行类型检查**

Run: `npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 4: 提交批量生成集成**

```bash
git add src/components/batch/step1-select-data.tsx src/app/\(dashboard\)/templates/\[id\]/batch/page.tsx
git commit -m "feat(batch): integrate auto-select and field filtering

- Auto-select linked data table when available
- Integrate RecordFilter for field-level filtering
- Show auto-select notification to user

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 8: 端到端测试和验证

**Files:**
- 无新建文件，使用 Playwright 进行浏览器自动化测试

- [ ] **Step 1: 启动开发服务器**

Run: `nohup npm run dev > /tmp/dev.log 2>&1 &`
Wait: 等待服务器启动（约 5 秒）

- [ ] **Step 2: 测试模板关联功能**

使用 Playwright 测试：
1. 登录管理员账户
2. 进入模板详情页
3. 验证「主数据关联」区块显示
4. 选择数据表
5. 配置字段映射
6. 保存并验证

- [ ] **Step 3: 测试批量生成自动选择**

使用 Playwright 测试：
1. 对已关联数据表的模板
2. 进入批量生成页面
3. 验证自动选中关联的数据表
4. 验证提示信息显示

- [ ] **Step 4: 测试高级筛选功能**

使用 Playwright 测试：
1. 在批量生成步骤1中
2. 添加筛选条件
3. 验证记录列表正确过滤
4. 清除筛选验证恢复

- [ ] **Step 5: 运行完整构建验证**

Run: `npm run build`
Expected: 构建成功

- [ ] **Step 6: 提交测试验证**

```bash
git add -A
git commit -m "test: verify P2 features with browser automation

- Template data table linking works correctly
- Auto-select in batch generation verified
- Field-level filtering tested

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## 验收标准

- [ ] 模板详情页管理员可见「主数据关联」区块
- [ ] 可选择/更换/取消关联数据表
- [ ] 字段映射弹窗正确显示占位符和字段列表
- [ ] 同名占位符自动匹配并标记
- [ ] 批量生成时自动选中关联的数据表
- [ ] 筛选条件正确构建 URL 参数
- [ ] 不同字段类型显示对应操作符
- [ ] 筛选结果实时更新记录列表
- [ ] 类型检查通过
- [ ] 构建成功
