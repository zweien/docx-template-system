# 单条生成数据选择器实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现模板填写表单（单条生成）时的数据选择与自动填充功能，支持占位符绑定数据表字段，选择记录后自动填充关联字段。

**Architecture:** 扩展 Placeholder 模型添加数据源绑定字段，新建数据选择器弹窗组件，修改填写表单集成选择器，实现级联解析 API 处理自动填充逻辑。

**Tech Stack:** Next.js 16 + Prisma 7 + shadcn/ui (Base UI) + Playwright (浏览器自动化测试)

---

## 文件结构

| 文件路径 | 操作 | 职责 |
|---------|------|------|
| `prisma/schema.prisma` | 修改 | 添加占位符数据源字段 |
| `src/types/placeholder.ts` | 修改 | 添加数据源绑定类型 |
| `src/validators/placeholder.ts` | 修改 | 添加数据源绑定验证 |
| `src/lib/services/placeholder.service.ts` | 修改 | 扩展占位符服务 |
| `src/app/api/placeholders/[id]/route.ts` | **新建** | 占位符更新 API（支持数据源绑定） |
| `src/app/api/placeholders/[id]/source-tables/route.ts` | 新建 | 获取可绑定数据表列表 |
| `src/app/api/placeholders/[id]/picker-data/route.ts` | 新建 | 数据选择器数据 API |
| `src/app/api/fill/resolve-cascade/route.ts` | 新建 | 级联解析 API |
| `src/components/forms/data-picker-dialog.tsx` | 新建 | 数据选择器弹窗组件 |
| `src/components/forms/dynamic-form.tsx` | 修改 | 填写表单集成选择器 |
| `src/components/templates/placeholder-config-table.tsx` | 修改 | 占位符配置表格 |

---

### Task 1: 扩展 Placeholder 数据模型

**Files:**
- Modify: `prisma/schema.prisma:69-82`
- Modify: `src/types/placeholder.ts`
- Modify: `src/validators/placeholder.ts`

- [ ] **Step 1: 修改 Prisma Schema**

```prisma
model Placeholder {
  id             String          @id @default(cuid())
  key            String
  label          String
  inputType      PlaceholderType @default(TEXT)
  required       Boolean         @default(false)
  defaultValue   String?
  sortOrder      Int             @default(0)
  templateId     String
  template       Template        @relation(fields: [templateId], references: [id], onDelete: Cascade)

  // 数据源绑定（新增）
  sourceTableId  String?
  sourceField    String?
  enablePicker   Boolean         @default(false)

  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  @@unique([templateId, key])
}
```

- [ ] **Step 2: 推送数据库变更并重新生成 Prisma Client**

Run: `npx prisma db push && npx prisma generate`
Expected: Schema pushed to database, Prisma Client regenerated

- [ ] **Step 3: 更新类型定义**

在 `src/types/placeholder.ts` 添加：

```typescript
export interface PlaceholderWithSource {
  id: string;
  key: string;
  label: string;
  inputType: string;
  required: boolean;
  defaultValue: string | null;
  sortOrder: number;
  sourceTableId: string | null;
  sourceField: string | null;
  enablePicker: boolean;
}
```

- [ ] **Step 4: 更新验证器**

在 `src/validators/placeholder.ts` 添加数据源绑定验证：

```typescript
export const updatePlaceholderSourceSchema = z.object({
  sourceTableId: z.string().nullable(),
  sourceField: z.string().nullable(),
  enablePicker: z.boolean().default(false),
});
```

- [ ] **Step 5: 提交**

```bash
git add prisma/schema.prisma src/types/placeholder.ts src/validators/placeholder.ts
git commit -m "feat: add source binding fields to Placeholder model"
```

---

### Task 2: 扩展占位符服务并创建 API

**Files:**
- Modify: `src/lib/services/placeholder.service.ts`
- Create: `src/app/api/placeholders/[id]/route.ts`
- Create: `src/app/api/placeholders/[id]/source-tables/route.ts`

- [ ] **Step 1: 扩展占位符服务**

在 `src/lib/services/placeholder.service.ts` 添加更新方法：

```typescript
import { db } from "@/lib/db";

export async function updatePlaceholderSource(
  id: string,
  data: { sourceTableId?: string | null; sourceField?: string | null; enablePicker?: boolean }
) {
  return db.placeholder.update({
    where: { id },
    data: {
      sourceTableId: data.sourceTableId,
      sourceField: data.sourceField,
      enablePicker: data.enablePicker,
    },
  });
}

export async function getPlaceholderById(id: string) {
  return db.placeholder.findUnique({
    where: { id },
  });
}
```

- [ ] **Step 2: 创建占位符 API 路由（新建文件）**

创建 `src/app/api/placeholders/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { updatePlaceholderSource } from "@/lib/services/placeholder.service";
import { updatePlaceholderSourceSchema } from "@/validators/placeholder";
import { ZodError } from "zod";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const validated = updatePlaceholderSourceSchema.parse(body);

    const result = await updatePlaceholderSource(id, validated);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      const errorMessages = error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
      return NextResponse.json(
        { error: `数据验证失败: ${errorMessages}` },
        { status: 400 }
      );
    }
    console.error("更新占位符数据源失败:", error);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}
```

- [ ] **Step 3: 创建获取可绑定数据表 API**

创建 `src/app/api/placeholders/[id]/source-tables/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listTables, getTable } from "@/lib/services/data-table.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  // 获取数据表列表
  const listResult = await listTables();

  if (!listResult.success) {
    return NextResponse.json({ error: listResult.error.message }, { status: 500 });
  }

  // 为每个表获取完整信息（包含字段）
  const tablesWithFields = await Promise.all(
    listResult.data.map(async (t) => {
      const detailResult = await getTable(t.id);
      return {
        id: t.id,
        name: t.name,
        fields: detailResult.success ? detailResult.data.fields : [],
      };
    })
  );

  return NextResponse.json(tablesWithFields);
}
```

- [ ] **Step 4: 运行单元测试**

Run: `npm run test:run`
Expected: All tests pass

- [ ] **Step 5: 提交**

```bash
git add src/lib/services/placeholder.service.ts src/app/api/placeholders/[id]/route.ts src/app/api/placeholders/[id]/source-tables/route.ts
git commit -m "feat: add placeholder source binding API endpoints"
```

---

### Task 3: 创建数据选择器 API

**Files:**
- Create: `src/app/api/placeholders/[id]/picker-data/route.ts`
- Create: `src/app/api/fill/resolve-cascade/route.ts`

- [ ] **Step 1: 创建数据选择器数据 API**

创建 `src/app/api/placeholders/[id]/picker-data/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPlaceholderById } from "@/lib/services/placeholder.service";
import { listRecords } from "@/lib/services/data-record.service";
import { recordQuerySchema } from "@/validators/data-table";
import { ZodError } from "zod";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { id } = await params;

  // 获取占位符信息
  const placeholder = await getPlaceholderById(id);
  if (!placeholder || !placeholder.sourceTableId) {
    return NextResponse.json({ error: "占位符未绑定数据表" }, { status: 400 });
  }

  // 解析查询参数
  const { searchParams } = new URL(request.url);
  try {
    const query = recordQuerySchema.parse({
      search: searchParams.get("search") || undefined,
      page: searchParams.get("page") || "1",
      pageSize: searchParams.get("pageSize") || "10",
    });

    const result = await listRecords(placeholder.sourceTableId, {
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    return NextResponse.json({
      records: result.data.records,
      total: result.data.total,
      page: result.data.page,
      pageSize: result.data.pageSize,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: `参数验证失败: ${error.issues.map((e) => e.message).join(", ")}` },
        { status: 400 }
      );
    }
    console.error("获取选择器数据失败:", error);
    return NextResponse.json({ error: "获取数据失败" }, { status: 500 });
  }
}
```

- [ ] **Step 2: 创建级联解析 API**

创建 `src/app/api/fill/resolve-cascade/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  try {
    const { templateId, sourceTableId, recordId } = await request.json();

    if (!templateId || !sourceTableId || !recordId) {
      return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
    }

    // 1. 获取模板所有占位符绑定信息
    const placeholders = await db.placeholder.findMany({
      where: { templateId },
      select: {
        key: true,
        sourceTableId: true,
        sourceField: true,
      },
    });

    // 2. 获取选中的记录数据
    const record = await db.dataRecord.findUnique({
      where: { id: recordId },
      select: { data: true },
    });

    if (!record) {
      return NextResponse.json({ error: "记录不存在" }, { status: 404 });
    }

    // 3. 构建返回数据
    const result: Record<string, unknown> = {};

    for (const ph of placeholders) {
      if (ph.sourceTableId === sourceTableId && ph.sourceField) {
        // 同表直接取值
        result[ph.key] = (record.data as Record<string, unknown>)?.[ph.sourceField] ?? "";
      }
    }

    // Phase 1 只实现同表自动填充，关联字段级联查询在 Phase 2 实现

    return NextResponse.json(result);
  } catch (error) {
    console.error("解析级联数据失败:", error);
    return NextResponse.json({ error: "解析级联数据失败" }, { status: 500 });
  }
}
```

- [ ] **Step 3: 运行单元测试**

Run: `npm run test:run`
Expected: All tests pass

- [ ] **Step 4: 提交**

```bash
git add src/app/api/placeholders/[id]/picker-data/route.ts src/app/api/fill/resolve-cascade/route.ts
git commit -m "feat: add picker data and cascade resolve APIs"
```

---

### Task 4: 创建数据选择器弹窗组件

**Files:**
- Create: `src/components/forms/data-picker-dialog.tsx`

- [ ] **Step 1: 创建数据选择器弹窗组件**

创建 `src/components/forms/data-picker-dialog.tsx`:

```typescript
"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface DataField {
  id: string;
  key: string;
  label: string;
  type: string;
}

interface DataRecordItem {
  id: string;
  data: Record<string, unknown>;
}

// 注意：使用 placeholderId 而非 tableId，通过 API 获取绑定的数据表数据
interface DataPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placeholderId: string;
  displayField: string;
  fields: DataField[];
  searchPlaceholder?: string;
  onSelect: (record: DataRecordItem) => void;
}

export function DataPickerDialog({
  open,
  onOpenChange,
  placeholderId,
  displayField,
  fields,
  searchPlaceholder = "搜索...",
  onSelect,
}: DataPickerDialogProps) {
  const [search, setSearch] = useState("");
  const [records, setRecords] = useState<DataRecordItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 加载数据
  useEffect(() => {
    if (!open) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: "10",
        });
        if (search) params.set("search", search);

        const res = await fetch(`/api/placeholders/${placeholderId}/picker-data?${params}`);
        if (!res.ok) throw new Error("获取数据失败");

        const data = await res.json();
        setRecords(data.records);
        setTotal(data.total);
      } catch (error) {
        console.error("获取数据失败:", error);
        toast.error("获取数据失败");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [open, placeholderId, page, search]);

  // 重置状态
  useEffect(() => {
    if (!open) {
      setSearch("");
      setPage(1);
      setSelectedId(null);
    }
  }, [open]);

  const handleConfirm = () => {
    const selected = records.find((r) => r.id === selectedId);
    if (selected) {
      onSelect(selected);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>选择数据</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>

        <ScrollArea className="flex-1 border rounded-md">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : records.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              暂无数据
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  {fields.slice(0, 5).map((field) => (
                    <TableHead key={field.id}>{field.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow
                    key={record.id}
                    className={selectedId === record.id ? "bg-muted" : "cursor-pointer"}
                    onClick={() => setSelectedId(record.id)}
                  >
                    <TableCell>
                      <input
                        type="radio"
                        checked={selectedId === record.id}
                        onChange={() => setSelectedId(record.id)}
                      />
                    </TableCell>
                    {fields.slice(0, 5).map((field) => (
                      <TableCell key={field.id}>
                        {String(record.data[field.key] ?? "")}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>

        {total > 10 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>共 {total} 条记录</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                上一页
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page * 10 >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                下一页
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedId}>
            确认选择
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: 运行构建验证**

Run: `npm run build`
Expected: Build succeeds without errors

- [ ] **Step 3: 提交**

```bash
git add src/components/forms/data-picker-dialog.tsx
git commit -m "feat: add DataPickerDialog component"
```

---

### Task 5: 修改占位符配置表格（添加数据源绑定）

**Files:**
- Modify: `src/components/templates/placeholder-config-table.tsx`

- [ ] **Step 1: 读取现有配置表格代码**

Run: Read `src/components/templates/placeholder-config-table.tsx` to understand current structure.

- [ ] **Step 2: 添加数据源绑定 UI**

在配置表格的编辑对话框中添加：
- 「启用数据选择」开关
- 「数据来源表」下拉框（选择后启用）
- 「数据字段」下拉框（根据选择的表动态加载）

关键代码：

```typescript
// 添加状态
const [enablePicker, setEnablePicker] = useState(placeholder?.enablePicker ?? false);
const [sourceTableId, setSourceTableId] = useState<string | null>(placeholder?.sourceTableId ?? null);
const [sourceField, setSourceField] = useState<string | null>(placeholder?.sourceField ?? null);
const [availableTables, setAvailableTables] = useState<DataTable[]>([]);
const [selectedTableFields, setSelectedTableFields] = useState<DataField[]>([]);

// 加载可绑定数据表
useEffect(() => {
  if (!enablePicker || !placeholder?.id) return;
  fetch(`/api/placeholders/${placeholder.id}/source-tables`)
    .then((res) => res.json())
    .then(setAvailableTables)
    .catch(console.error);
}, [enablePicker, placeholder?.id]);

// 加载选中表的字段
useEffect(() => {
  if (!sourceTableId) {
    setSelectedTableFields([]);
    return;
  }
  const table = availableTables.find((t) => t.id === sourceTableId);
  if (table) {
    setSelectedTableFields(table.fields);
  }
}, [sourceTableId, availableTables]);

// 保存时更新数据源绑定
const handleSaveSource = async () => {
  await fetch(`/api/placeholders/${placeholder.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sourceTableId,
      sourceField,
      enablePicker,
    }),
  });
};
```

- [ ] **Step 3: 浏览器自动化测试 - 配置表格**

启动开发服务器并使用 Playwright 验证：

```bash
# 确保服务器运行
npm run dev &
```

使用 Playwright 工具：
1. 导航到 http://localhost:8060/login
2. 登录系统（admin@example.com / admin123）
3. 进入模板管理
4. 选择一个模板，进入配置页面
5. 点击编辑一个占位符
6. 验证「启用数据选择」开关存在
7. 启用后验证数据表下拉框加载
8. 选择数据表和字段
9. 保存配置
10. 验证配置保存成功

- [ ] **Step 4: 提交**

```bash
git add src/components/templates/placeholder-config-table.tsx
git commit -m "feat: add source binding UI to placeholder config table"
```

---

### Task 6: 修改填写表单集成数据选择器

**Files:**
- Modify: `src/components/forms/dynamic-form.tsx`

- [ ] **Step 1: 读取现有填写表单代码**

Run: Read `src/components/forms/dynamic-form.tsx` to understand current structure.

- [ ] **Step 2: 集成数据选择器**

对于 `enablePicker=true` 的占位符：
1. 渲染数据选择器按钮
2. 点击打开 DataPickerDialog
3. 选择记录后调用级联解析 API
4. 自动填充所有关联字段

关键代码：

```typescript
import { DataPickerDialog } from "./data-picker-dialog";

// 在表单组件中
const [pickerOpen, setPickerOpen] = useState(false);
const [activePickerPlaceholder, setActivePickerPlaceholder] = useState<Placeholder | null>(null);
const [tableFields, setTableFields] = useState<DataField[]>([]);

// 处理选择记录
const handlePickerSelect = async (record: DataRecordItem) => {
  if (!activePickerPlaceholder?.sourceTableId) return;

  try {
    // 调用级联解析 API
    const res = await fetch("/api/fill/resolve-cascade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateId,
        sourceTableId: activePickerPlaceholder.sourceTableId,
        recordId: record.id,
      }),
    });

    if (!res.ok) throw new Error("解析级联数据失败");

    const data = await res.json();
    // 自动填充所有关联字段
    Object.entries(data).forEach(([key, value]) => {
      setValue(key, String(value ?? ""));
    });
  } catch (error) {
    console.error("自动填充失败:", error);
    toast.error("自动填充失败");
  }
};

// 打开选择器时加载字段信息
const handleOpenPicker = async (ph: Placeholder) => {
  setActivePickerPlaceholder(ph);
  // 从 source-tables API 获取字段列表
  const res = await fetch(`/api/placeholders/${ph.id}/source-tables`);
  const tables = await res.json();
  const table = tables.find((t: { id: string }) => t.id === ph.sourceTableId);
  if (table) {
    setTableFields(table.fields);
  }
  setPickerOpen(true);
};

// 渲染表单字段时
{placeholders.map((ph) => (
  <div key={ph.id}>
    <label>{ph.label}{ph.required && " *"}</label>
    <div className="flex gap-2">
      <Input {...register(ph.key)} />
      {ph.enablePicker && (
        <Button
          type="button"
          variant="outline"
          onClick={() => handleOpenPicker(ph)}
        >
          选择数据
        </Button>
      )}
    </div>
  </div>
))}

<DataPickerDialog
  open={pickerOpen}
  onOpenChange={setPickerOpen}
  placeholderId={activePickerPlaceholder?.id ?? ""}
  displayField={activePickerPlaceholder?.sourceField ?? ""}
  fields={tableFields}
  onSelect={handlePickerSelect}
/>
```

- [ ] **Step 3: 运行构建验证**

Run: `npm run build`
Expected: Build succeeds without errors

- [ ] **Step 4: 提交**

```bash
git add src/components/forms/dynamic-form.tsx
git commit -m "feat: integrate data picker into fill form with cascade auto-fill"
```

---

### Task 7: 端到端浏览器自动化测试

**Files:**
- 无新文件（使用 Playwright 工具）

- [ ] **Step 1: 确保服务运行**

Run: `npm run dev &`
Expected: Server running on port 8060

- [ ] **Step 2: 完整流程测试 - 配置阶段**

使用 Playwright 浏览器自动化工具：

1. 导航到 http://localhost:8060/login
2. 登录系统（admin@example.com / admin123）
3. 进入模板管理
4. 选择一个模板，进入配置页面
5. 编辑一个占位符
6. 启用「数据选择」
7. 选择数据表和字段
8. 保存配置
9. 验证配置保存成功

- [ ] **Step 3: 完整流程测试 - 填写阶段**

1. 导航到模板填写页面 `/templates/{id}/fill`
2. 验证绑定了数据源的占位符显示「选择数据」按钮
3. 点击「选择数据」按钮
4. 验证弹窗显示数据表记录
5. 搜索功能测试
6. 选择一条记录
7. 验证关联字段自动填充
8. 验证自动填充的值可手动修改

- [ ] **Step 4: 边界情况测试**

1. 未绑定数据表的占位符 - 显示普通文本输入框
2. 数据表无记录 - 弹窗显示「暂无数据」
3. 关联字段值为空 - 自动填充空字符串

- [ ] **Step 5: 记录测试结果**

验证所有测试用例通过。

---

### Task 8: 完成开发分支

- [ ] **Step 1: 运行完整测试套件**

Run: `npm run test:run`
Expected: All tests pass

- [ ] **Step 2: 运行构建**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: 使用 finishing-a-development-branch 技能**

调用 superpowers:finishing-a-development-branch 完成开发分支。

---

## 测试要点总结

- [ ] 占位符绑定数据表后，填写表单显示选择器按钮
- [ ] 选择器弹窗正确显示数据表记录
- [ ] 搜索和筛选功能正常
- [ ] 选择记录后，同表映射字段自动填充
- [ ] 自动填充值可手动修改
- [ ] 未绑定的占位符正常显示文本输入框
- [ ] 边界情况处理正确
