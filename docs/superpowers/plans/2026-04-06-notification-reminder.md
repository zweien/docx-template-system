# 通知提醒系统实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为文档收集任务添加站内通知系统，支持任务分配通知、到期提醒（懒加载）、手动催办。

**Architecture:** 数据库驱动 — Notification 表存储通知，铃铛组件轮询未读数，获取通知时懒加载检查到期/逾期事件。所有服务函数返回 `ServiceResult<T>`，路由处理器是薄包装层。

**Tech Stack:** Prisma 7, Next.js 16 (Route Handlers), shadcn/ui v4 (Base UI), Zod, Vitest, lucide-react

---

## 文件结构

### 新增文件

| 文件 | 职责 |
|------|------|
| `src/types/notification.ts` | 通知相关 TypeScript 类型定义 |
| `src/lib/validators/notification.ts` | Zod 验证：标记已读、通知列表查询参数 |
| `src/lib/services/notification.service.ts` | 通知核心服务：创建、查询、标记已读、懒加载检查到期/逾期 |
| `src/lib/services/notification.service.test.ts` | 通知服务的单元测试 |
| `src/app/api/notifications/route.ts` | GET 通知列表（触发懒加载） |
| `src/app/api/notifications/read/route.ts` | PATCH 批量标记已读 |
| `src/app/api/notifications/read-all/route.ts` | PATCH 一键全部已读 |
| `src/app/api/notifications/unread-count/route.ts` | GET 未读数量 |
| `src/app/api/collections/[id]/remind/route.ts` | POST 催办 |
| `src/components/collections/collection-remind-button.tsx` | 催办按钮客户端组件 |
| `src/components/layout/notification-bell.tsx` | 铃铛图标 + 未读数徽章 + 弹窗列表（有意合并为单文件，弹窗逻辑紧密耦合铃铛状态） |

### 修改文件

| 文件 | 改动 |
|------|------|
| `prisma/schema.prisma` | 添加 Notification 模型、NotificationType 枚举、User 反向关联 |
| `src/lib/services/document-collection-task.service.ts` | createDocumentCollectionTask 末尾生成 TASK_ASSIGNED 通知 |
| `src/components/layout/header.tsx` | 引入 NotificationBell 组件 |
| `src/app/(dashboard)/collections/[id]/page.tsx` | 在创建者操作栏添加 CollectionRemindButton |

---

### Task 1: Prisma Schema — 添加 Notification 模型

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: 在 schema.prisma 末尾添加 NotificationType 枚举和 Notification 模型**

在文件末尾追加：

```prisma
enum NotificationType {
  TASK_ASSIGNED
  DUE_TODAY
  OVERDUE
  MANUAL_REMIND
}

model Notification {
  id          String   @id @default(cuid())
  type        NotificationType
  title       String
  content     String
  taskId      String?
  task        DocumentCollectionTask? @relation(fields: [taskId], references: [id], onDelete: Cascade)
  recipientId String
  recipient   User                    @relation("UserNotifications", fields: [recipientId], references: [id], onDelete: Cascade)
  isRead      Boolean  @default(false)
  createdAt   DateTime @default(now())

  @@index([recipientId, isRead, createdAt])
  @@map("notifications")
}
```

- [ ] **Step 2: 在 User 模型中添加反向关联**

在 User 模型的 `collectionSubmissionVersions` 行后追加：

```prisma
  notifications                 Notification[]                       @relation("UserNotifications")
```

- [ ] **Step 3: 在 DocumentCollectionTask 模型中添加反向关联**

在 DocumentCollectionTask 模型的 `assignees` 行后追加：

```prisma
  notifications Notification[]
```

- [ ] **Step 4: 推送 schema 到数据库**

Run: `npx prisma db push`

- [ ] **Step 5: 重新生成 Prisma 客户端**

Run: `npx prisma generate`

- [ ] **Step 6: 提交**

```bash
git add prisma/schema.prisma
git commit -m "feat(notifications): add Notification model and NotificationType enum to Prisma schema"
```

---

### Task 2: TypeScript 类型定义

**Files:**
- Create: `src/types/notification.ts`

- [ ] **Step 1: 创建通知类型文件**

```typescript
export type NotificationType = "TASK_ASSIGNED" | "DUE_TODAY" | "OVERDUE" | "MANUAL_REMIND";

export type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  content: string;
  taskId: string | null;
  isRead: boolean;
  createdAt: Date;
};
```

- [ ] **Step 2: 提交**

```bash
git add src/types/notification.ts
git commit -m "feat(notifications): add TypeScript type definitions for notifications"
```

---

### Task 3: Zod 验证器

**Files:**
- Create: `src/lib/validators/notification.ts`

- [ ] **Step 1: 创建通知验证器**

```typescript
import { z } from "zod";

export const markReadSchema = z.object({
  notificationIds: z.array(z.string().min(1)).min(1, "请选择要标记已读的通知"),
});

export const notificationListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export type MarkReadInput = z.infer<typeof markReadSchema>;
export type NotificationListQueryInput = z.infer<typeof notificationListQuerySchema>;
```

- [ ] **Step 2: 提交**

```bash
git add src/lib/validators/notification.ts
git commit -m "feat(notifications): add Zod validators for notification API input"
```

---

### Task 4: 通知核心服务 — 编写测试

**Files:**
- Create: `src/lib/services/notification.service.test.ts`

- [ ] **Step 1: 编写测试文件**

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = {
  notification: {
    createMany: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    updateMany: vi.fn(),
    findFirst: vi.fn(),
  },
  documentCollectionTask: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
  documentCollectionAssignee: {
    findMany: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({ db: dbMock }));

describe("notification.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createNotifications", () => {
    it("批量创建通知", async () => {
      dbMock.notification.createMany.mockResolvedValue({ count: 2 });

      const { createNotifications } = await import("./notification.service");
      const result = await createNotifications([
        {
          type: "TASK_ASSIGNED",
          title: "新收集任务",
          content: "测试",
          taskId: "task-1",
          recipientId: "user-1",
        },
        {
          type: "TASK_ASSIGNED",
          title: "新收集任务",
          content: "测试",
          taskId: "task-1",
          recipientId: "user-2",
        },
      ]);

      expect(result.success).toBe(true);
      expect(dbMock.notification.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ recipientId: "user-1" }),
          expect.objectContaining({ recipientId: "user-2" }),
        ]),
      });
    });
  });

  describe("getUnreadCount", () => {
    it("返回用户未读通知数", async () => {
      dbMock.notification.count.mockResolvedValue(5);

      const { getUnreadCount } = await import("./notification.service");
      const result = await getUnreadCount({ recipientId: "user-1" });

      expect(result.success).toBe(true);
      expect(result.data).toBe(5);
      expect(dbMock.notification.count).toHaveBeenCalledWith({
        where: { recipientId: "user-1", isRead: false },
      });
    });
  });

  describe("markAsRead", () => {
    it("批量标记已读", async () => {
      dbMock.notification.updateMany.mockResolvedValue({ count: 3 });

      const { markAsRead } = await import("./notification.service");
      const result = await markAsRead({
        recipientId: "user-1",
        notificationIds: ["n-1", "n-2", "n-3"],
      });

      expect(result.success).toBe(true);
      expect(dbMock.notification.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ["n-1", "n-2", "n-3"] },
          recipientId: "user-1",
        },
        data: { isRead: true },
      });
    });
  });

  describe("markAllAsRead", () => {
    it("全部标记已读", async () => {
      dbMock.notification.updateMany.mockResolvedValue({ count: 10 });

      const { markAllAsRead } = await import("./notification.service");
      const result = await markAllAsRead({ recipientId: "user-1" });

      expect(result.success).toBe(true);
      expect(dbMock.notification.updateMany).toHaveBeenCalledWith({
        where: { recipientId: "user-1", isRead: false },
        data: { isRead: true },
      });
    });
  });

  describe("checkAndGenerateDueReminders", () => {
    it("为今天到期且未提交的任务生成 DUE_TODAY 通知", async () => {
      const today = new Date();
      today.setHours(23, 59, 59, 999);

      dbMock.documentCollectionAssignee.findMany.mockResolvedValue([
        {
          taskId: "task-1",
          task: { id: "task-1", title: "测试任务", dueAt: today, status: "ACTIVE" },
          userId: "user-1",
          submittedAt: null,
        },
      ]);
      dbMock.notification.findFirst.mockResolvedValue(null);
      dbMock.notification.createMany.mockResolvedValue({ count: 1 });

      const { checkAndGenerateDueReminders } = await import("./notification.service");
      const result = await checkAndGenerateDueReminders({ recipientId: "user-1" });

      expect(result.success).toBe(true);
      expect(dbMock.notification.createMany).toHaveBeenCalled();
      const createCall = dbMock.notification.createMany.mock.calls[0][0];
      expect(createCall.data[0].type).toBe("DUE_TODAY");
    });

    it("为已逾期且未提交的任务生成 OVERDUE 通知", async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      dbMock.documentCollectionAssignee.findMany.mockResolvedValue([
        {
          taskId: "task-2",
          task: { id: "task-2", title: "逾期任务", dueAt: yesterday, status: "ACTIVE" },
          userId: "user-1",
          submittedAt: null,
        },
      ]);
      dbMock.notification.findFirst.mockResolvedValue(null);
      dbMock.notification.createMany.mockResolvedValue({ count: 1 });

      const { checkAndGenerateDueReminders } = await import("./notification.service");
      const result = await checkAndGenerateDueReminders({ recipientId: "user-1" });

      expect(result.success).toBe(true);
      const createCall = dbMock.notification.createMany.mock.calls[0][0];
      expect(createCall.data[0].type).toBe("OVERDUE");
    });

    it("不重复生成已存在的通知（同一天去重）", async () => {
      const today = new Date();
      today.setHours(23, 59, 59, 999);

      dbMock.documentCollectionAssignee.findMany.mockResolvedValue([
        {
          taskId: "task-1",
          task: { id: "task-1", title: "测试任务", dueAt: today, status: "ACTIVE" },
          userId: "user-1",
          submittedAt: null,
        },
      ]);
      dbMock.notification.findFirst.mockResolvedValue({ id: "existing" });

      const { checkAndGenerateDueReminders } = await import("./notification.service");
      const result = await checkAndGenerateDueReminders({ recipientId: "user-1" });

      expect(result.success).toBe(true);
      expect(dbMock.notification.createMany).not.toHaveBeenCalled();
    });

    it("跳过已关闭的任务", async () => {
      dbMock.documentCollectionAssignee.findMany.mockResolvedValue([]);

      const { checkAndGenerateDueReminders } = await import("./notification.service");
      const result = await checkAndGenerateDueReminders({ recipientId: "user-1" });

      expect(result.success).toBe(true);
      expect(dbMock.notification.createMany).not.toHaveBeenCalled();
    });

    it("跳过已提交的参与人", async () => {
      dbMock.documentCollectionAssignee.findMany.mockResolvedValue([]);

      const { checkAndGenerateDueReminders } = await import("./notification.service");
      const result = await checkAndGenerateDueReminders({ recipientId: "user-1" });

      expect(result.success).toBe(true);
      expect(dbMock.notification.createMany).not.toHaveBeenCalled();
    });
  });

  describe("sendManualRemind", () => {
    it("为未提交参与人生成催办通知", async () => {
      dbMock.documentCollectionTask.findFirst.mockResolvedValue({
        id: "task-1",
        title: "测试任务",
        createdById: "creator-1",
        status: "ACTIVE",
        assignees: [
          { userId: "user-1", submittedAt: null, user: { name: "张三" } },
          { userId: "user-2", submittedAt: new Date(), user: { name: "李四" } },
        ],
      });
      dbMock.notification.createMany.mockResolvedValue({ count: 1 });

      const { sendManualRemind } = await import("./notification.service");
      const result = await sendManualRemind({
        taskId: "task-1",
        senderId: "creator-1",
        senderName: "管理员",
      });

      expect(result.success).toBe(true);
      const createCall = dbMock.notification.createMany.mock.calls[0][0];
      expect(createCall.data).toHaveLength(1);
      expect(createCall.data[0].recipientId).toBe("user-1");
      expect(createCall.data[0].type).toBe("MANUAL_REMIND");
    });

    it("非创建者不能催办", async () => {
      dbMock.documentCollectionTask.findFirst.mockResolvedValue({
        id: "task-1",
        createdById: "creator-1",
      });

      const { sendManualRemind } = await import("./notification.service");
      const result = await sendManualRemind({
        taskId: "task-1",
        senderId: "other-user",
        senderName: "其他人",
      });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe("NOT_FOUND");
    });

    it("已关闭的任务不能催办", async () => {
      dbMock.documentCollectionTask.findFirst.mockResolvedValue({
        id: "task-1",
        title: "已关闭",
        createdById: "creator-1",
        status: "CLOSED",
        assignees: [],
      });

      const { sendManualRemind } = await import("./notification.service");
      const result = await sendManualRemind({
        taskId: "task-1",
        senderId: "creator-1",
        senderName: "管理员",
      });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe("TASK_CLOSED");
    });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/lib/services/notification.service.test.ts`

Expected: FAIL — module not found

- [ ] **Step 3: 提交测试**

```bash
git add src/lib/services/notification.service.test.ts
git commit -m "test(notifications): add unit tests for notification service"
```

---

### Task 5: 通知核心服务 — 实现

**Files:**
- Create: `src/lib/services/notification.service.ts`

- [ ] **Step 1: 实现通知服务**

```typescript
import { db } from "@/lib/db";
import type { ServiceResult } from "@/types/data-table";
import type { NotificationItem, NotificationType } from "@/types/notification";

type NotificationInput = {
  type: NotificationType;
  title: string;
  content: string;
  taskId?: string;
  recipientId: string;
};

export async function createNotifications(
  inputs: NotificationInput[]
): Promise<ServiceResult<{ count: number }>> {
  if (inputs.length === 0) {
    return { success: true, data: { count: 0 } };
  }

  try {
    const result = await db.notification.createMany({
      data: inputs.map((input) => ({
        type: input.type,
        title: input.title,
        content: input.content,
        taskId: input.taskId ?? null,
        recipientId: input.recipientId,
      })),
    });

    return { success: true, data: { count: result.count } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建通知失败";
    return { success: false, error: { code: "CREATE_FAILED", message } };
  }
}

export async function getNotifications(input: {
  recipientId: string;
  page: number;
  pageSize: number;
}): Promise<ServiceResult<{ items: NotificationItem[]; total: number }>> {
  try {
    const where = { recipientId: input.recipientId };

    const [items, total] = await Promise.all([
      db.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      db.notification.count({ where }),
    ]);

    return {
      success: true,
      data: {
        items: items.map((item) => ({
          id: item.id,
          type: item.type as NotificationType,
          title: item.title,
          content: item.content,
          taskId: item.taskId,
          isRead: item.isRead,
          createdAt: item.createdAt,
        })),
        total,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取通知失败";
    return { success: false, error: { code: "GET_FAILED", message } };
  }
}

export async function getUnreadCount(input: {
  recipientId: string;
}): Promise<ServiceResult<number>> {
  try {
    const count = await db.notification.count({
      where: { recipientId: input.recipientId, isRead: false },
    });

    return { success: true, data: count };
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取未读数失败";
    return { success: false, error: { code: "GET_FAILED", message } };
  }
}

export async function markAsRead(input: {
  recipientId: string;
  notificationIds: string[];
}): Promise<ServiceResult<{ count: number }>> {
  try {
    const result = await db.notification.updateMany({
      where: {
        id: { in: input.notificationIds },
        recipientId: input.recipientId,
      },
      data: { isRead: true },
    });

    return { success: true, data: { count: result.count } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "标记已读失败";
    return { success: false, error: { code: "UPDATE_FAILED", message } };
  }
}

export async function markAllAsRead(input: {
  recipientId: string;
}): Promise<ServiceResult<{ count: number }>> {
  try {
    const result = await db.notification.updateMany({
      where: { recipientId: input.recipientId, isRead: false },
      data: { isRead: true },
    });

    return { success: true, data: { count: result.count } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "标记全部已读失败";
    return { success: false, error: { code: "UPDATE_FAILED", message } };
  }
}

/**
 * 懒加载检查：为当前用户的到期/逾期且未提交的任务生成通知。
 * 去重：同一天同一任务同一类型不重复生成。
 */
export async function checkAndGenerateDueReminders(input: {
  recipientId: string;
  now?: Date;
}): Promise<ServiceResult<{ count: number }>> {
  try {
    const now = input.now ?? new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    // 查询当前用户所有未提交的分配（ACTIVE 任务，仅限已到期或今天到期的）
    const assignments = await db.documentCollectionAssignee.findMany({
      where: {
        userId: input.recipientId,
        submittedAt: null,
        task: { status: "ACTIVE", dueAt: { lte: todayEnd } },
      },
      include: {
        task: { select: { id: true, title: true, dueAt: true, status: true } },
      },
    });

    const notificationsToCreate: Array<{
      type: NotificationType;
      title: string;
      content: string;
      taskId: string;
      recipientId: string;
    }> = [];

    for (const assignment of assignments) {
      const task = assignment.task;
      const dueAt = task.dueAt;

      const isOverdue = dueAt < todayStart;
      const isDueToday = dueAt >= todayStart && dueAt <= todayEnd;

      if (!isOverdue && !isDueToday) continue;

      const type: NotificationType = isOverdue ? "OVERDUE" : "DUE_TODAY";

      // 去重：检查今天是否已生成过同类型通知
      const existing = await db.notification.findFirst({
        where: {
          recipientId: input.recipientId,
          taskId: task.id,
          type,
          createdAt: { gte: todayStart, lte: todayEnd },
        },
      });

      if (existing) continue;

      notificationsToCreate.push({
        type,
        title: isOverdue ? "任务已到期" : "任务今天到期",
        content: `「${task.title}」已${isOverdue ? "过期" : "到期"}，请尽快提交`,
        taskId: task.id,
        recipientId: input.recipientId,
      });
    }

    if (notificationsToCreate.length === 0) {
      return { success: true, data: { count: 0 } };
    }

    const result = await db.notification.createMany({
      data: notificationsToCreate,
    });

    return { success: true, data: { count: result.count } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "检查到期提醒失败";
    return { success: false, error: { code: "REMINDER_FAILED", message } };
  }
}

export async function sendManualRemind(input: {
  taskId: string;
  senderId: string;
  senderName: string;
}): Promise<ServiceResult<{ count: number }>> {
  try {
    const task = await db.documentCollectionTask.findFirst({
      where: { id: input.taskId },
      include: {
        assignees: {
          where: { submittedAt: null },
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    if (!task || task.createdById !== input.senderId) {
      return { success: false, error: { code: "NOT_FOUND", message: "任务不存在" } };
    }

    if (task.status === "CLOSED") {
      return { success: false, error: { code: "TASK_CLOSED", message: "任务已关闭，无法催办" } };
    }

    const notifications = task.assignees.map((assignee) => ({
      type: "MANUAL_REMIND" as NotificationType,
      title: "催办提醒",
      content: `${input.senderName} 催促你尽快提交「${task.title}」`,
      taskId: task.id,
      recipientId: assignee.userId,
    }));

    if (notifications.length === 0) {
      return { success: true, data: { count: 0 } };
    }

    const result = await db.notification.createMany({ data: notifications });

    return { success: true, data: { count: result.count } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "催办失败";
    return { success: false, error: { code: "REMIND_FAILED", message } };
  }
}
```

- [ ] **Step 2: 运行测试确认通过**

Run: `npx vitest run src/lib/services/notification.service.test.ts`

Expected: ALL PASS

- [ ] **Step 3: 提交**

```bash
git add src/lib/services/notification.service.ts
git commit -m "feat(notifications): implement notification service with lazy-load due reminders and manual remind"
```

---

### Task 6: 通知 API 路由

**Files:**
- Create: `src/app/api/notifications/route.ts`
- Create: `src/app/api/notifications/read/route.ts`
- Create: `src/app/api/notifications/read-all/route.ts`
- Create: `src/app/api/notifications/unread-count/route.ts`

- [ ] **Step 1: 创建 GET /api/notifications 路由**

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  checkAndGenerateDueReminders,
  getNotifications,
} from "@/lib/services/notification.service";
import { notificationListQuerySchema } from "@/validators/notification";

function errorResponse(message: string, status: number, code?: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return errorResponse("未授权", 401, "UNAUTHORIZED");
  }

  try {
    const url = new URL(request.url);
    const query = notificationListQuerySchema.parse({
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
    });

    // 懒加载：检查到期/逾期提醒
    await checkAndGenerateDueReminders({ recipientId: session.user.id });

    const result = await getNotifications({
      recipientId: session.user.id,
      page: query.page,
      pageSize: query.pageSize,
    });

    if (!result.success) {
      return errorResponse(result.error.message, 500, result.error.code);
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      return errorResponse("参数校验失败", 400, "VALIDATION_ERROR");
    }
    return errorResponse("获取通知失败", 500, "INTERNAL_ERROR");
  }
}
```

- [ ] **Step 2: 创建 PATCH /api/notifications/read 路由**

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { markAsRead } from "@/lib/services/notification.service";
import { markReadSchema } from "@/validators/notification";

function errorResponse(message: string, status: number, code?: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return errorResponse("未授权", 401, "UNAUTHORIZED");
  }

  try {
    const body = await request.json();
    const parsed = markReadSchema.parse(body);

    const result = await markAsRead({
      recipientId: session.user.id,
      notificationIds: parsed.notificationIds,
    });

    if (!result.success) {
      return errorResponse(result.error.message, 500, result.error.code);
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      return errorResponse("参数校验失败", 400, "VALIDATION_ERROR");
    }
    return errorResponse("标记已读失败", 500, "INTERNAL_ERROR");
  }
}
```

- [ ] **Step 3: 创建 PATCH /api/notifications/read-all 路由**

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { markAllAsRead } from "@/lib/services/notification.service";

function errorResponse(message: string, status: number, code?: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function PATCH() {
  const session = await auth();
  if (!session?.user) {
    return errorResponse("未授权", 401, "UNAUTHORIZED");
  }

  try {
    const result = await markAllAsRead({ recipientId: session.user.id });

    if (!result.success) {
      return errorResponse(result.error.message, 500, result.error.code);
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch {
    return errorResponse("标记全部已读失败", 500, "INTERNAL_ERROR");
  }
}
```

- [ ] **Step 4: 创建 GET /api/notifications/unread-count 路由**

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUnreadCount } from "@/lib/services/notification.service";

function errorResponse(message: string, status: number, code?: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return errorResponse("未授权", 401, "UNAUTHORIZED");
  }

  try {
    const result = await getUnreadCount({ recipientId: session.user.id });

    if (!result.success) {
      return errorResponse(result.error.message, 500, result.error.code);
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch {
    return errorResponse("获取未读数失败", 500, "INTERNAL_ERROR");
  }
}
```

- [ ] **Step 5: 提交**

```bash
git add src/app/api/notifications/
git commit -m "feat(notifications): add notification API routes (list, read, read-all, unread-count)"
```

---

### Task 7: 催办 API 路由

**Files:**
- Create: `src/app/api/collections/[id]/remind/route.ts`

- [ ] **Step 1: 创建 POST /api/collections/[id]/remind 路由**

注意 Next.js 16 中 params 是 Promise，需要 await。

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sendManualRemind } from "@/lib/services/notification.service";

type RouteParams = {
  params: Promise<{ id: string }>;
};

function errorResponse(message: string, status: number, code?: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(_request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return errorResponse("未授权", 401, "UNAUTHORIZED");
  }

  try {
    const { id } = await params;

    const result = await sendManualRemind({
      taskId: id,
      senderId: session.user.id,
      senderName: session.user.name ?? "未知用户",
    });

    if (!result.success) {
      const status = result.error.code === "NOT_FOUND" ? 404
        : result.error.code === "TASK_CLOSED" ? 400
        : 500;
      return errorResponse(result.error.message, status, result.error.code);
    }

    return NextResponse.json({
      success: true,
      data: { remindedCount: result.data.count },
    });
  } catch {
    return errorResponse("催办失败", 500, "INTERNAL_ERROR");
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add src/app/api/collections/
git commit -m "feat(notifications): add POST /api/collections/[id]/remind route for manual remind"
```

---

### Task 8: 创建任务时生成 TASK_ASSIGNED 通知

**Files:**
- Modify: `src/lib/services/document-collection-task.service.ts` (在 createDocumentCollectionTask 函数中)

- [ ] **Step 1: 添加通知导入**

在文件顶部 import 区域追加：

```typescript
import { createNotifications } from "@/lib/services/notification.service";
```

- [ ] **Step 2: 在 createDocumentCollectionTask 返回成功之前添加通知生成逻辑**

在 `createDocumentCollectionTask` 函数中，紧接 `const now = new Date();` 之后、`return { success: true, ... }` 之前，添加：

```typescript
    // 生成任务分配通知
    // 注意：此调用在 Prisma 事务外。通知创建失败不应阻断任务创建，
    // 用户始终可以通过手动刷新获取通知。这是有意为之的权衡。
    await createNotifications(
      input.assigneeIds.map((userId) => ({
        type: "TASK_ASSIGNED",
        title: "新收集任务",
        content: `${task.createdBy?.name ?? "未知用户"} 发起了收集任务「${task.title}」，请在 ${task.dueAt.toLocaleDateString("zh-CN")} 前提交`,
        taskId: task.id,
        recipientId: userId,
      }))
    );
```

- [ ] **Step 3: 提交**

```bash
git add src/lib/services/document-collection-task.service.ts
git commit -m "feat(notifications): generate TASK_ASSIGNED notifications when creating collection task"
```

---

### Task 9: 铃铛通知组件

**Files:**
- Create: `src/components/layout/notification-bell.tsx`
- Modify: `src/components/layout/header.tsx`

- [ ] **Step 1: 创建铃铛 + 弹窗组件**

这个客户端组件包含铃铛图标、未读数徽章、弹窗列表。

```typescript
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import type { NotificationItem, NotificationType } from "@/types/notification";

const TYPE_LABELS: Record<NotificationType, string> = {
  TASK_ASSIGNED: "任务分配",
  DUE_TODAY: "今天到期",
  OVERDUE: "已到期",
  MANUAL_REMIND: "催办提醒",
};

const TYPE_COLORS: Record<NotificationType, string> = {
  TASK_ASSIGNED: "bg-blue-500",
  DUE_TODAY: "bg-amber-500",
  OVERDUE: "bg-red-500",
  MANUAL_REMIND: "bg-amber-500",
};

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} 小时前`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay} 天前`;
  return new Date(date).toLocaleDateString("zh-CN");
}

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/unread-count");
      if (res.ok) {
        const data = await res.json();
        if (data.success) setUnreadCount(data.data);
      }
    } catch {
      // 静默失败
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?pageSize=20");
      if (res.ok) {
        const data = await res.json();
        if (data.success) setNotifications(data.data.items);
      }
    } catch {
      // 静默失败
    } finally {
      setLoading(false);
    }
  }, []);

  // 轮询未读数
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // 路由变化时刷新
  useEffect(() => {
    fetchUnreadCount();
  }, [pathname, fetchUnreadCount]);

  // 点击外部关闭
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const togglePopup = async () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (nextOpen) {
      await fetchNotifications();
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch("/api/notifications/read-all", { method: "PATCH" });
      if (res.ok) {
        setUnreadCount(0);
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      }
    } catch {
      // 静默失败
    }
  };

  const handleClickNotification = async (notification: NotificationItem) => {
    if (!notification.isRead) {
      try {
        await fetch("/api/notifications/read", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationIds: [notification.id] }),
        });
        setUnreadCount((prev) => Math.max(0, prev - 1));
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
        );
      } catch {
        // 静默失败
      }
    }
    if (notification.taskId) {
      setIsOpen(false);
      router.push(`/collections/${notification.taskId}`);
    }
  };

  return (
    <div className="relative" ref={popupRef}>
      <button
        onClick={togglePopup}
        className="relative inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border bg-background shadow-lg z-50">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <span className="text-sm font-semibold">通知</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-primary hover:underline"
              >
                全部已读
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                加载中...
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                暂无通知
              </div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleClickNotification(notification)}
                  className={`w-full text-left px-4 py-3 border-b last:border-b-0 hover:bg-accent/50 transition-colors ${
                    !notification.isRead ? "bg-blue-50 dark:bg-blue-950/20" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium text-white ${TYPE_COLORS[notification.type]}`}
                    >
                      {TYPE_LABELS[notification.type]}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatRelativeTime(notification.createdAt)}
                    </span>
                  </div>
                  <div
                    className={`text-xs font-medium ${
                      notification.isRead ? "text-muted-foreground" : "text-foreground"
                    }`}
                  >
                    {notification.title}
                  </div>
                  <div
                    className={`text-xs mt-0.5 ${
                      notification.isRead ? "text-muted-foreground/70" : "text-muted-foreground"
                    }`}
                  >
                    {notification.content}
                  </div>
                </button>
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <div className="border-t px-4 py-2 text-center">
              <button
                onClick={() => { setIsOpen(false); }}
                className="text-xs text-primary hover:underline"
              >
                查看全部通知
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 修改 Header 组件引入铃铛**

在 `src/components/layout/header.tsx` 中：

添加导入：
```typescript
import { NotificationBell } from "@/components/layout/notification-bell";
```

在 `<div className="flex flex-1 ...">` 的结束标签后、`</header>` 之前添加：
```tsx
      <NotificationBell />
```

- [ ] **Step 3: 提交**

```bash
git add src/components/layout/notification-bell.tsx src/components/layout/header.tsx
git commit -m "feat(notifications): add NotificationBell component with popup and integrate into Header"
```

---

### Task 10: 催办按钮组件

**Files:**
- Create: `src/components/collections/collection-remind-button.tsx`
- Modify: `src/app/(dashboard)/collections/[id]/page.tsx`

- [ ] **Step 1: 创建催办按钮客户端组件**

```typescript
"use client";

import { useState } from "react";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function CollectionRemindButton({ taskId }: { taskId: string }) {
  const [loading, setLoading] = useState(false);

  const handleRemind = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/collections/${taskId}/remind`, { method: "POST" });
      const data = await res.json();

      if (data.success) {
        if (data.data.remindedCount === 0) {
          toast.info("所有参与人已提交，无需催办");
        } else {
          toast.success(`已催办 ${data.data.remindedCount} 位未提交人`);
        }
      } else {
        toast.error(data.error?.message ?? "催办失败");
      }
    } catch {
      toast.error("催办失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleRemind} disabled={loading} variant="default" size="sm">
      <BellRing className="h-4 w-4" />
      {loading ? "催办中..." : "催办未提交人"}
    </Button>
  );
}
```

- [ ] **Step 2: 在任务详情页添加催办按钮**

修改 `src/app/(dashboard)/collections/[id]/page.tsx`：

添加导入：
```typescript
import { CollectionRemindButton } from "@/components/collections/collection-remind-button";
```

在创建者操作栏中（`{task.status === "ACTIVE" ? <CollectionCloseTaskButton .../> : null}` 之后），添加：

```tsx
{task.status === "ACTIVE" ? <CollectionRemindButton taskId={task.id} /> : null}
```

- [ ] **Step 3: 提交**

```bash
git add src/components/collections/collection-remind-button.tsx src/app/\(dashboard\)/collections/\[id\]/page.tsx
git commit -m "feat(notifications): add CollectionRemindButton component and integrate into task detail page"
```

---

### Task 11: 类型检查和 lint 验证

- [ ] **Step 1: 运行类型检查**

Run: `npx tsc --noEmit`

Expected: 无错误

- [ ] **Step 2: 运行 lint**

Run: `npm run lint`

Expected: 无错误

- [ ] **Step 3: 运行全部测试**

Run: `npx vitest run`

Expected: ALL PASS

- [ ] **Step 4: 如有错误，修复并提交**

---

### Task 12: 手动验证

- [ ] **Step 1: 启动开发服务器**

Run: `npm run dev`

- [ ] **Step 2: 验证铃铛显示**

以任意用户登录，确认头部右侧出现铃铛图标

- [ ] **Step 3: 验证任务分配通知**

以 admin 创建一个收集任务，分配给 user，切换到 user 账号，确认铃铛显示未读数，点击铃铛看到通知

- [ ] **Step 4: 验证催办功能**

以 admin 在任务详情页点击「催办未提交人」，切换到 user 账号确认收到催办通知

- [ ] **Step 5: 验证到期提醒**

创建一个截止时间为今天的任务，切换到被分配用户，点击铃铛查看通知，确认有「今天到期」类型通知
