# 文档收集任务 - 通知提醒系统设计

## 概述

为文档收集任务新增站内通知系统，支持三种通知场景：任务分配通知、到期提醒、手动催办。用户通过顶部头部的铃铛图标查看未读通知。

## 需求

- **通知渠道**：站内通知
- **通知场景**：
  - 任务分配：新任务发布时，参与人自动收到通知
  - 到期提醒：到期当天提醒，逾期后每天提醒（极简策略）
  - 手动催办：发起人点击催办按钮，通知未提交参与人
- **定时机制**：懒加载（用户访问时检查是否有新到期事件）
- **展示形式**：铃铛图标 + 弹窗列表，点击跳转到对应任务
- **不需要**：提交状态通知、邮件通知、实时推送

## 数据模型

新增 `Notification` 模型和 `NotificationType` 枚举：

```prisma
model Notification {
  id          String   @id @default(cuid())
  type        NotificationType
  title       String
  content     String
  taskId      String?
  task        DocumentCollectionTask? @relation(fields: [taskId], references: [id], onDelete: Cascade)
  recipientId String
  recipient   User                    @relation(fields: [recipientId], references: [id], onDelete: Cascade)
  isRead      Boolean  @default(false)
  createdAt   DateTime @default(now())

  @@index([recipientId, isRead, createdAt])
  @@map("notifications")
}

enum NotificationType {
  TASK_ASSIGNED    // 任务分配给你了
  DUE_TODAY        // 任务今天到期
  OVERDUE          // 任务已逾期
  MANUAL_REMIND    // 发起人催办
}
```

**设计决策：**
- `isRead` 布尔字段，简单标记已读/未读
- `taskId` 直接关联到收集任务，点击通知可跳转
- 索引覆盖 `[recipientId, isRead, createdAt]` 支持高效查询未读通知
- 不预留通用通知，YAGNI

## 通知生成逻辑

### 任务分配通知

在现有 `createCollectionTask` service 中追加逻辑：
- 为每个 assignee 生成一条 `TASK_ASSIGNED` 通知
- 标题：「新收集任务」
- 内容：「{发起人} 发起了收集任务「{任务标题}」，请在 {截止日期} 前提交」
- 在现有创建事务内一起写入，保证原子性

### 到期提醒（懒加载）

用户访问时，在获取通知的 API 中顺带检查：

1. 查询当前用户所有未提交的 assigned tasks（status=ACTIVE）
2. 过滤出今天到期或已逾期的任务
3. 按 `recipientId + taskId + type + 当天日期` 去重，不重复生成
4. 批量插入 `DUE_TODAY` / `OVERDUE` 通知
5. 返回所有未读通知（包含新生成的）

**去重策略**：查询 Notification 表中 `recipientId + taskId + type + createdAt(今天)` 是否已存在。

### 手动催办

- API：`POST /api/collections/[id]/remind`
- 权限：只有任务创建者可催办
- 为所有未提交的 assignee 生成 `MANUAL_REMIND` 通知
- 标题：「催办提醒」
- 内容：「{发起人} 催促你尽快提交「{任务标题}」」
- 无去重限制，每次催办都生成新通知

## API 设计

### 通知相关

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/notifications` | 获取通知列表（分页），同时触发懒加载检查到期/逾期 |
| PATCH | `/api/notifications/read` | 批量标记已读，body: `{ notificationIds: string[] }` |
| PATCH | `/api/notifications/read-all` | 一键全部已读 |
| GET | `/api/notifications/unread-count` | 获取未读数量 |

### 催办

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/collections/[id]/remind` | 发起人催办，为未提交参与人生成通知 |

### 现有 API 改动

- `POST /api/collections`：在创建事务内为 assignees 生成 `TASK_ASSIGNED` 通知

## UI 设计

### 铃铛位置

铃铛图标放在顶部头部（Header）右侧，页面标题旁边。

### 通知弹窗

点击铃铛展开弹窗：
- 顶部：标题「通知」+ 「全部已读」链接
- 中间：通知列表，按时间倒序
  - 未读项蓝色背景高亮
  - 已读项灰显
  - 每条通知包含类型标签、时间、标题、内容摘要
  - 点击通知跳转到对应任务页并标记已读
- 底部：「查看全部通知」链接

类型标签颜色：
- 任务分配：蓝色（#3b82f6）
- 催办提醒：橙色（#f59e0b）
- 已到期/逾期：红色（#ef4444）

### 催办按钮

在任务详情页发起人视图的操作栏中，添加蓝色「催办未提交人」按钮。任务已关闭时隐藏该按钮。

## 服务层

### 新增文件

| 文件 | 说明 |
|------|------|
| `src/lib/services/notification.service.ts` | 通知核心服务：创建通知、查询未读、标记已读、懒加载检查 |
| `src/lib/validators/notification.ts` | Zod 验证：批量标记已读的 ID 数组 |
| `src/app/api/notifications/route.ts` | GET 通知列表（触发懒加载） |
| `src/app/api/notifications/read/route.ts` | PATCH 批量标记已读 |
| `src/app/api/notifications/read-all/route.ts` | PATCH 一键全部已读 |
| `src/app/api/notifications/unread-count/route.ts` | GET 未读数 |
| `src/app/api/collections/[id]/remind/route.ts` | POST 催办 |
| `src/components/layout/notification-bell.tsx` | 铃铛组件（客户端组件） |
| `src/components/layout/notification-popup.tsx` | 通知弹窗列表组件 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `src/lib/services/document-collection-task.service.ts` | 创建任务时生成 TASK_ASSIGNED 通知 |
| `src/components/layout/header.tsx` | 引入 NotificationBell 组件 |

### 铃铛轮询策略

- `useEffect` + `setInterval` 每 30 秒请求 `/api/notifications/unread-count`
- 路由变化时也触发一次检查
- 弹窗打开时请求完整列表（触发懒加载）

## 边界情况

| 场景 | 处理方式 |
|------|---------|
| 任务已关闭 | 不再生成到期/逾期通知，催办按钮隐藏 |
| 参与人已提交 | 催办时跳过已提交的参与人 |
| 同一天重复检查 | 按 recipientId + taskId + type + 当天日期去重 |
| 任务无截止日期 | 不生成到期/逾期通知 |
| 大量未读通知 | 分页加载，默认每页 20 条 |

## 非目标（MVP 不做）

- 邮件通知
- WebSocket/SSE 实时推送
- 通知偏好设置（用户自行配置提醒频率）
- 通知关联到模板或其他模块
- 通知删除功能
