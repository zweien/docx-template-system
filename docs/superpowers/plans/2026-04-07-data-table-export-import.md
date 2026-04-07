# 数据表导出/导入增强功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- []`) syntax for tracking.

**Goal:** 为数据表增加 JSON 和 SQL 导出格式，支持从 JSON 文件导入，实现跨站点数据迁移闭环。

**Architecture:** 新建 `export.service.ts` 承载所有导出逻辑（Excel 从 `import.service.ts` 迁出），`import.service.ts` 增加 `importFromJSON`。前端导出按钮改为下拉菜单（三种格式），导入向导支持 `.json` 文件上传并跳过列映射步骤。

**Tech Stack:** Next.js v16, Prisma v7, xlsx, shadcn/ui v4 (Base UI DropdownMenu), Zod

---

## File Structure

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/lib/services/export.service.ts` | 新建 | 导出服务：getTableExportData, exportToExcel, exportToJSON, exportToSQL |
| `src/lib/services/import.service.ts` | 修改 | 删除 exportToExcel，新增 importFromJSON |
| `src/app/api/data-tables/[id]/export/route.ts` | 修改 | 改为从 export.service.ts 导入 |
| `src/app/api/data-tables/[id]/export/json/route.ts` | 新建 | JSON 导出 API |
| `src/app/api/data-tables/[id]/export/sql/route.ts` | 新建 | SQL 导出 API |
| `src/app/api/data-tables/[id]/import/json/route.ts` | 新建 | JSON 导入 API |
| `src/components/data/table-card.tsx` | 修改 | 导出改为下拉子菜单 |
| `src/components/data/record-table.tsx` | 修改 | 工具栏增加导出下拉菜单 |
| `src/components/data/import-wizard.tsx` | 修改 | 支持 .json 文件上传，跳过映射步骤 |
| `src/validators/data-table.ts` | 修改 | 新增 JSON 导入验证 schema |

---

### Task 1: 新建 export.service.ts — 基础结构与 getTableExportData

**Files:**
- Create: `src/lib/services/export.service.ts`

**Step 1: 创建 export.service.ts，实现 getTableExportData**

```typescript
import * as XLSX from "xlsx";
import { db } from "@/lib/db";
import { getTable } from "./data-table.service";
import type { ServiceResult, DataFieldItem } from "@/types/data-table";

// ── Shared Types ──

export interface TableExportData {
  table: {
    id: string;
    name: string;
    description: string | null;
    icon: string | null;
    businessKeys: string[];
  };
  fields: DataFieldItem[];
  records: Array<{
    id: string;
    data: Record<string, unknown>;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
  }>;
}

// ── Shared Data Fetcher ──

export async function getTableExportData(
  tableId: string
): Promise<ServiceResult<TableExportData>> {
  const tableResult = await getTable(tableId);
  if (!tableResult.success) {
    return { success: false, error: tableResult.error };
  }

  const table = tableResult.data;

  const records = await db.dataRecord.findMany({
    where: { tableId },
    orderBy: { sortOrder: "asc" },
  });

  return {
    success: true,
    data: {
      table: {
        id: table.id,
        name: table.name,
        description: table.description,
        icon: table.icon,
        businessKeys: table.businessKeys ?? [],
      },
      fields: table.fields,
      records: records.map((r) => ({
        id: r.id,
        data: r.data as Record<string, unknown>,
        sortOrder: r.sortOrder,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    },
  };
}
```

- [ ] Step 1: Write the file `src/lib/services/export.service.ts` with the code above

- [ ] Step 2: Verify types compile

Run: `npx tsc --noEmit`
Expected: No errors related to export.service.ts

---

### Task 2: export.service.ts — exportToExcel（从 import.service.ts 迁移）

**Files:**
- Modify: `src/lib/services/export.service.ts`
- Modify: `src/lib/services/import.service.ts`

**Step 1: 在 export.service.ts 中追加 exportToExcel**

在文件末尾追加：

```typescript
// ── Excel Export ──

export async function exportToExcel(
  tableId: string
): Promise<ServiceResult<Buffer>> {
  try {
    const dataResult = await getTableExportData(tableId);
    if (!dataResult.success) {
      return { success: false, error: dataResult.error };
    }

    const { table, fields, records } = dataResult.data;

    const headers = fields.map((f) => f.label);
    const rows = records.map((record) => {
      const data = record.data;
      return fields.map((f) => {
        const value = data[f.key];
        if (f.type === "MULTISELECT" && Array.isArray(value)) {
          return value.join(", ");
        }
        return value ?? "";
      });
    });

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, table.name);

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    return { success: true, data: Buffer.from(buffer) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "导出数据失败";
    return { success: false, error: { code: "EXPORT_ERROR", message } };
  }
}
```

**Step 2: 从 import.service.ts 中删除 exportToExcel**

删除 `import.service.ts` 中第 303-551 行（`// ── Export ──` 注释到文件末尾），即删除 `exportToExcel` 函数及其上方的空 Export 注释块。保留 `findRecordByBusinessKey` 和 `importRelationDetails` 不动。

具体来说，删除以下内容（从第 303 行开始）：

```typescript
// ── Export ──

// ── Business Key Lookup ──
```

不对，让我重新确认。`findRecordByBusinessKey` 在第 305-335 行，`importRelationDetails` 在第 337-505 行，`exportToExcel` 在第 507-551 行。

删除 `import.service.ts` 中的以下代码（第 507-552 行）：

```typescript
// ── Export ──

export async function exportToExcel(
  tableId: string
): Promise<ServiceResult<Buffer>> {
  ...
}
```

- [ ] Step 1: 在 export.service.ts 追加 exportToExcel 函数
- [ ] Step 2: 从 import.service.ts 删除 exportToExcel 函数（第 507-552 行）
- [ ] Step 3: Run `npx tsc --noEmit` to verify no compile errors

---

### Task 3: export.service.ts — exportToJSON

**Files:**
- Modify: `src/lib/services/export.service.ts`

在文件末尾追加：

```typescript
// ── JSON Export ──

export interface ExportJSON {
  version: string;
  exportedAt: string;
  table: {
    name: string;
    description: string | null;
    icon: string | null;
    businessKeys: string[];
  };
  fields: Array<{
    key: string;
    label: string;
    type: string;
    required: boolean;
    sortOrder: number;
    options: unknown;
    defaultValue: string | null;
    relationTo?: string;
    relationCardinality?: string | null;
  }>;
  records: Record<string, unknown>[];
}

export async function exportToJSON(
  tableId: string
): Promise<ServiceResult<ExportJSON>> {
  try {
    const dataResult = await getTableExportData(tableId);
    if (!dataResult.success) {
      return { success: false, error: dataResult.error };
    }

    const { table, fields, records } = dataResult.data;

    const exportFields = fields.map((f) => ({
      key: f.key,
      label: f.label,
      type: f.type,
      required: f.required,
      sortOrder: f.sortOrder,
      options: f.options ?? null,
      defaultValue: f.defaultValue ?? null,
      ...(f.type === "RELATION" || f.type === "RELATION_SUBTABLE"
        ? {
            relationTo: f.relationTo,
            relationCardinality: f.relationCardinality,
          }
        : {}),
    }));

    const exportRecords = records.map((r) => r.data);

    return {
      success: true,
      data: {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        table: {
          name: table.name,
          description: table.description,
          icon: table.icon,
          businessKeys: table.businessKeys,
        },
        fields: exportFields,
        records: exportRecords,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "导出 JSON 失败";
    return { success: false, error: { code: "EXPORT_JSON_ERROR", message } };
  }
}
```

- [ ] Step 1: 追加 exportToJSON 和 ExportJSON 类型到 export.service.ts
- [ ] Step 2: Run `npx tsc --noEmit`

---

### Task 4: export.service.ts — exportToSQL

**Files:**
- Modify: `src/lib/services/export.service.ts`

在文件末尾追加：

```typescript
// ── SQL Export ──

export async function exportToSQL(
  tableId: string
): Promise<ServiceResult<string>> {
  try {
    const dataResult = await getTableExportData(tableId);
    if (!dataResult.success) {
      return { success: false, error: dataResult.error };
    }

    const { table, fields, records } = dataResult.data;

    const lines: string[] = [];
    lines.push(`-- 数据表: ${table.name}`);
    lines.push(`-- 导出时间: ${new Date().toISOString()}`);
    lines.push(
      `-- 字段定义: ${fields.map((f) => `${f.key}(${f.type})`).join(", ")}`
    );
    lines.push("");

    if (records.length === 0) {
      lines.push("-- 无记录数据");
      return { success: true, data: lines.join("\n") };
    }

    const values = records.map((r) => {
      const dataStr = JSON.stringify(r.data).replace(/'/g, "''");
      const id = r.id.replace(/'/g, "''");
      return `('${id}', '${table.id}', '${dataStr}', ${r.sortOrder}, '${r.createdAt.toISOString()}', '${r.updatedAt.toISOString()}')`;
    });

    lines.push(
      `INSERT INTO "DataRecord" ("id", "tableId", "data", "sortOrder", "createdAt", "updatedAt") VALUES`
    );
    lines.push(values.join(",\n") + ";");

    return { success: true, data: lines.join("\n") };
  } catch (error) {
    const message = error instanceof Error ? error.message : "导出 SQL 失败";
    return { success: false, error: { code: "EXPORT_SQL_ERROR", message } };
  }
}
```

- [ ] Step 1: 追加 exportToSQL 到 export.service.ts
- [ ] Step 2: Run `npx tsc --noEmit`

---

### Task 5: 修改现有 Excel 导出路由

**Files:**
- Modify: `src/app/api/data-tables/[id]/export/route.ts`

将 import 语句从 `import.service` 改为 `export.service`：

```typescript
// 修改前
import { exportToExcel } from "@/lib/services/import.service";

// 修改后
import { exportToExcel } from "@/lib/services/export.service";
```

其余代码不变。

- [ ] Step 1: 修改 import 语句
- [ ] Step 2: Run `npx tsc --noEmit`

---

### Task 6: 新建 JSON 导出路由

**Files:**
- Create: `src/app/api/data-tables/[id]/export/json/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { exportToJSON } from "@/lib/services/export.service";
import { getTable } from "@/lib/services/data-table.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { id: tableId } = await params;

  const tableResult = await getTable(tableId);
  if (!tableResult.success) {
    return NextResponse.json(
      { error: tableResult.error.message },
      { status: 400 }
    );
  }

  const result = await exportToJSON(tableId);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.message },
      { status: 400 }
    );
  }

  const filename = `${tableResult.data.name}_${new Date().toISOString().split("T")[0]}.json`;

  return new NextResponse(JSON.stringify(result.data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
```

- [ ] Step 1: 创建文件
- [ ] Step 2: Run `npx tsc --noEmit`

---

### Task 7: 新建 SQL 导出路由

**Files:**
- Create: `src/app/api/data-tables/[id]/export/sql/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { exportToSQL } from "@/lib/services/export.service";
import { getTable } from "@/lib/services/data-table.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { id: tableId } = await params;

  const tableResult = await getTable(tableId);
  if (!tableResult.success) {
    return NextResponse.json(
      { error: tableResult.error.message },
      { status: 400 }
    );
  }

  const result = await exportToSQL(tableId);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.message },
      { status: 400 }
    );
  }

  const filename = `${tableResult.data.name}_${new Date().toISOString().split("T")[0]}.sql`;

  return new NextResponse(result.data, {
    headers: {
      "Content-Type": "application/sql; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
```

- [ ] Step 1: 创建文件
- [ ] Step 2: Run `npx tsc --noEmit`

---

### Task 8: import.service.ts — 新增 importFromJSON + validator schema

**Files:**
- Modify: `src/lib/services/import.service.ts`
- Modify: `src/validators/data-table.ts`

**Step 1: 在 validators/data-table.ts 中追加 JSON 导入 schema**

在 `importSchema` 之后追加：

```typescript
export const jsonImportOptionsSchema = z.object({
  strategy: z.enum(["skip", "overwrite"]),
});

export const jsonImportSchema = z.object({
  version: z.string(),
  fields: z.array(z.object({
    key: z.string(),
    label: z.string(),
    type: z.string(),
  })),
  records: z.array(z.record(z.unknown())),
});

export type JsonImportOptionsInput = z.infer<typeof jsonImportOptionsSchema>;
```

同时在 type exports 区域追加：

```typescript
export type JsonImportOptionsInput = z.infer<typeof jsonImportOptionsSchema>;
```

**Step 2: 在 import.service.ts 中追加 importFromJSON**

在 `importData` 函数之后追加：

```typescript
// ── JSON Import ──

export async function importFromJSON(
  tableId: string,
  userId: string,
  jsonData: {
    version: string;
    fields: Array<{ key: string; label: string; type: string }>;
    records: Record<string, unknown>[];
  },
  options: { strategy: "skip" | "overwrite" },
  fields: DataFieldItem[]
): Promise<ServiceResult<ImportResult>> {
  // Validate version
  if (!jsonData.version) {
    return {
      success: false,
      error: { code: "INVALID_JSON", message: "缺少 version 字段" },
    };
  }

  if (!Array.isArray(jsonData.records)) {
    return {
      success: false,
      error: { code: "INVALID_JSON", message: "缺少 records 数组" },
    };
  }

  // Build mapping: JSON field keys map directly to table field keys
  const mapping: Record<string, string | null> = {};
  const fieldKeySet = new Set(fields.map((f) => f.key));
  for (const jsonField of jsonData.fields) {
    mapping[jsonField.key] = fieldKeySet.has(jsonField.key) ? jsonField.key : null;
  }

  // Use business keys from the table for dedup
  const tableResult = await getTable(tableId);
  const businessKeys = tableResult.success ? (tableResult.data.businessKeys ?? []) : [];

  // Delegate to importData
  return importData(tableId, userId, jsonData.records, mapping, {
    uniqueField: businessKeys[0] ?? fields[0]?.key ?? "",
    strategy: options.strategy,
  }, fields, { businessKeys });
}
```

- [ ] Step 1: 追加 JSON 导入 schema 到 validators/data-table.ts
- [ ] Step 2: 追加 importFromJSON 到 import.service.ts
- [ ] Step 3: Run `npx tsc --noEmit`

---

### Task 9: 新建 JSON 导入 API 路由

**Files:**
- Create: `src/app/api/data-tables/[id]/import/json/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { importFromJSON } from "@/lib/services/import.service";
import { getTable } from "@/lib/services/data-table.service";
import { jsonImportOptionsSchema } from "@/validators/data-table";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
  }

  const { id: tableId } = await params;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const configStr = formData.get("config") as string | null;

  if (!file) {
    return NextResponse.json({ error: "未上传文件" }, { status: 400 });
  }

  if (!configStr) {
    return NextResponse.json({ error: "缺少导入配置" }, { status: 400 });
  }

  let config: { strategy: "skip" | "overwrite" };
  try {
    const parsed = JSON.parse(configStr);
    const validation = jsonImportOptionsSchema.safeParse(parsed);
    if (!validation.success) {
      return NextResponse.json(
        { error: "配置格式错误", details: validation.error.flatten() },
        { status: 400 }
      );
    }
    config = validation.data;
  } catch {
    return NextResponse.json({ error: "配置 JSON 解析失败" }, { status: 400 });
  }

  // Parse JSON file
  let jsonData: {
    version: string;
    fields: Array<{ key: string; label: string; type: string }>;
    records: Record<string, unknown>[];
  };
  try {
    const text = await file.text();
    jsonData = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "JSON 文件解析失败" }, { status: 400 });
  }

  // Get table fields
  const tableResult = await getTable(tableId);
  if (!tableResult.success) {
    return NextResponse.json(
      { error: tableResult.error.message },
      { status: 400 }
    );
  }

  const result = await importFromJSON(
    tableId,
    session.user.id,
    jsonData,
    config,
    tableResult.data.fields
  );

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.message },
      { status: 400 }
    );
  }

  return NextResponse.json(result.data);
}
```

- [ ] Step 1: 创建文件
- [ ] Step 2: Run `npx tsc --noEmit`

---

### Task 10: table-card.tsx — 导出下拉子菜单

**Files:**
- Modify: `src/components/data/table-card.tsx`

需要导入额外的子菜单组件，并在下拉菜单中增加导出子菜单。

**Step 1: 更新 import 语句，增加 DropdownMenuSub 等组件**

```typescript
// 修改前
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// 修改后
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
```

**Step 2: 在 DropdownMenuContent 中，在"导入数据"之后、"删除"之前插入导出子菜单**

在 `<DropdownMenuItem render={<Link href={`/data/${table.id}/import`}>导入数据</Link>} />` 之后插入：

```tsx
<DropdownMenuSub>
  <DropdownMenuSubTrigger>导出数据</DropdownMenuSubTrigger>
  <DropdownMenuSubContent>
    <DropdownMenuItem
      onClick={() => window.open(`/api/data-tables/${table.id}/export`)}
    >
      导出 Excel
    </DropdownMenuItem>
    <DropdownMenuItem
      onClick={() => window.open(`/api/data-tables/${table.id}/export/json`)}
    >
      导出 JSON
    </DropdownMenuItem>
    <DropdownMenuItem
      onClick={() => window.open(`/api/data-tables/${table.id}/export/sql`)}
    >
      导出 SQL
    </DropdownMenuItem>
  </DropdownMenuSubContent>
</DropdownMenuSub>
```

- [ ] Step 1: 更新 import 语句
- [ ] Step 2: 插入导出子菜单
- [ ] Step 3: Run `npx tsc --noEmit`

---

### Task 11: record-table.tsx — 工具栏增加导出下拉菜单

**Files:**
- Modify: `src/components/data/record-table.tsx`

**Step 1: 增加 DropdownMenu 相关导入**

```typescript
// 在现有 import 区域追加
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download } from "lucide-react";
```

**Step 2: 在工具栏右侧（FieldConfigPopover 和 "新建记录" 按钮之间）插入导出按钮**

在 `{isAdmin && (` 之前插入：

```tsx
<DropdownMenu>
  <DropdownMenuTrigger
    render={
      <Button variant="outline" size="sm">
        <Download className="h-4 w-4 mr-1" />
        导出
      </Button>
    }
  />
  <DropdownMenuContent align="end">
    <DropdownMenuItem
      onClick={() => window.open(`/api/data-tables/${tableId}/export`)}
    >
      导出 Excel
    </DropdownMenuItem>
    <DropdownMenuItem
      onClick={() => window.open(`/api/data-tables/${tableId}/export/json`)}
    >
      导出 JSON
    </DropdownMenuItem>
    <DropdownMenuItem
      onClick={() => window.open(`/api/data-tables/${tableId}/export/sql`)}
    >
      导出 SQL
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

- [ ] Step 1: 增加导入
- [ ] Step 2: 插入导出下拉菜单
- [ ] Step 3: Run `npx tsc --noEmit`

---

### Task 12: import-wizard.tsx — 支持 JSON 文件导入

**Files:**
- Modify: `src/components/data/import-wizard.tsx`

这是最复杂的改动。需要：
1. 上传步骤接受 `.json` 文件
2. 识别 JSON 文件后跳过映射步骤，直接进入选项步骤
3. 导入时调用 `/api/data-tables/${tableId}/import/json` 而非普通导入接口

**Step 1: 修改文件 accept 属性**

```tsx
// 修改前
accept=".xlsx"

// 修改后
accept=".xlsx,.json"
```

**Step 2: 增加 JSON 文件检测 state**

在组件 state 区域追加：

```typescript
const [isJsonFile, setIsJsonFile] = useState(false);
const [jsonSummary, setJsonSummary] = useState<{
  tableName: string;
  fieldCount: number;
  recordCount: number;
} | null>(null);
```

**Step 3a: JSON 文件选择时自动切换为 normal 模式**

在文件选择 onChange 中增加逻辑：

```tsx
onChange={(e) => {
  const selectedFile = e.target.files?.[0];
  if (selectedFile) {
    setFile(selectedFile);
    setError("");
    if (selectedFile.name.endsWith(".json")) {
      setImportMode("normal"); // JSON 仅支持主表导入
    }
  }
}}
```

**Step 3b: 修改 handleUpload，支持 JSON 文件解析**

替换 `handleUpload` 函数为：

```typescript
const handleUpload = useCallback(async () => {
  if (!file) return;

  setIsLoading(true);
  setError("");

  try {
    const isJson = file.name.endsWith(".json");

    if (isJson) {
      // JSON 文件：前端解析，展示摘要
      const text = await file.text();
      const jsonData = JSON.parse(text);

      if (!jsonData.version || !Array.isArray(jsonData.fields) || !Array.isArray(jsonData.records)) {
        setError("JSON 文件格式不正确，缺少 version、fields 或 records 字段");
        setIsLoading(false);
        return;
      }

      setIsJsonFile(true);
      setJsonSummary({
        tableName: jsonData.table?.name ?? "未知",
        fieldCount: jsonData.fields.length,
        recordCount: jsonData.records.length,
      });

      // 设置预览数据
      const columns = jsonData.fields.map((f: { key: string }) => f.key);
      const previewRows = jsonData.records.slice(0, 5);
      setPreview({
        columns,
        rows: previewRows,
        totalRows: jsonData.records.length,
      });

      // 自动映射（key 直接匹配）
      const initialMapping: Record<string, string | null> = {};
      const fieldKeySet = new Set(localFields.map((f) => f.key));
      for (const jsonField of jsonData.fields) {
        initialMapping[jsonField.key] = fieldKeySet.has(jsonField.key) ? jsonField.key : null;
      }
      setMapping(initialMapping);

      // JSON 跳过映射步骤，直接到选项
      setStep("options");
    } else {
      // Excel 文件：走原有逻辑
      setIsJsonFile(false);
      setJsonSummary(null);

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `/api/data-tables/${tableId}/import/preview`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "上传失败");
        return;
      }

      setPreview(data);
      const initialMapping: Record<string, string | null> = {};
      data.columns.forEach((col: string) => {
        const matchedField = localFields.find(
          (f) =>
            f.label.toLowerCase() === col.toLowerCase() ||
            f.key.toLowerCase() === col.toLowerCase()
        );
        initialMapping[col] = matchedField?.key ?? null;
      });
      setMapping(initialMapping);
      setStep("mapping");
    }
  } catch (_err) {
    setError(isJsonFile ? "JSON 文件解析失败" : "上传失败，请稍后重试");
  } finally {
    setIsLoading(false);
  }
}, [file, tableId, localFields]);
```

**Step 4: 修改 handleImport，支持 JSON 导入路径**

替换 `handleImport` 函数中普通导入的 else 分支（第 232-258 行）为：

```typescript
} else {
  // 普通导入 或 JSON 导入
  if (isJsonFile) {
    // JSON 导入：发送文件 + config 到 JSON 导入接口
    const jsonFormData = new FormData();
    jsonFormData.append("file", file!);
    jsonFormData.append(
      "config",
      JSON.stringify({ strategy })
    );

    const response = await fetch(`/api/data-tables/${tableId}/import/json`, {
      method: "POST",
      body: jsonFormData,
    });

    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "导入失败");
      return;
    }

    setResult(data);
  } else {
    // Excel 普通导入
    formData.append(
      "config",
      JSON.stringify({
        mapping,
        options: {
          uniqueField,
          strategy,
        },
      })
    );

    const response = await fetch(`/api/data-tables/${tableId}/import`, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "导入失败");
      return;
    }

    setResult(data);
  }
}
```

**Step 5: 修改 renderUploadStep 的标题和描述**

将上传步骤标题改为动态：

```tsx
<h2 className="text-lg font-medium">上传文件</h2>
<p className="text-zinc-500 text-sm mt-1">
  支持 .xlsx 和 .json 格式，最大 5MB，最多 1000 行
</p>
```

**Step 6: 在 upload 步骤中，当是 JSON 文件时显示摘要**

在文件上传区域后面、error 提示之前，增加：

```tsx
{jsonSummary && (
  <div className="bg-blue-50 rounded-lg p-4 text-sm">
    <div className="font-medium text-blue-700 mb-1">JSON 导出文件摘要</div>
    <div className="text-blue-600">
      表名: {jsonSummary.tableName} | 字段数: {jsonSummary.fieldCount} | 记录数: {jsonSummary.recordCount}
    </div>
  </div>
)}
```

**Step 7: 修改进度条，JSON 导入时显示 3 步而非 4 步**

替换进度条部分：

```tsx
const stepLabels = isJsonFile
  ? ["上传文件", "导入选项", "完成"]
  : ["上传文件", "字段映射", "导入选项", "完成"];
const stepKeys = isJsonFile
  ? ["upload", "options", "result"]
  : ["upload", "mapping", "options", "result"];

// 在进度条渲染中使用 stepLabels 和 stepKeys
```

替换进度条渲染部分为：

```tsx
<div className="flex items-center justify-between text-sm mb-2">
  {stepLabels.map((label, i) => {
    const stepIndex = stepKeys.indexOf(step);
    return (
      <div
        key={label}
        className={`flex items-center ${
          i <= stepIndex ? "text-zinc-900" : "text-zinc-400"
        }`}
      >
        <div
          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
            i < stepIndex
              ? "bg-green-500 text-white"
              : i === stepIndex
                ? "bg-zinc-900 text-white"
                : "bg-zinc-200"
          }`}
        >
          {i < stepIndex ? "✓" : i + 1}
        </div>
        <span className="ml-2">{label}</span>
      </div>
    );
  })}
</div>
<div className="h-1 bg-zinc-100 rounded-full overflow-hidden">
  <div
    className="h-full bg-zinc-900 transition-all"
    style={{
      width: `${((stepKeys.indexOf(step) + 1) / stepKeys.length) * 100}%`,
    }}
  />
</div>
```

**Step 8: 修改 options 步骤的"上一步"按钮，JSON 导入时返回 upload**

```tsx
<Button
  variant="outline"
  onClick={() => setStep(isJsonFile ? "upload" : "mapping")}
>
  上一步
</Button>
```

- [ ] Step 1: 修改 accept 属性
- [ ] Step 2: 增加 state
- [ ] Step 3: 修改 handleUpload
- [ ] Step 4: 修改 handleImport
- [ ] Step 5: 修改上传步骤标题
- [ ] Step 6: 增加 JSON 摘要显示
- [ ] Step 7: 修改进度条
- [ ] Step 8: 修改 options 步骤返回按钮
- [ ] Step 9: Run `npx tsc --noEmit`
- [ ] Step 10: Run `npm run build` 验证完整构建

---

### Task 13: 端到端验证

- [ ] Step 1: Run `npx tsc --noEmit` — 确认零类型错误
- [ ] Step 2: Run `npm run build` — 确认构建成功
- [ ] Step 3: Run `npm run lint` — 确认无 lint 错误
- [ ] Step 4: 功能测试（手动或 Playwright）：
  - 访问数据表页面，点击表卡片下拉菜单 → 导出数据 → 导出 JSON / 导出 SQL / 导出 Excel
  - 访问数据表详情页，点击工具栏导出按钮 → 三种格式下载
  - 导入 JSON 文件 → 验证跳过映射步骤 → 完成导入
- [ ] Step 5: Commit

```bash
git add src/lib/services/export.service.ts \
  src/lib/services/import.service.ts \
  src/app/api/data-tables/\[id\]/export/route.ts \
  src/app/api/data-tables/\[id\]/export/json/route.ts \
  src/app/api/data-tables/\[id\]/export/sql/route.ts \
  src/app/api/data-tables/\[id\]/import/json/route.ts \
  src/components/data/table-card.tsx \
  src/components/data/record-table.tsx \
  src/components/data/import-wizard.tsx \
  src/validators/data-table.ts

git commit -m "feat(data-table): add JSON/SQL export and JSON import for cross-site migration"
```
