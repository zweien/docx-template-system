# AI-Agent2 数据操作优化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax in tracking.

**Goal:** 优化 ai-agent2 的数据操作——委托 CRUD 到正式服务层、用原生 SQL 优化聚合和过滤、解析关系字段、增强系统提示。

**Architecture:** 方案 A（委托服务层）。tool-executor.ts 调用 data-record.service.ts，消除 tool-helpers.ts 中的重复 CRUD。新增原生 SQL 辅助函数处理聚合和高级过滤。分三个批次实施（P0→P1→P2）。

**Tech Stack:** Next.js v16, Prisma v7 ($queryRawUnsafe), PostgreSQL JSONB, TypeScript

**前置验证（Prisma v7 raw query）：** 本项目使用 Prisma v7 + PrismaPg driver adapter。`$queryRawUnsafe` 在此配置下应可用，但实施前需验证。在 Task 3 开始前，运行一个简单的 raw query 测试确认兼容性：
```typescript
// 在 dev 环境临时测试
const result = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
  `SELECT COUNT(*) as count FROM "DataRecord" WHERE "tableId" = $1`, "test-id"
);
```

**Spec:** `docs/superpowers/specs/2026-04-04-ai-agent2-data-ops-optimization.md`

---

## P0：核心修复

### Task 1: CRUD 委托到 data-record.service

**Files:**
- Modify: `src/lib/agent2/tool-executor.ts`

- [ ] **Step 1: 替换 import 和 CRUD cases**

将 `tool-executor.ts` 中 `import * as helpers from "./tool-helpers"` 改为同时导入 helpers 和 recordService：

```typescript
import * as helpers from "./tool-helpers";
import * as recordService from "@/lib/services/data-record.service";
```

将 `createRecord`、`updateRecord`、`deleteRecord` 三个 case 改为调用 `recordService`：

```typescript
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
  // data-record.service.deleteRecord 返回 null，但下游期望 { id } 格式
  return { success: true, data: { id: toolInput.recordId as string } };
}
```

- [ ] **Step 2: 验证编译通过**

Run: `npx tsc --noEmit`

- [ ] **Step 3: 手动测试 CRUD 操作**

在 dev 环境中通过 AI 对话测试创建、更新、删除记录，确认：
- 创建记录后关系子表格数据正确同步
- 更新记录后关系快照正确刷新
- 删除记录后关系行正确清理

- [ ] **Step 4: Commit**

```bash
git add src/lib/agent2/tool-executor.ts
git commit -m "refactor(agent2): delegate CRUD to data-record.service.ts"
```

### Task 2: 废弃 tool-helpers 中的 CRUD 函数

**Files:**
- Modify: `src/lib/agent2/tool-helpers.ts`

- [ ] **Step 1: 标记 CRUD 函数为 @deprecated（先不删除）**

为以下三个函数添加 `@deprecated` JSDoc 注释，保持代码不变：
- `createRecord`（以 `export async function createRecord(` 开头）
- `updateRecord`（以 `export async function updateRecord(` 开头）
- `deleteRecord`（以 `export async function deleteRecord(` 开头）

```typescript
/** @deprecated 使用 data-record.service.createRecord 替代 */
export async function createRecord(...) { ... }
/** @deprecated 使用 data-record.service.updateRecord 替代 */
export async function updateRecord(...) { ... }
/** @deprecated 使用 data-record.service.deleteRecord 替代 */
export async function deleteRecord(...) { ... }
```

在 P1 完成且验证委托调用无问题后，再在下个 commit 中删除这三个函数。

- [ ] **Step 2: 验证编译通过**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/lib/agent2/tool-helpers.ts
git commit -m "refactor(agent2): deprecate duplicate CRUD in tool-helpers.ts"
```

### Task 3: 添加 SQL 辅助函数和聚合查询优化

**Files:**
- Modify: `src/lib/agent2/tool-helpers.ts`

- [ ] **Step 1: 添加 isSafeIdentifier 和 buildSqlWhereClause**

在 `tool-helpers.ts` 顶部（`listTables` 函数之前）添加：

```typescript
// 字段名白名单校验：防止 SQL 注入
function isSafeIdentifier(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

// 将 FilterCondition[] 转换为原生 SQL WHERE 子句
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
          const placeholders: string[] = [];
          for (const v of filter.value) {
            placeholders.push(`$${params.push(v)}`);
          }
          conditions.push(`${jsonPath} IN (${placeholders.join(", ")})`);
        }
        break;
    }
  }

  return { sql: conditions.join(" AND "), params };
}
```

- [ ] **Step 2: 重写 aggregateRecords 函数**

替换现有的 `aggregateRecords` 实现（行 310-411），count 保持 Prisma，sum/avg/min/max 改用原生 SQL。参照 spec 0.2 节的代码。 注意添加 `isSafeIdentifier(field)` 校验。

- [ ] **Step 3: 验证编译通过**

Run: `npx tsc --noEmit`

- [ ] **Step 4: 手动测试聚合操作**

通过 AI 对话测试：
- `aggregateRecords({ operation: "count" })` — 应返回正确计数
- `aggregateRecords({ operation: "sum", field: "某个数字字段" })` — 应返回正确总和
- `aggregateRecords({ operation: "avg" })` — 应返回正确平均值
- 带过滤条件的聚合 — 应正确过滤后聚合

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent2/tool-helpers.ts
git commit -m "perf(agent2): use raw SQL for aggregation queries"
```

---

## P1：性能与功能增强

### Task 4: searchRecords 高级过滤下推

**Files:**
- Modify: `src/lib/agent2/tool-helpers.ts`

- [ ] **Step 1: 重写 searchRecords 中的高级过滤路径**

**关键决策：`hasAdvancedFilters` 为 true 时，所有过滤条件统一走 SQL 路径。** 不要混合 Prisma + SQL 两条路径处理同一查询中的不同条件。`buildSqlWhereClause` 已经处理了所有操作符（eq/ne/contains/gt/gte/lt/lte/in），所以一旦检测到 gt/gte/lt/lte，整条查询都通过 `$queryRawUnsafe` 执行。

包括：
- COUNT 查询获取总数
- 带 LIMIT/OFFSET（参数化）的分页查询
- sortBy 通过 `isSafeIdentifier` 白名单校验

无高级过滤时保持现有 Prisma 路径不变。 参照 spec 1.1 节代码。

- [ ] **Step 2: 验证编译通过**

Run: `npx tsc --noEmit`

- [ ] **Step 3: 手动测试搜索过滤**

通过 AI 对话测试：
- 数字过滤：`searchRecords({ filters: [{ field: "price", operator: "gt", value: 100 }] })`
- 日期过滤：`searchRecords({ filters: [{ field: "deadline", operator: "gte", value: "2024-01-01" }] })`
- 混合过滤（eq + gt）：应同时应用两种条件
- 分页：验证 total、page、pageSize 正确

- [ ] **Step 4: Commit**

```bash
git add src/lib/agent2/tool-helpers.ts
git commit -m "perf(agent2): push numeric/date filters to database with raw SQL"
```

### Task 5: searchRecords 解析关系字段

**Files:**
- Modify: `src/lib/agent2/tool-helpers.ts`

- [ ] **Step 1: 在 searchRecords 返回前增加关系解析**

参照 spec 1.2 节代码， 在 searchRecords 的两个返回路径（高级过滤和普通过滤）中都添加关系字段解析逻辑：
1. 从 table.fields 中筛选 RELATION 类型字段
2. 收集所有关联 ID，按目标表分组。
3. 批量查询关联记录。
4. 替换为 `{ id, display }` 结构。

注意：需要确保 table 的 fields 中包含 `relationTo`、`displayField` 等字段。 检查 `getTableSchema` 的 include 是否已包含这些字段——当前 `searchRecords` 只 include 了 `{ fields: { orderBy: { sortOrder: "asc" } } }`，可能需要增加 relationTo/displayField 的 select。

- [ ] **Step 2: 验证编译通过**

Run: `npx tsc --noEmit`

- [ ] **Step 3: 手动测试关系解析**

通过 AI 对话搜索包含 RELATION 字段的记录，确认返回的是 `{ id, display }` 而非原始 ID。

- [ ] **Step 4: Commit**

```bash
git add src/lib/agent2/tool-helpers.ts
git commit -m "feat(agent2): resolve relation fields in searchRecords"
```

### Task 6: getTableSchema 返回关系信息

**Files:**
- Modify: `src/lib/agent2/tool-helpers.ts`

- [ ] **Step 1: 增强 getTableSchema 返回的字段信息**

在 `getTableSchema` 的 fields map 中增加：
- `relationTo: f.relationTo ?? undefined`
- `displayField: f.displayField ?? undefined`
- `cardinality: f.relationCardinality ?? undefined`

注意 Prisma schema 中字段名是 `relationCardinality`，不是 `cardinality`。

- [ ] **Step 2: 验证编译通过**

Run: `npx tsc --noEmit`

- [ ] **Step 3: 手动测试 Schema 信息**

通过 AI 对话调用 `getTableSchema`， 确认 RELATION 类型字段返回了 `relationTo` 和 `displayField`。

- [ ] **Step 4: Commit**

```bash
git add src/lib/agent2/tool-helpers.ts
git commit -m "feat(agent2): include relation info in getTableSchema"
```

---

## P2：体验提升

### Task 7: 系统提示动态注入上下文

**Files:**
- Modify: `src/lib/agent2/context-builder.ts`
- Modify: 调用 `buildSystemPrompt()` 的上游文件（需要 grep 查找所有调用点）

- [ ] **Step 1: 改造 buildSystemPrompt 为 async**

参照 spec 2.1 节代码。 将 `buildSystemPrompt()` 改为 async 函数， 需要：
- 导入 `listTables` 和 `getTableSchema` from `./tool-helpers`
- 添加动态表概要注入逻辑
- try-catch 保护，获取失败不影响静态提示
- 添加性能考量注释（模块级缓存可选项）

- [ ] **Step 2: 更新所有调用点（必须完整，遗漏会导致 prompt 变成 `[object Promise]`）**

确认的调用点：
- `src/app/api/agent2/conversations/[id]/chat/route.ts:56` — `const systemPrompt = buildSystemPrompt()` → `const systemPrompt = await buildSystemPrompt()`

注意：`src/lib/ai-agent/context-builder.ts` 和 `src/lib/ai-agent/service.ts` 是 ai-agent（v1），与 agent2 是不同模块，**不需要修改**。

- [ ] **Step 3: 验证编译通过**

Run: `npx tsc --noEmit`

- [ ] **Step 4: 手动测试动态提示**

开启新对话，确认 AI 知道当前系统有哪些表。 测试："帮我查一下有哪些数据表"。

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent2/context-builder.ts <其他修改的文件>
git commit -m "feat(agent2): inject dynamic table context into system prompt"
```

### Task 8: generateDocument 对接实际生成

**Files:**
- Modify: `src/lib/agent2/tool-executor.ts`

- [ ] **Step 1: 实现 generateDocument case**

在 `tool-executor.ts` 顶部添加 db import（如果还没有）：

```typescript
import { db } from "@/lib/db";
```

参照 spec 2.2 节代码。 在 `tool-executor.ts` 中替换 `generateDocument` 的占位符实现：
- 查询模板，验证存在性和状态（PUBLISHED）
- 调用 Python 服务生成文档

- [ ] **Step 2: 验证编译通过**

Run: `npx tsc --noEmit`

- [ ] **Step 3: 手动测试文档生成**

通过 AI 对话测试：选择一个已发布的模板，填入表单数据，确认生成成功。

- [ ] **Step 4: Commit**

```bash
git add src/lib/agent2/tool-executor.ts
git commit -m "feat(agent2): implement generateDocument with Python service"
```

### Task 9: 搜索增强 — isempty/isnotempty 操作符

**Files:**
- Modify: `src/lib/agent2/tool-helpers.ts`
- Modify: `src/lib/agent2/tools.ts`

- [ ] **Step 1: 更新 FilterCondition 类型**

在 `tool-helpers.ts` 的 `FilterCondition` interface 中，operator 联合类型增加 `"isempty" | "isnotempty"`。

- [ ] **Step 2: 在 buildFilterConditions 中添加 isempty/isnotempty**

参照 spec 2.3 节代码。 在 switch 中添加两个新 case。

- [ ] **Step 2b: 在 buildSqlWhereClause 中也添加 isempty/isnotempty**

**重要：** Task 4 让高级过滤走 SQL 路径，如果只有 buildFilterConditions 支持 isempty/isnotempty，高级过滤路径会静默丢失这些条件。必须在 `buildSqlWhereClause` 的 switch 中也添加：

```typescript
case "isempty":
  conditions.push(`(${jsonPath} IS NULL OR ${jsonPath} = '')`);
  break;
case "isnotempty":
  conditions.push(`(${jsonPath} IS NOT NULL AND ${jsonPath} != '')`);
  break;
```

- [ ] **Step 3: 更新 tools.ts 中的 Zod schema**

在 `searchRecords` tool 的 `operator` enum 中增加 `"isempty"` 和 `"isnotempty"`。

- [ ] **Step 4: 验证编译通过**

Run: `npx tsc --noEmit`

- [ ] **Step 5: 手动测试**

通过 AI 对话测试：搜索"没有填写邮箱的记录"（isempty）。

- [ ] **Step 6: Commit**

```bash
git add src/lib/agent2/tool-helpers.ts src/lib/agent2/tools.ts
git commit -m "feat(agent2): add isempty/isnotempty filter operators"
```

---

## 文件依赖关系

```
tool-executor.ts ──依赖──> data-record.service.ts (P0)
tool-executor.ts ──依赖──> tool-helpers.ts (查询函数保留)
tool-helpers.ts ──依赖──> db (原生 SQL)
context-builder.ts ──依赖──> tool-helpers.ts (listTables, getTableSchema)
tools.ts ──依赖──> tool-helpers.ts (无变化)
```

## 实施顺序

Task 1 → Task 2 → Task 3（P0 串行，因为 Task 2 删除代码，Task 3 修改同文件）
Task 4 → Task 5 → Task 6（P1 串行，同文件递进修改）
Task 7, Task 8, Task 9（P2 可并行，不同文件）
