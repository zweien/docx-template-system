# AI Agent 2 设计规范

**项目**: docx-template-system
**日期**: 2026-04-01
**状态**: 设计阶段

---

## 1. 概述

### 1.1 目标

新建独立的 AI 聊天页面 `/ai-agent2`，使用 Vercel AI Elements 组件库构建，提供完整的对话管理、附件上传、推理过程展示、工具调用确认等功能。

### 1.2 与现有 ai-agent 的关系

- **完全独立**：新建独立 API (`/api/ai2/*`) 和独立数据库表
- **数据隔离**：不共享对话、消息、附件数据
- **未来替代**：设计时考虑作为现有 ai-agent 的替代方案

### 1.3 核心功能

- 完整会话管理（新建、切换、删除、收藏）
- 附件上传与展示
- Reasoning 推理过程展示
- 工具调用展示与状态流转
- 用户确认流程（可配置免确认）
- 设置面板

---

## 2. 页面结构

### 2.1 路由

| 路径 | 说明 |
|------|------|
| `/ai-agent2` | 主页面 |
| `/ai-agent2?tableId=xxx` | 带表上下文的入口 |

### 2.2 布局

```
┌─────────────────────────────────────────────────────────┐
│  侧边栏 (280px)  │         主内容区                      │
│  ┌─────────────┐ │  ┌─────────────────────────────────┐  │
│  │ + 新对话    │ │  │  AI 助手 (v2)              [≡]  │  │
│  ├─────────────┤ │  │  当前表: xxx                   │  │
│  │ ⭐ 收藏 (2) │ │  ├─────────────────────────────────┤  │
│  │ ├─ 对话1   │ │  │                                 │  │
│  │ └─ 对话2   │ │  │  ┌─ Message ──────────────────┐  │  │
│  ├─────────────┤ │  │  │ 用户消息                   │  │  │
│  │ 今天        │ │  │  └───────────────────────────┘  │  │
│  │ ├─ 对话3   │ │  │                                 │  │
│  │ └─ 对话4   │ │  │  ┌─ Reasoning ────────────────┐  │  │
│  ├─────────────┤ │  │  │ <think>                 │  │  │
│  │ 更早        │ │  │  │ 思考过程展示               │  │  │
│  │ └─ 对话5   │ │  │  │ [/展开] [/收起]            │  │  │
│  ├─────────────┤ │  │  └───────────────────────────┘  │  │
│  │ ⚙️ 设置    │ │  │                                 │  │
│  └─────────────┘ │  │  ┌─ Message ──────────────────┐  │  │
│                  │  │  │ AI 回复 + Markdown         │  │  │
│                  │  │  └───────────────────────────┘  │  │
│                  │  │                                 │  │
│                  │  │  ┌─ Tool ─────────────────────┐  │  │
│                  │  │  │ ▼ searchRecords  [运行中]  │  │  │
│                  │  │  │   输入: {...}              │  │  │
│                  │  │  │   输出: {...}              │  │  │
│                  │  │  └───────────────────────────┘  │  │
│                  │  │                                 │  │
│                  │  │  ┌─ Confirmation ────────────┐  │  │
│                  │  │  │ ⚠️ 需要确认                │  │  │
│                  │  │  │ [取消]          [确认执行] │  │  │
│                  │  │  └───────────────────────────┘  │  │
│                  │  │                                 │  │
│                  │  ├─────────────────────────────────┤  │
│                  │  │ ┌─ PromptInput ──────────────┐  │  │
│                  │  │ │ [📎] │ 输入框...   │ [➤] │  │  │
│                  │  │ └─────────────────────────────┘  │  │
│                  │  └─────────────────────────────────┘  │
└──────────────────┴───────────────────────────────────────┘
```

---

## 3. 组件规范

### 3.1 使用的 AI Elements 组件

| 功能 | 组件 | 说明 |
|------|------|------|
| 对话容器 | `Conversation` | 自动滚动，滚动按钮 |
| 消息列表 | `ConversationContent` | 消息区域 |
| 空状态 | `ConversationEmptyState` | 无消息时显示 |
| 用户消息 | `Message from="user"` | 用户消息样式 |
| AI 消息 | `Message from="assistant"` | AI 消息样式 |
| 消息内容 | `MessageContent` | 消息外层容器 |
| 文本渲染 | `MessageResponse` | Markdown 渲染 |
| 消息操作 | `MessageActions`, `MessageAction` | 重试、复制等 |
| 思考过程 | `Reasoning`, `ReasoningTrigger`, `ReasoningContent` | 折叠式思维展示 |
| 工具调用 | `Tool`, `ToolHeader`, `ToolContent`, `ToolInput`, `ToolOutput` | 工具调用展示 |
| 确认弹窗 | `Confirmation`, `ConfirmationRequest`, `ConfirmationActions` | 用户确认 |
| 输入框 | `PromptInput` | 组合输入框 |
| 输入框头部 | `PromptInputHeader` | 附件预览区域 |
| 输入框主体 | `PromptInputBody` | Textarea |
| 输入框底部 | `PromptInputFooter` | 工具栏 |
| 工具栏 | `PromptInputTools` | 工具按钮组 |
| 附件按钮 | `PromptInputActionMenu`, `PromptInputActionAddAttachments` | 附件上传 |
| 提交按钮 | `PromptInputSubmit` | 发送按钮（自动状态） |
| 附件展示 | `Attachments`, `Attachment`, `AttachmentPreview`, `AttachmentRemove` | 附件显示 |

### 3.2 使用的 shadcn/ui 组件

| 功能 | 组件 | 说明 |
|------|------|------|
| 会话列表 | 自定义 + `ScrollArea` | 按日期分组 |
| 新建按钮 | `Button` | 触发新建 |
| 会话项 | `Button` (variant: ghost) | hover 显示操作 |
| 删除确认 | `AlertDialog` | 确认删除 |
| 设置弹窗 | `Dialog` | 设置面板 |
| 开关 | `Switch` | 设置项开关 |
| 复选框 | `Checkbox` | 工具类型选择 |
| 分隔符 | `Separator` | 设置分组 |
| 收藏图标 | `Star` | lucide-react |

---

## 4. API 设计

### 4.1 路由结构

```
/api/ai2/
├── /conversations
│   ├── GET    /conversations          # 获取对话列表
│   ├── POST   /conversations          # 创建对话
│   ├── PATCH  /conversations/[id]     # 更新对话 (标题、收藏)
│   └── DELETE /conversations/[id]     # 删除对话
│
├── /conversations/[id]
│   ├── GET    /conversations/[id]     # 获取对话详情
│   └── DELETE /conversations/[id]     # 删除对话
│
├── /conversations/[id]/messages
│   ├── GET    /conversations/[id]/messages  # 获取消息列表
│   └── POST   /conversations/[id]/messages  # 发送消息 (流式)
│
├── /attachments
│   ├── POST   /attachments            # 上传附件
│   └── DELETE /attachments/[id]       # 删除附件
│
└── /confirm
    └── POST   /confirm                # 确认执行工具
```

### 4.2 请求/响应格式

#### 获取对话列表

```typescript
// GET /api/ai2/conversations
interface Response {
  success: true;
  data: Array<{
    id: string;
    title: string;
    isFavorite: boolean;
    lastMessageAt: string; // ISO date
    messageCount: number;
  }>;
}
```

#### 发送消息 (流式)

```typescript
// POST /api/ai2/conversations/[id]/messages
interface Request {
  message: string;
  tableId?: string;
  attachmentIds?: string[];
}

// 响应: SSE 流
interface StreamEvent {
  type: 'message-created' | 'text-delta' | 'tool-call' |
        'tool-result' | 'confirm-required' | 'message-completed' | 'error';
  messageId: string;
  content?: string;
  toolName?: string;
  toolArgs?: object;
  result?: object;
  confirmToken?: string;
}
```

---

## 5. 数据库设计

### 5.1 新建表

```prisma
// AIConversation2 - 对话
model AIConversation2 {
  id            String    @id @default(cuid())
  title         String    @default("新对话")
  isFavorite    Boolean   @default(false)
  initialTableId String?
  userId        String
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  messages      AIMessage2[]
}

// AIMessage2 - 消息
model AIMessage2 {
  id            String    @id @default(cuid())
  conversationId String
  role          String    // 'USER' | 'ASSISTANT'
  content       String    @db.Text
  status        String    // 'pending' | 'streaming' | 'completed' | 'failed'
  errorMessage  String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  conversation  AIConversation2 @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  attachments   AIAttachment2[]
}

// AIAttachment2 - 附件
model AIAttachment2 {
  id            String    @id @default(cuid())
  messageId     String
  fileName      String
  mimeType      String?
  size          Int?
  extractStatus String    // 'pending' | 'processing' | 'completed' | 'failed'
  extractSummary String?  @db.Text
  extractError  String?
  createdAt     DateTime  @default(now())

  message       AIMessage2  @relation(fields: [messageId], references: [id], onDelete: Cascade)
}
```

---

## 6. 功能规范

### 6.1 会话管理

#### 会话列表展示

- 按分组显示：收藏、今天、更早
- 收藏会话始终置顶，显示收藏数量
- 更早包含昨天及之前的所有会话
- 点击会话切换当前对话

#### 收藏功能

- 点击会话右侧星标图标切换收藏状态
- 收藏会话显示 ⭐ 图标，未收藏显示 ☆
- 收藏后自动移至收藏分组顶部

#### 新建/删除会话

- 点击"新建对话"创建空对话
- 删除前显示确认对话框
- 删除后自动切换至第一个会话或显示空状态

### 6.2 消息展示

#### 用户消息

- 右侧对齐，背景色区分
- 显示附件缩略图（图片）或文件名（其他）
- 支持 Markdown 文本

#### AI 消息

- 左侧对齐
- Reasoning 部分：折叠显示，streaming 时自动展开
- 文本部分：Markdown 渲染
- 工具调用：展示在消息下方

### 6.3 工具调用

#### 状态流转

```
input-streaming → input-available → (需要确认?)
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
                   否                 是                 │
                    │                 │                 │
                    ▼                 ▼                 ▼
          output-available   confirm-required   (等待确认)
                              │
              ┌───────────────┴───────────────┐
              │                               │
            确认                             拒绝
              │                               │
              ▼                               ▼
        output-available              output-error
```

#### 工具类型

| 分类 | 工具 | 默认免确认 |
|------|------|-----------|
| 查询 | `searchRecords`, `aggregateRecords` | ✅ |
| 获取 | `getTableSchema`, `listTables`, `getCurrentTime` | ✅ |
| 创建 | `createRecord` | ❌ |
| 更新 | `updateRecord` | ❌ |
| 删除 | `deleteRecord` | ❌ |

### 6.4 确认流程

- 需要确认的工具：显示 Confirmation 组件
- 免确认工具：根据设置自动执行
- 确认后：携带 confirmToken 调用 `/api/ai2/confirm` 执行

### 6.5 设置面板

#### 入口

侧边栏底部 "设置" 按钮

#### 设置项

```
工具执行:
├─ 免确认工具类型
│  ├─ ☑ 查询类 (searchRecords, aggregateRecords)
│  ├─ ☑ 获取类 (getTableSchema, listTables, getCurrentTime)
│  ├─ ☐ 创建类 (createRecord)
│  ├─ ☐ 更新类 (updateRecord)
│  └─ ☐ 删除类 (deleteRecord)
│
对话:
├─ 显示推理过程 [开/关]
└─ 自动滚动到底部 [开/关]
```

#### 存储

用户设置存储在 `AIConversation2` 表或独立的用户设置表中

---

## 7. 实现顺序

1. **数据库层**: 创建 Prisma 模型
2. **API 层**: 实现 `/api/ai2/*` 路由
3. **组件层**: 安装 ai-elements 组件
4. **前端层**: 构建页面和交互
5. **集成测试**: 端到端功能测试

---

## 8. 验收标准

- [ ] 页面 `/ai-agent2` 正常加载
- [ ] 可以创建、切换、删除、收藏会话
- [ ] 消息可以正常发送和展示
- [ ] 附件可以上传和展示
- [ ] Reasoning 推理过程可以展示
- [ ] 工具调用状态正确展示
- [ ] 需要确认的工具弹窗确认
- [ ] 设置可以保存和生效
- [ ] 查询类工具默认不弹确认