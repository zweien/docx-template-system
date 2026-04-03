# AI-Agent2 数据操作优化设计

> 2026-04-04

## 背景

ai-agent2 的 `tool-helpers.ts` 包含简化版 CRUD 和查询实现，绕过了 `data-record.service.ts` 的正式服务层。这导致关系子表格数据未同步、聚合查询全表加载到内存、数字/日期比较无法下推到数据库、系统提示缺少领域上下文等问题。

## 方案选择

| 方案 | 描述 | 优点 | 缺点 |
|------|------|------|------|
| A: 委托服务层 | tool-executor 调用 data-record.service | 零重复代码，自动获得事务/关系/验证 | 需适配返回格式 |
| B: 合并为统一服务 | 合并 tool-helpers 和 data-record.service | 统一入口 | 改动范围大，风险高 |
| C: 补齐 tool-helpers | 在 tool-helpers 中补齐关系/事务/验证 | 不影响现有服务 | 维持两套实现 |

**选定方案 A**：改动最小，收益最大。删除重复代码，委托给正式服务层即可获得所有能力。

## 分批实施

- **P0**：CRUD 委托 + 聚合原生 SQL
- **P1**：数字/日期过滤下推 + 关系字段解析 + Schema 增强
- **P2**：动态系统提示 + 文档生成对接 + 搜索增强

---

## P0：核心修复

### 0.1 CRUD 操作委托

**现状**：`tool-executor.ts` → `tool-helpers.ts`（简化版，无事务、无关系同步、无验证）

**目标**：`tool-executor.ts` → `data-record.service.ts`（完整版）

改动：

1. `tool-executor.ts` 的 `executeToolAction` 函数中，将 `createRecord`/`updateRecord`/`deleteRecord` 三个 case 改为调用 `data-record.service.ts` 的对应函数
2. `tool-helpers.ts` 删除 `createRecord`、`updateRecord`、`deleteRecord` 三个函数（约 100 行）

```typescript
// tool-executor.ts
import * as recordService from "@/lib/services/data-record.service";

case "createRecord": {
  const result = await recordService.createRecord(
    userId,
    toolInput.tableId as string,
    toolInput.data as Record<string, unknown>
  );
  if (!result.success) return { success: false, error: result.error.message };
  return { success: true, data: result.data };
}

case "updateRecord": {
  const result = await recordService.updateRecord(
    toolInput.recordId as string,
    toolInput.data as Record<string, unknown>
  );
  if (!result.success) return { success: false, error: result.error.message };
  return { success: true, data: result.data };
}

case "deleteRecord": {
  const result = await recordService.deleteRecord(
    toolInput.recordId as string
  );
  if (!result.success) return { success: false, error: result.error.message };
  return { success: true, data: result.data };
}
```

**获得的能力**：
- `$transaction` 事务保护
- `syncRelationSubtableValues` 关系子表格同步（创建/更新时）
- `removeAllRelationsForRecord` 关系行清理（删除时）
- `refreshSnapshotsForTargetRecord` 关系快照刷新（更新时）
- `validateRecordData` 数据验证（必填、类型、选项）

### 0.2 聚合查询优化

**现状**：sum/avg/min/max 加载全表记录到 JS 计算，count 使用数据库 `count()`

**目标**：所有聚合操作使用 PostgreSQL 原生 JSONB 聚合

在 `tool-helpers.ts` 中新增辅助函数：

```typescript
import { db } from "@/lib/db";

// 字段名白名单校验：只允许安全字符，防止 SQL 注入
function isSafeIdentifier(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

/**
 * 将 FilterCondition[] 转换为原生 SQL WHERE 子句
 * 根据字段类型选择正确的 CAST 方式
 *
 * 安全策略：字段名通过白名单校验（isSafeIdentifier）+ 字段存在性双重保护
 */
function buildSqlWhereClause(
  tableId: string,
  filters: FilterCondition[],
  fields: Array<{ key: string; type: string }>
): { sql: string; params: unknown[] } {
  const params: unknown[] = [];
  const conditions: string[] = [`"tableId" = $${params.push(tableId)}`];

  for (const filter of filters) {
    const field = fields.find(f => f.key === filter.field);
    if (!field || !isSafeIdentifier(filter.field)) continue;

    const paramIdx = params.push(filter.value);
    // 字段名已通过 isSafeIdentifier 校验，可安全拼接
    const jsonPath = `data->>'${filter.field}'`;

    switch (filter.operator) {
      case "eq":
        conditions.push(`${jsonPath} = $${paramIdx}`);
        break;
      case "ne":
        conditions.push(`${jsonPath} != $${paramIdx}`);
        break;
      case "contains":
        conditions.push(`${jsonPath} LIKE '%' || $${paramIdx} || '%'`);
        break;
      case "gt":
      case "gte":
      case "lt":
      case "lte": {
        if (field.type === "NUMBER") {
          const op = { gt: ">", gte: ">=", lt: "<", lte: "<=" }[filter.operator];
          conditions.push(`CAST(${jsonPath} AS NUMERIC) ${op} $${paramIdx}`);
        } else if (field.type === "DATE") {
          const op = { gt: ">", gte: ">=", lt: "<", lte: "<=" }[filter.operator];
          conditions.push(`CAST(${jsonPath} AS DATE) ${op} CAST($${paramIdx} AS DATE)`);
        }
        break;
      }
      case "in":
        if (Array.isArray(filter.value)) {
          const placeholders = filter.value.map(() => `$${params.push(null)}`);
          let i = params.length - filter.value.length;
          for (const v of filter.value) {
            params[i++] = v;
          }
          conditions.push(`${jsonPath} IN (${placeholders.join(", ")})`);
        }
        break;
    }
  }

  return { sql: conditions.join(" AND "), params };
}
```

聚合查询改造：

```typescript
export async function aggregateRecords(params) {
  // count 仍用 Prisma（已足够高效）
  if (operation === "count") {
    const count = await db.dataRecord.count({ where });
    return { success: true, data: { value: count, field, operation } };
  }

  // sum/avg/min/max: 原生 SQL
  const tableFields = await db.dataField.findMany({ where: { tableId } });
  const targetField = tableFields.find(f => f.key === field);

  if (!targetField) {
    return { success: false, error: { code: "NOT_FOUND", message: "聚合字段不存在" } };
  }

  const castType = targetField.type === "DATE" ? "DATE" : "NUMERIC";
  const sqlOperation = {
    sum: "SUM",
    avg: "AVG",
    min: "MIN",
    max: "MAX",
  }[operation];

  // 字段名白名单校验
  if (!isSafeIdentifier(field)) {
    return { success: false, error: { code: "INVALID_FIELD", message: "无效字段名" } };
  }

  const { sql: whereSql, params: whereParams } = buildSqlWhereClause(
    tableId, filters, tableFields
  );

  const result = await db.$queryRawUnsafe<Array<{ value: number }>>(
    `SELECT COALESCE(${sqlOperation}(CAST(data->>'${field}' AS ${castType})), 0) as value
     FROM "DataRecord"
     WHERE ${whereSql}`,
    ...whereParams
  );

  return { success: true, data: { value: Number(result[0].value), field, operation } };
}
```

---

## P1：性能与功能增强

### 1.1 数字/日期过滤下推

**现状**：`searchRecords` 遇到 gt/gte/lt/lte 时跳过 Prisma 条件，全表加载后 JS 过滤

**目标**：使用原生 SQL 实现数据库侧过滤

改造 `searchRecords`：
- 当 filters 包含数字或日期比较操作符时，走 `$queryRawUnsafe` 路径
- 无数字/日期比较时，保持现有 Prisma 查询路径
- 原生 SQL 路径中实现 LIMIT/OFFSET 分页

```typescript
if (hasAdvancedFilters) {
  const { sql: whereSql, params: whereParams } = buildSqlWhereClause(
    tableId, typedFilters, table.fields
  );

  // 获取总数
  const countResult = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*) as count FROM "DataRecord" WHERE ${whereSql}`,
    ...whereParams
  );
  const total = Number(countResult[0].count);

  // 构建 ORDER BY — sortBy 需通过白名单校验
  const safeSortBy = sortBy && table.fields.find(f => f.key === sortBy) && isSafeIdentifier(sortBy)
    ? sortBy
    : null;
  const direction = sortOrder === "asc" ? "ASC" : "DESC";
  const orderClause = safeSortBy
    ? `ORDER BY data->>'${safeSortBy}' ${direction}`
    : `ORDER BY "createdAt" DESC`;

  // LIMIT/OFFSET 通过参数化传入，防止注入
  const limitParamIdx = whereParams.push(pageSize);
  const offsetParamIdx = whereParams.push((page - 1) * pageSize);

  const records = await db.$queryRawUnsafe<Array<{ id: string; data: unknown }>>(
    `SELECT id, data FROM "DataRecord"
     WHERE ${whereSql}
     ${orderClause}
     LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx}`,
    ...whereParams
  );

  return {
    success: true,
    data: {
      records: records.map(r => ({ id: r.id, ...(r.data as Record<string, unknown>) })),
      total,
      page,
      pageSize,
    },
  };
}
```

字段类型感知的处理规则：

| 字段类型 | 过滤方式 | 排序方式 | 聚合 |
|---------|---------|---------|------|
| TEXT/EMAIL/PHONE | string_contains / equals | 文本排序 | 不适用 |
| NUMBER | `CAST(data->>'field' AS NUMERIC)` 比较 | 数值排序 | sum/avg/min/max |
| DATE | `CAST(data->>'field' AS DATE)` 比较 | 日期排序 | min/max |
| SELECT/MULTISELECT | equals / in | 文本排序 | count |
| FILE | 不参与过滤 | 不排序 | 不适用 |
| RELATION | equals（按 ID） | 按 display 排序 | count |
| RELATION_SUBTABLE | 不参与过滤 | 不排序 | 不适用 |

### 1.2 searchRecords 解析关系字段

**现状**：RELATION 字段返回原始 ID（如 `"author_id_123"`）

**目标**：返回 `{ id, display }` 格式

参照 `data-record.service.ts:238-288` 的批量解析模式，在 `searchRecords` 返回前增加关系解析：

```typescript
// 获取 RELATION 类型字段
const relationFields = table.fields.filter(
  f => f.type === "RELATION" && f.relationTo && f.displayField
);

if (relationFields.length > 0) {
  // 收集所有关联 ID
  const relationIdsByTable = new Map<string, Set<string>>();
  for (const field of relationFields) {
    if (!relationIdsByTable.has(field.relationTo!)) {
      relationIdsByTable.set(field.relationTo!, new Set());
    }
    const ids = relationIdsByTable.get(field.relationTo!)!;
    for (const record of resultRecords) {
      const relId = record[field.key];
      if (typeof relId === "string" && relId) ids.add(relId);
    }
  }

  // 批量查询关联记录
  const relatedMap = new Map<string, Record<string, unknown>>();
  for (const [, ids] of relationIdsByTable) {
    if (ids.size > 0) {
      const related = await db.dataRecord.findMany({
        where: { id: { in: Array.from(ids) } },
      });
      for (const r of related) {
        relatedMap.set(r.id, r.data as Record<string, unknown>);
      }
    }
  }

  // 替换为 display 值
  for (const record of resultRecords) {
    for (const field of relationFields) {
      const relId = record[field.key];
      if (typeof relId === "string" && relId) {
        const data = relatedMap.get(relId);
        if (data && field.displayField) {
          record[field.key] = { id: relId, display: data[field.displayField] ?? relId };
        }
      }
    }
  }
}
```

### 1.3 getTableSchema 返回关系信息

**现状**：只返回 `{ key, label, type, required, options }`

**目标**：增加关系字段元数据和类型描述

```typescript
fields: table.fields.map(f => ({
  key: f.key,
  label: f.label,
  type: f.type,
  required: f.required,
  options: f.options as string[] | undefined,
  // 新增
  relationTo: f.relationTo ?? undefined,               // 关联目标表 ID
  displayField: f.displayField ?? undefined,           // 显示字段 key
  cardinality: f.relationCardinality ?? undefined,     // SINGLE | MULTIPLE（注意：Prisma schema 中字段名为 relationCardinality）
}))
```

---

## P2：体验提升

### 2.1 系统提示动态注入上下文

**现状**：`buildSystemPrompt()` 返回纯静态文本

**目标**：动态注入表结构概要，让 AI 了解当前系统中有哪些数据

改造 `context-builder.ts`：

```typescript
export async function buildSystemPrompt(): Promise<string> {
  let tableContext = "";

  try {
    const tablesResult = await listTables();
    if (tablesResult.success && tablesResult.data.length > 0) {
      tableContext = "\n## 当前系统数据表概览\n";
      for (const t of tablesResult.data.slice(0, 5)) {
        const schema = await getTableSchema(t.id);
        if (schema.success) {
          tableContext += `\n### ${t.name}（ID: ${t.id}，${t.recordCount} 条记录）\n`;
          tableContext += "字段：" + schema.data.fields
            .map(f => {
              let desc = `${f.label}(${f.type})`;
              if (f.required) desc += "[必填]";
              if (f.options?.length) desc += `[选项: ${f.options.join("/")}]`;
              if (f.relationTo) desc += `[关联→${f.relationTo}]`;
              return desc;
            })
            .join("、") + "\n";
        }
      }
      tableContext += "\n提示：使用 getTableSchema(tableId) 可获取完整字段定义。如需查询其他表，先用 listTables() 查看所有表。\n";
    }
  } catch {
    // 动态上下文获取失败时不影响系统正常运行
  }

  return `你是一个系统集成 AI 助手，能够操作本系统的数据表、模板和记录。

## 能力范围
- 查询和管理数据表（查看、搜索、聚合）
- 创建、更新、删除记录
- 查看和生成文档（基于模板）
- 生成数据可视化图表
- 获取当前时间

## 工作原则
1. 先查询再操作 — 在修改数据前，先确认目标记录或数据
2. 确认重要操作 — 创建、更新、删除操作需要用户确认
3. 解释操作结果 — 每次操作后清晰说明结果
4. 主动提供帮助 — 根据用户意图推荐合适的工具
${tableContext}
## 回答语言
默认使用中文回答，除非用户明确要求其他语言。`;
}
```

调用链上游适配：`buildSystemPrompt()` 变为 async，所有调用处需加 `await`。

**性能考量**：每次调用最多触发 6 次数据库查询（1 次 listTables + 最多 5 次 getTableSchema）。对于高频聊天场景，可引入短时内存缓存（30 秒 TTL）避免重复查询。实现时使用模块级变量缓存结果即可，无需额外依赖。

### 2.2 generateDocument 对接

**现状**：`tool-executor.ts` 中返回占位符 "文档生成功能尚未实现"

**目标**：对接 Python 服务生成文档

```typescript
case "generateDocument": {
  const templateId = toolInput.templateId as string;
  const formData = toolInput.formData as Record<string, unknown>;

  // 获取模板，验证状态
  const template = await db.template.findUnique({
    where: { id: templateId },
    select: { filePath: true, name: true, status: true },
  });

  if (!template) {
    return { success: false, error: "模板不存在" };
  }

  // 检查模板状态是否可用（PUBLISHED）
  if (template.status !== "PUBLISHED") {
    return { success: false, error: "模板未发布，无法生成文档" };
  }

  // 调用 Python 服务
  const pythonUrl = process.env.PYTHON_SERVICE_URL || "http://localhost:8065";
  const response = await fetch(`${pythonUrl}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      template_path: template.filePath,
      output_filename: `${template.name}-${Date.now()}.docx`,
      form_data: formData,
    }),
  });

  if (!response.ok) {
    return { success: false, error: "文档生成失败" };
  }

  const result = await response.json();
  return { success: true, data: result };
}
```

### 2.3 搜索增强

新增过滤操作符 `isempty` 和 `isnotempty`。

`buildFilterConditions` 补充：

```typescript
case "isempty":
  conditions.push({
    OR: [
      { data: { path: [filter.field], equals: null } },
      { data: { path: [filter.field], equals: "" } },
    ],
  });
  break;
case "isnotempty":
  conditions.push({
    NOT: {
      OR: [
        { data: { path: [filter.field], equals: null } },
        { data: { path: [filter.field], equals: "" } },
      ],
    },
  });
  break;
```

`tools.ts` 中 `searchRecords` 的 operator enum 增加 `"isempty"` 和 `"isnotempty"`。

`FilterCondition` interface 的 operator 联合类型同步更新。

---

## 涉及文件总览

| 文件 | P0 | P1 | P2 |
|------|----|----|-----|
| `src/lib/agent2/tool-executor.ts` | CRUD 委托 | — | 文档生成 |
| `src/lib/agent2/tool-helpers.ts` | 删除 CRUD + 聚合 SQL | 过滤下推 + 关系解析 + Schema | 搜索增强 |
| `src/lib/agent2/tools.ts` | — | — | operator enum |
| `src/lib/agent2/context-builder.ts` | — | — | 动态提示 |
| `src/lib/agent2/confirm-store.ts` | — | — | — |
| `src/lib/services/data-record.service.ts` | 被委托调用 | — | — |

## 安全考量

所有原生 SQL 查询中的字段名通过 `isSafeIdentifier()` 白名单校验（只允许 `[a-zA-Z_][a-zA-Z0-9_]*`），防止 SQL 注入。值通过参数化查询传入。

`LIMIT`/`OFFSET` 使用参数化而非直接拼接。

## 测试策略

- P0：SQL 注入防护测试（字段名包含特殊字符的场景）
- P0：CRUD 委托后的返回格式适配测试
- P1：数字/日期过滤的正确性测试
- P1：关系字段解析的批量测试
- P2：动态提示在表结构变化时的刷新测试

## 回滚策略

P0 删除 `tool-helpers.ts` 中的 CRUD 函数时，先保留旧函数标记为 `@deprecated`，验证委托调用无问题后再在下个版本中删除。
