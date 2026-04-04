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

### 禂述

工具返回的错误消息过于笼统（如 `"操作失败"`），AI 无法判断具体原因并精确反馈给用户。

### 0.1 统一错误结构

所有工具保持 `ServiceResult<T>` 格式不变，但改进 `error.message` 使其包含具体上下文：

**现状** → **改进**

| 函数 | 现有错误 | 改进后 |
|------|---------|--------|
| `searchRecords` | `"搜索记录失败"` | `"搜索记录失败：表 xxx 不存在"` / `"过滤字段 'age' 不存在于表 xxx 中"` / `"SQL 查询执行失败: ..."` |
| `aggregateRecords` | `"聚合统计失败"` | `"聚合统计失败：字段 'price' 不存在"` / `"字段 'name' 类型为 TEXT，不支持 sum 操作"` |
| `generateDocument` | `"文档生成失败"` | `"模板 xxx 不存在"` / `"模板未发布，当前状态: DRAFT"` / `"文档生成服务不可达"` |
| `listTables` | `"获取数据表列表失败"` | 保持现有（数据库连接错误，原始 message 已足够） |

### 0.2 实施要点

- `searchRecords`：在三个失败点（表不存在 / 字段不匹配 / SQL 执行错误）分别构造具体消息
- `aggregateRecords`：区分"聚合字段不存在"、"字段类型不匹配操作"等场景
- `generateDocument`：在 tool-executor.ts 中，区分"模板不存在"、"模板未发布"、"Python 服务不可达"（已部分实现，补充网络错误的 detail）
- 不改动 `data-record.service.ts`（它已有较完善的错误信息）
- 不引入新的错误码体系

### 0.3 涉及文件

| 文件 | 改动 |
|------|------|
| `src/lib/agent2/tool-helpers.ts` | 改进 searchRecords、aggregateRecords 的错误消息 |
| `src/lib/agent2/tool-executor.ts` | 改进 generateDocument 的错误消息 |

---

## P1：批量操作 + 事务

### 概述

新增批量创建/更新/删除工具，支持事务保障和文件导入场景。

### 1.1 新增工具

#### `batchCreateRecords`

- **输入**：`{ tableId: string, records: Array<Record<string, unknown>> }`
- **行为**：委托 `data-record.service.batchCreate`（已有实现）
- **输出**：`{ created: number, errors: Array<{ row: number, message: string }> }`
- **需要确认**：是
- **限制**：单次最多 100 条

#### `batchUpdateRecords`

- **输入**：`{ updates: Array<{ recordId: string, data: Record<string, unknown> }> }`
- **行为**：在 `$transaction` 内逐条执行更新逻辑（复用 `data-record.service.updateRecord` 的内部逻辑）
- **输出**：`{ updated: number, errors: Array<{ recordId: string, message: string }> }`
- **需要确认**：是
- **限制**：单次最多 50 条

#### `batchDeleteRecords`

- **输入**：`{ recordIds: string[] }`
- **行为**：在 `$transaction` 内逐条执行删除逻辑（复用 `data-record.service.deleteRecord` 的内部逻辑）
- **输出**：`{ deleted: number, errors: Array<{ recordId: string, message: string }> }`
- **需要确认**：是（标记为不可逆）
- **限制**：单次最多 50 条

### 1.2 文件导入流程

现有 `/api/agent2/upload` 已支持 CSV/Excel 解析并返回文本。流程无需修改：

```
用户上传文件 → upload API 返回文本 → AI 看到内容
→ AI 调用 batchCreateRecords 导入
```

只需在 `context-builder.ts` 的工作原则中增加一条提示，告知 AI 可以引导用户上传文件后批量导入。

### 1.3 事务策略

| 操作 | 事务实现 | 回滚策略 |
|------|---------|---------|
| `batchCreateRecords` | `createMany`（已有） | 单条，不回滚全部 |
| `batchUpdateRecords` | `$transaction` + 逐条更新 | 任何一条失败则整体回滚 |
| `batchDeleteRecords` | `$transaction` + 逐条删除 | 任何一条失败则整体回滚 |

> **batchCreate 保持现有 `createMany` 行为**（逐条验证、批量插入，错误记录跳过而非回滚）。这是因为导入场景用户期望部分成功而非全部失败。

> 超过 50 条的 update/delete 操作会在 service 层内部自动分批执行，避免长事务锁表。

### 1.4 data-record.service.ts 新增函数

```typescript
// 新增
export async function batchUpdate(
  updates: Array<{ id: string; data: Record<string, unknown> }>
): Promise<ServiceResult<{ updated: number; errors: Array<{ recordId: string; message: string }> }>>

export async function batchDelete(
  ids: string[]
): Promise<ServiceResult<{ deleted: number; errors: Array<{ recordId: string; message: string }> }>>
```

### 1.5 涉及文件

| 文件 | 改动 |
|------|------|
| `src/lib/agent2/tools.ts` | 注册 batchCreateRecords、batchUpdateRecords、batchDeleteRecords |
| `src/lib/agent2/tool-executor.ts` | 添加三个 batch case |
| `src/lib/agent2/context-builder.ts` | 工作原则增加文件导入提示 |
| `src/lib/services/data-record.service.ts` | 新增 batchUpdate、batchDelete |

### 1.6 不涉及

- 不改前端上传组件
- 不做增量导入（upsert）— YAGNI
- 不做导入进度条 — 当前架构是同步的

---

## P2：性能缓存

### 概述

高频对话场景下，每条消息触发多次相同的 DB 查询（表结构、用户设置等）。用模块级 TTL 缓存减少重复查询。

### 2.1 缓存设计

模块级 `Map<string, { data: unknown; expiresAt: number }>`，不引入外部依赖。

| 缓存项 | TTL | Key | 缓存内容 |
|--------|-----|-----|---------|
| 表 Schema | 30s | `schema:${tableId}` | `getTableSchema` 返回值 |
| 系统提示 | 30s | `sysprompt` | 完整提示字符串 |

### 2.2 缓存失效策略

- **TTL 自动过期**：每次读取检查 `Date.now() > expiresAt`
- **写操作主动失效**：`createRecord`、`updateRecord`、`deleteRecord` 执行后清除对应 `schema:${tableId}` 缓存
- **无手动刷新接口**：YAGNI

### 2.3 缓存粒度选择

**方案 A（推荐）：缓存 getTableSchema + buildSystemPrompt**

- `getTableSchema` 是高频调用（每条消息可能调多次）
- `buildSystemPrompt` 最多触发 6 次 DB 查询，30s 内复用显著减少压力
- 不缓存 `searchRecords` / `aggregateRecords`（结果变化快，无收益）

### 2.4 实施要点

- 在 `tool-helpers.ts` 顶部声明缓存 Map
- `getTableSchema` 先查缓存，miss 时查 DB 并写入
- `buildSystemPrompt` 缓存整个返回字符串
- `tool-executor.ts` 写操作后调用缓存失效函数

### 2.5 涉及文件

| 文件 | 改动 |
|------|------|
| `src/lib/agent2/tool-helpers.ts` | 添加缓存 Map、改 getTableSchema |
| `src/lib/agent2/context-builder.ts` | 缓存 buildSystemPrompt 结果 |
| `src/lib/agent2/tool-executor.ts` | 写操作后清除缓存 |

### 2.6 不涉及

- 不用 Redis 或外部缓存
- 不缓存搜索/聚合结果
- 不做缓存预热

---

## 涉及文件总览

| 文件 | P0 | P1 | P2 |
|------|----|----|-----|
| `src/lib/agent2/tool-helpers.ts` | 错误消息 | — | 缓存 |
| `src/lib/agent2/tool-executor.ts` | 错误消息 | batch case | 缓存失效 |
| `src/lib/agent2/tools.ts` | — | 注册 batch 工具 | — |
| `src/lib/agent2/context-builder.ts` | — | 导入提示 | 缓存 |
| `src/lib/services/data-record.service.ts` | — | batchUpdate、batchDelete | — |

## 实施顺序

P0 → P1 → P2（递进，P1 依赖 P0 的错误信息结构）
