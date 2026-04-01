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

侧边栏功能：新建对话、会话列表（按收藏/今天/更早分组）、会话右键菜单（重命名/删除/收藏）、底部设置按钮（打开设置弹窗）、可折叠。

### 会话列表分组

按以下优先级分组展示：
1. **⭐ 收藏** — 用户标记的收藏会话，始终置顶
2. **今天** — 当天创建或更新的会话
3. **更早** — 昨天及之前的会话

会话项支持右键菜单：重命名、删除、收藏/取消收藏。收藏的会话显示 ⭐ 图标。

## 2. 数据模型

新增 5 张数据库表。

### Agent2Conversation

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String @id @default(cuid()) | 主键 |
| title | String @default("新对话") | 会话标题 |
| isFavorite | Boolean @default(false) | 是否收藏 |
| userId | String | 用户 ID |
| model | String @default("gpt-4o") | 上次使用的模型 |
| createdAt | DateTime @default(now()) | 创建时间 |
| updatedAt | DateTime @updatedAt | 更新时间 |

关联：`user User`、`messages Agent2Message[]`
索引：`@@index([userId, isFavorite])`、`@@index([userId, updatedAt])`

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

### Agent2ModelConfig（模型配置）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String @id @default(cuid()) | 主键 |
| name | String | 模型显示名（如 "GPT-4o"） |
| providerId | String | Provider 标识（如 "openai"、"custom"） |
| modelId | String | 模型 ID（如 "gpt-4o"） |
| baseUrl | String | API Base URL |
| apiKeyEncrypted | String? | 加密的 API Key（用户自定义时存储） |
| isGlobal | Boolean @default(false) | 是否全局可见（管理员配置） |
| userId | String? | 所属用户（null 表示全局模型） |
| createdAt | DateTime @default(now()) | 创建时间 |

索引：`@@index([userId])`、`@@index([isGlobal])`
约束：全局模型 `isGlobal=true AND userId IS NULL`，用户模型 `isGlobal=false AND userId NOT NULL`

**设计决策**：
- 管理员在后台添加全局模型（`isGlobal=true`），所有用户可见
- 用户可添加自定义模型（`isGlobal=false`），仅自己可见
- 自定义模型统一使用 OpenAI 兼容格式（`baseUrl` + `apiKey`）
- API Key 使用 AES 加密存储，解密后使用
- 模型列表 = 全局模型 + 当前用户自定义模型

### Agent2UserSettings（用户设置）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String @id @default(cuid()) | 主键 |
| userId | String @unique | 用户 ID |
| autoConfirmTools | Json @default("{}") | 按工具类别存储自动确认设置 |
| defaultModel | String @default("gpt-4o") | 默认模型 |
| showReasoning | Boolean @default(true) | 显示推理过程 |
| createdAt | DateTime @default(now()) | 创建时间 |
| updatedAt | DateTime @updatedAt | 更新时间 |

**设置弹窗内容**：
- **工具执行**：按工具类别的自动确认开关（查询/获取/创建/更新/删除）
- **模型设置**：默认模型选择、管理自定义模型（添加/删除 OpenAI 兼容模型）
- **显示设置**：显示推理过程、自动滚动等
- 未来可扩展更多设置项

## 3. API 设计

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/agent2/conversations` | 列出当前用户的所有会话 |
| POST | `/api/agent2/conversations` | 创建新会话 |
| POST | `/api/agent2/conversations/[id]/chat` | 发送消息（SSE 流式响应） |
| PATCH | `/api/agent2/conversations/[id]` | 更新会话（重命名/收藏） |
| DELETE | `/api/agent2/conversations/[id]` | 删除会话 |
| POST | `/api/agent2/confirm/[token]` | 确认/拒绝工具调用 |
| POST | `/api/agent2/upload` | 上传附件（Excel/Word） |

遵循项目三层后端模式：`types/` → `validators/` → `services/` → `api/`。

### 聊天 API 流程

```
POST /api/agent2/conversations/[id]/chat
  → 验证输入 (Zod)
  → 检查认证和会话所有权
  → 从 DB 加载完整对话历史
  → 上下文窗口管理：
      → 计算 messages 总 token 数
      → 未超限： 发送全部历史
      → 超限（>80% 模型上下文窗口）: 截断最早的消息，保留最近的消息
      → 始终保留 system prompt（表结构、工具说明等）
  → streamText({
      model,
      system: systemPrompt,        // 包含表结构上下文
      messages: truncatedMessages,
      tools: { ... },
      onToolCall: 需确认的工具 → 返回 needs-confirm 状态
    })
  → toUIMessageStreamResponse({ sendReasoning: true, sendSources: true })
  → 流结束后持久化完整消息到 Agent2Message
```

### 上下文窗口管理策略

采用**完整历史 + 滑动窗口截断**方案，与主流 ChatGPT 一致：

1. **正常情况**：从 DB 加载完整对话历史，现代模型上下文窗口为 128K+ tokens，普通对话很难超限
2. **截断规则**：当消息 token 总数超过模型上下文窗口的 80% 时，从最早的消息开始丢弃，直到总量回到 70% 以下
3. **始终保留**：system prompt（表结构上下文、工具说明）不参与截断计数，它是固定的 overhead
4. **实现方式**：使用 AI SDK 的 `generateText` 或 `countTokens` 工具预估 token 数。简单实现可用消息数 × 平均倍率估算（每条消息约 500-1000 tokens），精确实现可调用 tokenizer
5. **不做摘要**：不使用 AI 摘要早期对话。摘要增加复杂度和额外 API 调用成本，现代模型的大窗口使得摘要大部分场景下不必要

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

### 技术实现方案（AI SDK v6）

AI SDK v6 的 `streamText` 不原生支持"暂停等待用户确认"。采用以下方案：

**后端**：需确认的工具在 `tool.execute` 中生成 confirm token，立即返回包含 token 的结果（`{ _needsConfirm: true, token, toolName, toolInput }`），不执行实际操作。前端识别此标记后展示确认弹窗。

**前端**：渲染 `tool-invocation` part 时检查 output 中是否包含 `_needsConfirm`：
- 是 → 展示 `ToolConfirmDialog`，用户确认后调用 `/api/agent2/confirm/[token]`
- 否 → 正常展示 ToolInput/ToolOutput

**确认后执行**：`/api/agent2/confirm/[token]` 验证 token 后执行实际操作，返回结果。前端收到结果后更新对应 tool-invocation part 的 output 并继续对话。

### 时序

```
用户 → "删除销售记录中金额为 0 的所有记录"
AI   → 调用 searchRecords → 找到 3 条记录
AI   → 调用 deleteRecord → tool.execute 返回 { _needsConfirm: true, token: "xxx" }
前端  → 识别 _needsConfirm → 展示 ToolConfirmDialog
用户  → 点击"确认执行"
前端  → POST /api/agent2/confirm/xxx
后端  → token 验证 → 执行删除 → 返回结果
前端  → 更新 tool output → 追加用户确认消息 → AI 继续生成回复
AI   → "已成功删除 3 条金额为 0 的销售记录"
```

### 确认弹窗 UI

- 展示工具名称（如 `deleteRecord`）
- 展示参数 JSON
- 风险提示（如"此操作将永久删除数据，不可恢复"）
- "拒绝"和"确认执行"两个按钮
- 复选框："以后自动确认此类操作"

### 确认令牌机制

- Token 为加密随机字符串（`crypto.randomUUID()`），存入 `Agent2ToolConfirm` 表
- **过期时间**：5 分钟。`/api/agent2/confirm/[token]` 检查 `createdAt + 5min > now`，过期则返回 410 Gone
- **并发保护**：token 为一次性使用。确认后 status 立即更新为 confirmed/rejected，重复调用返回 409 Conflict
- **清理**：通过定时任务或惰性清理删除超过 1 小时的 pending 状态记录

### 自动确认

- 设置弹窗中的"工具执行"选项卡：按工具类别的自动确认开关
- 确认弹窗中可勾选"以后自动确认此类操作"（按工具类别记忆）
- 自动确认设置持久化到 `Agent2UserSettings.autoConfirmTools`（Json 格式：`{ read: true, write: false, delete: false }`）
- 自动确认开启时，前端检测到 `_needsConfirm` 后自动调用 confirm API，不弹窗

### 设置弹窗

侧边栏底部"设置"按钮打开设置弹窗（`Dialog`），使用 `Tabs` 分选项卡：

```
设置
├── 🔧 工具执行
│   ├── 查询类工具自动确认 [开]
│   ├── 创建类工具自动确认 [关]
│   ├── 更新类工具自动确认 [关]
│   └── 删除类工具自动确认 [关]
│
├── 🤖 模型管理
│   ├── 默认模型选择
│   ├── 自定义模型列表
│   │   ├── DeepSeek V3 — https://api.deepseek.com/v1
│   │   └── Qwen-Max — https://dashscope.aliyuncs.com/v1
│   └── [+ 添加自定义模型]
│       → 模型名称
│       → Base URL
│       → API Key (密码输入)
│       → 模型 ID
│
└── 🎨 显示设置
    ├── 显示推理过程 [开]
    └── 自动滚动到底部 [开]
```

设置变更后即时生效，无需刷新页面。

### 流中断与错误处理

- **流中断**：如果 SSE 流在传输过程中断开（网络错误、服务端崩溃），`useChat` 的 `onError` 回调触发，显示错误提示。前端保留已接收的部分消息
- **消息持久化时机**：流正常结束后（`onFinish` 回调）持久化完整消息。流中断时，已接收的完整消息仍然持久化（按 message 粒度），不完整的最后一条消息标记为 `status: "failed"`
- **工具确认中断**：如果用户关闭页面时仍有未确认的工具调用，token 在 5 分钟后自动过期，不产生副作用

## 6. 前端组件架构

### 组件树

```
Agent2Page                          // src/app/(dashboard)/ai-agent2/page.tsx
└── Agent2Layout                    // 左右分栏 + 侧边栏折叠
    ├── ConversationSidebar         // 会话列表 + 操作
    │   ├── 新建对话按钮
    │   ├── 会话列表（按日期分组）
    │   ├── 会话项（标题 + 右键菜单：重命名/删除/收藏）
    │   └── 底部设置按钮 → 打开 SettingsDialog
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

**SettingsDialog** — 设置弹窗
- 侧边栏底部齿轮按钮触发，使用 shadcn `Dialog` + `Tabs`
- 三个选项卡：
  - **工具执行**：按工具类别的自动确认开关
  - **模型管理**：自定义模型 CRUD（名称 + baseURL + apiKey + 模型ID）
  - **显示设置**：推理过程显示、自动滚动等
- 设置变更即时生效，API Key 加密存储

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

### 模型来源

模型列表由两部分合并：

1. **全局模型**（管理员配置）— 管理员在后台添加，所有用户可见。配置包含 provider（openai/anthropic/google 等）、模型 ID、base URL。API Key 由管理员在服务端配置（环境变量或加密存储），用户无需关心。
2. **用户自定义模型** — 用户在设置弹窗中添加，仅自己可见。使用 OpenAI 兼容格式，用户自行配置 base URL 和 API Key。

### 自定义模型配置

用户可在设置弹窗中管理自定义模型：

- **添加模型**：填写模型名称、Base URL、API Key、模型 ID
- **编辑/删除**：管理已添加的自定义模型
- **格式**：统一使用 OpenAI 兼容格式（`@ai-sdk/openai` 的 `createOpenAI({ baseURL })`）
- **安全**：API Key 加密存储在数据库（`Agent2ModelConfig.apiKeyEncrypted`），传输和显示时脱敏

### 管理员后台

管理员可在系统设置中配置全局模型：

- 配置 provider、模型 ID、Base URL、API Key
- 设置全局可见性
- 管理模型列表（启用/禁用）

### 模型选择器

使用 AI Elements 的 `ModelSelector` 组件，按 provider 分组展示：

```
全局模型
├── OpenAI
│   ├── GPT-4o
│   └── GPT-4o Mini
├── Anthropic
│   ├── Claude 4 Opus
│   └── Claude 4 Sonnet
└── Google
    └── Gemini 2.0 Flash

我的模型
├── DeepSeek V3 (自定义)
└── Qwen-Max (自定义)
```

### 后端路由

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/agent2/models` | 获取可用模型列表（全局 + 用户自定义） |
| POST | `/api/agent2/models` | 添加自定义模型 |
| DELETE | `/api/agent2/models/[id]` | 删除自定义模型 |
| GET | `/api/agent2/admin/models` | 管理员：获取全局模型列表 |
| POST | `/api/agent2/admin/models` | 管理员：添加全局模型 |
| PATCH | `/api/agent2/admin/models/[id]` | 管理员：更新全局模型 |
| DELETE | `/api/agent2/admin/models/[id]` | 管理员：删除全局模型 |

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
