# AI Agent 2 设计文档

**日期**: 2026-04-01
**状态**: 已确认
**路径**: `/ai-agent2`

## 概述

基于 Vercel AI Elements 组件库构建的系统集成 AI 助手，能够操作本系统的数据表、模板和记录。采用方案 A（AI Elements 全套集成），最大程度使用 AI Elements 组件，仅在工具确认等未覆盖区域自定义扩展。

## 1. 页面布局

**左栏会话列表 + 右栏聊天区域**的经典双栏布局，侧边栏支持折叠。

```
┌──────────────────────────────────────────┐
│ Sidebar (可折叠)  │     Chat Area         │
│ ┌───────────────┐ │ ┌──────────────────┐  │
│ │ + 新建对话     │ │ │ 会话标题 + 操作  │  │
│ ├───────────────┤ │ ├──────────────────┤  │
│ │ 今天          │ │ │                  │  │
│ │ ● 数据表查询  │ │ │  Conversation    │  │
│ │   生成报告    │ │ │  (消息列表)      │  │
│ │ 昨天          │ │ │                  │  │
│ │   模板说明    │ │ │                  │  │
│ │   批量导入    │ │ ├──────────────────┤  │
│ ├───────────────┤ │ │ PromptInput      │  │
│ │ ⚙ 自动确认   │ │ │ (输入+附件+模型) │  │
│ └───────────────┘ │ └──────────────────┘  │
└──────────────────────────────────────────┘
```

侧边栏功能：新建对话、会话列表（按日期分组）、会话右键菜单（重命名/删除）、底部自动确认开关、可折叠。

## 2. 数据模型

新增 3 张数据库表。

### Agent2Conversation

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String @id @default(cuid()) | 主键 |
| title | String @default("新对话") | 会话标题 |
| userId | String | 用户 ID |
| model | String @default("gpt-4o") | 上次使用的模型 |
| createdAt | DateTime @default(now()) | 创建时间 |
| updatedAt | DateTime @updatedAt | 更新时间 |

关联：`user User`、`messages Agent2Message[]`

### Agent2Message

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String @id @default(cuid()) | 主键 |
| conversationId | String | 会话 ID |
| role | String | "user" 或 "assistant" |
| parts | Json | AI SDK UIMessage parts 数组 |
| attachments | Json? | [{name, type, url}] |
| createdAt | DateTime @default(now()) | 创建时间 |

索引：`@@index([conversationId, createdAt])`

**设计决策**：消息以 parts JSON 整体存储，不拆分表。parts 数组包含所有 part 类型（text、reasoning、tool-invocation、source、file 等），前端直接还原渲染。

### Agent2ToolConfirm

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String @id @default(cuid()) | 主键 |
| conversationId | String | 会话 ID |
| messageId | String | 消息 ID |
| toolName | String | 工具名称 |
| toolInput | Json | 工具输入参数 |
| token | String | 一次性确认令牌 |
| status | String @default("pending") | pending/confirmed/rejected |
| createdAt | DateTime @default(now()) | 创建时间 |
| confirmedAt | DateTime? | 确认时间 |

## 3. API 设计

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/agent2/conversations` | 列出当前用户的所有会话 |
| POST | `/api/agent2/conversations` | 创建新会话 |
| POST | `/api/agent2/conversations/[id]/chat` | 发送消息（SSE 流式响应） |
| PATCH | `/api/agent2/conversations/[id]` | 重命名会话 |
| DELETE | `/api/agent2/conversations/[id]` | 删除会话 |
| POST | `/api/agent2/confirm/[token]` | 确认/拒绝工具调用 |
| POST | `/api/agent2/upload` | 上传附件（Excel/Word） |

遵循项目三层后端模式：`types/` → `validators/` → `services/` → `api/`。

### 聊天 API 流程

```
POST /api/agent2/conversations/[id]/chat
  → 验证输入 (Zod)
  → 检查认证和会话所有权
  → streamText({
      model,
      messages: convertToModelMessages(messages),
      tools: { ... },
      onToolCall: 需确认的工具 → 返回 needs-confirm 状态
    })
  → toUIMessageStreamResponse({ sendReasoning: true, sendSources: true })
  → 流结束后持久化完整消息到 Agent2Message
```

## 4. 工具系统

### 工具清单（14 个）

**数据表操作（4 个）**

| 工具 | 描述 | 需确认 |
|------|------|--------|
| `listTables` | 列出可访问的数据表 | 否 |
| `getTableSchema` | 获取表结构和字段定义 | 否 |
| `searchRecords` | 查询记录（筛选/分页/排序） | 否 |
| `aggregateRecords` | 聚合统计（count/sum/avg/min/max） | 否 |

**文档生成（3 个）**

| 工具 | 描述 | 需确认 |
|------|------|--------|
| `listTemplates` | 列出可用模板 | 否 |
| `getTemplateDetail` | 查看模板详情和占位符 | 否 |
| `generateDocument` | 填写模板并生成文档 | 是 |

**记录管理（4 个）**

| 工具 | 描述 | 需确认 |
|------|------|--------|
| `getRecord` | 查看单条记录详情 | 否 |
| `createRecord` | 创建新记录 | 是 |
| `updateRecord` | 更新已有记录 | 是 |
| `deleteRecord` | 删除记录 | 是 |

**辅助工具（3 个）**

| 工具 | 描述 | 需确认 | 状态 |
|------|------|--------|------|
| `getCurrentTime` | 获取当前服务器日期时间 | 否 | 开发 |
| `executeCode` | 沙箱中执行代码 | 是 | 仅定义 schema，暂不实现 |
| `generateChart` | 根据数据生成图表（ECharts） | 否 | 开发 |

### generateChart 参数

```typescript
{
  type: "bar" | "line" | "pie" | "scatter" | "table",
  title: string,
  data: { labels: string[], values: number[] },
  options?: { xLabel?: string, yLabel?: string, color?: string }
}
```

输出 ECharts 配置 JSON，前端使用 ECharts 渲染。

### executeCode 参数（占位）

```typescript
{
  language: "python" | "javascript",
  code: string
}
```

仅定义 schema 和 UI 占位，后续接入沙箱运行时。

## 5. 工具确认流程

### 时序

```
用户 → "删除销售记录中金额为 0 的所有记录"
AI   → 调用 searchRecords → 找到 3 条记录
AI   → 调用 deleteRecord × 3 → 暂停，等待确认
系统  → 展示 ToolConfirmDialog（工具名 + 参数 JSON + 风险提示）
用户  → 点击"确认执行"（或勾选"以后自动确认此类操作"）
后端  → token 验证 → 执行操作 → 返回结果
AI   → "已成功删除 3 条金额为 0 的销售记录"
```

### 确认弹窗 UI

- 展示工具名称（如 `deleteRecord`）
- 展示参数 JSON
- 风险提示（如"此操作将永久删除数据，不可恢复"）
- "拒绝"和"确认执行"两个按钮
- 复选框："以后自动确认此类操作"

### 自动确认

- 侧边栏底部全局"自动确认工具调用"开关
- 确认弹窗中可勾选"以后自动确认此类操作"（按工具类别记忆）
- 自动确认设置存储在客户端（localStorage），不存数据库

## 6. 前端组件架构

### 组件树

```
Agent2Page                          // src/app/(dashboard)/ai-agent2/page.tsx
└── Agent2Layout                    // 左右分栏 + 侧边栏折叠
    ├── ConversationSidebar         // 会话列表 + 操作
    │   ├── 新建对话按钮
    │   ├── 会话列表（按日期分组）
    │   ├── 会话项（标题 + 右键菜单）
    │   └── 底部设置区（自动确认开关）
    │
    └── ChatArea                    // 主聊天区域
        ├── Conversation            // AI Elements
        │   ├── ConversationContent
        │   │   └── messages.map → Message
        │   │       ├── from="user" → 用户消息
        │   │       └── from="assistant" → parts 渲染
        │   │           ├── Reasoning (可折叠推理面板)
        │   │           ├── Tool (工具调用展示)
        │   │           │   ├── 读操作 → 直接展示结果
        │   │           │   └── 写操作 → ToolConfirmDialog
        │   │           ├── Sources (来源引用)
        │   │           └── MessageResponse → StreamdownRenderer
        │   ├── ConversationEmptyState + Suggestions
        │   └── ConversationScrollButton
        │
        └── PromptInput             // AI Elements
            ├── PromptInputTextarea (输入框)
            ├── PromptInputHeader → Attachments (附件预览)
            └── PromptInputFooter → PromptInputTools
                ├── PromptInputActionMenu (添加附件/上传)
                ├── ModelSelector (模型选择器)
                └── PromptInputSubmit (发送/停止)
```

### AI Elements 组件复用

| 组件 | 用途 |
|------|------|
| `Conversation` / `ConversationContent` / `ConversationScrollButton` | 聊天容器和滚动 |
| `ConversationEmptyState` | 空对话状态 |
| `Message` / `MessageContent` / `MessageResponse` | 消息展示 |
| `Reasoning` / `ReasoningTrigger` / `ReasoningContent` | 推理面板（流式 + 可折叠） |
| `Tool` / `ToolHeader` / `ToolContent` / `ToolInput` / `ToolOutput` | 工具调用展示 |
| `Sources` / `SourcesTrigger` / `SourcesContent` / `Source` | 来源引用 |
| `PromptInput` / `PromptInputTextarea` / `PromptInputSubmit` | 输入区 |
| `PromptInputActionMenu` / `PromptInputActionAddAttachments` | 操作菜单 |
| `ModelSelector` 全套组件 | 模型选择器 |
| `Suggestions` / `Suggestion` | 推荐问题 |
| `Attachments` / `Attachment` / `AttachmentPreview` / `AttachmentRemove` | 附件展示 |

### 自定义组件（4 个）

**ToolConfirmDialog** — 工具确认弹窗
- 展示工具名 + 参数 JSON + 风险提示
- 触发：tool-invocation part state 为 needs-confirm
- 调用 `/api/agent2/confirm/[token]` 确认/拒绝
- 支持"以后自动确认此类操作"复选框

**StreamdownRenderer** — 流式 Markdown 渲染
- 使用 streamdown 渲染流式 markdown 输出
- 替换 AI Elements 默认的 MessageResponse
- 支持代码高亮、表格、公式等

**ChartRenderer** — 图表渲染
- 渲染 generateChart 工具返回的 ECharts 配置
- 作为 Tool 组件的自定义渲染器
- 依赖：echarts 或 echarts-for-react

**FileAttachmentHandler** — 文件附件处理
- 处理 Excel/Word 文件上传和文本提取
- 流程：选择文件 → 上传到 `/api/agent2/upload` → 返回提取文本
- 使用 AI Elements Attachments + usePromptInputAttachments hook

### 数据流

```
useChat({ api: "/api/agent2/conversations/[id]/chat" })
  → messages: UIMessage[]（含 parts 数组）
  → status: "ready" | "submitted" | "streaming" | "error"
  → sendMessage({ text, files })

ConversationContent → messages.map()
  → 每个 message.parts 按 type 分发渲染：
    "text"            → StreamdownRenderer (streamdown)
    "reasoning"       → Reasoning (流式展示 + 完成后可折叠)
    "tool-invocation" → Tool / ToolConfirmDialog
    "source"          → Sources
    "file"            → Attachments 预览

PromptInput → sendMessage
  → 文本 + 附件 + 模型选择 → POST /api/.../chat
  → 后端 streamText → SSE → useChat 接收 parts
```

## 7. 技术栈

| 层 | 技术 |
|------|------|
| 前端 UI | AI Elements（基于 shadcn/ui v4 + Base UI） |
| 流式 Markdown | streamdown v2.5 |
| 图表 | ECharts |
| AI SDK | Vercel AI SDK v6 (ai ^6.0) + @ai-sdk/react |
| 模型 | @ai-sdk/openai（可扩展其他 provider） |
| 后端 | Next.js 16 Route Handlers + streamText |
| 数据库 | PostgreSQL + Prisma v7 |
| 认证 | NextAuth v4（复用现有体系） |
| 验证 | Zod |

## 8. 多模型支持

通过 AI SDK 的 provider 机制支持多模型切换：

- **OpenAI**: GPT-4o, GPT-4o Mini
- **Anthropic**: Claude 4 Opus, Claude 4 Sonnet（需安装 @ai-sdk/anthropic）
- **Google**: Gemini 2.0 Flash（需安装 @ai-sdk/google）

模型选择器使用 AI Elements 的 `ModelSelector` 组件，按 provider 分组展示。

## 9. 附件支持

### 支持的文件类型

- **Excel/CSV**: 解析电子表格内容，提取为文本/结构化数据
- **Word (.docx)**: 提取文档文本内容

### 处理流程

1. 用户通过 PromptInput 附件按钮选择文件
2. 文件上传到 `/api/agent2/upload`
3. 后端解析文件内容（Excel 用 xlsx 库，Word 用 jszip）
4. 返回提取的文本内容，作为消息上下文传给 AI
5. 附件信息存入 Agent2Message 的 attachments 字段

## 10. 导航集成

在现有 sidebar 导航中新增"AI 助手 2"入口，路径 `/ai-agent2`，使用 Bot 图标。与现有 `/ai-agent` 并存。
