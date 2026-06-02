# NocoDB 集成实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 NocoDB 完全替代自定义数据表系统，通过 iframe 嵌入 NocoDB UI 管理数据，通过 API 适配层桥接模板填充和批量生成。

**Architecture:** 新增 `src/lib/nocodb/` 适配层封装 NocoDB v2 REST API；数据表管理页改为 iframe 嵌入 NocoDB；模板填充/批量生成通过适配层获取数据；MCP Server 底层实现替换为 NocoDB API 调用。

**Tech Stack:** NocoDB REST API v2, TypeScript, Next.js 16, Prisma 7

**Spec:** `docs/superpowers/specs/2026-06-02-nocodb-integration-design.md`

---

## 文件结构

### 新增文件

| 文件 | 职责 |
|------|------|
| `src/lib/nocodb/client.ts` | NocoDB API HTTP 客户端，封装认证、请求、错误处理 |
| `src/lib/nocodb/adapter.ts` | 数据适配器，将 NocoDB 响应映射为系统内部类型 |
| `src/lib/nocodb/field-mapper.ts` | NocoDB 字段类型 ↔ 系统内部 FieldType 映射 |
| `src/lib/nocodb/filter-mapper.ts` | 系统 FilterCondition → NocoDB where 语法转换 |
| `src/lib/nocodb/index.ts` | 统一导出 |
| `src/app/(dashboard)/data/nocodb-config.tsx` | NocoDB 配置组件（URL、Token、Base ID） |
| `src/app/api/nocodb/tables/route.ts` | 代理：列出 NocoDB 表（供 data-table-link 等使用） |
| `src/app/api/nocodb/tables/[tableId]/route.ts` | 代理：获取 NocoDB 表 schema |
| `src/app/api/nocodb/tables/[tableId]/records/route.ts` | 代理：CRUD NocoDB 记录 |
| `src/app/api/automation/nocodb-webhook/route.ts` | 接收 NocoDB Webhook 回调 |

### 修改文件

| 文件 | 变更 |
|------|------|
| `src/app/(dashboard)/data/page.tsx` | 改为 iframe 嵌入 NocoDB + 配置栏 |
| `src/components/forms/data-picker-dialog.tsx` | API 调用改为 NocoDB 代理路由 |
| `src/components/template/data-table-link.tsx` | 列出 NocoDB 表 |
| `src/components/template/field-mapping-dialog.tsx` | 读 NocoDB 字段元数据 |
| `src/components/batch/step1-select-data.tsx` | 查询 NocoDB 表和记录 |
| `src/components/batch/step2-field-mapping.tsx` | 读 NocoDB 字段元数据 |
| `src/app/api/fill/resolve-cascade/route.ts` | 改为调 NocoDB adapter |
| `src/app/api/placeholders/[id]/picker-data/route.ts` | 改为调 NocoDB adapter |
| `src/lib/services/batch-generation.service.ts` | 数据源改为 NocoDB adapter |
| `src/types/data-table.ts` | 确保类型兼容 NocoDB 映射 |
| `prisma/schema.prisma` | 移除数据表相关模型 |
| `.env.example` | 添加 NocoDB 环境变量 |
| `mcp-server/src/api-client.ts` | 完全重写为 NocoDB API 客户端 |
| `mcp-server/src/index.ts` | 工具实现改为调 NocoDB API |

### 删除文件

| 文件 | 原因 |
|------|------|
| `src/app/(dashboard)/data/[tableId]/page.tsx` | NocoDB 自带表详情 |
| `src/app/(dashboard)/data/[tableId]/fields/page.tsx` | NocoDB 自带字段配置 |
| `src/app/(dashboard)/data/[tableId]/import/page.tsx` | NocoDB 自带导入 |
| `src/app/(dashboard)/data/[tableId]/new/page.tsx` | NocoDB 自带新建 |
| `src/app/(dashboard)/data/[tableId]/[recordId]/edit/page.tsx` | NocoDB 自带编辑 |
| `src/components/data/views/` | 整个目录删除 |
| `src/components/data/create-table-dialog.tsx` | 不再需要 |
| `src/components/data/import-table-dialog.tsx` | 不再需要 |
| `src/components/data/record-table.tsx` | 不再需要 |
| `src/components/data/table-detail-content.tsx` | 不再需要 |
| `src/components/data/table-card.tsx` | 不再需要 |
| `src/lib/services/data-table.service.ts` | NocoDB 接管 |
| `src/lib/services/data-field.service.ts` | NocoDB 接管 |
| `src/lib/services/data-record.service.ts` | NocoDB 接管 |
| `src/lib/services/data-relation.service.ts` | NocoDB 接管 |
| `src/lib/services/data-view.service.ts` | NocoDB 接管 |
| `src/app/api/data-tables/` | 主 API 路由目录（大部分删除） |
| `src/app/api/v1/data-tables/` | v1 API 路由目录 |
| `src/validators/data-table.ts` | 不再需要 |

---

## Task 1: 创建开发分支

- [ ] **Step 1: 从 master 创建开发分支**

```bash
git checkout -b feature/nocodb-integration
```

- [ ] **Step 2: 确认分支**

```bash
git branch --show-current
```

Expected: `feature/nocodb-integration`

---

## Task 2: NocoDB API 客户端

**Files:**
- Create: `src/lib/nocodb/client.ts`

- [ ] **Step 1: 创建 NocoDB API 客户端**

```typescript
// src/lib/nocodb/client.ts

const NOCODB_URL = process.env.NOCODB_URL || "http://localhost:8040";
const NOCODB_API_TOKEN = process.env.NOCODB_API_TOKEN || "";
const NOCODB_BASE_ID = process.env.NOCODB_BASE_ID || "";

export class NocoDBError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "NocoDBError";
  }
}

async function request<T>(
  method: string,
  path: string,
  options?: { params?: Record<string, string>; body?: unknown }
): Promise<T> {
  const url = new URL(`${NOCODB_URL}${path}`);
  if (options?.params) {
    Object.entries(options.params).forEach(([k, v]) => {
      if (v !== undefined && v !== "") url.searchParams.set(k, v);
    });
  }

  const res = await fetch(url.toString(), {
    method,
    headers: {
      "xc-token": NOCODB_API_TOKEN,
      "Content-Type": "application/json",
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new NocoDBError(
      res.status,
      `NOCODB_${res.status}`,
      `NocoDB API error: ${res.status} ${text}`
    );
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// ---- Meta API ----

export interface NocoDBTable {
  id: string;
  title: string;
  baseId: string;
  columns?: NocoDBColumn[];
}

export interface NocoDBColumn {
  id: string;
  title: string;
  column_name: string;
  uidt: string; // UI data type: e.g. "SingleLineText", "Number", "Date"
  meta?: string; // JSON string with options
  required?: boolean;
  unique?: boolean;
  colOptions?: {
    // For link fields
    type: string; // "mm" | "hm" | "bt"
    fk_related_model_id?: string;
    fk_child_column_id?: string;
    fk_parent_column_id?: string;
    fk_mm_model_id?: string;
    fk_mm_child_column_id?: string;
    fk_mm_parent_column_id?: string;
  };
  system?: boolean;
}

export async function listTables(): Promise<{ list: NocoDBTable[] }> {
  return request("GET", `/api/v2/meta/bases/${NOCODB_BASE_ID}/tables`);
}

export async function getTable(
  tableId: string
): Promise<NocoDBTable & { columns: NocoDBColumn[] }> {
  return request(
    "GET",
    `/api/v2/meta/bases/${NOCODB_BASE_ID}/tables/${tableId}`
  );
}

// ---- Data API ----

export interface NocoDBRecordList {
  list: Record<string, unknown>[];
  pageInfo: {
    totalRows: number;
    page: number;
    pageSize: number;
    isFirstPage: boolean;
    isLastPage: boolean;
  };
}

export async function listRecords(
  tableId: string,
  params?: {
    where?: string;
    limit?: number;
    offset?: number;
    sort?: string;
    fields?: string;
  }
): Promise<NocoDBRecordList> {
  const queryParams: Record<string, string> = {};
  if (params?.where) queryParams.where = params.where;
  if (params?.limit !== undefined) queryParams.limit = String(params.limit);
  if (params?.offset !== undefined) queryParams.offset = String(params.offset);
  if (params?.sort) queryParams.sort = params.sort;
  if (params?.fields) queryParams.fields = params.fields;

  return request("GET", `/api/v2/tables/${tableId}/records`, {
    params: queryParams,
  });
}

export async function getRecord(
  tableId: string,
  recordId: string
): Promise<Record<string, unknown>> {
  const result = await request<NocoDBRecordList>(
    "GET",
    `/api/v2/tables/${tableId}/records/${recordId}`
  );
  return result.list?.[0] ?? {};
}

export async function createRecord(
  tableId: string,
  data: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const result = await request<{ list: Record<string, unknown>[] }>(
    "POST",
    `/api/v2/tables/${tableId}/records`,
    { body: data }
  );
  return result.list?.[0] ?? {};
}

export async function updateRecord(
  tableId: string,
  recordId: string | number,
  data: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const result = await request<{ list: Record<string, unknown>[] }>(
    "PATCH",
    `/api/v2/tables/${tableId}/records`,
    { body: { Id: recordId, ...data } }
  );
  return result.list?.[0] ?? {};
}

export async function deleteRecord(
  tableId: string,
  recordIds: (string | number)[]
): Promise<void> {
  await request("DELETE", `/api/v2/tables/${tableId}/records`, {
    body: { Ids: recordIds },
  });
}

export async function batchCreateRecords(
  tableId: string,
  records: Record<string, unknown>[]
): Promise<{ list: Record<string, unknown>[] }> {
  return request("POST", `/api/v2/tables/${tableId}/records`, {
    body: records,
  });
}

export async function linkRecords(
  tableId: string,
  linkFieldId: string,
  recordId: string | number,
  linkedRecordIds: (string | number)[]
): Promise<void> {
  await request(
    "POST",
    `/api/v2/tables/${tableId}/links/${linkFieldId}/records/${recordId}`,
    { body: linkedRecordIds }
  );
}

// ---- Health Check ----

export async function healthCheck(): Promise<boolean> {
  try {
    await request("GET", `/api/v2/meta/bases/${NOCODB_BASE_ID}/tables`, {
      params: { limit: "1" },
    });
    return true;
  } catch {
    return false;
  }
}

// ---- Webhooks ----

export interface NocoDBWebhook {
  id?: string;
  title: string;
  event: "after.insert" | "after.update" | "after.delete";
  active?: boolean;
  notification: {
    type: "URL";
    payload: {
      method: "POST";
      body: string;
      url: string;
      headers: { key: string; value: string }[];
    };
  };
}

export async function createWebhook(
  tableId: string,
  webhook: NocoDBWebhook
): Promise<{ id: string }> {
  return request(
    "POST",
    `/api/v2/meta/bases/${NOCODB_BASE_ID}/tables/${tableId}/hooks`,
    { body: webhook }
  );
}
```

- [ ] **Step 2: 验证文件创建**

```bash
ls -la src/lib/nocodb/client.ts
```

Expected: 文件存在

- [ ] **Step 3: 提交**

```bash
git add src/lib/nocodb/client.ts
git commit -m "feat(nocodb): add NocoDB API client"
```

---

## Task 3: 字段类型映射器

**Files:**
- Create: `src/lib/nocodb/field-mapper.ts`

- [ ] **Step 1: 创建字段映射器**

先读取现有 FieldType 枚举：

```bash
grep -n "FieldType" src/types/data-table.ts | head -30
```

然后创建映射器：

```typescript
// src/lib/nocodb/field-mapper.ts

// NocoDB uidt (UI Data Type) → 系统内部类型映射
// 参考: https://nocodb.com/docs/product-docs/developer-resources/rest-apis

export interface MappedField {
  key: string;
  label: string;
  type: string; // 对应系统内的 FieldType 字符串
  required: boolean;
  options?: Record<string, unknown>;
  // NocoDB 特有
  nocodbColumnId: string;
  nocodbUidt: string;
  isSystem: boolean;
  // 关联字段
  relationType?: "SINGLE" | "MULTIPLE";
  relationTargetTableId?: string;
  relationFieldId?: string;
}

const UIDT_TO_FIELD_TYPE: Record<string, string> = {
  SingleLineText: "TEXT",
  LongText: "TEXT",
  RichText: "RICH_TEXT",
  Number: "NUMBER",
  Decimal: "NUMBER",
  Float: "NUMBER",
  Currency: "CURRENCY",
  Percent: "PERCENTAGE",
  Duration: "DURATION",
  Date: "DATE",
  DateTime: "DATE",
  Time: "TEXT",
  Email: "EMAIL",
  PhoneNumber: "PHONE",
  URL: "URL",
  Checkbox: "BOOLEAN",
  SingleSelect: "SELECT",
  MultiSelect: "MULTISELECT",
  Rating: "RATING",
  Formula: "FORMULA",
  Rollup: "ROLLUP",
  Lookup: "LOOKUP",
  AutoNumber: "AUTO_NUMBER",
  Attachment: "FILE",
  // Link types
  Links: "RELATION",
  LinkToAnotherRecord: "RELATION",
  // System fields
  CreatedTime: "SYSTEM_TIMESTAMP",
  LastModifiedTime: "SYSTEM_TIMESTAMP",
  CreatedBy: "SYSTEM_USER",
  LastModifiedBy: "SYSTEM_USER",
  ID: "AUTO_NUMBER",
  // Fallback
  Geometry: "TEXT",
  JSON: "TEXT",
  Barcode: "TEXT",
  QRCode: "TEXT",
  Button: "TEXT",
};

interface NocoDBColumn {
  id: string;
  title: string;
  column_name: string;
  uidt: string;
  meta?: string;
  required?: boolean;
  system?: boolean;
  colOptions?: {
    type: string; // "mm" | "hm" | "bt"
    fk_related_model_id?: string;
    fk_child_column_id?: string;
    fk_parent_column_id?: string;
  };
}

export function mapColumn(column: NocoDBColumn): MappedField {
  const fieldType = UIDT_TO_FIELD_TYPE[column.uidt] || "TEXT";

  const mapped: MappedField = {
    key: column.column_name || column.title,
    label: column.title,
    type: fieldType,
    required: column.required ?? false,
    nocodbColumnId: column.id,
    nocodbUidt: column.uidt,
    isSystem: column.system ?? false,
  };

  // 解析选项（SELECT/MULTISELECT）
  if (
    (column.uidt === "SingleSelect" || column.uidt === "MultiSelect") &&
    column.meta
  ) {
    try {
      const meta = JSON.parse(column.meta);
      if (meta.choices) {
        mapped.options = {
          choices: meta.choices.map(
            (c: { title: string; color?: string }) => ({
              label: c.title,
              color: c.color,
            })
          ),
        };
      }
    } catch {
      // meta 不是有效 JSON，跳过
    }
  }

  // 解析关联字段
  if (
    column.uidt === "Links" ||
    column.uidt === "LinkToAnotherRecord"
  ) {
    if (column.colOptions) {
      // "hm" = has many → MULTIPLE, "bt" = belongs to → SINGLE, "mm" = many to many → MULTIPLE
      mapped.relationType =
        column.colOptions.type === "bt" ? "SINGLE" : "MULTIPLE";
      mapped.relationTargetTableId =
        column.colOptions.fk_related_model_id;
      mapped.relationFieldId = column.id;
    }
  }

  return mapped;
}

export function mapColumns(columns: NocoDBColumn[]): MappedField[] {
  return columns
    .filter((c) => !c.system)
    .map(mapColumn);
}
```

- [ ] **Step 2: 验证文件创建**

```bash
ls -la src/lib/nocodb/field-mapper.ts
```

- [ ] **Step 3: 提交**

```bash
git add src/lib/nocodb/field-mapper.ts
git commit -m "feat(nocodb): add field type mapper for NocoDB columns"
```

---

## Task 4: 过滤器映射器

**Files:**
- Create: `src/lib/nocodb/filter-mapper.ts`

- [ ] **Step 1: 创建过滤器映射器**

先读取现有 FilterCondition 类型：

```bash
grep -n "FilterCondition\|FilterOperator" src/types/data-table.ts | head -20
```

然后创建映射器：

```typescript
// src/lib/nocodb/filter-mapper.ts

// 将系统的 FilterCondition 转换为 NocoDB where 语法
// 参考: https://nocodb.com/docs/product-docs/developer-resources/rest-apis

type FilterOperator =
  | "eq"
  | "ne"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "is_empty"
  | "is_not_empty"
  | "in"
  | "not_in"
  | "between";

interface FilterCondition {
  field: string;
  operator: FilterOperator;
  value?: unknown;
}

type LogicalOperator = "AND" | "OR";

interface FilterGroup {
  logicalOperator: LogicalOperator;
  conditions: (FilterCondition | FilterGroup)[];
}

const OPERATOR_MAP: Record<FilterOperator, string> = {
  eq: "eq",
  ne: "neq",
  gt: "gt",
  gte: "ge",
  lt: "lt",
  lte: "le",
  contains: "like",
  not_contains: "nlike",
  starts_with: "like",
  ends_with: "like",
  is_empty: "is",
  is_not_empty: "isnot",
  in: "in",
  not_in: "nallof",
  between: "btw",
};

function escapeValue(value: unknown): string {
  if (value === null || value === undefined) return "null";
  const str = String(value);
  // 如果值包含特殊字符，用引号包裹
  if (/[,\(\)~]/.test(str)) {
    return `"${str.replace(/"/g, '\\"')}"`;
  }
  return str;
}

function conditionToWhere(condition: FilterCondition): string {
  const nocodbOp = OPERATOR_MAP[condition.operator];
  if (!nocodbOp) return "";

  const field = condition.field;
  const value = condition.value;

  // 特殊处理
  switch (condition.operator) {
    case "is_empty":
      return `(${field},${nocodbOp},null)`;
    case "is_not_empty":
      return `(${field},${nocodbOp},null)`;
    case "contains":
      return `(${field},${nocodbOp},%${escapeValue(value)}%)`;
    case "not_contains":
      return `(${field},${nocodbOp},%${escapeValue(value)}%)`;
    case "starts_with":
      return `(${field},${nocodbOp},${escapeValue(value)}%)`;
    case "ends_with":
      return `(${field},${nocodbOp},%${escapeValue(value)})`;
    case "between": {
      const [min, max] = Array.isArray(value)
        ? value
        : String(value).split(",");
      return `(${field},${nocodbOp},${escapeValue(min)},${escapeValue(max)})`;
    }
    case "in": {
      const vals = Array.isArray(value) ? value : [value];
      return `(${field},${nocodbOp},${vals.map(escapeValue).join(",")})`;
    }
    default:
      return `(${field},${nocodbOp},${escapeValue(value)})`;
  }
}

export function filterToWhere(filter: FilterCondition | FilterGroup | null | undefined): string {
  if (!filter) return "";

  if ("logicalOperator" in filter) {
    // FilterGroup
    const parts = filter.conditions
      .map((c) => filterToWhere(c))
      .filter(Boolean);
    if (parts.length === 0) return "";
    if (parts.length === 1) return parts[0];

    const joinOp =
      filter.logicalOperator === "AND" ? "~and" : "~or";
    return parts.length === 2
      ? `${parts[0]}${joinOp}${parts[1]}`
      : parts
          .reduce(
            (acc, part, i) =>
              i === 0 ? part : `${acc}${joinOp}(${part})`,
            ""
          );
  }

  // FilterCondition
  return conditionToWhere(filter as FilterCondition);
}

export function sortToNocoDB(sorts: { field: string; order: "asc" | "desc" }[]): string {
  if (!sorts || sorts.length === 0) return "";
  return sorts
    .map((s) => (s.order === "desc" ? `-${s.field}` : s.field))
    .join(",");
}
```

- [ ] **Step 2: 验证**

```bash
ls -la src/lib/nocodb/filter-mapper.ts
```

- [ ] **Step 3: 提交**

```bash
git add src/lib/nocodb/filter-mapper.ts
git commit -m "feat(nocodb): add filter mapper for NocoDB where syntax"
```

---

## Task 5: 数据适配器

**Files:**
- Create: `src/lib/nocodb/adapter.ts`
- Create: `src/lib/nocodb/index.ts`

- [ ] **Step 1: 先读取现有类型定义**

```bash
head -100 src/types/data-table.ts
```

了解 `DataTableListItem`、`DataTableDetail`、`DataRecordItem`、`PaginatedRecords` 等类型的精确结构。

- [ ] **Step 2: 创建适配器**

```typescript
// src/lib/nocodb/adapter.ts

import * as nocodb from "./client";
import { mapColumns, type MappedField } from "./field-mapper";
import { filterToWhere, sortToNocoDB } from "./filter-mapper";

// ---- 返回类型（与现有系统兼容） ----

export interface TableSummary {
  id: string;
  name: string;
  fieldCount: number;
  recordCount: number;
}

export interface TableDetail {
  id: string;
  name: string;
  fields: MappedField[];
}

export interface RecordData {
  id: string | number;
  data: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaginatedResult {
  records: RecordData[];
  total: number;
  page: number;
  pageSize: number;
}

// ---- 适配方法 ----

export async function listTables(): Promise<TableSummary[]> {
  const result = await nocodb.listTables();
  return (result.list || []).map((t) => ({
    id: t.id,
    name: t.title,
    fieldCount: t.columns?.length ?? 0,
    recordCount: 0, // NocoDB 不在 list 中返回记录数，需要单独查询
  }));
}

export async function getTableDetail(tableId: string): Promise<TableDetail> {
  const table = await nocodb.getTable(tableId);
  const fields = mapColumns(table.columns || []);
  return {
    id: table.id,
    name: table.title,
    fields,
  };
}

export async function getTableFields(
  tableId: string
): Promise<MappedField[]> {
  const detail = await getTableDetail(tableId);
  return detail.fields;
}

export async function listRecords(
  tableId: string,
  options?: {
    page?: number;
    pageSize?: number;
    search?: string;
    where?: string;
    sort?: string;
    fields?: string[];
  }
): Promise<PaginatedResult> {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 50;
  const offset = (page - 1) * pageSize;

  const params: Parameters<typeof nocodb.listRecords>[1] = {
    limit: pageSize,
    offset,
  };

  if (options?.where) {
    params.where = options.where;
  }
  if (options?.sort) {
    params.sort = options.sort;
  }
  if (options?.fields?.length) {
    params.fields = options.fields.join(",");
  }

  const result = await nocodb.listRecords(tableId, params);

  return {
    records: (result.list || []).map((row) => ({
      id: row.Id ?? row.id ?? 0,
      data: Object.fromEntries(
        Object.entries(row).filter(([k]) => k !== "Id" && k !== "id")
      ),
    })),
    total: result.pageInfo?.totalRows ?? 0,
    page: result.pageInfo?.page ?? page,
    pageSize: result.pageInfo?.pageSize ?? pageSize,
  };
}

export async function getRecord(
  tableId: string,
  recordId: string | number
): Promise<RecordData> {
  const row = await nocodb.getRecord(tableId, String(recordId));
  const id = row.Id ?? row.id ?? recordId;
  return {
    id,
    data: Object.fromEntries(
      Object.entries(row).filter(([k]) => k !== "Id" && k !== "id")
    ),
  };
}

export async function createRecord(
  tableId: string,
  data: Record<string, unknown>
): Promise<RecordData> {
  const row = await nocodb.createRecord(tableId, data);
  return {
    id: row.Id ?? row.id ?? 0,
    data: Object.fromEntries(
      Object.entries(row).filter(([k]) => k !== "Id" && k !== "id")
    ),
  };
}

export async function updateRecord(
  tableId: string,
  recordId: string | number,
  data: Record<string, unknown>
): Promise<RecordData> {
  const row = await nocodb.updateRecord(tableId, recordId, data);
  return {
    id: row.Id ?? row.id ?? recordId,
    data: Object.fromEntries(
      Object.entries(row).filter(([k]) => k !== "Id" && k !== "id")
    ),
  };
}

export async function deleteRecord(
  tableId: string,
  recordId: string | number
): Promise<void> {
  await nocodb.deleteRecord(tableId, [recordId]);
}

export async function findRecords(
  tableId: string,
  field: string,
  value: unknown
): Promise<RecordData[]> {
  const where = `(${field},eq,${value})`;
  const result = await listRecords(tableId, { where, pageSize: 10 });
  return result.records;
}

export async function batchCreateRecords(
  tableId: string,
  records: Record<string, unknown>[]
): Promise<RecordData[]> {
  const result = await nocodb.batchCreateRecords(tableId, records);
  return (result.list || []).map((row) => ({
    id: row.Id ?? row.id ?? 0,
    data: Object.fromEntries(
      Object.entries(row).filter(([k]) => k !== "Id" && k !== "id")
    ),
  }));
}

// ---- 重新导出底层功能 ----

export { healthCheck, createWebhook, type NocoDBWebhook } from "./client";
export { filterToWhere, sortToNocoDB } from "./filter-mapper";
export { mapColumns, type MappedField } from "./field-mapper";
```

- [ ] **Step 3: 创建统一导出**

```typescript
// src/lib/nocodb/index.ts

export * from "./adapter";
export * from "./client";
export * from "./field-mapper";
export * from "./filter-mapper";
```

- [ ] **Step 4: 类型检查**

```bash
npx tsc --noEmit --pretty 2>&1 | grep "nocodb" | head -20
```

修复任何类型错误。

- [ ] **Step 5: 提交**

```bash
git add src/lib/nocodb/
git commit -m "feat(nocodb): add data adapter and unified exports"
```

---

## Task 6: 环境变量配置

**Files:**
- Modify: `.env.example`
- Modify: `.env.local`（如果存在）

- [ ] **Step 1: 添加环境变量到 .env.example**

在 `.env.example` 中添加：

```env
# NocoDB Integration
NOCODB_URL=http://localhost:8040
NOCODB_API_TOKEN=
NOCODB_BASE_ID=
```

- [ ] **Step 2: 在 .env.local 中配置实际值**

确认 NocoDB 可访问：

```bash
curl -s http://localhost:8040/api/v1/db/meta/projects -H "xc-token: test" | head -20
```

需要用户提供实际的 API Token 和 Base ID。

- [ ] **Step 3: 提交**

```bash
git add .env.example
git commit -m "feat(nocodb): add NocoDB environment variables to .env.example"
```

---

## Task 7: NocoDB 代理 API 路由

**Files:**
- Create: `src/app/api/nocodb/tables/route.ts`
- Create: `src/app/api/nocodb/tables/[tableId]/route.ts`
- Create: `src/app/api/nocodb/tables/[tableId]/records/route.ts`
- Create: `src/app/api/nocodb/health/route.ts`

这些路由替代现有的 `/api/data-tables/` 路由，供前端组件调用。

- [ ] **Step 1: 创建健康检查路由**

```typescript
// src/app/api/nocodb/health/route.ts

import { NextResponse } from "next/server";
import { healthCheck } from "@/lib/nocodb";

export async function GET() {
  const ok = await healthCheck();
  return NextResponse.json({
    connected: ok,
    url: process.env.NOCODB_URL || "http://localhost:8040",
  });
}
```

- [ ] **Step 2: 创建表列表路由**

```typescript
// src/app/api/nocodb/tables/route.ts

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listTables } from "@/lib/nocodb";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tables = await listTables();
    return NextResponse.json({ data: tables });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { error: { code: "NOCODB_ERROR", message } },
      { status: 502 }
    );
  }
}
```

- [ ] **Step 3: 创建表详情路由**

```typescript
// src/app/api/nocodb/tables/[tableId]/route.ts

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTableDetail } from "@/lib/nocodb";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tableId } = await params;

  try {
    const table = await getTableDetail(tableId);
    return NextResponse.json({ data: table });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { error: { code: "NOCODB_ERROR", message } },
      { status: 502 }
    );
  }
}
```

- [ ] **Step 4: 创建记录 CRUD 路由**

```typescript
// src/app/api/nocodb/tables/[tableId]/records/route.ts

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  listRecords,
  createRecord,
  updateRecord,
  deleteRecord,
} from "@/lib/nocodb";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tableId } = await params;
  const { searchParams } = new URL(request.url);

  try {
    const result = await listRecords(tableId, {
      page: Number(searchParams.get("page") || "1"),
      pageSize: Number(searchParams.get("pageSize") || "50"),
      search: searchParams.get("search") || undefined,
      where: searchParams.get("where") || undefined,
      sort: searchParams.get("sort") || undefined,
    });
    return NextResponse.json({ data: result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { error: { code: "NOCODB_ERROR", message } },
      { status: 502 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tableId } = await params;
  const body = await request.json();

  try {
    const record = await createRecord(tableId, body);
    return NextResponse.json({ data: record });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { error: { code: "NOCODB_ERROR", message } },
      { status: 502 }
    );
  }
}
```

- [ ] **Step 5: 类型检查**

```bash
npx tsc --noEmit --pretty 2>&1 | grep "nocodb" | head -20
```

- [ ] **Step 6: 提交**

```bash
git add src/app/api/nocodb/
git commit -m "feat(nocodb): add NocoDB proxy API routes"
```

---

## Task 8: 数据表管理页改为 iframe

**Files:**
- Modify: `src/app/(dashboard)/data/page.tsx`

- [ ] **Step 1: 读取现有页面代码**

```bash
cat src/app/(dashboard)/data/page.tsx
```

- [ ] **Step 2: 重写页面**

```typescript
// src/app/(dashboard)/data/page.tsx

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink, RefreshCw, Settings } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function DataPage() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [nocodbUrl, setNocodbUrl] = useState(
    process.env.NEXT_PUBLIC_NOCODB_URL || "http://localhost:8040"
  );

  useEffect(() => {
    fetch("/api/nocodb/health")
      .then((r) => r.json())
      .then((data) => setConnected(data.connected))
      .catch(() => setConnected(false));
  }, []);

  if (connected === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <h2 className="text-lg font-semibold">NocoDB 未连接</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              请确认 NocoDB 服务已启动，并在环境变量中正确配置
              NOCODB_URL、NOCODB_API_TOKEN 和 NOCODB_BASE_ID。
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">主数据表</span>
          <span className="text-xs text-muted-foreground">
            Powered by NocoDB
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open(nocodbUrl, "_blank")}
          >
            <ExternalLink className="mr-1 h-4 w-4" />
            在新窗口打开
          </Button>
        </div>
      </div>

      {/* iframe 嵌入 NocoDB */}
      <div className="flex-1">
        <iframe
          src={nocodbUrl}
          className="h-full w-full border-0"
          title="NocoDB 数据表"
          allow="clipboard-read; clipboard-write"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 验证页面加载**

启动 dev server 后访问 `http://localhost:8060/data`，确认 iframe 显示 NocoDB。

- [ ] **Step 4: 提交**

```bash
git add src/app/(dashboard)/data/page.tsx
git commit -m "feat(nocodb): replace data table page with NocoDB iframe"
```

---

## Task 9: 改造数据表关联组件

**Files:**
- Modify: `src/components/template/data-table-link.tsx`

- [ ] **Step 1: 读取现有组件**

```bash
cat src/components/template/data-table-link.tsx
```

- [ ] **Step 2: 将 API 调用改为 NocoDB 代理路由**

关键变更：将 `fetch("/api/data-tables")` 改为 `fetch("/api/nocodb/tables")`，将 `fetch("/api/data-tables/${id}/fields")` 改为 `fetch("/api/nocodb/tables/${id}")`。

需要适配返回格式：
- 旧: `{ data: { id, name, fields: [...] } }`
- 新: `{ data: { id, name, fields: MappedField[] } }`

MappedField 的 `key` 字段对应旧的 `key`，`type` 对应旧的 `type`。前端组件的核心逻辑（选择表、绑定 dataTableId）不变，只是数据来源变了。

具体改动：
1. 表列表 API：`/api/data-tables` → `/api/nocodb/tables`
2. 字段列表 API：`/api/data-tables/${id}/fields` → `/api/nocodb/tables/${id}`
3. 字段结构：`{ id, key, label, type }` → `{ nocodbColumnId, key, label, type }`
4. dataTableId 现在存的是 NocoDB table ID（如 `mxxxxxxx`）

- [ ] **Step 3: 验证**

启动 dev server，打开模板配置页面，确认能列出 NocoDB 表并绑定。

- [ ] **Step 4: 提交**

```bash
git add src/components/template/data-table-link.tsx
git commit -m "feat(nocodb): update data-table-link to use NocoDB API"
```

---

## Task 10: 改造字段映射对话框

**Files:**
- Modify: `src/components/template/field-mapping-dialog.tsx`

- [ ] **Step 1: 读取现有组件**

```bash
cat src/components/template/field-mapping-dialog.tsx
```

- [ ] **Step 2: 将字段获取改为 NocoDB API**

关键变更：
1. 字段列表 API：改为 `fetch("/api/nocodb/tables/${dataTableId}")`
2. 字段结构适配：`MappedField` 的 `key` 用于映射，`label` 用于显示

自动匹配逻辑（按 key 相同匹配）不需要改变。

- [ ] **Step 3: 验证**

在模板配置页面打开字段映射对话框，确认字段列表正确显示。

- [ ] **Step 4: 提交**

```bash
git add src/components/template/field-mapping-dialog.tsx
git commit -m "feat(nocodb): update field-mapping-dialog to use NocoDB fields"
```

---

## Task 11: 改造数据选择器

**Files:**
- Modify: `src/components/forms/data-picker-dialog.tsx`
- Modify: `src/app/api/placeholders/[id]/picker-data/route.ts`

- [ ] **Step 1: 读取 picker-data API 路由**

```bash
cat src/app/api/placeholders/[id]/picker-data/route.ts
```

- [ ] **Step 2: 改造 picker-data API 路由**

将底层从 `db.dataRecord` 改为调用 NocoDB adapter：

1. 从 placeholder 获取 `sourceTableId`（现在是 NocoDB table ID）
2. 从 placeholder 获取 `sourceField`
3. 调用 `listRecords(sourceTableId, { ... })` 获取数据
4. 返回格式保持不变：`{ fields: [...], records: [...] }`

- [ ] **Step 3: 改造 data-picker-dialog**

如果前端直接调 API，API 路由改了就行。如果前端有硬编码的 URL，也需要更新。

确认 data-picker-dialog 是否需要额外改动：
- API 响应格式保持一致的话，前端不需要改动
- 字段显示名用 `label`，值用 `data[fieldKey]`

- [ ] **Step 4: 验证**

在模板填充页面，点击数据选择器，确认能弹出 NocoDB 数据。

- [ ] **Step 5: 提交**

```bash
git add src/app/api/placeholders/ src/components/forms/data-picker-dialog.tsx
git commit -m "feat(nocodb): update data picker to use NocoDB adapter"
```

---

## Task 12: 改造级联填充

**Files:**
- Modify: `src/app/api/fill/resolve-cascade/route.ts`

- [ ] **Step 1: 读取现有路由**

```bash
cat src/app/api/fill/resolve-cascade/route.ts
```

- [ ] **Step 2: 改造级联逻辑**

核心变更：
1. 获取 placeholder 的 `sourceTableId`（现在是 NocoDB table ID）
2. 用 `getRecord(sourceTableId, recordId)` 获取选中记录
3. RELATION 字段解析：用 NocoDB 的 link 数据（记录中的 link 字段值是关联记录 ID 列表）
4. 返回格式保持不变

关联字段的值获取方式：
- NocoDB 记录中，Link 字段返回的是关联记录的 Id 列表
- 需要额外调用 `getRecord(targetTableId, linkedId)` 获取关联记录的显示值

- [ ] **Step 3: 验证**

在模板填充页面选择一条记录，确认所有关联字段自动填充。

- [ ] **Step 4: 提交**

```bash
git add src/app/api/fill/resolve-cascade/route.ts
git commit -m "feat(nocodb): update cascade resolve to use NocoDB adapter"
```

---

## Task 13: 改造批量生成

**Files:**
- Modify: `src/components/batch/step1-select-data.tsx`
- Modify: `src/components/batch/step2-field-mapping.tsx`
- Modify: `src/lib/services/batch-generation.service.ts`

- [ ] **Step 1: 读取 step1 组件**

```bash
cat src/components/batch/step1-select-data.tsx | head -150
```

- [ ] **Step 2: 改造 step1 数据选择**

将 API 调用从 `/api/data-tables` 改为 `/api/nocodb/tables`，从 `/api/data-tables/${id}/records` 改为 `/api/nocodb/tables/${id}/records`。

需要适配的字段：
- 表列表：返回 `TableSummary[]`，有 `id`、`name`、`fieldCount`
- 记录列表：返回 `PaginatedResult`，有 `records`、`total`、`page`

- [ ] **Step 3: 改造 step2 字段映射**

将字段获取从 `/api/data-tables/${id}/fields` 改为 `/api/nocodb/tables/${id}`。

- [ ] **Step 4: 改造 batch-generation.service.ts**

关键变更：
1. `listDataTables()` → 调 NocoDB adapter 的 `listTables()`
2. `getDataTableFields()` → 调 NocoDB adapter 的 `getTableFields()`
3. `listDataRecords()` → 调 NocoDB adapter 的 `listRecords()`
4. 记录数据结构：旧的是 `data: JSONB`，新的也是 `data: Record<string, unknown>`
5. `buildFormData()` 需要用 field mapping 转换 NocoDB 字段名到 placeholder key

- [ ] **Step 5: 验证**

走一遍完整的批量生成流程：选择模板 → 选择数据 → 字段映射 → 生成。

- [ ] **Step 6: 提交**

```bash
git add src/components/batch/ src/lib/services/batch-generation.service.ts
git commit -m "feat(nocodb): update batch generation to use NocoDB adapter"
```

---

## Task 14: 改造 MCP Server

**Files:**
- Rewrite: `mcp-server/src/api-client.ts`
- Modify: `mcp-server/src/index.ts`

- [ ] **Step 1: 重写 MCP API 客户端**

将 `mcp-server/src/api-client.ts` 完全重写为 NocoDB API 客户端。

关键变更：
- `API_BASE_URL` → `NOCODB_URL`
- `API_TOKEN` (Bearer) → `NOCODB_API_TOKEN` (xc-token)
- 添加 `NOCODB_BASE_ID` 配置
- 所有 API 路径改为 NocoDB v2 路径
- 响应格式转换：NocoDB 的 `{ list, pageInfo }` → 现有的 `{ data, pagination }`

对外方法签名保持不变，确保 `index.ts` 中的工具实现不需要大改。

- [ ] **Step 2: 更新 MCP 工具实现**

在 `mcp-server/src/index.ts` 中：
1. `list_tables`：调 `client.listTables()` → 映射为 `{ tableId, name, fields: [...] }`
2. `get_table_schema`：调 `client.getTable(tableId)` → 映射字段类型
3. `list_records`：调 `client.listRecords(tableId, params)` → 映射分页
4. `create_record`：调 `client.createRecord(tableId, data)`
5. `update_record`：调 `client.updateRecord(tableId, recordId, data)`
6. `delete_record`：调 `client.deleteRecord(tableId, recordId)`
7. `find_or_create`：先 listRecords + filter → 未找到则 createRecord
8. `upsert_record`：先 listRecords + filter → 找到则 updateRecord，否则 createRecord
9. `batch_create`：调 `client.batchCreateRecords(tableId, records)`
10. `link_records`：调 `client.linkRecords(tableId, fieldId, recordId, linkedIds)`

- [ ] **Step 3: 更新 MCP 配置**

在 `mcp-server/` 目录下更新环境变量文档或配置模板。

- [ ] **Step 4: 测试 MCP Server**

```bash
cd mcp-server && npm run build && npm start
```

使用 MCP Inspector 或直接测试工具调用。

- [ ] **Step 5: 提交**

```bash
git add mcp-server/
git commit -m "feat(nocodb): rewrite MCP server to use NocoDB API"
```

---

## Task 15: 清理旧代码

**Files:**
- Delete: 数据表相关旧文件（见上方删除文件列表）
- Modify: `prisma/schema.prisma`

这是风险最高的 Task，需要在所有改造完成后执行。

- [ ] **Step 1: 确认所有引用已迁移**

```bash
grep -r "data-table\.service\|data-record\.service\|data-field\.service\|data-relation\.service\|data-view\.service" src/ --include="*.ts" --include="*.tsx" -l
```

确认没有文件引用旧的 service。

- [ ] **Step 2: 删除旧 Service 文件**

```bash
rm src/lib/services/data-table.service.ts
rm src/lib/services/data-field.service.ts
rm src/lib/services/data-record.service.ts
rm src/lib/services/data-relation.service.ts
rm src/lib/services/data-view.service.ts
rm src/validators/data-table.ts
```

- [ ] **Step 3: 删除旧 API 路由**

```bash
rm -rf src/app/api/data-tables/
rm -rf src/app/api/v1/data-tables/
```

- [ ] **Step 4: 删除旧前端组件**

```bash
rm -rf src/app/\(dashboard\)/data/\[tableId\]/
rm -rf src/components/data/views/
rm src/components/data/create-table-dialog.tsx
rm src/components/data/import-table-dialog.tsx
rm src/components/data/record-table.tsx
rm src/components/data/table-detail-content.tsx
rm src/components/data/table-card.tsx
```

注意：只删除以上列出的文件，保留 `src/components/data/` 下其他仍需要的组件。

- [ ] **Step 5: 更新 Prisma Schema**

从 `prisma/schema.prisma` 中移除以下模型：
- `DataTable`
- `DataField`
- `DataRecord`
- `DataView`
- `DataRelationRow`
- `DataRecordChangeHistory`
- `DataRecordComment`

同时移除这些模型上的关联关系（其他模型中引用它们的字段）。

确认 `Template.dataTableId` 和 `Placeholder.sourceTableId`、`Placeholder.sourceField` 字段保留（它们现在存 NocoDB ID）。

- [ ] **Step 6: 推送 Schema 变更**

```bash
npx prisma db push
npx prisma generate
```

- [ ] **Step 7: 检查构建**

```bash
npx tsc --noEmit
npm run build
```

修复所有编译错误。

- [ ] **Step 8: 提交**

```bash
git add -A
git commit -m "refactor(nocodb): remove old data table code and Prisma models"
```

---

## Task 16: 端到端验证

- [ ] **Step 1: 启动所有服务**

```bash
# 1. NocoDB（Docker，应该已在运行）
curl http://localhost:8040/api/v1/health

# 2. 主应用
npm run dev  # port 8060

# 3. Report Engine（如需要批量生成）
cd report-engine && .venv/bin/python main.py  # port 8066
```

- [ ] **Step 2: 测试数据表管理**

访问 `http://localhost:8060/data`：
- 确认 iframe 加载 NocoDB
- 在 NocoDB 中创建一个测试表和几条记录

- [ ] **Step 3: 测试模板绑定**

1. 创建/打开一个模板
2. 绑定到 NocoDB 表（data-table-link）
3. 配置字段映射（field-mapping-dialog）

- [ ] **Step 4: 测试模板填充**

1. 打开模板填充页面
2. 使用数据选择器从 NocoDB 表选记录
3. 确认级联填充正常
4. 生成文档

- [ ] **Step 5: 测试批量生成**

1. 打开批量生成页面
2. 选择 NocoDB 表和记录
3. 配置字段映射
4. 批量生成文档

- [ ] **Step 6: 测试 MCP 工具**

通过 Claude Desktop 或 MCP Inspector 调用 MCP 工具：
- `list_tables`
- `list_records`
- `create_record`

- [ ] **Step 7: 提交验证结果**

如有修复，逐个提交。
