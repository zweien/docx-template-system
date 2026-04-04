# AI-Agent2 数据操作优化 V2 设计

> 2026-04-04

## 背景

上一轮优化（P0-P2）已完成：CRUD 委托、原生 SQL 聚合、高级过滤下推、关系字段解析、Schema 增强、动态系统提示、文档生成对接、搜索操作符扩展。

本轮聚焦三个方向：**错误信息增强**、**批量操作 + 事务**、**性能缓存**。

## 分批实施

- **P0**：错误信息增强
- **P1**：批量操作 + 事务
- **P2**：性能缓存

---

## P0：错误信息增强

### 概述

工具返回的错误消息不够精确，AI 无法判断具体原因并反馈给用户。主要有两类问题：

1. **`tool-executor.ts` 的 `ExecuteResult` 类型丢失错误结构**：当前 `ExecuteResult` 的 `error` 字段是 `string`，而 `ServiceResult` 的 error 是 `{ code, message }`。`tool-executor.ts` 第 25 行 `error: result.error.message` 只传递了 message 字符串，丢弃了 code。P0 需要扩展 `ExecuteResult` 使其保留结构化错误信息。
2. **过滤字段无效时静默跳过**：`buildSqlWhereClause` 中 `resolveFieldKey` 返回 `null` 后直接 `continue`，AI 拿到"成功但结果不对"的响应。

### 0.1 扩展 ExecuteResult 类型

```typescript
// tool-executor.ts
type ExecuteResult = {
  success: boolean;
  data?: unknown;
  error?: string;
  errorDetails?: { code: string; message: string };  // 新增
};
```

在 CRUD 和 generateDocument case 中，透传 `result.error` 而非只传 `result.error.message`：

```typescript
case "createRecord": {
  const result = await recordService.createRecord(...);
  if (!result.success)
    return { success: false, error: result.error.message, errorDetails: result.error };
  return { success: true, data: result.data };
}
```

工具 execute 函数中，返回完整错误信息给 AI SDK：

```typescript
execute: async (args) => {
  const result = await helpers.searchRecords({...});
  if (!result.success) throw new Error(result.error.message);
  return result.data;
}
```

### 0.2 searchRecords 过滤字段无效时的错误收集

在 `buildSqlWhereClause` 中收集被跳过的字段，在 `searchRecords` 中作为警告信息附加到结果：

```typescript
// buildSqlWhereClause 返回值增加 warnings
function buildSqlWhereClause(...): { sql: string; params: unknown[]; warnings: string[] }

// searchRecords 返回时检查 warnings
if (warnings.length > 0) {
  // 在返回的 data 中附加 warnings 字段
  return { success: true, data: { ...data, _warnings: warnings } };
}
```

AI 收到 warnings 后能告知用户"过滤条件中字段 X 不存在已被忽略"。

### 0.3 aggregateRecords 前置校验

在执行 SQL 前增加字段类型校验：

```typescript
// 对于 sum/avg 操作，检查字段类型是否为 NUMBER
if (["sum", "avg"].includes(operation) && targetField.type !== "NUMBER") {
  return {
    success: false,
    error: { code: "INVALID_FIELD_TYPE", message: `字段 '${field}' 类型为 ${targetField.type}，不支持 ${operation} 操作` }
  };
}
```

### 0.4 generateDocument 错误增强

当前 `generateDocument` 已区分"模板不存在"和"模板未发布"。补充网络错误的 detail：

```typescript
if (!response.ok) {
  const detail = response.status === 0 ? "文档生成服务不可达" : `文档生成服务返回错误 (${response.status})`;
  return { success: false, error: detail };
}
```

### 0.5 涉及文件

| 文件 | 改动 |
|------|------|
| `src/lib/agent2/tool-helpers.ts` | searchRecords 增加警告收集；aggregateRecords 增加字段类型校验 |
| `src/lib/agent2/tool-executor.ts` | ExecuteResult 扩展 errorDetails；generateDocument 网络错误增强 |

---

## P1：批量操作 + 事务

### 概述

新增批量创建/更新/删除工具，支持事务保障和文件导入场景。

### 1.1 前置重构：提取事务内部函数

`data-record.service.ts` 中 `updateRecord` 和 `deleteRecord` 内部已使用 `$transaction`。批量操作需要在外部开启事务后逐条调用，因此需要将事务体提取为接受 `tx: PrismaTransaction` 参数的内部函数：

```typescript
// 新增内部函数（不导出）
async function doUpdateRecord(tx: PrismaTransaction, id: string, data: Record<string, unknown>): Promise<DataRecordItem>
async function doDeleteRecord(tx: PrismaTransaction, id: string): Promise<void>

// 现有 updateRecord/deleteRecord 改为调用这些内部函数
export async function updateRecord(id: string, data: Record<string, unknown>) {
  return db.$transaction(tx => doUpdateRecord(tx, id, data));
}
```

### 1.2 新增工具

#### `batchCreateRecords`

- **输入**：`{ tableId: string, records: Array<Record<string, unknown>> }`
- **行为**：委托 `data-record.service.batchCreate`（已有实现）
- **输出**：`{ created: number, errors: Array<{ row: number, message: string }> }`
- **需要确认**：是
- **限制**：单次最多 100 条
- **注意**：现有 `batchCreate` 使用 `createMany`，不支持 RELATION_SUBTABLE 字段。文档生成场景的批量导入通常不涉及关系子表，如果需要支持，需改为逐条调用 `createRecord`。当前版本保持 `createMany`，在工具描述中标注"不支持关系子表字段"。

#### `batchUpdateRecords`

- **输入**：`{ tableId: string, updates: Array<{ recordId: string, data: Record<string, unknown> }> }`
- **行为**：在 `$transaction` 内逐条调用 `doUpdateRecord(tx, id, data)`，获取字段定义一次（利用 tableId）
- **输出**：`{ updated: number, errors: Array<{ recordId: string, message: string }> }`
- **需要确认**：是
- **限制**：单次最多 50 条
- **要求传入 tableId**：用于一次获取字段定义做校验，同时用于 P2 缓存失效

#### `batchDeleteRecords`

- **输入**：`{ tableId: string, recordIds: string[] }`
- **行为**：在 `$transaction` 内逐条调用 `doDeleteRecord(tx, id)`
- **输出**：`{ deleted: number, errors: Array<{ recordId: string, message: string }> }`
- **需要确认**：是（标记为不可逆）
- **限制**：单次最多 50 条
- **要求传入 tableId**：同上，用于缓存失效

### 1.3 事务策略

| 操作 | 事务实现 | 回滚策略 |
|------|---------|---------|
| `batchCreateRecords` | `createMany`（已有） | 单条，不回滚全部 |
| `batchUpdateRecords` | `$transaction` + `doUpdateRecord` | 任何一条失败则整体回滚 |
| `batchDeleteRecords` | `$transaction` + `doDeleteRecord` | 任何一条失败则整体回滚 |

> **batchCreate 保持现有 `createMany` 行为**（逐条验证、批量插入，错误记录跳过而非回滚）。这是因为导入场景用户期望部分成功而非全部失败。

> 超过 50 条的 update/delete 操作会在 service 层内部自动分批执行，避免长事务锁表。

### 1.4 文件导入流程

现有 `/api/agent2/upload` 已支持 CSV/Excel 解析并返回文本。流程无需修改：

```
用户上传文件 → upload API 返回文本 → AI 看到内容
→ AI 调用 batchCreateRecords 导入
```

只需在 `context-builder.ts` 的工作原则中增加一条提示，告知 AI 可以引导用户上传文件后批量导入。

### 1.5 confirm-store.ts 同步更新

在 `CONFIRM_REQUIRED_TOOLS` 集合中添加三个新工具名。在 `RISK_MESSAGES` 映射中添加：

```typescript
batchCreateRecords: "即将批量创建 {n} 条记录",
batchUpdateRecords: "即将批量更新 {n} 条记录",
batchDeleteRecords: "⚠️ 即将永久删除 {n} 条记录，此操作不可撤销",
```

### 1.6 data-record.service.ts 新增函数

```typescript
// 导出（供 batch 和外部使用）
export async function batchUpdate(
  tableId: string,
  updates: Array<{ id: string; data: Record<string, unknown> }>
): Promise<ServiceResult<{ updated: number; errors: Array<{ recordId: string; message: string }> }>>

export async function batchDelete(
  tableId: string,
  ids: string[]
): Promise<ServiceResult<{ deleted: number; errors: Array<{ recordId: string; message: string }> }>>
```

### 1.7 涉及文件

| 文件 | 改动 |
|------|------|
| `src/lib/agent2/tools.ts` | 注册 batchCreateRecords、batchUpdateRecords、batchDeleteRecords |
| `src/lib/agent2/tool-executor.ts` | 添加三个 batch case |
| `src/lib/agent2/context-builder.ts` | 工作原则增加文件导入提示 |
| `src/lib/agent2/confirm-store.ts` | 添加 batch 工具到确认列表和风险消息 |
| `src/lib/services/data-record.service.ts` | 重构：提取 doUpdateRecord/doDeleteRecord；新增 batchUpdate、batchDelete |

### 1.8 不涉及

- 不改前端上传组件
- 不做增量导入（upsert）— YAGNI
- 不做导入进度条 — 当前架构是同步的
- 不改 batchCreate（保持 createMany 行为）

---

## P2：性能缓存

### 概述

高频对话场景下，每条消息触发多次相同的 DB 查询（表结构、用户设置等）。用模块级 TTL 缓存减少重复查询。

### 2.1 缓存设计

模块级 `Map<string, { data: unknown; expiresAt: number }>`，不引入外部依赖。

**局限性声明**：此缓存为进程内、单实例、best-effort 优化。在 Next.js 开发模式下每次请求可能重建；在 Serverless 环境下冷启动会清空。TTL 仅 30 秒，设计为降低高频短时重复查询而非保证一致性。

**前置条件**：系统提示（buildSystemPrompt）不包含用户特定内容，只查询全局表结构。

| 缓存项 | TTL | Key | 缓存内容 |
|--------|-----|-----|---------|
| 表 Schema | 30s | `schema:${tableId}` | `getTableSchema` 返回值 |
| 系统提示 | 30s | `sysprompt` | 完整提示字符串 |

### 2.2 缓存失效策略

- **TTL 自动过期**：每次读取检查 `Date.now() > expiresAt`
- **写操作主动失效**：`createRecord`、`updateRecord`、`deleteRecord` 执行后清除对应 `schema:${tableId}` 缓存
- **批量操作失效**：P1 新增的 `batchCreateRecords`、`batchUpdateRecords`、`batchDeleteRecords` 执行后也需清除对应 `schema:${tableId}` 缓存（这些工具都要求传入 tableId，可直接定位缓存）
- **无手动刷新接口**：YAGNI

### 2.3 缓存粒度选择

**缓存 getTableSchema + buildSystemPrompt**

- `getTableSchema` 是高频调用（每条消息可能调多次）
- `buildSystemPrompt` 最多触发 6 次 DB 查询，30s 内复用显著减少压力
- 不缓存 `searchRecords` / `aggregateRecords`（结果变化快，无收益）

### 2.4 实施要点

- 在 `tool-helpers.ts` 顶部声明缓存 Map
- `getTableSchema` 先查缓存，miss 时查 DB 并写入
- `buildSystemPrompt` 缓存整个返回字符串
- 导出 `invalidateSchemaCache(tableId)` 函数供 tool-executor 调用
- `tool-executor.ts` 所有写操作（包括 batch 操作）后调用缓存失效函数

### 2.5 涉及文件

| 文件 | 改动 |
|------|------|
| `src/lib/agent2/tool-helpers.ts` | 添加缓存 Map、改 getTableSchema、导出 invalidateSchemaCache |
| `src/lib/agent2/context-builder.ts` | 缓存 buildSystemPrompt 结果 |
| `src/lib/agent2/tool-executor.ts` | 所有写操作后清除缓存 |

### 2.6 不涉及

- 不用 Redis 或外部缓存
- 不缓存搜索/聚合结果
- 不做缓存预热

---

## 涉及文件总览

| 文件 | P0 | P1 | P2 |
|------|----|----|-----|
| `src/lib/agent2/tool-helpers.ts` | 错误消息、警告收集 | — | 缓存 |
| `src/lib/agent2/tool-executor.ts` | ExecuteResult 扩展 | batch case | 缓存失效 |
| `src/lib/agent2/tools.ts` | — | 注册 batch 工具 | — |
| `src/lib/agent2/context-builder.ts` | — | 导入提示 | 缓存 |
| `src/lib/agent2/confirm-store.ts` | — | batch 确认配置 | — |
| `src/lib/services/data-record.service.ts` | — | 重构 + batchUpdate/batchDelete | — |

## 实施顺序

P0 → P1 → P2（递进，P1 依赖 P0 的错误信息结构，P2 依赖 P1 的 tableId 参数做缓存失效）
