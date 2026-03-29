# AI Agent 编辑能力设计

**日期**: 2026-03-30
**状态**: 设计完成，等待评审

## 1. 目标

为 AI Agent 添加数据编辑能力，支持新增、修改、删除记录，需 ADMIN 权限 + 用户确认。

## 2. 背景

AI Agent 已实现查询功能（listTables, searchRecords, aggregateRecords），现需扩展编辑能力。

## 3. 用户场景

1. 用户通过聊天窗口请求："把员工张三的年龄改为 30"
2. LLM 解析意图，调用编辑工具
3. 返回操作预览（包含变更内容）
4. 用户确认后执行
5. 返回执行结果

## 4. 权限设计

- **执行权限**: 仅 ADMIN 角色
- **预览权限**: 登录用户可见，确认需 ADMIN

## 5. 技术设计

### 5.1 新增工具函数

```typescript
// 创建记录
createRecord({
  tableId: string,
  data: Record<string, unknown>
}): Promise<{ preview: EditPreview; confirmToken: string }>

// 更新记录
updateRecord({
  tableId: string,
  recordId: string,
  data: Record<string, unknown>
}): Promise<{ preview: EditPreview; confirmToken: string }>

// 删除记录
deleteRecord({
  tableId: string,
  recordId: string
}): Promise<{ preview: EditPreview; confirmToken: string }>

// 工具函数内部根据 tableId 查询 tableName，返回时填充 EditPreview.tableName
interface EditPreview {
  action: 'create' | 'update' | 'delete';
  tableId: string;
  tableName: string;
  // create: 展示新增字段及其值 from: null, to: value
  // update: 展示变更字段 from: 旧值, to: 新值
  // delete: 变更列表为空，通过 recordCount 或 recordId 标识
  changes?: Array<{ field: string; from: unknown; to: unknown }>;
  recordId?: string;
  recordCount?: number;
}
```

### 5.2 确认流程

```
LLM 调用编辑工具
    ↓
返回预览 + confirmToken（内存/缓存，30分钟有效）
    ↓
用户点击确认 → 调用 /api/ai-agent/confirm
    ↓
验证 token → 执行操作 → 删除 token → 记录日志 → 返回结果
```

### 5.3 组件结构

| 文件 | 职责 |
|------|------|
| `src/lib/ai-agent/tools.ts` | 新增 createRecord, updateRecord, deleteRecord 工具 |
| `src/lib/ai-agent/edit-validator.ts` | 验证编辑数据有效性 |
| `src/lib/ai-agent/confirm-store.ts` | 确认 token 存储和管理 |
| `src/lib/ai-agent/operation-log.ts` | 操作日志记录 |
| `src/app/api/ai-agent/confirm/route.ts` | 确认执行接口 |

### 5.4 Token 存储

采用内存存储（Map）+ 过期时间方式：
- 使用 `crypto.randomUUID()` 生成唯一 token
- Map<token, { action, tableId, data, recordId, expiresAt, userId }>
- 过期时间：30 分钟
- 确认执行后立即删除（一次性使用）

注意：Next.js 开发模式下热更新会重置内存存储，生产环境建议使用 Redis 或类似缓存。

## 6. API 设计

### 6.1 确认执行接口

```
POST /api/ai-agent/confirm

Request:
{
  confirmToken: string
  // action 已存储在 token 内部，无需重复传递
}

Response:
{
  success: boolean,
  result?: unknown,
  error?: { code: string; message: string }
}
```

## 7. 安全机制

### 7.1 权限控制

- 编辑工具仅对 ADMIN 角色暴露
- confirm 接口验证 ADMIN 权限

### 7.2 Token 验证

- 30 分钟有效期
- 一次性使用（确认后删除）
- 验证 token 存在且未过期

### 7.3 操作日志

记录内容：
- 用户 ID
- 操作类型（create/update/delete）
- 目标表/记录
- 操作时间
- 操作结果

## 8. 错误处理

| 错误类型 | HTTP 状态码 | 返回格式 |
|----------|-------------|----------|
| 无权限 | 403 | `{ code: 'FORBIDDEN', message: '...' }` |
| Token 无效/过期 | 400 | `{ code: 'INVALID_TOKEN', message: '...' }` |
| 记录不存在 | 404 | `{ code: 'NOT_FOUND', message: '...' }` |
| 验证失败 | 400 | `{ code: 'VALIDATION_ERROR', message: '...' }` |

## 9. 实施计划

1. **新增编辑工具函数**（tools.ts）
   - 依赖于 edit-validator.ts（先实现验证器）
   - 依赖于 confirm-store.ts（先生成 token）
2. **实现 edit-validator.ts**（独立模块）
3. **实现 confirm-store.ts**（独立模块）
4. **实现 operation-log.ts**（独立模块）
5. **更新 confirm/route.ts**（依赖 confirm-store.ts 和 operation-log.ts）
6. **更新 service.ts 中的工具定义**（依赖 tools.ts 的工具函数）
7. **单元测试**

## 10. 风险与规避

| 风险 | 规避措施 |
|------|----------|
| 权限绕过 | 所有编辑操作必须经过 ADMIN 权限检查 |
| Token 被滥用 | 一次性使用 + 30 分钟过期 |
| 数据不一致 | 事务处理确保原子性 |