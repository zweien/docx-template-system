# AI Agent 数据查询能力设计

**日期**: 2026-03-29
**状态**: 设计完成，等待评审

## 1. 目标

为系统添加通过大语言模型调用主数据库的能力，支持：

- 用户通过聊天窗口与数据库进行自然语言交互（查询、筛选、统计）
- 其他系统调用能力进行数据统计加工
- 兼顾效率与安全性

## 2. 背景

项目使用 Prisma + PostgreSQL，动态数据表存储在 JSONB 中。现需要添加 AI 能力让用户通过自然语言操作数据。

## 3. 用户场景

1. **聊天交互**: 用户在聊天窗口用自然语言查询数据
2. **API 调用**: 其他系统调用接口进行数据统计加工

## 4. 权限设计

- **查询操作**: 所有登录用户可执行
- **编辑操作**: 仅 ADMIN 角色可执行（后续扩展）

### 确认机制（编辑操作）

1. LLM 分析用户意图，生成操作预览
2. 返回预览信息给用户（包含将要执行的操作描述）
3. 用户确认后，执行实际数据库操作
4. 返回执行结果

示例预览响应：
```json
{
  "type": "preview",
  "action": "update",
  "table": "客户表",
  "changes": [
    { "field": "name", "from": "张三", "to": "张三丰" }
  ],
  "confirmToken": "abc123"
}
```

## 5. 技术选型

- **AI SDK**: Vercel AI SDK (`ai`) - 工具函数模式
- **模型**: 支持多 provider（OpenAI、Anthropic 等）
- **数据库**: 现有 Prisma + PostgreSQL

## 6. 架构设计

### 6.1 整体架构

```
用户输入 → AI Agent → 意图分析
                    ├── 简单查询 → 预定义工具函数
                    ├── 统计聚合 → 预定义工具函数
                    └── 复杂分析 → 验证后执行
```

### 6.2 组件结构

| 文件 | 职责 |
|------|------|
| `src/lib/ai-agent/service.ts` | LLM 调用入口，管理对话上下文 |
| `src/lib/ai-agent/tools.ts` | 预定义工具函数（search, aggregate, getSchema） |
| `src/lib/ai-agent/query-validator.ts` | 验证 LLM 生成的查询 |
| `src/lib/ai-agent/context-builder.ts` | 构建 schema 上下文 |
| `src/lib/ai-agent/types.ts` | 类型定义 |

### 6.3 工具函数设计

```typescript
// 筛选条件
interface FilterCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in';
  value: unknown;
}

// 排序配置
interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

// 搜索结果
interface SearchResult {
  records: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
}

// 聚合结果
interface AggregateResult {
  value: number;
  field: string;
  operation: 'count' | 'sum' | 'avg' | 'min' | 'max';
}

// 表结构
interface TableSchema {
  id: string;
  name: string;
  fields: Array<{
    key: string;
    label: string;
    type: string;
    required: boolean;
    options?: string[];
  }>;
}

// 搜索记录
searchRecords({
  tableId: string,
  filters: FilterCondition[],
  pagination?: { page: number; pageSize: number },
  sort?: SortConfig
}): Promise<SearchResult>

// 聚合统计
aggregateRecords({
  tableId: string,
  field: string,
  operation: 'count' | 'sum' | 'avg' | 'min' | 'max',
  filters?: FilterCondition[]
}): Promise<AggregateResult>

// 获取表结构
getTableSchema({ tableId: string }): Promise<TableSchema>

// 列出可访问的表
listTables(): Promise<DataTableListItem[]>
```

## 7. 安全机制

### 7.1 权限控制

- 路由保护：查询需登录，编辑需 ADMIN
- 中间件验证用户角色

### 7.2 查询验证

- 字段白名单：只允许操作 DataField 中定义的字段
- 操作限制：只读模式下禁止 mutation
- SQL/Prisma 验证：复杂查询需通过 validator

### 7.3 操作日志

- 记录所有 AI 执行的操作
- 包含：用户、时间、操作类型、输入输出

## 8. API 设计

### 8.1 聊天接口

```
POST /api/ai-agent/chat

Request:
{
  message: string,
  tableId?: string,
  history?: Array<{ role: 'user' | 'assistant'; content: string }>  // 最多 20 条
}

Response (streaming):
{
  type: 'text' | 'tool_call' | 'result' | 'error',
  content: string,
  // tool_call 时
  toolName?: string,
  toolArgs?: Record<string, unknown>,
  // result 时
  result?: unknown,
}
```

### 8.2 确认执行接口（编辑操作）

```
POST /api/ai-agent/confirm

Request:
{
  confirmToken: string,
  action: 'create' | 'update' | 'delete'
}

Response:
{
  success: boolean,
  result?: unknown,
  error?: { code: string; message: string }
}
```

### 8.3 统计接口

```
POST /api/ai-agent/aggregate

Request:
{
  tableId: string,
  field: string,
  operation: 'count' | 'sum' | 'avg' | 'min' | 'max',
  filters?: FilterCondition[]
}

Response:
{
  value: number,
  field: string,
  operation: string
}
```

## 9. 后续扩展

1. **编辑能力**: 新增/修改/删除记录（需 ADMIN + 预览确认）
2. **多表关联**: 支持 RELATION 字段的跨表查询
3. **数据导出**: 支持生成 Excel/CSV
4. **缓存优化**: 热点查询结果缓存

## 10. 实施计划

1. 创建 `src/lib/ai-agent/` 目录及基础文件
2. 实现工具函数层
3. 实现 LLM 调用逻辑
4. 添加 API 路由
5. 添加权限控制和日志
6. 单元测试

## 11. 风险与规避

| 风险 | 规避措施 |
|------|----------|
| LLM 生成恶意查询 | 仅暴露预定义工具函数，复杂查询需验证 |
| 数据泄露 | 权限检查 + 字段白名单 |
| 性能问题 | 分页限制 + 超时控制 |

## 12. 错误处理

| 错误类型 | HTTP 状态码 | 返回格式 |
|----------|-------------|----------|
| 无权限 | 403 | `{ code: 'FORBIDDEN', message: '...' }` |
| 表不存在 | 404 | `{ code: 'TABLE_NOT_FOUND', message: '...' }` |
| 字段不存在 | 400 | `{ code: 'INVALID_FIELD', message: '...' }` |
| LLM 调用失败 | 500 | `{ code: 'LLM_ERROR', message: '...' }` |
| 验证失败 | 400 | `{ code: 'VALIDATION_ERROR', message: '...' }` |

## 13. 限流机制

- 每个用户每分钟最多 30 次请求
- 超出限流返回 429 状态码
- LLM 响应超时设置为 30 秒