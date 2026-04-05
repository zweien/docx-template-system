# AI-Agent2 数据操作优化 V2 实施计划

> **Goal:** 优化 ai-agent2 的错误信息、批量操作工具和性能缓存
>
> **Architecture:** 方案 A（委托服务层），P0 错误增强 -> P1 批量操作 + 事务 -> P2 模块级 TTL 缓存。三批次递进实施（P1 依赖 P0，P2 依赖 P1）。
>
> **Tech Stack:** Next.js v16, Prisma v7 + PostgreSQL JSONB, TypeScript, Vercel AI SDK (`ai`), `zod`
>
> **Spec:** `docs/superpowers/specs/2026-04-04-ai-agent2-data-ops-v2-design.md`

---

## P0：错误信息增强

### Task 1: 扩展 ExecuteResult 类型 + CRUD 透传 errorDetails

**Files:**
- Modify: `src/lib/agent2/tool-executor.ts`

- [ ] **Step 1: 扩展 ExecuteResult 类型**

在 `tool-executor.ts` 顶部修改类型定义：

```typescript
type ExecuteResult = {
  success: boolean;
  data?: unknown;
  error?: string;
  errorDetails?: { code: string; message: string };  // 新增
};
```

- [ ] **Step 2: CRUD case 中透传 errorDetails**

在 `createRecord`、`updateRecord`、`deleteRecord` 三个 case 中，错误返回时增加 `errorDetails` 字段：

```typescript
case "createRecord": {
  const result = await recordService.createRecord(
    userId,
    toolInput.tableId as string,
    toolInput.data as Record<string, unknown>
  );
  if (!result.success)
    return { success: false, error: result.error.message, errorDetails: result.error };
  return { success: true, data: result.data };
}

case "updateRecord": {
  const result = await recordService.updateRecord(
    toolInput.recordId as string,
    toolInput.data as Record<string, unknown>
  );
  if (!result.success)
    return { success: false, error: result.error.message, errorDetails: result.error };
  return { success: true, data: result.data };
}

case "deleteRecord": {
  const result = await recordService.deleteRecord(
    toolInput.recordId as string
  );
  if (!result.success)
    return { success: false, error: result.error.message, errorDetails: result.error };
  return { success: true, data: { id: toolInput.recordId as string } };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/agent2/tool-executor.ts
git commit -m "refactor(agent2): extend ExecuteResult with errorDetails field for structured errors"
```

---

### Task 2: generateDocument 网络错误增强

**Files:**
- Modify: `src/lib/agent2/tool-executor.ts`

- [ ] **Step 1: 增强 generateDocument 的网络错误处理**

替换现有 `generateDocument` case 中 `if (!response.ok)` 的返回值：

```typescript
case "generateDocument": {
  // ... 现有模板查询逻辑不变 ...

  if (!response.ok) {
    const detail = response.status === 0
      ? "文档生成服务不可达"
      : `文档生成服务返回错误 (${response.status})`;
    return { success: false, error: detail };
  }

  // ... 后续逻辑不变 ...
}
```

注意：当前代码返回的是 `{ success: false, error: "文档生成失败" }`，需要改为更精确的错误信息。

- [ ] **Step 2: Commit**

```bash
git add src/lib/agent2/tool-executor.ts
git commit -m "fix(agent2): improve generateDocument error messages for network failures"
```

---

### Task 3: searchRecords 过滤字段无效警告收集

**Files:**
- Modify: `src/lib/agent2/tool-helpers.ts`

- [ ] **Step 1: 修改 buildSqlWhereClause 签名增加 warnings**

```typescript
function buildSqlWhereClause(
  tableId: string,
  filters: Array<{ field: string; operator: string; value: unknown }>,
  fields: Array<{ key: string; type: string; label?: string }>
): { sql: string; params: unknown[]; warnings: string[] }
```

- [ ] **Step 2: 在 resolveFieldKey 返回 null 时收集 warning**

```typescript
const warnings: string[] = [];
// ...
for (const filter of filters) {
  const resolvedKey = resolveFieldKey(filter.field, fields);
  if (!resolvedKey) {
    warnings.push(`过滤条件中字段 '${filter.field}' 不存在，已忽略`);
    continue;
  }
  // ... 现有逻辑 ...
}
return { sql: conditions.join(" AND "), params, warnings };
```

- [ ] **Step 3: searchRecords 中附加 _warnings 到结果**

在 `searchRecords` 返回前，检查 `warnings` 并附加到 data：

```typescript
// 高级过滤路径中
const { sql: whereSql, params: whereParams, warnings } = buildSqlWhereClause(...);
// ... 查询逻辑 ...
const resultData = {
  records: resultRecords as Array<{ id: string; [key: string]: unknown }>,
  total, page, pageSize,
};
if (warnings.length > 0) {
  (resultData as Record<string, unknown>)._warnings = warnings;
}
return { success: true, data: resultData };
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/agent2/tool-helpers.ts
git commit -m "feat(agent2): collect filter field warnings in searchRecords for ignored fields"
```

---

### Task 4: aggregateRecords 前置字段类型校验

**Files:**
- Modify: `src/lib/agent2/tool-helpers.ts`

- [ ] **Step 1: 在 aggregateRecords 中 sum/avg 操作前增加字段类型校验**

在 `aggregateRecords` 函数中，找到 `targetField` 已获取但尚未执行 SQL 的位置（约行 520 后），增加：

```typescript
// 对于 sum/avg 操作，检查字段类型是否为 NUMBER
if (["sum", "avg"].includes(operation) && targetField.type !== "NUMBER") {
  return {
    success: false,
    error: {
      code: "INVALID_FIELD_TYPE",
      message: `字段 '${field}' 类型为 ${targetField.type}，不支持 ${operation} 操作`,
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/agent2/tool-helpers.ts
git commit -m "fix(agent2): add field type validation for sum/avg aggregate operations"
```

---

## P1：批量操作 + 事务

### Task 5: data-record.service 重构 — 提取事务内部函数

**Files:**
- Modify: `src/lib/services/data-record.service.ts`

- [ ] **Step 1: 提取 doUpdateRecord 内部函数**

将 `updateRecord` 中 `$transaction` 内部的逻辑提取为独立函数：

```typescript
// 新增内部函数（不导出）
async function doUpdateRecord(
  tx: Prisma.TransactionClient,
  id: string,
  existingRecord: { id: string; tableId: string; data: unknown },
  data: Record<string, unknown>,
  tableFields: DataFieldItem[]
): Promise<{ id: string; tableId: string; data: unknown; createdAt: Date; updatedAt: Date; createdBy: { name: string } } | null> {
  const { scalarData, relationData } = splitRecordDataByFieldType(data, tableFields);

  await tx.dataRecord.update({
    where: { id },
    data: {
      data: toJsonInput({
        ...(existingRecord.data as Record<string, unknown>),
        ...scalarData,
      }),
    },
  });

  if (Object.keys(scalarData).length > 0) {
    const refreshResult = await refreshSnapshotsForTargetRecord({ tx, recordId: id });
    if (!refreshResult.success) {
      throw new Error(`${refreshResult.error.code}:${refreshResult.error.message}`);
    }
  }

  if (Object.keys(relationData).length > 0) {
    const relationResult = await syncRelationSubtableValues({
      tx, sourceRecordId: id, tableId: existingRecord.tableId, relationPayload: relationData,
    });
    if (!relationResult.success) {
      throw new Error(`${relationResult.error.code}:${relationResult.error.message}`);
    }
  }

  return tx.dataRecord.findUnique({
    where: { id },
    include: { createdBy: { select: { name: true } } },
  });
}
```

- [ ] **Step 2: 提取 doDeleteRecord 内部函数**

```typescript
async function doDeleteRecord(
  tx: Prisma.TransactionClient,
  id: string
): Promise<void> {
  const relationResult = await removeAllRelationsForRecord({ tx, recordId: id });
  if (!relationResult.success) {
    throw new Error(`${relationResult.error.code}:${relationResult.error.message}`);
  }
  await tx.dataRecord.delete({ where: { id } });
}
```

- [ ] **Step 3: 改写现有 updateRecord/deleteRecord 调用内部函数**

```typescript
export async function updateRecord(id: string, data: Record<string, unknown>): Promise<ServiceResult<DataRecordItem>> {
  // ... 现有验证逻辑保留 ...
  const record = await db.$transaction(tx => doUpdateRecord(tx, id, existingRecord, data, tableResult.data.fields));
  // ...
}

export async function deleteRecord(id: string): Promise<ServiceResult<null>> {
  // ... 现有验证逻辑保留 ...
  await db.$transaction(tx => doDeleteRecord(tx, id));
  // ...
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/services/data-record.service.ts
git commit -m "refactor(data-record): extract doUpdateRecord/doDeleteRecord for batch transaction reuse"
```

---

### Task 6: data-record.service 新增 batchUpdate/batchDelete

**Files:**
- Modify: `src/lib/services/data-record.service.ts`

- [ ] **Step 1: 新增 batchUpdate 导出函数**

```typescript
export async function batchUpdate(
  tableId: string,
  updates: Array<{ id: string; data: Record<string, unknown> }>
): Promise<ServiceResult<{ updated: number; errors: Array<{ recordId: string; message: string }> }>> {
  try {
    if (updates.length > 50) {
      return {
        success: false,
        error: { code: "BATCH_LIMIT_EXCEEDED", message: "批量更新最多 50 条" },
      };
    }

    const tableResult = await getTable(tableId);
    if (!tableResult.success) return { success: false, error: tableResult.error };

    const errors: Array<{ recordId: string; message: string }> = [];
    let updated = 0;

    await db.$transaction(async (tx) => {
      for (const { id, data } of updates) {
        try {
          const existing = await tx.dataRecord.findUnique({ where: { id } });
          if (!existing) {
            errors.push({ recordId: id, message: "记录不存在" });
            continue;
          }
          const validation = validateRecordData(data, tableResult.data.fields);
          if (!validation.success) {
            errors.push({ recordId: id, message: validation.error.message });
            continue;
          }
          await doUpdateRecord(tx, id, existing, data, tableResult.data.fields);
          updated++;
        } catch (err) {
          errors.push({ recordId: id, message: err instanceof Error ? err.message : "更新失败" });
        }
      }
    });

    return { success: true, data: { updated, errors } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "批量更新失败";
    return { success: false, error: { code: "BATCH_UPDATE_FAILED", message } };
  }
}
```

- [ ] **Step 2: 新增 batchDelete 导出函数**

```typescript
export async function batchDelete(
  tableId: string,
  ids: string[]
): Promise<ServiceResult<{ deleted: number; errors: Array<{ recordId: string; message: string }> }>> {
  try {
    if (ids.length > 50) {
      return {
        success: false,
        error: { code: "BATCH_LIMIT_EXCEEDED", message: "批量删除最多 50 条" },
      };
    }

    const errors: Array<{ recordId: string; message: string }> = [];
    let deleted = 0;

    await db.$transaction(async (tx) => {
      for (const id of ids) {
        try {
          const existing = await tx.dataRecord.findUnique({ where: { id } });
          if (!existing) {
            errors.push({ recordId: id, message: "记录不存在" });
            continue;
          }
          await doDeleteRecord(tx, id);
          deleted++;
        } catch (err) {
          errors.push({ recordId: id, message: err instanceof Error ? err.message : "删除失败" });
        }
      }
    });

    return { success: true, data: { deleted, errors } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "批量删除失败";
    return { success: false, error: { code: "BATCH_DELETE_FAILED", message } };
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/services/data-record.service.ts
git commit -m "feat(data-record): add batchUpdate and batchDelete with transaction support"
```

---

### Task 7: 注册 batch 工具（tools.ts + confirm-store.ts）

**Files:**
- Modify: `src/lib/agent2/tools.ts`
- Modify: `src/lib/agent2/confirm-store.ts`

- [ ] **Step 1: confirm-store.ts 添加 batch 工具到确认列表和风险消息**

```typescript
const CONFIRM_REQUIRED_TOOLS = new Set([
  "createRecord",
  "updateRecord",
  "deleteRecord",
  "generateDocument",
  "executeCode",
  "batchCreateRecords",     // 新增
  "batchUpdateRecords",     // 新增
  "batchDeleteRecords",     // 新增
]);

const RISK_MESSAGES: Record<string, string> = {
  // ... 现有 ...
  batchCreateRecords: "即将批量创建记录",
  batchUpdateRecords: "即将批量更新记录",
  batchDeleteRecords: "即将永久删除记录，此操作不可撤销",
};
```

- [ ] **Step 2: tools.ts 注册 batchCreateRecords 工具**

在 `createRecord` 工具之后添加：

```typescript
batchCreateRecords: wrapConfirm(
  "batchCreateRecords",
  "write",
  z.object({
    tableId: z.string().describe("目标数据表 ID"),
    records: z
      .array(z.record(z.string(), z.unknown()))
      .max(100)
      .describe("要创建的记录数组，最多 100 条"),
  }),
  "批量创建记录（需要确认，最多 100 条）。注意：不支持关系子表字段。",
  async (args) => {
    return { message: "批量创建待确认", args };
  }
),
```

- [ ] **Step 3: tools.ts 注册 batchUpdateRecords 工具**

```typescript
batchUpdateRecords: wrapConfirm(
  "batchUpdateRecords",
  "write",
  z.object({
    tableId: z.string().describe("数据表 ID"),
    updates: z
      .array(z.object({
        recordId: z.string().describe("要更新的记录 ID"),
        data: z.record(z.string(), z.unknown()).describe("要更新的字段数据"),
      }))
      .max(50)
      .describe("更新操作数组，最多 50 条"),
  }),
  "批量更新记录（需要确认，最多 50 条）",
  async (args) => {
    return { message: "批量更新待确认", args };
  }
),
```

- [ ] **Step 4: tools.ts 注册 batchDeleteRecords 工具**

```typescript
batchDeleteRecords: wrapConfirm(
  "batchDeleteRecords",
  "delete",
  z.object({
    tableId: z.string().describe("数据表 ID"),
    recordIds: z
      .array(z.string())
      .max(50)
      .describe("要删除的记录 ID 数组，最多 50 条"),
  }),
  "批量删除记录（需要确认，不可恢复，最多 50 条）",
  async (args) => {
    return { message: "批量删除待确认", args };
  }
),
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent2/tools.ts src/lib/agent2/confirm-store.ts
git commit -m "feat(agent2): register batchCreateRecords, batchUpdateRecords, batchDeleteRecords tools"
```

---

### Task 8: tool-executor.ts 添加 batch case

**Files:**
- Modify: `src/lib/agent2/tool-executor.ts`

- [ ] **Step 1: 添加三个 batch case 到 switch 语句**

在 `default:` case 之前添加：

```typescript
case "batchCreateRecords": {
  const result = await recordService.batchCreate(
    toolInput.tableId as string,
    userId,
    toolInput.records as Record<string, unknown>[]
  );
  if (!result.success)
    return { success: false, error: result.error.message, errorDetails: result.error };
  return { success: true, data: result.data };
}

case "batchUpdateRecords": {
  const result = await recordService.batchUpdate(
    toolInput.tableId as string,
    toolInput.updates as Array<{ id: string; data: Record<string, unknown> }>
  );
  if (!result.success)
    return { success: false, error: result.error.message, errorDetails: result.error };
  return { success: true, data: result.data };
}

case "batchDeleteRecords": {
  const result = await recordService.batchDelete(
    toolInput.tableId as string,
    toolInput.recordIds as string[]
  );
  if (!result.success)
    return { success: false, error: result.error.message, errorDetails: result.error };
  return { success: true, data: result.data };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/agent2/tool-executor.ts
git commit -m "feat(agent2): add batchCreateRecords, batchUpdateRecords, batchDeleteRecords executor cases"
```

---

### Task 9: context-builder.ts 增加文件导入提示

**Files:**
- Modify: `src/lib/agent2/context-builder.ts`

- [ ] **Step 1: 在工作原则中增加文件导入提示**

在 `buildSystemPrompt` 返回字符串的"工作原则"部分，增加第 5 条：

```typescript
5. 支持文件导入 — 用户上传 CSV/Excel 后，可使用批量创建工具导入数据
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/agent2/context-builder.ts
git commit -m "feat(agent2): add file import hint to system prompt working principles"
```

---

## P2：性能缓存

### Task 10: tool-helpers.ts 添加 TTL 缓存 + invalidateSchemaCache

**Files:**
- Modify: `src/lib/agent2/tool-helpers.ts`

- [ ] **Step 1: 在文件顶部声明缓存 Map**

```typescript
// 模块级 TTL 缓存（进程内、单实例、best-effort）
const CACHE_TTL_MS = 30_000; // 30 秒
const schemaCache = new Map<string, { data: unknown; expiresAt: number }>();
```

- [ ] **Step 2: 改造 getTableSchema 使用缓存**

```typescript
export async function getTableSchema(tableId: string): Promise<...> {
  const cacheKey = `schema:${tableId}`;
  const cached = schemaCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data as Awaited<ReturnType<typeof getTableSchema>>;
  }

  try {
    // ... 现有查询逻辑 ...
    const result = { success: true, data: { ... } };
    schemaCache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  } catch (error) {
    // ... 现有错误处理 ...
  }
}
```

- [ ] **Step 3: 导出 invalidateSchemaCache 函数**

```typescript
export function invalidateSchemaCache(tableId?: string): void {
  if (tableId) {
    schemaCache.delete(`schema:${tableId}`);
  } else {
    schemaCache.clear();
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/agent2/tool-helpers.ts
git commit -m "perf(agent2): add TTL cache for getTableSchema and export invalidateSchemaCache"
```

---

### Task 11: context-builder.ts 缓存 buildSystemPrompt

**Files:**
- Modify: `src/lib/agent2/context-builder.ts`

- [ ] **Step 1: 添加系统提示缓存**

```typescript
// 系统提示缓存
const syspromptCache = new Map<string, { data: string; expiresAt: number }>();

export async function buildSystemPrompt(): Promise<string> {
  const cached = syspromptCache.get("sysprompt");
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  // ... 现有构建逻辑 ...

  const prompt = `你是一个系统集成 AI 助手...`;
  syspromptCache.set("sysprompt", { data: prompt, expiresAt: Date.now() + 30_000 });
  return prompt;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/agent2/context-builder.ts
git commit -m "perf(agent2): add TTL cache for buildSystemPrompt result"
```

---

### Task 12: tool-executor.ts 写操作后清除缓存

**Files:**
- Modify: `src/lib/agent2/tool-executor.ts`

- [ ] **Step 1: 导入 invalidateSchemaCache**

```typescript
import { invalidateSchemaCache } from "./tool-helpers";
```

- [ ] **Step 2: 在所有写操作成功后调用缓存失效**

在以下 case 的成功返回前增加缓存失效调用：

- `createRecord`: `invalidateSchemaCache(toolInput.tableId as string);`
- `updateRecord`: 需要获取 tableId（当前 updateRecord 只传 recordId，需通过 recordService 获取 tableId，或在返回前通过 data 中的 tableId 调用）
- `deleteRecord`: 同上
- `batchCreateRecords`: `invalidateSchemaCache(toolInput.tableId as string);`
- `batchUpdateRecords`: `invalidateSchemaCache(toolInput.tableId as string);`
- `batchDeleteRecords`: `invalidateSchemaCache(toolInput.tableId as string);`

注意：对于 `updateRecord` 和 `deleteRecord`，因为输入只有 `recordId` 没有 `tableId`，有两种方案：
- 方案 A：在 tool-executor 中先查一下记录获取 tableId（增加一次查询）
- 方案 B：让 invalidateSchemaCache 不传 tableId，清除全部 schema 缓存（简单但有过度失效风险）

推荐方案 A，因为缓存失效的精确性更重要。具体实现：

```typescript
case "updateRecord": {
  const result = await recordService.updateRecord(...);
  if (!result.success)
    return { success: false, error: result.error.message, errorDetails: result.error };
  invalidateSchemaCache((result.data as { tableId: string }).tableId);
  return { success: true, data: result.data };
}

case "deleteRecord": {
  // 删除前先获取 tableId
  const existingRecord = await recordService.getRecord(toolInput.recordId as string);
  const tableId = existingRecord.success ? existingRecord.data.tableId : undefined;
  const result = await recordService.deleteRecord(toolInput.recordId as string);
  if (!result.success)
    return { success: false, error: result.error.message, errorDetails: result.error };
  if (tableId) invalidateSchemaCache(tableId);
  return { success: true, data: { id: toolInput.recordId as string } };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/agent2/tool-executor.ts
git commit -m "perf(agent2): add cache invalidation after all write operations"
```

---

## 涉及文件总览

| 文件 | P0 | P1 | P2 |
|------|----|----|-----|
| `src/lib/agent2/tool-executor.ts` | ExecuteResult 扩展 + 网络错误增强 | batch case | 缓存失效 |
| `src/lib/agent2/tool-helpers.ts` | 警告收集 + 类型校验 | -- | TTL 缓存 + invalidateSchemaCache |
| `src/lib/agent2/tools.ts` | -- | 注册 3 个 batch 工具 | -- |
| `src/lib/agent2/context-builder.ts` | -- | 导入提示 | sysprompt 缓存 |
| `src/lib/agent2/confirm-store.ts` | -- | batch 确认配置 | -- |
| `src/lib/services/data-record.service.ts` | -- | 重构 + batchUpdate/batchDelete | -- |

## 实施顺序

P0 (Task 1-4) -> P1 (Task 5-9) -> P2 (Task 10-12)

每批次可独立验证：
- P0 完成后：type check 通过，现有功能不受影响
- P1 完成后：3 个 batch 工具可通过 AI 对话测试
- P2 完成后：缓存命中可通过日志验证，写操作后缓存正确失效
