# AI Agent 2 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 基于 Vercel AI Elements 构建独立的系统集成 AI 助手页面 `/ai-agent2`，支持多模型、工具调用确认、附件上传、推理展示。

**Architecture:** 左右分栏布局（会话列表 + 聊天区域），，后端三层架构（types → validators → services → api），使用 AI SDK v6 streamText 流式输出， UIMessage parts 格式存储，工具确认用 token 机制。

**Tech Stack:** Next.js 16, AI SDK v6 (`ai ^6.0`, `@ai-sdk/react`), Vercel AI Elements, Prisma v7, shadcn/ui v4 (Base UI), streamdown v2.5, ECharts, Zod v4

**Spec:** `docs/superpowers/specs/2026-04-01-ai-agent2-design.md`

---

## 文件结构总览

### 新增文件

```
prisma/schema.prisma                          # 追加 5 个 Agent2 模型

src/types/agent2.ts                           # TypeScript 接口
src/validators/agent2.ts                      # Zod schemas

src/lib/services/agent2-conversation.service.ts  # 会话 CRUD
src/lib/services/agent2-message.service.ts       # 消息持久化
src/lib/services/agent2-model.service.ts         # 模型配置 CRUD + AES 加密
src/lib/services/agent2-settings.service.ts      # 用户设置 CRUD

src/lib/agent2/tools.ts                        # 14 个工具定义
src/lib/agent2/tool-helpers.ts                 # 工具辅助（DB 查询复封装）
src/lib/agent2/tool-executor.ts                # 确认后工具执行映射
src/lib/agent2/confirm-store.ts                # 确认令牌管理
src/lib/agent2/context-builder.ts              # System prompt 构建 + 上下文窗口管理
src/lib/agent2/model-resolver.ts               # 模型解析（provider → SDK model）

src/app/(dashboard)/ai-agent2/page.tsx         # 页面入口

src/components/agent2/agent2-layout.tsx        # 左右分栏布局
src/components/agent2/conversation-sidebar.tsx  # 会话列表侧边栏
src/components/agent2/chat-area.tsx            # 聊天主区域（含 PromptInput + 附件）
src/components/agent2/message-parts.tsx        # 消息 parts 渲染
src/components/agent2/streamdown-renderer.tsx   # Streamdown Markdown 渲染
src/components/agent2/tool-confirm-dialog.tsx   # 工具确认弹窗
src/components/agent2/chart-renderer.tsx        # ECharts 图表渲染
src/components/agent2/settings-dialog.tsx       # 设置弹窗
src/components/agent2/model-manager.tsx         # 模型管理选项卡

src/app/api/agent2/conversations/route.ts              # GET/POST 会话
src/app/api/agent2/conversations/[id]/route.ts         # PATCH/DELETE 会话
src/app/api/agent2/conversations/[id]/chat/route.ts    # POST 聊天（流式）
src/app/api/agent2/confirm/[token]/route.ts            # POST 确认
src/app/api/agent2/upload/route.ts                     # POST 上传附件
src/app/api/agent2/models/route.ts                     # GET/POST 用户模型
src/app/api/agent2/models/[id]/route.ts                # DELETE 用户模型
src/app/api/agent2/settings/route.ts                   # GET/PATCH 设置
src/app/api/agent2/admin/models/route.ts               # GET/POST 管理员模型
src/app/api/agent2/admin/models/[id]/route.ts          # PATCH/DELETE 管理员模型
```

### 修改文件

```
src/components/layout/sidebar.tsx             # 新增"AI 助手 2"导航项
```

---

## Task 1: 依赖安装 & 数据库 Schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: 安装依赖**

```bash
cd /home/z/test-hub/docx-template-system
npx ai-elements@latest init
npm install echarts
npm install @ai-sdk/react  # 确保安装，ai-elements init 可能未包含
```

AI Elements init 会在 `src/components/ai-elements/` 下生成组件文件。如果 init 交互式提示，选择默认选项。

- [ ] **Step 2: 验证 AI Elements 安装**

```bash
ls src/components/ai-elements/
```

Expected: 看到 conversation.tsx, message.tsx, prompt-input.tsx, reasoning.tsx, tool.tsx, sources.tsx, suggestions.tsx, attachments.tsx, model-selector.tsx 等文件。如果目录为空或 init 失败，回退方案：从 AI Elements 仓库手动复制组件文件到 `src/components/ai-elements/`。

- [ ] **Step 3: 验证 AI SDK tool API 字段名**

```bash
grep -r "inputSchema\|parameters" node_modules/ai/dist/index.d.ts | head -5
```

确认当前安装的 `ai` 版本中工具定义使用 `inputSchema` 还是 `parameters`。项目现有 `ai ^6.0.141` 的 `service.ts` 使用了 `inputSchema`。如果确认是 `inputSchema`，则 Task 4 的工具定义中需用 `inputSchema` 替代 `parameters`。

- [ ] **Step 4: 在 `prisma/schema.prisma` 末尾追加 5 个模型**

在 User model 中追加关联：
```prisma
agent2Conversations Agent2Conversation[]
```

新增模型：
```prisma
model Agent2Conversation {
  id         String   @id @default(cuid())
  title      String   @default("新对话")
  isFavorite Boolean  @default(false)
  userId     String
  model      String   @default("gpt-4o")
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  user       User     @relation(fields: [userId], references: [id])
  messages   Agent2Message[]

  @@index([userId, isFavorite])
  @@index([userId, updatedAt])
}

model Agent2Message {
  id             String   @id @default(cuid())
  conversationId String
  role           String
  parts          Json
  attachments    Json?
  createdAt      DateTime @default(now())
  conversation   Agent2Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@index([conversationId, createdAt])
}

model Agent2ToolConfirm {
  id             String    @id @default(cuid())
  conversationId String
  messageId      String
  toolName       String
  toolInput      Json
  token          String    @unique
  status         String    @default("pending")
  createdAt      DateTime  @default(now())
  confirmedAt    DateTime?
}

model Agent2ModelConfig {
  id              String   @id @default(cuid())
  name            String
  providerId      String
  modelId         String
  baseUrl         String
  apiKeyEncrypted String?
  isGlobal        Boolean  @default(false)
  userId          String?
  createdAt       DateTime @default(now())

  @@index([userId])
  @@index([isGlobal])
}

model Agent2UserSettings {
  id               String   @id @default(cuid())
  userId           String   @unique
  autoConfirmTools Json     @default("{}")
  defaultModel     String   @default("gpt-4o")
  showReasoning    Boolean  @default(true)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}
```

- [ ] **Step 5: 推送 Schema 到数据库**

```bash
npx prisma db push
npx prisma generate
```

Expected: Schema synced, Prisma client regenerated。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(agent2): add dependencies and database schema"
```

---

## Task 2: Types & Validators

**Files:**
- Create: `src/types/agent2.ts`
- Create: `src/validators/agent2.ts`

- [ ] **Step 1: 创建类型定义 `src/types/agent2.ts`**

定义 `Agent2ConversationItem`, `Agent2ConversationDetail`, `Agent2MessageItem`, `ToolConfirmResult`, `Agent2ModelItem`, `Agent2ModelCreateInput`, `Agent2UserSettingsData`, `Agent2ChatRequest` 等接口。详情见设计文档 Section 2 和 Section 3。

所有 service 函数共享 `ServiceResult<T>` 类型，从各 service 文件局部定义即可（项目现有模式）。

- [ ] **Step 2: 创建 Zod 验证器 `src/validators/agent2.ts`**

定义 schemas:
- `createConversationSchema` — title?, model?
- `updateConversationSchema` — title?, isFavorite?
- `chatRequestSchema` — messages, model
- `toolConfirmSchema` — approved: boolean
- `createModelSchema` — name, providerId, modelId, baseUrl, apiKey
- `updateModelSchema` — name?, baseUrl?, apiKey?, modelId?
- `updateSettingsSchema` — autoConfirmTools?, defaultModel?, showReasoning?

- [ ] **Step 3: Commit**

```bash
git add src/types/agent2.ts src/validators/agent2.ts
git commit -m "feat(agent2): add types and validators"
```

---

## Task 3: Services — 会话、消息、设置、模型

**Files:**
- Create: `src/lib/services/agent2-conversation.service.ts`
- Create: `src/lib/services/agent2-message.service.ts`
- Create: `src/lib/services/agent2-settings.service.ts`
- Create: `src/lib/services/agent2-model.service.ts`

- [ ] **Step 1: 创建会话服务**

`listConversations(userId)`, `createConversation(userId, data?)`, `updateConversation(id, userId, data)`, `deleteConversation(id, userId)`, `getConversation(id, userId)`。全部返回 `ServiceResult<T>`。使用 `db` from `@/lib/db`。

- [ ] **Step 2: 创建消息服务**

`saveMessages(conversationId, userMessage, assistantMessage)` — 保存 UIMessage parts 为 Json。`getMessages(conversationId)` — 按 createdAt 升序获取。

- [ ] **Step 3: 创建设置服务**

`getSettings(userId)` — 获取或创建默认设置。`updateSettings(userId, data)` — 更新。

- [ ] **Step 4: 创建模型服务（含 AES 加密）**

用户模型：`listModels(userId)`, `createModel(userId, data)`, `deleteModel(id, userId)`, `getDecryptedApiKey(id, userId)`。
管理员模型：`listGlobalModels()`, `createGlobalModel(data)`, `updateGlobalModel(id, data)`, `deleteGlobalModel(id)`。
加密使用 `crypto.createCipheriv('aes-256-gcm', key, iv)` + `crypto.createDecipheriv`。密钥来自 `process.env.MODEL_CONFIG_ENCRYPTION_KEY`。

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/agent2-*.service.ts
git commit -m "feat(agent2): add conversation, message, settings, model services"
```

---

## Task 4: 工具系统 & 确认机制 & 上下文管理

**Files:**
- Create: `src/lib/agent2/tool-helpers.ts`
- Create: `src/lib/agent2/tools.ts`
- Create: `src/lib/agent2/tool-executor.ts`
- Create: `src/lib/agent2/confirm-store.ts`
- Create: `src/lib/agent2/context-builder.ts`
- Create: `src/lib/agent2/model-resolver.ts`

- [ ] **Step 1: 创建工具辅助函数 `tool-helpers.ts`**

封装 DB 查询：`listTables()`, `getTableSchema(tableId)`, `searchRecords(...)`, `aggregateRecords(...)`, `listTemplates()`, `getTemplateDetail(templateId)`, `getRecord(recordId)`, `createRecord(userId, tableId, data)`, `updateRecord(recordId, data)`, `deleteRecord(recordId)`。复用现有 `src/lib/ai-agent/tools.ts` 中的查询逻辑。

- [ ] **Step 2: 创建确认令牌管理 `confirm-store.ts`**

- `needsConfirm(toolName)` — 查表（createRecord, updateRecord, deleteRecord, generateDocument, executeCode 需确认）
- `getRiskMessage(toolName)` — 返回风险提示文案
- `createConfirmToken(conversationId, messageId, toolName, toolInput)` — 生成 UUID token 存入 DB
- `validateAndClaimToken(token)` — 验证有效性（5分钟过期）+ 原子占用（status pending→confirmed）
- `rejectToken(token)` — 标记 rejected
- `cleanupExpiredTokens()` — 删除 1 小时前的 pending 记录（惰性清理）

局部定义 `ServiceResult<T>` 类型。

- [ ] **Step 3: 创建确认后工具执行映射 `tool-executor.ts`**

将 toolName 映射到实际执行函数：
```typescript
import * as helpers from "./tool-helpers";

export async function executeToolAction(
  toolName: string,
  toolInput: Record<string, unknown>,
  userId: string
): Promise<ServiceResult<unknown>> {
  switch (toolName) {
    case "createRecord": return helpers.createRecord(userId, toolInput.tableId, toolInput.data);
    case "updateRecord": return helpers.updateRecord(toolInput.recordId, toolInput.data);
    case "deleteRecord": return helpers.deleteRecord(toolInput.recordId);
    case "generateDocument": return helpers.generateDocument(toolInput);
    default: return { success: false, error: { code: "UNKNOWN_TOOL", message: `未知工具: ${toolName}` } };
  }
}
```

- [ ] **Step 4: 创建工具定义 `tools.ts`**

使用 AI SDK `tool()` 定义 14 个工具（注意：根据 Step 3 验证结果使用 `inputSchema` 或 `parameters`）。

核心逻辑：
- 无需确认的工具（listTables, getTableSchema, searchRecords, aggregateRecords, listTemplates, getTemplateDetail, getRecord, getCurrentTime, generateChart）直接 execute 调用 tool-helpers
- 需确认的工具（createRecord, updateRecord, deleteRecord, generateDocument, executeCode）通过 `wrapConfirm` 包装：检查 autoConfirm 设置，决定直接执行还是返回 `_needsConfirm` 结果
- `generateChart` 的 execute 将输入参数转换为 ECharts option 对象

导出 `createTools(conversationId, messageId, autoConfirm)` 工厂函数。

- [ ] **Step 5: 创建上下文构建器 `context-builder.ts`**

- `buildSystemPrompt()` — 返回 system prompt 文本
- `truncateMessages(messages, maxTokens)` — 滑动窗口截断： 超过 80% 时截断到 70%，始终保留 system prompt。简单实现可用消息数估算（messages.length * 800），精确实现可用 tokenizer。

- [ ] **Step 6: 创建模型解析器 `model-resolver.ts`**

`resolveModel(modelId, userId)` — 查 Agent2ModelConfig 获取自定义/全局模型配置，用 `createOpenAI({ baseURL, apiKey })` 创建 provider 并返回 `provider(modelId)`。找不到时 fallback 到环境变量默认 provider。

- [ ] **Step 7: Commit**

```bash
git add src/lib/agent2/
git commit -m "feat(agent2): add tools, confirm store, context builder, model resolver, tool executor"
```

---

## Task 5: API 路由

**Files:**
- Create: `src/app/api/agent2/conversations/route.ts`
- Create: `src/app/api/agent2/conversations/[id]/route.ts`
- Create: `src/app/api/agent2/conversations/[id]/chat/route.ts`
- Create: `src/app/api/agent2/confirm/[token]/route.ts`
- Create: `src/app/api/agent2/upload/route.ts`
- Create: `src/app/api/agent2/models/route.ts`
- Create: `src/app/api/agent2/models/[id]/route.ts`
- Create: `src/app/api/agent2/settings/route.ts`
- Create: `src/app/api/agent2/admin/models/route.ts`
- Create: `src/app/api/agent2/admin/models/[id]/route.ts`

- [ ] **Step 1: 创建会话 API（conversations/route.ts + conversations/[id]/route.ts）**

GET/POST 会话列表和创建。PATCH/DELETE 更新和删除。注意 `await params` (Next.js 16)。

- [ ] **Step 2: 创建聊天 API（conversations/[id]/chat/route.ts）**

核心路由，步骤：
1. `auth()` 检查认证
2. `chatRequestSchema.parse(body)` 验证
3. 验证会话所有权
4. 获取用户设置（autoConfirmTools）
5. `resolveModel(model, userId)` 获取 AI SDK model
6. `buildSystemPrompt()` 构建 system prompt
7. `truncateMessages(messages, maxTokens)` 上下文窗口管理
8. `createTools(conversationId, messageId, autoConfirmTools)` 创建工具集
9. `streamText({ model, system, messages, tools })` 流式调用
10. `onFinish` 回调中 `saveMessages()` 持久化
11. 返回 `result.toUIMessageStreamResponse({ sendReasoning: true, sendSources: true })`

- [ ] **Step 3: 创建确认 API（confirm/[token]/route.ts）**

`approved=true`: `validateAndClaimToken(token)` → `executeToolAction(toolName, toolInput, userId)` → 返回结果。
`approved=false`: `rejectToken(token)` → 返回成功。

- [ ] **Step 4: 创建上传 API（upload/route.ts）**

接收 FormData，解析文件。 Excel 用 `xlsx` 库读取， Word 用 `jszip` 提取 XML 文本。返回 `{ text, fileName, fileType }`。

- [ ] **Step 5: 创建用户模型 API（models/route.ts + models/[id]/route.ts）**

GET 获取全局+自定义模型列表。 POST 创建自定义模型。 DELETE 删除自定义模型。

- [ ] **Step 6: 创建设置 API（settings/route.ts）**

GET 获取用户设置。 PATCH 更新用户设置。

- [ ] **Step 7: 创建管理员模型 API（admin/models/route.ts + admin/models/[id]/route.ts）**

GET 获取全局模型列表。 POST 创建全局模型（需 ADMIN 角色）。 PATCH 更新全局模型。 DELETE 删除全局模型。全部需要 `session.user.role === "ADMIN"` 校验。

- [ ] **Step 8: Commit**

```bash
git add src/app/api/agent2/
git commit -m "feat(agent2): add all API routes including admin model management"
```

---

## Task 6: 前端页面 & 布局组件

**Files:**
- Create: `src/app/(dashboard)/ai-agent2/page.tsx`
- Create: `src/components/agent2/agent2-layout.tsx`
- Create: `src/components/agent2/conversation-sidebar.tsx`
- Modify: `src/components/layout/sidebar.tsx`

- [ ] **Step 1: 创建页面入口 `src/app/(dashboard)/ai-agent2/page.tsx`**

Server component，渲染 `Agent2Layout`。

- [ ] **Step 2: 创建布局组件 `agent2-layout.tsx`**

"use client" 组件。管理 `selectedConversationId` 状态。左右分栏（左侧 280px，可折叠按钮切换为 0px）。右侧渲染 `ChatArea` 或空状态。

- [ ] **Step 3: 创建会话侧边栏 `conversation-sidebar.tsx`**

- 新建对话按钮（POST `/api/agent2/conversations`）
- 会话列表，按分组展示： ⭐ 收藏 → 今天 → 更早
- 每个会话项：标题 + 右键菜单（DropdownMenu：重命名、收藏/取消收藏、删除）
- 底部设置按钮（打开 SettingsDialog）
- 选中态高亮，`useEffect` 加载列表

- [ ] **Step 4: 添加导航入口到 `sidebar.tsx`**

在 `navItems` 数组的"AI 助手"项后追加 `{ title: "AI 助手 2", href: "/ai-agent2", icon: <Sparkles className="h-4 w-4" /> }`。

- [ ] **Step 5: 验证页面加载**

```bash
npm run dev
```

打开 http://localhost:8060/ai-agent2，应看到左右分栏布局。

- [ ] **Step 6: Commit**

```bash
git add src/app/(dashboard)/ai-agent2/ src/components/agent2/ src/components/layout/sidebar.tsx
git commit -m "feat(agent2): add page, layout, sidebar, and navigation"
```

---

## Task 7: 聊天核心 — AI Elements 集成

**Files:**
- Create: `src/components/agent2/chat-area.tsx`
- Create: `src/components/agent2/message-parts.tsx`
- Create: `src/components/agent2/streamdown-renderer.tsx`

- [ ] **Step 1: 创建聊天区域 `chat-area.tsx`（框架）**

"use client" 组件。初始化 `useChat({ api: .../chat, body: { model } })`。渲染 `Conversation` + `ConversationContent`。空状态展示 `ConversationEmptyState` + `Suggestions`。

- [ ] **Step 2: 添加 PromptInput 输入区**

在 chat-area 底部添加 `PromptInput` + `PromptInputTextarea` + `PromptInputSubmit`。添加 `PromptInputActionMenu` + `PromptInputActionAddAttachments` 用于附件。添加模型选择按钮。

- [ ] **Step 3: 创建消息 parts 渲染器 `message-parts.tsx`**

按 message.parts 的 type 分发：
- "reasoning" → `Reasoning` + `ReasoningTrigger` + `ReasoningContent`（合并多个 reasoning parts，流式时自动展开）
- "text" → `StreamdownRenderer`
- "tool-invocation" → 检查 `_needsConfirm` 显示 `ToolConfirmDialog`，否则显示 AI Elements `Tool`。`generateChart` 显示 `ChartRenderer`。
- "source" → `Sources`

- [ ] **Step 4: 创建 Streamdown 渲染器 `streamdown-renderer.tsx`**

使用 `Streamdown` 组件渲染 markdown，流式时追加 "▌" 光标。

- [ ] **Step 5: 验证聊天功能**

发送消息，验证流式回复、推理展示、工具调用。

- [ ] **Step 6: Commit**

```bash
git add src/components/agent2/chat-area.tsx src/components/agent2/message-parts.tsx src/components/agent2/streamdown-renderer.tsx
git commit -m "feat(agent2): add chat area with AI Elements integration"
```

---

## Task 8: 自定义组件 — 确认弹窗、图表、设置

**Files:**
- Create: `src/components/agent2/tool-confirm-dialog.tsx`
- Create: `src/components/agent2/chart-renderer.tsx`
- Create: `src/components/agent2/settings-dialog.tsx`
- Create: `src/components/agent2/model-manager.tsx`

- [ ] **Step 1: 创建工具确认弹窗 `tool-confirm-dialog.tsx`**

使用 shadcn `Dialog`。展示工具名 + 参数 JSON + 风险提示。确认/拒绝按钮。"以后自动确认"复选框。确认后调用 `/api/agent2/confirm/[token]`。

- [ ] **Step 2: 创建图表渲染器 `chart-renderer.tsx`**

使用原生 `echarts`（`echarts.init` + `setOption` + resize 监听）。仅安装 `echarts`，不需要 `echarts-for-react`。

- [ ] **Step 3: 创建设置弹窗 `settings-dialog.tsx`**

shadcn `Dialog` + `Tabs`。三个选项卡：工具执行（4 个 Switch）、模型管理（渲染 ModelManager）、显示设置（Switch）。从 `/api/agent2/settings` 加载。

- [ ] **Step 4: 创建模型管理组件 `model-manager.tsx`**

模型列表（全局 + 自定义）。添加表单 Dialog。删除确认。API Key 密码输入。

- [ ] **Step 5: 端到端验证**

1. 创建对话 → 发消息 → 流式回复
2. 请求删除记录 → 确认弹窗 → 确认 → 成功
3. 请求图表 → ECharts 渲染
4. 上传 Excel → 内容作为上下文
5. 设置弹窗 → 切换自动确认 → 添加自定义模型
6. 切换模型 → 验证
7. 收藏会话 → 分组正确

- [ ] **Step 6: Commit**

```bash
git add src/components/agent2/tool-confirm-dialog.tsx src/components/agent2/chart-renderer.tsx src/components/agent2/settings-dialog.tsx src/components/agent2/model-manager.tsx
git commit -m "feat(agent2): add confirm dialog, chart renderer, settings dialog"
```

---

## 实现注意事项

1. **Next.js 16 动态路由参数**: `{ params }: { params: Promise<{ id: string }> }` — 必须 `await params`
2. **Prisma v7**: 使用 `import { db } from "@/lib/db"`，不要直接 `new PrismaClient()`
3. **shadcn/ui v4**: Button 用 `render` prop 而不是 `asChild`
4. **AI SDK v6**: `useChat` 返回 `sendMessage`（非 `append`）；消息结构用 `parts` 数组。工具定义字段名需在 Task 1 Step 3 中验证（`inputSchema` vs `parameters`）
5. **Zod v4**: `z.object()` 语法与 v3 基本一致，但注意 `z.coerce` 等行为差异
6. **API Key 加密**: 环境变量 `MODEL_CONFIG_ENCRYPTION_KEY`（32 字节 hex），需在 `.env.local` 中配置
7. **附件处理**: 附件上传逻辑内联在 `chat-area.tsx` 的 PromptInput 配置中（使用 `usePromptInputAttachments` hook + POST `/api/agent2/upload`）
8. **惰性清理过期 token**: 在 `confirm-store.ts` 中实现 `cleanupExpiredTokens()`，在聊天 API 中偶尔调用
