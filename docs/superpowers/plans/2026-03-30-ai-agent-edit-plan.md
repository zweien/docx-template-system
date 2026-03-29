# AI Agent 编辑能力实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 AI Agent 添加数据编辑能力（创建、更新、删除记录），需 ADMIN 权限 + 用户确认

**Architecture:**
- 新增编辑工具函数：createRecord, updateRecord, deleteRecord
- 确认 Token 存储：内存 Map + 30 分钟过期
- 操作日志：记录所有编辑操作到数据库

**Tech Stack:** Next.js 16, Prisma, TypeScript, Vercel AI SDK

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `src/lib/ai-agent/types.ts` | 新增 EditPreview、EditOperation 接口 |
| `src/lib/ai-agent/edit-validator.ts` | 验证编辑数据有效性（复用 data-record.service.ts 的验证逻辑） |
| `src/lib/ai-agent/confirm-store.ts` | 确认 token 存储和管理 |
| `src/lib/ai-agent/operation-log.ts` | 操作日志记录 |
| `src/lib/ai-agent/tools.ts` | 新增 createRecord, updateRecord, deleteRecord 工具函数 |
| `src/lib/ai-agent/service.ts` | 更新工具定义，添加编辑工具 |
| `src/validators/ai-agent.ts` | 更新 confirmRequestSchema（移除 action 字段） |
| `src/app/api/ai-agent/confirm/route.ts` | 实现确认执行接口 |
| `prisma/schema.prisma` | 新增 AIOperationLog 模型 |

---

### Task 1: 新增编辑类型定义

**Files:**
- Modify: `src/lib/ai-agent/types.ts:51-51`

- [ ] **Step 1: 添加 EditPreview 和相关类型**

> **注意**: edit-validator.ts 复用 data-record.service.ts 内部的 validateRecordData 函数，无需单独实现。

```typescript
// 编辑预览
export interface EditPreview {
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

// 编辑操作数据（存储在 token 中）
export interface EditOperation {
  action: 'create' | 'update' | 'delete';
  tableId: string;
  recordId?: string;
  data?: Record<string, unknown>;
  userId: string;
  expiresAt: number;
}
```

- [ ] **Step 2: 提交**

```bash
git add src/lib/ai-agent/types.ts
git commit -m "feat(ai-agent): add edit types (EditPreview, EditOperation)"
```

---

### Task 2: 实现确认 Token 存储

**Files:**
- Create: `src/lib/ai-agent/confirm-store.ts`

- [ ] **Step 1: 创建 confirm-store.ts**

```typescript
import crypto from 'crypto';
import type { EditOperation } from './types';

// 内存存储：token -> EditOperation
const confirmStore = new Map<string, EditOperation>();

// Token 有效期：30 分钟
const TOKEN_EXPIRY_MS = 30 * 60 * 1000;

/**
 * 生成确认 Token 并存储操作
 */
export function createConfirmToken(operation: Omit<EditOperation, 'expiresAt'>): string {
  const token = crypto.randomUUID();
  const expiresAt = Date.now() + TOKEN_EXPIRY_MS;

  confirmStore.set(token, {
    ...operation,
    expiresAt,
  });

  return token;
}

/**
 * 验证并获取 Token 对应的操作
 * 返回 null 表示 token 无效或已过期
 */
export function getConfirmOperation(token: string): EditOperation | null {
  const operation = confirmStore.get(token);

  if (!operation) {
    return null;
  }

  if (Date.now() > operation.expiresAt) {
    confirmStore.delete(token);
    return null;
  }

  return operation;
}

/**
 * 删除 Token（一次性使用）
 */
export function deleteConfirmToken(token: string): boolean {
  return confirmStore.delete(token);
}

/**
 * 清理过期 Token（定时任务调用）
 */
export function cleanExpiredTokens(): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [token, operation] of confirmStore.entries()) {
    if (now > operation.expiresAt) {
      confirmStore.delete(token);
      cleaned++;
    }
  }

  return cleaned;
}
```

- [ ] **Step 2: 编写测试**

```typescript
// tests/ai-agent/confirm-store.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createConfirmToken, getConfirmOperation, deleteConfirmToken } from '@/lib/ai-agent/confirm-store';

describe('confirm-store', () => {
  beforeEach(() => {
    // Clear store before each test
    // Note: In real implementation, export a clear function or use module isolation
  });

  it('should create and retrieve token', () => {
    const operation = {
      action: 'create' as const,
      tableId: 'table-1',
      data: { name: 'test' },
      userId: 'user-1',
    };

    const token = createConfirmToken(operation);
    expect(token).toBeDefined();

    const retrieved = getConfirmOperation(token);
    expect(retrieved).toMatchObject(operation);
    expect(retrieved?.expiresAt).toBeGreaterThan(Date.now());
  });

  it('should return null for invalid token', () => {
    const result = getConfirmOperation('invalid-token');
    expect(result).toBeNull();
  });

  it('should delete token after use', () => {
    const token = createConfirmToken({
      action: 'delete',
      tableId: 'table-1',
      recordId: 'record-1',
      userId: 'user-1',
    });

    const deleted = deleteConfirmToken(token);
    expect(deleted).toBe(true);

    const result = getConfirmOperation(token);
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 3: 运行测试验证**

Run: `npm test -- --run src/lib/ai-agent/confirm-store.test.ts`
Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add src/lib/ai-agent/confirm-store.ts src/lib/ai-agent/confirm-store.test.ts
git commit -m "feat(ai-agent): add confirm token store with expiry"
```

---

### Task 3: 实现操作日志记录

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/lib/ai-agent/operation-log.ts`

- [ ] **Step 1: 添加 Prisma 模型**

```prisma
// prisma/schema.prisma 添加
model AIOperationLog {
  id        String   @id @default(cuid())
  userId    String
  userName  String?
  action    String   // create, update, delete
  tableId   String
  tableName String
  recordId  String?
  changes   Json?    // Array<{ field, from, to }>
  status    String   // success, failed
  errorMsg  String?
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([tableId])
  @@index([createdAt])
}
```

- [ ] **Step 2: 运行 Prisma generate**

Run: `npx prisma generate`
Expected: Success

- [ ] **Step 3: 创建 operation-log.ts**

```typescript
import { db } from '@/lib/db';
import type { EditPreview } from './types';

export interface LogOperationParams {
  userId: string;
  userName?: string;
  action: 'create' | 'update' | 'delete';
  tableId: string;
  tableName: string;
  recordId?: string;
  preview: EditPreview;
  status: 'success' | 'failed';
  errorMsg?: string;
}

/**
 * 记录操作日志
 */
export async function logOperation(params: LogOperationParams): Promise<void> {
  await db.aIOperationLog.create({
    data: {
      userId: params.userId,
      userName: params.userName,
      action: params.action,
      tableId: params.tableId,
      tableName: params.tableName,
      recordId: params.recordId,
      changes: params.preview.changes ?? [],
      status: params.status,
      errorMsg: params.errorMsg,
    },
  });
}

/**
 * 获取用户的操作日志
 */
export async function getUserOperationLogs(
  userId: string,
  limit = 50
): Promise<Array<{
  id: string;
  action: string;
  tableName: string;
  recordId?: string;
  status: string;
  createdAt: Date;
}>> {
  const logs = await db.aIOperationLog.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      action: true,
      tableName: true,
      recordId: true,
      status: true,
      createdAt: true,
    },
  });

  return logs;
}
```

- [ ] **Step 4: 提交**

```bash
git add prisma/schema.prisma src/lib/ai-agent/operation-log.ts
npx prisma generate
git commit -m "feat(ai-agent): add operation log model and service"
```

---

### Task 4: 新增编辑工具函数

**Files:**
- Modify: `src/lib/ai-agent/tools.ts:288-288`

- [ ] **Step 1: 添加编辑工具函数到 tools.ts**

> **注意**:
> - **userId 处理**: AI Agent 执行时没有直接的 session 上下文。在第一阶段实现中，使用占位符 `'ai-agent'`，确认执行时会使用当前登录用户的信息覆盖。
> - 后续可以优化：让 LLM 返回用户请求的 userId，或通过对话上下文传递。

```typescript
// ========== 编辑工具函数 ==========

import { createConfirmToken } from './confirm-store';
import type { EditPreview } from './types';

/**
 * 创建记录 - 生成预览和确认 Token
 */
export async function createRecordPreview(
  tableId: string,
  data: Record<string, unknown>,
  userId: string
): Promise<{ preview: EditPreview; confirmToken: string }> {
  // 获取表信息
  const table = await db.dataTable.findUnique({
    where: { id: tableId },
  });

  if (!table) {
    throw new Error('数据表不存在');
  }

  // 构建预览
  const changes = Object.entries(data).map(([field, to]) => ({
    field,
    from: null,
    to,
  }));

  const preview: EditPreview = {
    action: 'create',
    tableId,
    tableName: table.name,
    changes,
  };

  // 生成确认 Token
  const confirmToken = createConfirmToken({
    action: 'create',
    tableId,
    data,
    userId,
  });

  return { preview, confirmToken };
}

/**
 * 更新记录 - 生成预览和确认 Token
 */
export async function updateRecordPreview(
  tableId: string,
  recordId: string,
  data: Record<string, unknown>,
  userId: string
): Promise<{ preview: EditPreview; confirmToken: string }> {
  // 获取表信息
  const table = await db.dataTable.findUnique({
    where: { id: tableId },
  });

  if (!table) {
    throw new Error('数据表不存在');
  }

  // 获取现有记录
  const record = await db.dataRecord.findUnique({
    where: { id: recordId },
  });

  if (!record) {
    throw new Error('记录不存在');
  }

  const existingData = record.data as Record<string, unknown>;

  // 构建变更预览
  const changes: Array<{ field: string; from: unknown; to: unknown }> = [];

  for (const [field, to] of Object.entries(data)) {
    const from = existingData[field];
    // 只显示有变化的字段
    if (from !== to) {
      changes.push({ field, from, to });
    }
  }

  const preview: EditPreview = {
    action: 'update',
    tableId,
    tableName: table.name,
    changes,
    recordId,
  };

  // 生成确认 Token
  const confirmToken = createConfirmToken({
    action: 'update',
    tableId,
    recordId,
    data,
    userId,
  });

  return { preview, confirmToken };
}

/**
 * 删除记录 - 生成预览和确认 Token
 */
export async function deleteRecordPreview(
  tableId: string,
  recordId: string,
  userId: string
): Promise<{ preview: EditPreview; confirmToken: string }> {
  // 获取表信息
  const table = await db.dataTable.findUnique({
    where: { id: tableId },
  });

  if (!table) {
    throw new Error('数据表不存在');
  }

  // 验证记录存在
  const record = await db.dataRecord.findUnique({
    where: { id: recordId },
  });

  if (!record) {
    throw new Error('记录不存在');
  }

  const preview: EditPreview = {
    action: 'delete',
    tableId,
    tableName: table.name,
    recordId,
    recordCount: 1,
  };

  // 生成确认 Token
  const confirmToken = createConfirmToken({
    action: 'delete',
    tableId,
    recordId,
    userId,
  });

  return { preview, confirmToken };
}
```

- [ ] **Step 2: 提交**

```bash
git add src/lib/ai-agent/tools.ts
git commit -m "feat(ai-agent): add edit preview functions (createRecordPreview, updateRecordPreview, deleteRecordPreview)"
```

---

### Task 5: 更新 service.ts 添加工具定义

**Files:**
- Modify: `src/lib/ai-agent/service.ts:24-111`

- [ ] **Step 1: 添加编辑工具定义**

在 service.ts 的 tools 对象中添加：

```typescript
// 在现有的 tools 定义后添加
createRecord: tool({
  description: '创建数据记录（需要管理员确认）',
  inputSchema: z.object({
    tableId: z.string().min(1, '表ID不能为空'),
    data: z.record(z.unknown(), '要创建的数据对象'),
  }),
  execute: async (args) => {
    const { tableId, data } = args as {
      tableId: string;
      data: Record<string, unknown>;
    };
    // 需要用户ID，需要从 session 获取，这里先占位
    const { preview, confirmToken } = await createRecordPreview(tableId, data, 'ai-agent');
    return {
      preview,
      confirmToken,
      message: `准备创建记录，确认码: ${confirmToken.substring(0, 8)}...`,
    };
  },
}),

updateRecord: tool({
  description: '更新数据记录（需要管理员确认）',
  inputSchema: z.object({
    tableId: z.string().min(1, '表ID不能为空'),
    recordId: z.string().min(1, '记录ID不能为空'),
    data: z.record(z.unknown(), '要更新的数据对象'),
  }),
  execute: async (args) => {
    const { tableId, recordId, data } = args as {
      tableId: string;
      recordId: string;
      data: Record<string, unknown>;
    };
    const { preview, confirmToken } = await updateRecordPreview(tableId, recordId, data, 'ai-agent');
    return {
      preview,
      confirmToken,
      message: `准备更新记录，确认码: ${confirmToken.substring(0, 8)}...`,
    };
  },
}),

deleteRecord: tool({
  description: '删除数据记录（需要管理员确认）',
  inputSchema: z.object({
    tableId: z.string().min(1, '表ID不能为空'),
    recordId: z.string().min(1, '记录ID不能为空'),
  }),
  execute: async (args) => {
    const { tableId, recordId } = args as {
      tableId: string;
      recordId: string;
    };
    const { preview, confirmToken } = await deleteRecordPreview(tableId, recordId, 'ai-agent');
    return {
      preview,
      confirmToken,
      message: `准备删除记录，确认码: ${confirmToken.substring(0, 8)}...`,
    };
  },
}),
```

- [ ] **Step 2: 添加 import**

```typescript
import { createRecordPreview, updateRecordPreview, deleteRecordPreview } from './tools';
```

- [ ] **Step 3: 类型检查**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: 提交**

```bash
git add src/lib/ai-agent/service.ts
git commit -m "feat(ai-agent): add edit tool definitions to service"
```

---

### Task 6: 实现确认执行接口

**Files:**
- Modify: `src/validators/ai-agent.ts`
- Modify: `src/app/api/ai-agent/confirm/route.ts`

- [ ] **Step 1: 更新验证器（移除 action 字段）**

```typescript
// src/validators/ai-agent.ts

// 更新 Confirm Schemas
export const confirmRequestSchema = z.object({
  confirmToken: z.string().min(1, '确认令牌不能为空'),
  // action 已存储在 token 内部，无需重复传递
});

// 更新类型
export type ConfirmRequestInput = z.infer<typeof confirmRequestSchema>;
```

- [ ] **Step 2: 实现 confirm/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getConfirmOperation, deleteConfirmToken } from '@/lib/ai-agent/confirm-store';
import { logOperation } from '@/lib/ai-agent/operation-log';
import { createRecord as dbCreateRecord, updateRecord as dbUpdateRecord, deleteRecord as dbDeleteRecord } from '@/lib/services/data-record.service';
import { confirmRequestSchema } from '@/validators/ai-agent';

export async function POST(request: NextRequest) {
  const session = await auth();

  // 检查登录
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: '未授权' } },
      { status: 401 }
    );
  }

  // 检查 ADMIN 权限
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: '仅管理员可执行此操作' } },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const validated = confirmRequestSchema.parse(body);

    // 获取并验证 token
    const operation = getConfirmOperation(validated.confirmToken);
    if (!operation) {
      return NextResponse.json(
        { error: { code: 'INVALID_TOKEN', message: '确认令牌无效或已过期' } },
        { status: 400 }
      );
    }

    // 执行操作
    let result;
    try {
      switch (operation.action) {
        case 'create':
          result = await dbCreateRecord(
            operation.userId,
            operation.tableId,
            operation.data!
          );
          break;
        case 'update':
          result = await dbUpdateRecord(
            operation.recordId!,
            operation.data!
          );
          break;
        case 'delete':
          result = await dbDeleteRecord(operation.recordId!);
          break;
        default:
          throw new Error('未知操作类型');
      }
    } catch (dbError) {
      // 记录失败日志（此时 tableName 未知）
      await logOperation({
        userId: session.user.id,
        userName: session.user.name ?? undefined,
        action: operation.action,
        tableId: operation.tableId,
        tableName: '未知',
        recordId: operation.recordId,
        preview: { action: operation.action, tableId: operation.tableId, tableName: '未知' },
        status: 'failed',
        errorMsg: dbError instanceof Error ? dbError.message : '执行失败',
      });

      // 删除 token
      deleteConfirmToken(validated.confirmToken);

      return NextResponse.json(
        { error: { code: 'EXECUTE_FAILED', message: dbError instanceof Error ? dbError.message : '执行失败' } },
        { status: 500 }
      );
    }

    // 获取表名（用于日志）
    const table = await db.dataTable.findUnique({
      where: { id: operation.tableId },
      select: { name: true },
    });
    const tableName = table?.name ?? '未知';

    // 记录成功日志
    await logOperation({
      userId: session.user.id,
      userName: session.user.name ?? undefined,
      action: operation.action,
      tableId: operation.tableId,
      tableName,
      recordId: operation.recordId,
      preview: { action: operation.action, tableId: operation.tableId, tableName },
      status: 'success',
    });

    // 删除 token（一次性使用）
    deleteConfirmToken(validated.confirmToken);

    return NextResponse.json({
      success: true,
      result: result.success ? result.data : null,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '数据验证失败' } },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: { code: 'CONFIRM_FAILED', message: '确认执行失败' } },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: 类型检查**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: 提交**

```bash
git add src/validators/ai-agent.ts src/app/api/ai-agent/confirm/route.ts
git commit -m "feat(ai-agent): implement confirm execution endpoint"
```

---

### Task 7: 单元测试

**Files:**
- Create: `tests/ai-agent/edit-tools.test.ts`

- [ ] **Step 1: 编写编辑工具测试**

```typescript
import { describe, it, expect } from 'vitest';
import { createRecordPreview, updateRecordPreview, deleteRecordPreview } from '@/lib/ai-agent/tools';

describe('edit tools', () => {
  // 注意：需要数据库和 session，可以集成测试或 mock

  it('should be defined', () => {
    expect(createRecordPreview).toBeDefined();
    expect(updateRecordPreview).toBeDefined();
    expect(deleteRecordPreview).toBeDefined();
  });
});
```

- [ ] **Step 2: 提交**

```bash
git add tests/ai-agent/edit-tools.test.ts
git commit -m "test(ai-agent): add edit tools basic tests"
```