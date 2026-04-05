# AI-Agent2 数据操作优化 V2 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax in tracking.

**Goal:** 增强 ai-agent2 的错误信息、新增批量操作工具、添加性能缓存

**Architecture:** P0 扩展 ExecuteResult 保留结构化错误 + buildSqlWhereClause 收集过滤警告 + aggregateRecords 前置类型校验；P1 提取 service 层事务内部函数后新增 batchUpdate/batchDelete + 注册三个 batch 工具；P2 模块级 TTL 缓存减少高频重复查询。

**Tech Stack:** Next.js v16, Prisma v7 ($transaction), TypeScript, Vercel AI SDK

**Spec:** `docs/superpowers/specs/2026-04-04-ai-agent2-data-ops-v2-design.md`

---

## 文件结构

| 文件 | 职责 | P0 | P1 | P2 |
|------|------|----|----|-----|
| `src/lib/agent2/tool-executor.ts` | 工具执行路由 | ExecuteResult 扩展 + generateDocument 增强 | batch case | 缓存失效调用 |
| `src/lib/agent2/tool-helpers.ts` | 查询辅助函数 | buildSqlWhereClause 警告 + aggregateRecords 校验 | — | 缓存 Map + invalidateSchemaCache |
| `src/lib/agent2/tools.ts` | 工具定义（Zod） | — | 注册 3 个 batch 工具 | — |
| `src/lib/agent2/confirm-store.ts` | 确认令牌 | — | batch 确认配置 | — |
| `src/lib/agent2/context-builder.ts` | 系统提示 | — | 导入提示 | 缓存 sysprompt |
| `src/lib/services/data-record.service.ts` | 数据记录 CRUD | — | 重构 + batchUpdate/batchDelete | — |

---

## P0：错误信息增强

### Task 1: 扩展 ExecuteResult 类型 + 增强 generateDocument 错误

**Files:**
- Modify: `src/lib/agent2/tool-executor.ts:1-88`

- [ ] **Step 1: 扩展 ExecuteResult 类型**

在 `tool-executor.ts` 第 6-10 行，将 `ExecuteResult` 类型扩展：

```typescript
type ExecuteResult = {
  success: boolean;
  data?: unknown;
  error?: string;
  errorDetails?: { code: string; message: string };  // 新增：保留结构化错误
};
```

- [ ] **Step 2: 在 CRUD case 中透传 errorDetails**

修改 `createRecord`、`updateRecord`、`deleteRecord` 三个 case，在 `!result.success` 分支添加 `errorDetails`：

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

- [ ] **Step 3: 增强 generateDocument 错误信息**

将 `generateDocument` case 中的 fetch 调用（约第 66-82 行）改为区分网络错误：

```typescript
case "generateDocument": {
  const templateId = toolInput.templateId as string;
  const formData = toolInput.formData as Record<string, unknown>;

  const template = await db.template.findUnique({
    where: { id: templateId },
    select: { filePath: true, name: true, status: true },
  });

  if (!template) {
    return { success: false, error: `模板 ${templateId} 不存在` };
  }

  if (template.status !== "PUBLISHED") {
    return { success: false, error: `模板未发布，当前状态: ${template.status}，无法生成文档` };
  }

  const pythonUrl = process.env.PYTHON_SERVICE_URL || "http://localhost:8065";
  let response: Response;
  try {
    response = await fetch(`${pythonUrl}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        template_path: template.filePath,
        output_filename: `${template.name}-${Date.now()}.docx`,
        form_data: formData,
      }),
    });
  } catch {
    return { success: false, error: "文档生成服务不可达，请检查服务是否运行" };
  }

  if (!response.ok) {
    return { success: false, error: `文档生成失败：服务返回错误 (${response.status})` };
  }

  const result = await response.json();
  return { success: true, data: result };
}
```

- [ ] **Step 4: 验证编译通过**

Run: `npx tsc --noEmit 2>&1 | grep -E "tool-executor|tool-helpers"`
Expected: 无输出（无错误）

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent2/tool-executor.ts
git commit -m "refactor(agent2): extend ExecuteResult with errorDetails and enhance generateDocument errors"
```

### Task 2: buildSqlWhereClause 警告收集 + aggregateRecords 类型校验

**Files:**
- Modify: `src/lib/agent2/tool-helpers.ts:27-85` (buildSqlWhereClause)
- Modify: `src/lib/agent2/tool-helpers.ts:488-545` (aggregateRecords)

- [ ] **Step 1: 修改 buildSqlWhereClause 返回 warnings**

将 `buildSqlWhereClause` 的返回类型改为包含 `warnings`：

```typescript
function buildSqlWhereClause(
  tableId: string,
  filters: Array<{ field: string; operator: string; value: unknown }>,
  fields: Array<{ key: string; type: string; label?: string }>
): { sql: string; params: unknown[]; warnings: string[] } {
  const params: unknown[] = [];
  const conditions: string[] = [`"tableId" = $${params.push(tableId)}`];
  const warnings: string[] = [];

  for (const filter of filters) {
    const resolvedKey = resolveFieldKey(filter.field, fields);
    if (!resolvedKey) {
      warnings.push(`过滤字段 '${filter.field}' 不存在，已忽略`);
      continue;
    }
    const field = fields.find(f => f.key === resolvedKey)!;
    if (!isSafeIdentifier(resolvedKey)) {
      warnings.push(`过滤字段 '${filter.field}' 名称不合法，已忽略`);
      continue;
    }

    // ... rest of switch statement unchanged ...
  }

  return { sql: conditions.join(" AND "), params, warnings };
}
```

- [ ] **Step 2: 更新 searchRecords 处理 warnings**

在 `searchRecords` 函数中，两个返回路径（高级过滤和普通过滤）都需要处理 warnings：

高级过滤路径（约第 362-390 行），在 `if (hasAdvancedFilters)` 块中：

```typescript
const { sql: whereSql, params: whereParams, warnings } = buildSqlWhereClause(
  tableId, typedFilters, table.fields.map((f) => ({ key: f.key, type: f.type, label: f.label }))
);
```

在两个 return 语句中附加 warnings：

```typescript
return {
  success: true,
  data: {
    records: resultRecords as Array<{ id: string; [key: string]: unknown }>,
    total,
    page,
    pageSize,
    ...(warnings.length > 0 ? { _warnings: warnings } : {}),
  },
};
```

普通过滤路径同理。

- [ ] **Step 3: 更新 aggregateRecords 处理 warnings**

在 `aggregateRecords` 的 count 路径和 sum/avg/min/max 路径中，解构 `warnings` 并附加到返回值：

```typescript
const { sql: whereSql, params: whereParams, warnings } = buildSqlWhereClause(
  tableId, filters, tableFields
);
```

在返回中：

```typescript
return {
  success: true,
  data: {
    value: Number(countResult[0].count),
    field,
    operation,
    ...(warnings.length > 0 ? { _warnings: warnings } : {}),
  },
};
```

- [ ] **Step 4: aggregateRecords 增加字段类型校验**

在 sum/avg/min/max 路径中（`!sqlOperation` 检查之前），增加类型校验：

```typescript
// 校验字段类型是否支持该聚合操作
if (["sum", "avg"].includes(operation) && targetField.type !== "NUMBER") {
  return {
    success: false,
    error: {
      code: "INVALID_FIELD_TYPE",
      message: `字段 '${field}' 类型为 ${targetField.type}，不支持 ${operation} 操作（仅支持 NUMBER 类型）`,
    },
  };
}
if (["min", "max"].includes(operation) && !["NUMBER", "DATE"].includes(targetField.type)) {
  return {
    success: false,
    error: {
      code: "INVALID_FIELD_TYPE",
      message: `字段 '${field}' 类型为 ${targetField.type}，不支持 ${operation} 操作（支持 NUMBER 和 DATE 类型）`,
    },
  };
}
```

- [ ] **Step 5: 验证编译通过**

Run: `npx tsc --noEmit 2>&1 | grep -E "tool-executor|tool-helpers"`
Expected: 无输出

- [ ] **Step 6: 手动测试**

通过浏览器 AI 对话测试：
1. `"统计论文表中2024年SCI论文有多少篇"` — 应返回正确的过滤计数
2. `"帮我统计论文表中统计年度字段的平均值"` — 应返回精确错误"字段类型为 NUMBER... 不支持 avg"（如果 count 操作不涉及类型问题则跳过）
3. 使用不存在的字段过滤 — 应在结果中看到 _warnings

- [ ] **Step 7: Commit**

```bash
git add src/lib/agent2/tool-helpers.ts
git commit -m "feat(agent2): add filter field warnings and aggregate type validation"
```

---

## P1：批量操作 + 事务

### Task 3: 重构 data-record.service.ts — 提取事务内部函数

**Files:**
- Modify: `src/lib/services/data-record.service.ts:397-514`

- [ ] **Step 1: 提取 doUpdateRecord 内部函数**

在 `updateRecord` 函数之前（约第 396 行），添加一个不导出的内部函数。该函数接受 `tx` 参数和已查询好的 `existingRecord` + `tableResult`，避免在批量调用时重复查询：

```typescript
// 内部函数：在事务中执行更新（供 updateRecord 和 batchUpdate 调用）
async function doUpdateRecord(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  id: string,
  data: Record<string, unknown>,
  existingRecord: { id: string; tableId: string; data: unknown }
): Promise<DataRecordItem> {
  const tableResult = await getTable(existingRecord.tableId);
  if (!tableResult.success) {
    throw new Error(`${tableResult.error.code}:${tableResult.error.message}`);
  }

  const validation = validateRecordData(data, tableResult.data.fields);
  if (!validation.success) {
    throw new Error(`${validation.error.code}:${validation.error.message}`);
  }

  const { scalarData, relationData } = splitRecordDataByFieldType(
    data,
    tableResult.data.fields
  );

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
    const refreshResult = await refreshSnapshotsForTargetRecord({
      tx,
      recordId: id,
    });
    if (!refreshResult.success) {
      throw new Error(`${refreshResult.error.code}:${refreshResult.error.message}`);
    }
  }

  if (Object.keys(relationData).length > 0) {
    const relationResult = await syncRelationSubtableValues({
      tx,
      sourceRecordId: id,
      tableId: existingRecord.tableId,
      relationPayload: relationData,
    });
    if (!relationResult.success) {
      throw new Error(`${relationResult.error.code}:${relationResult.error.message}`);
    }
  }

  const record = await tx.dataRecord.findUnique({
    where: { id },
    include: { createdBy: { select: { name: true } } },
  });

  if (!record) throw new Error("NOT_FOUND:记录不存在");
  return mapRecordToItem(record);
}
```

- [ ] **Step 2: 提取 doDeleteRecord 内部函数**

在 `deleteRecord` 函数之前，添加：

```typescript
// 内部函数：在事务中执行删除（供 deleteRecord 和 batchDelete 调用）
async function doDeleteRecord(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  id: string
): Promise<void> {
  const relationResult = await removeAllRelationsForRecord({
    tx,
    recordId: id,
  });
  if (!relationResult.success) {
    throw new Error(`${relationResult.error.code}:${relationResult.error.message}`);
  }

  await tx.dataRecord.delete({ where: { id } });
}
```

- [ ] **Step 3: 重构 updateRecord 调用 doUpdateRecord**

将现有 `updateRecord` 函数体改为调用 `doUpdateRecord`：

```typescript
export async function updateRecord(
  id: string,
  data: Record<string, unknown>
): Promise<ServiceResult<DataRecordItem>> {
  try {
    const existingRecord = await db.dataRecord.findUnique({ where: { id } });
    if (!existingRecord) {
      return { success: false, error: { code: "NOT_FOUND", message: "记录不存在" } };
    }

    const result = await db.$transaction(tx =>
      doUpdateRecord(tx, id, data, existingRecord)
    );
    return { success: true, data: result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新记录失败";
    return { success: false, error: { code: "UPDATE_FAILED", message } };
  }
}
```

- [ ] **Step 4: 重构 deleteRecord 调用 doDeleteRecord**

将现有 `deleteRecord` 函数体改为调用 `doDeleteRecord`：

```typescript
export async function deleteRecord(id: string): Promise<ServiceResult<null>> {
  try {
    const record = await db.dataRecord.findUnique({ where: { id } });
    if (!record) {
      return { success: false, error: { code: "NOT_FOUND", message: "记录不存在" } };
    }

    await db.$transaction(tx => doDeleteRecord(tx, id));
    return { success: true, data: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除记录失败";
    return { success: false, error: { code: "DELETE_FAILED", message } };
  }
}
```

- [ ] **Step 5: 验证编译通过**

Run: `npx tsc --noEmit 2>&1 | grep "data-record.service"`
Expected: 无输出

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/data-record.service.ts
git commit -m "refactor: extract doUpdateRecord/doDeleteRecord for batch operations"
```

### Task 4: 新增 batchUpdate 和 batchDelete service 函数

**Files:**
- Modify: `src/lib/services/data-record.service.ts`

- [ ] **Step 1: 添加 batchUpdate 函数**

在 `batchCreate` 函数之后添加：

```typescript
export async function batchUpdate(
  tableId: string,
  updates: Array<{ id: string; data: Record<string, unknown> }>
): Promise<ServiceResult<{ updated: number; errors: Array<{ recordId: string; message: string }> }>> {
  try {
    if (updates.length === 0) {
      return { success: true, data: { updated: 0, errors: [] } };
    }

    if (updates.length > 50) {
      return {
        success: false,
        error: { code: "TOO_MANY", message: "单次批量更新最多 50 条" },
      };
    }

    const errors: Array<{ recordId: string; message: string }> = [];
    let updated = 0;

    await db.$transaction(async (tx) => {
      for (const { id, data } of updates) {
        try {
          const existingRecord = await tx.dataRecord.findUnique({ where: { id } });
          if (!existingRecord) {
            errors.push({ recordId: id, message: "记录不存在" });
            throw new Error("SKIP");
          }
          if (existingRecord.tableId !== tableId) {
            errors.push({ recordId: id, message: "记录不属于目标表" });
            throw new Error("SKIP");
          }
          await doUpdateRecord(tx, id, data, existingRecord);
          updated++;
        } catch (e) {
          if (e instanceof Error && e.message === "SKIP") continue;
          throw e; // 非跳过错误，触发事务回滚
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

- [ ] **Step 2: 添加 batchDelete 函数**

```typescript
export async function batchDelete(
  tableId: string,
  ids: string[]
): Promise<ServiceResult<{ deleted: number; errors: Array<{ recordId: string; message: string }> }>> {
  try {
    if (ids.length === 0) {
      return { success: true, data: { deleted: 0, errors: [] } };
    }

    if (ids.length > 50) {
      return {
        success: false,
        error: { code: "TOO_MANY", message: "单次批量删除最多 50 条" },
      };
    }

    const errors: Array<{ recordId: string; message: string }> = [];
    let deleted = 0;

    await db.$transaction(async (tx) => {
      for (const id of ids) {
        try {
          const record = await tx.dataRecord.findUnique({ where: { id } });
          if (!record) {
            errors.push({ recordId: id, message: "记录不存在" });
            throw new Error("SKIP");
          }
          if (record.tableId !== tableId) {
            errors.push({ recordId: id, message: "记录不属于目标表" });
            throw new Error("SKIP");
          }
          await doDeleteRecord(tx, id);
          deleted++;
        } catch (e) {
          if (e instanceof Error && e.message === "SKIP") continue;
          throw e;
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

- [ ] **Step 3: 验证编译通过**

Run: `npx tsc --noEmit 2>&1 | grep "data-record.service"`
Expected: 无输出

- [ ] **Step 4: Commit**

```bash
git add src/lib/services/data-record.service.ts
git commit -m "feat: add batchUpdate and batchDelete to data-record.service"
```

### Task 5: 注册 batch 工具 — tools.ts + confirm-store.ts

**Files:**
- Modify: `src/lib/agent2/tools.ts:374-434`
- Modify: `src/lib/agent2/confirm-store.ts:7-21`

- [ ] **Step 1: 更新 confirm-store.ts**

在 `CONFIRM_REQUIRED_TOOLS` 集合中添加三个工具名：

```typescript
const CONFIRM_REQUIRED_TOOLS = new Set([
  "createRecord",
  "updateRecord",
  "deleteRecord",
  "generateDocument",
  "executeCode",
  "batchCreateRecords",
  "batchUpdateRecords",
  "batchDeleteRecords",
]);
```

在 `RISK_MESSAGES` 中添加：

```typescript
const RISK_MESSAGES: Record<string, string> = {
  createRecord: "此操作将创建新记录",
  updateRecord: "此操作将修改已有记录数据",
  deleteRecord: "此操作将永久删除记录，不可恢复",
  generateDocument: "此操作将使用模板生成文档",
  executeCode: "此操作将在沙箱中执行代码",
  batchCreateRecords: "即将批量创建多条记录",
  batchUpdateRecords: "即将批量更新多条记录",
  batchDeleteRecords: "⚠️ 即将永久删除多条记录，此操作不可撤销",
};
```

- [ ] **Step 2: 在 tools.ts 中注册 batch 工具**

在 `deleteRecord` 工具之后（约第 373 行）、`getCurrentTime` 之前添加：

```typescript
    // ── Batch operation tools ──
    batchCreateRecords: wrapConfirm(
      "batchCreateRecords",
      "write",
      z.object({
        tableId: z.string().describe("目标数据表 ID"),
        records: z
          .array(z.record(z.string(), z.unknown()))
          .max(100)
          .describe("要创建的记录数组（最多 100 条，不支持关系子表字段）"),
      }),
      "批量创建记录（需要确认，最多 100 条）",
      async (args) => {
        return { message: "批量创建待确认", args };
      }
    ),

    batchUpdateRecords: wrapConfirm(
      "batchUpdateRecords",
      "write",
      z.object({
        tableId: z.string().describe("目标数据表 ID"),
        updates: z
          .array(
            z.object({
              recordId: z.string().describe("要更新的记录 ID"),
              data: z
                .record(z.string(), z.unknown())
                .describe("要更新的字段数据"),
            })
          )
          .max(50)
          .describe("要更新的记录数组（最多 50 条）"),
      }),
      "批量更新记录（需要确认，最多 50 条）",
      async (args) => {
        return { message: "批量更新待确认", args };
      }
    ),

    batchDeleteRecords: wrapConfirm(
      "batchDeleteRecords",
      "delete",
      z.object({
        tableId: z.string().describe("目标数据表 ID"),
        recordIds: z
          .array(z.string())
          .max(50)
          .describe("要删除的记录 ID 数组（最多 50 条）"),
      }),
      "批量删除记录（需要确认，不可恢复，最多 50 条）",
      async (args) => {
        return { message: "批量删除待确认", args };
      }
    ),
```

- [ ] **Step 3: 验证编译通过**

Run: `npx tsc --noEmit 2>&1 | grep -E "tools|confirm-store"`
Expected: 无输出

- [ ] **Step 4: Commit**

```bash
git add src/lib/agent2/tools.ts src/lib/agent2/confirm-store.ts
git commit -m "feat(agent2): register batch tools with confirm store"
```

### Task 6: tool-executor.ts 添加 batch case + context-builder.ts 导入提示

**Files:**
- Modify: `src/lib/agent2/tool-executor.ts:85-88`
- Modify: `src/lib/agent2/context-builder.ts:42-46`

- [ ] **Step 1: 在 tool-executor.ts 添加 batch case**

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

- [ ] **Step 2: context-builder.ts 增加导入提示**

在工作原则部分（第 42-46 行）添加第 5 条：

```typescript
## 工作原则
1. 先查询再操作 — 在修改数据前，先确认目标记录或数据
2. 确认重要操作 — 创建、更新、删除操作需要用户确认
3. 解释操作结果 — 每次操作后清晰说明结果
4. 主动提供帮助 — 根据用户意图推荐合适的工具
5. 批量导入 — 用户上传文件后，解析内容并使用 batchCreateRecords 批量导入
```

- [ ] **Step 3: 验证编译通过**

Run: `npx tsc --noEmit 2>&1 | grep -E "tool-executor|context-builder"`
Expected: 无输出

- [ ] **Step 4: 手动测试**

通过浏览器 AI 对话测试：
1. 创建 3 条测试记录 — 应触发确认
2. 批量更新 3 条记录 — 应触发确认
3. 批量删除 3 条记录 — 应触发确认

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent2/tool-executor.ts src/lib/agent2/context-builder.ts
git commit -m "feat(agent2): add batch tool execution and file import hint"
```

---

## P2：性能缓存

### Task 7: getTableSchema 缓存 + invalidateSchemaCache

**Files:**
- Modify: `src/lib/agent2/tool-helpers.ts:1-5` (顶部)
- Modify: `src/lib/agent2/tool-helpers.ts` (getTableSchema 函数)

- [ ] **Step 1: 在 tool-helpers.ts 顶部添加缓存 Map**

在 `import` 之后、`isSafeIdentifier` 之前添加：

```typescript
// ── TTL 缓存（进程内、单实例、best-effort）──
// 局限性：Serverless 冷启动/开发模式热重载会清空；TTL 仅 30 秒
const TTL_MS = 30_000;
const cacheMap = new Map<string, { data: unknown; expiresAt: number }>();

function cacheGet<T>(key: string): T | null {
  const entry = cacheMap.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cacheMap.delete(key);
    return null;
  }
  return entry.data as T;
}

function cacheSet(key: string, data: unknown): void {
  cacheMap.set(key, { data, expiresAt: Date.now() + TTL_MS });
}

export function invalidateSchemaCache(tableId: string): void {
  cacheMap.delete(`schema:${tableId}`);
}
```

- [ ] **Step 2: 修改 getTableSchema 使用缓存**

将 `getTableSchema` 函数改为先查缓存：

```typescript
export async function getTableSchema(tableId: string): Promise<
  ServiceResult<{
    id: string;
    name: string;
    description: string | null;
    fields: Array<{
      key: string;
      label: string;
      type: string;
      required: boolean;
      options?: string[];
      relationTo?: string | null;
      displayField?: string | null;
      cardinality?: string | null;
    }>;
  }>
> {
  const cacheKey = `schema:${tableId}`;
  const cached = cacheGet<ServiceResult<typeof result>>(cacheKey);
  if (cached) return cached;

  try {
    const table = await db.dataTable.findUnique({
      where: { id: tableId },
      include: {
        fields: { orderBy: { sortOrder: "asc" } },
      },
    });

    if (!table) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "数据表不存在" },
      };
    }

    const result = {
      success: true,
      data: {
        id: table.id,
        name: table.name,
        description: table.description,
        fields: table.fields.map((f) => ({
          key: f.key,
          label: f.label,
          type: f.type,
          required: f.required,
          options: f.options as string[] | undefined,
          relationTo: f.relationTo ?? undefined,
          displayField: f.displayField ?? undefined,
          cardinality: f.relationCardinality ?? undefined,
        })),
      },
    } as const;

    cacheSet(cacheKey, result);
    return result;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "获取表结构失败";
    return { success: false, error: { code: "GET_SCHEMA_FAILED", message } };
  }
}
```

> 注意：缓存整个 `ServiceResult` 成功响应，失败响应不缓存（避免缓存"表不存在"错误）。

- [ ] **Step 3: 验证编译通过**

Run: `npx tsc --noEmit 2>&1 | grep "tool-helpers"`
Expected: 无输出

- [ ] **Step 4: Commit**

```bash
git add src/lib/agent2/tool-helpers.ts
git commit -m "perf(agent2): add TTL cache for getTableSchema"
```

### Task 8: buildSystemPrompt 缓存 + tool-executor 缓存失效

**Files:**
- Modify: `src/lib/agent2/context-builder.ts`
- Modify: `src/lib/agent2/tool-executor.ts`

- [ ] **Step 1: 缓存 buildSystemPrompt 结果**

在 `context-builder.ts` 中添加模块级缓存：

```typescript
// src/lib/agent2/context-builder.ts

import { listTables, getTableSchema } from "./tool-helpers";

// 系统提示缓存（30 秒 TTL）
let syspromptCache: { text: string; expiresAt: number } | null = null;
const SYSPROMPT_TTL = 30_000;

export async function buildSystemPrompt(): Promise<string> {
  // 检查缓存
  if (syspromptCache && Date.now() < syspromptCache.expiresAt) {
    return syspromptCache.text;
  }

  let tableContext = "";
  // ... 现有 try-catch 逻辑不变 ...

  const text = `你是一个系统集成 AI 助手...`; // 现有模板字符串
  syspromptCache = { text, expiresAt: Date.now() + SYSPROMPT_TTL };
  return text;
}
```

具体改动：在 `buildSystemPrompt` 函数体最开头添加缓存检查，在 return 前写入缓存。

- [ ] **Step 2: tool-executor.ts 写操作后清除缓存**

在 `tool-executor.ts` 顶部添加 import：

```typescript
import { invalidateSchemaCache } from "./tool-helpers";
```

在所有写操作（createRecord、updateRecord、deleteRecord、batchCreateRecords、batchUpdateRecords、batchDeleteRecords）成功后，调用缓存失效：

```typescript
case "createRecord": {
  const result = await recordService.createRecord(...);
  if (!result.success)
    return { success: false, error: result.error.message, errorDetails: result.error };
  invalidateSchemaCache(toolInput.tableId as string);
  return { success: true, data: result.data };
}
```

对于 `updateRecord` 和 `deleteRecord`（没有 tableId 输入），需要从返回数据中获取 tableId。由于 `recordService.updateRecord` 返回 `DataRecordItem`（含 tableId），可以直接使用：

```typescript
case "updateRecord": {
  const result = await recordService.updateRecord(...);
  if (!result.success)
    return { success: false, error: result.error.message, errorDetails: result.error };
  invalidateSchemaCache(result.data.tableId);
  return { success: true, data: result.data };
}

case "deleteRecord": {
  // deleteRecord 没有 tableId 返回，需要先查
  // 但 deleteRecord 返回 null... 需要在执行前先查记录获取 tableId
  // 简单方案：不做缓存失效（deleteRecord 不改变 schema）
  // 更好的方案：在 deleteRecord 之前通过 getRecord 获取 tableId
  const existingResult = await helpers.getRecord(toolInput.recordId as string);
  const result = await recordService.deleteRecord(toolInput.recordId as string);
  if (!result.success)
    return { success: false, error: result.error.message, errorDetails: result.error };
  if (existingResult.success) {
    invalidateSchemaCache(existingResult.data.tableId as string);
  }
  return { success: true, data: { id: toolInput.recordId as string } };
}
```

> 注：deleteRecord 不改变表结构，但影响 recordCount。缓存的是 schema 而非 count，所以此处的失效是可选的。但如果 buildSystemPrompt 缓存了 recordCount，则需要失效。当前 buildSystemPrompt 确实显示 recordCount，所以需要清除 sysprompt 缓存。最简单的方式：导出一个 `invalidateSyspromptCache()` 函数。

更精确的做法：在 `context-builder.ts` 中导出一个失效函数：

```typescript
export function invalidateSyspromptCache(): void {
  syspromptCache = null;
}
```

在 `tool-executor.ts` 所有写操作后调用 `invalidateSyspromptCache()`。

- [ ] **Step 3: 验证编译通过**

Run: `npx tsc --noEmit 2>&1 | grep -E "tool-executor|context-builder|tool-helpers"`
Expected: 无输出

- [ ] **Step 4: Commit**

```bash
git add src/lib/agent2/tool-helpers.ts src/lib/agent2/context-builder.ts src/lib/agent2/tool-executor.ts
git commit -m "perf(agent2): cache buildSystemPrompt and invalidate on writes"
```

---

## 实施顺序

```
Task 1 (P0: ExecuteResult + generateDocument)
  → Task 2 (P0: warnings + 类型校验)
    → Task 3 (P1: 重构 service)
      → Task 4 (P1: batchUpdate/batchDelete)
        → Task 5 (P1: tools + confirm-store)
          → Task 6 (P1: executor + context)
            → Task 7 (P2: schema 缓存)
              → Task 8 (P2: sysprompt 缓存 + 失效)
```

串行实施：P0 → P1 → P2，每步依赖前一步的改动。
