# AI-Agent2 数据操作优化 V2 实施计划

> **For agentic workers:** REQUIRED SUB-Skill: superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this计划 task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

>
>
> **Goal:** 优化 ai-agent2 的错误信息、批量操作工具和性能缓存
>
>
> **Architecture:** 方案 A（委托服务层)，P0 的错误增强作为 P1 的批量操作+ 事务保障 + P2 的模块级 TTL 缓存。数据查询减少重复查询链 3 扂批次递进实施（P1 依赖 P0，P2 依赖 P1, batchCreateRecords/batchUpdateRecords/batchDelete 的内部逻辑重构为 tx 参数的内部函数)
P2 的缓存层)
>
> **Tech Stack:** Next.js v16, Prisma v7 + PostgreSQL JSONB

 TypeScript

 Vercel AI SDK (`ai`)`, TypeScript `import { z } from "zod"`,---
## P0：错误信息增强

### Task 1: ExecuteResult 扩展 + 搜索/Records 警告字段警告

**Files:**
- Modify: `src/lib/agent2/tool-executor.ts`
- Modify: `src/lib/agent2/tool-helpers.ts`
- Modify: `src/lib/agent2/confirm-store.ts`
- Modify: `src/lib/agent2/context-builder.ts`

- Modify: `src/lib/agent2/tools.ts`
- Modify: `src/lib/services/data-record.service.ts`
---

### Task 1: 扩展 ExecuteResult 类型 + 增加 errorDetails

**Files:**
- `src/lib/agent2/tool-executor.ts`

- [ ] **Step 1: 扩展 ExecuteResult 类型**

```typescript
type ExecuteResult = {
  success: boolean;
  data?: unknown;
  error?: string;
  errorDetails?: { code: string; message: string };  // 新增
}
```

- [ ] **Step 2: CRUD case 中透传 errorDetails**

In现有 CRUD/传递中 (tool-executor.ts)。

- [ ] **Step 3: generateDocument 确认后增加网络错误处理**

在 tool-executor.ts 中，区分"模板不存在"、"和"文档生成服务不可达"等网络错误：
```typescript
case "generateDocument": {
  const templateId = toolInput.templateId as string;
  const formData = toolInput.formData as Record<string, unknown>;

  const pythonUrl = process.env.PYTHON_SERVICE_URL || "http://localhost:8065";

  if (!response.ok) {
    const detail = response.status === 0 ? "文档生成服务不可达" : `response.statusText ?? `文档生成服务返回错误 (${response.status})`;
    }
    return { success: true, data: result.data };
  },
  case "updateRecord": {
    const result = await recordService.updateRecord(
      toolInput.recordId as string,
      toolInput.data as Record<string, unknown>
    );
    if (!result.success) {
      return { success: false, error: result.error.message, errorDetails: result.error };
    }
    return { success: true, data: result.data };
  },
  case "deleteRecord": {
    const result = await recordService.deleteRecord(
      toolInput.recordId as string);
    if (!result.success) {
      return { success: false, error: result.error.message };
    }
    return { success: true, data: { id: toolInput.recordId as string } };
  }
  ```

- [ ] **Step 4: Commit**

  ```bash
git add src/lib/agent2/tool-executor.ts
git commit -m "refactor(agent2): extend ExecuteResult with errorDetails field"
```
**Files:**
- `src/lib/agent2/tool-executor.ts`
- `src/lib/agent2/tool-helpers.ts`

- `src/lib/agent2/confirm-store.ts` - `src/lib/agent2/context-builder.ts` (will be modified in P1)

- `src/lib/agent2/tools.ts` (will add batch tools)
- `src/lib/agent2/confirm-store.ts` (will add batch tool names and risk messages)
- `src/lib/services/data-record.service.ts` (will add batchUpdate/batchDelete and refactor internal functions + P2 cache invalidation)

- `src/lib/agent2/context-builder.ts` (will add file import hint)

- `src/lib/agent2/tool-executor.ts` (will add cache invalidation calls after all writes)

- `src/lib/agent2/tool-helpers.ts` (will cache getTableSchema)

- `src/lib/agent2/context-builder.ts` (will cache buildSystemPrompt)

- `src/lib/agent2/tool-executor.ts` (will call cache invalidation after all writes)
- `src/lib/services/data-record.service.ts` (will add batchUpdate/batchDelete, will add P2 cache layer + expose batchUpdate function)
- `src/lib/agent2/tool-helpers.ts` (will add TTL cache + export `invalidateSchemaCache`)

- `src/lib/agent2/context-builder.ts` (will cache buildSystemPrompt)
- `src/lib/agent2/tool-executor.ts` (will call `invalidateSchemaCache(tableId)` after createRecord, updateRecord, deleteRecord)
- `src/lib/agent2/tool-executor.ts` (will call `invalidateSchemaCache(tableId)` after all batch operations) - `src/lib/agent2/tool-helpers.ts` (will add TTL cache Map and export `invalidateSchemaCache` function) to use
- `src/lib/agent2/context-builder.ts` (will add TTL cache to buildSystemPrompt)
- `src/lib/agent2/tool-executor.ts` (will add caching via module-level Map)

- **Files:**
- `src/lib/agent2/tool-executor.ts` (route `src/lib/agent2/tool-helpers.ts`)
- `src/lib/agent2/tool-helpers.ts`
- `src/lib/agent2/confirm-store.ts`
- `src/lib/agent2/context-builder.ts`
- `src/lib/agent2/tools.ts`
- `src/lib/services/data-record.service.ts`

**Spec:** `docs/superpowers/specs/2026-04-04-ai-agent2-data-ops-v2-design.md`

)

**Files:**
- Modify: `src/lib/agent2/tool-executor.ts` — Extend ExecuteResult, add errorDetails
- Modify: `src/lib/agent2/tool-helpers.ts` — collect filter warnings in buildSqlWhereClause
- Modify: `src/lib/agent2/confirm-store.ts` — register batch tools
- Modify: `src/lib/agent2/context-builder.ts` — add file import hint to system prompt
- Modify ` `src/lib/agent2/tools.ts` — register 3 batch tools
- Modify ` `src/lib/agent2/tool-executor.ts` — add 3 batch cases
- Modify ` `src/lib/services/data-record.service.ts` — refactor: extract doUpdateRecord/doDeleteRecord; add batchUpdate/batchDelete

- **Files:**
- Modify: `src/lib/agent2/tool-executor.ts`
- Modify: `src/lib/agent2/tool-helpers.ts`
- Modify: `src/lib/agent2/confirm-store.ts`
- Modify: `src/lib/agent2/context-builder.ts`
- Modify: `src/lib/agent2/tools.ts`

---
## P1：批量操作 + 事务

### Task 4: batchCreateRecords

**Files:**
- Modify: `src/lib/agent2/tool-executor.ts`
- Modify: `src/lib/agent2/tools.ts`
- Modify: `src/lib/agent2/confirm-store.ts`
- Modify: `src/lib/agent2/context-builder.ts`
- Modify: `src/lib/services/data-record.service.ts`

**Files:**
- Modify: `src/lib/agent2/tool-executor.ts`
- Modify: `src/lib/agent2/tool-helpers.ts`
- Modify: `src/lib/agent2/confirm-store.ts`
- Modify: `src/lib/agent2/context-builder.ts`
- Modify: `src/lib/agent2/tools.ts`
- Modify: `src/lib/services/data-record.service.ts`

---
## P2: 性能缓存

### Task 7: 性能缓存
**Files:**
- Modify: `src/lib/agent2/tool-helpers.ts`
- Modify: `src/lib/agent2/context-builder.ts`
- Modify: `src/lib/agent2/tool-executor.ts`
- Modify: `src/lib/agent2/tools.ts`
- Modify: `src/lib/services/data-record.service.ts`

---
## P2: 总结

### Task 8: Commit

Run: `npx tsc --noEmit 2>&1 |grep "tool-helpers" || grep "tool-executor" | grep -E "命令` |&>1`
+ if failures, report exactly why

- [ ] **Step 4: 鷻加 aggregateRecords filter warnings collection**

修改 `buildSqlWhereClause` signature签名增加 `warnings` 参数：

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent2/tool-helpers.ts src/lib/agent2/confirm-store.ts src/lib/agent2/context-builder.ts src/lib/agent2/tools.ts src * as recordService from "@/lib/services/data-record.service";

/**
```

- [ ] **Step 6: 添加 aggregateRecords 前置字段类型校验**

  In `buildSqlWhereClause` 中， 当 `operation` 为 "sum"/avg" 且 `targetField.type !== "NUMBER"` 时， {
  }

  // For sum/avg,avg check field type is NUMBER and NUMERIC
  if (["sum", "avg"].includes(operation) && targetField.type !== "NUMBER") {
    return {
      success: false,
      error: { code: "INVALID_FIELD_TYPE", message: `字段 '${field}' 类型为 ${targetField.type}，不支持 ${operation} 操作` },
      });
    }
    });
  }
}
  ```

- [ ] **Step 7: Commit**

```bash
git add src/lib/agent2/tool-helpers.ts
git commit -m "fix(agent2): collect filter field warnings in searchRecords/aggregateRecords"