# AI Chat 能力升级 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为现有 AI Chat 增加 ChatGPT 风格双栏界面、真实流式输出、`streamdown` Markdown 渲染、完整会话持久化与基础附件抽取能力，同时保留现有 ai-agent 工具与确认执行链路。

**Architecture:** 采用“聊天产品层 + 聊天应用层 + AI 运行层 + 持久化层”的分层方案。前端围绕会话、消息、附件建立新的页面和组件边界，后端通过新的会话/消息/附件 API 和统一事件协议驱动 UI；当前运行层继续复用 `Vercel AI SDK + src/lib/ai-agent/*`，未来再切 LangGraph。

**Tech Stack:** Next.js 16.2.1、React 19、Prisma、PostgreSQL、Vercel AI SDK、`streamdown`、Zod、Vitest、Testing Library

---

## File Map

### Existing files to modify

- `package.json`
  - 增加 `streamdown` 及附件抽取所需依赖
- `prisma/schema.prisma`
  - 增加 AI 会话、消息、附件相关模型
- `src/app/(dashboard)/ai-agent/page.tsx`
  - 从简单容器升级为双栏聊天页入口
- `src/components/data/table-detail-content.tsx`
  - 将 AI 按钮从抽屉改为跳转新聊天页并带入 `tableId`
- `src/validators/ai-agent.ts`
  - 拆分现有聊天请求 schema，新增会话、消息、附件相关 schema
- `src/lib/ai-agent/types.ts`
  - 扩展消息角色、事件协议、附件与会话类型
- `src/lib/ai-agent/service.ts`
  - 将单次 `generateText` 升级为可消费增量事件的运行层接口
- `src/app/api/ai-agent/confirm/route.ts`
  - 适配新的消息流确认动作展示方式，接口本身尽量保持兼容

### New backend files

- `src/lib/services/ai-conversation.service.ts`
  - 会话 CRUD、自动标题、列表排序
- `src/lib/services/ai-message.service.ts`
  - 消息创建、状态流转、历史拉取
- `src/lib/services/ai-attachment.service.ts`
  - 附件保存、抽取状态管理、摘要生成
- `src/lib/ai-agent/runtime-adapter.ts`
  - 统一 AI 运行层事件输出协议
- `src/lib/ai-agent/stream-events.ts`
  - 定义事件类型、SSE 编码、前端解码约定
- `src/lib/ai-agent/context-window.ts`
  - 历史消息与附件摘要裁剪策略
- `src/lib/attachments/extract-text.ts`
  - 按文件类型执行基础文本抽取
- `src/app/api/ai/conversations/route.ts`
  - 会话列表与创建
- `src/app/api/ai/conversations/[id]/route.ts`
  - 重命名、删除会话
- `src/app/api/ai/conversations/[id]/messages/route.ts`
  - 拉取历史消息、发送新消息并输出流
- `src/app/api/ai/attachments/route.ts`
  - 上传附件并返回附件元数据

### New frontend files

- `src/components/ai-chat/ai-chat-shell.tsx`
  - 双栏工作区布局
- `src/components/ai-chat/conversation-sidebar.tsx`
  - 会话列表与管理操作
- `src/components/ai-chat/conversation-header.tsx`
  - 当前会话标题、表上下文、状态
- `src/components/ai-chat/message-thread.tsx`
  - 消息列表与滚动管理
- `src/components/ai-chat/message-bubble.tsx`
  - 单条消息样式与角色区分
- `src/components/ai-chat/message-markdown.tsx`
  - `streamdown` Markdown 渲染
- `src/components/ai-chat/message-attachments.tsx`
  - 消息附件与抽取状态
- `src/components/ai-chat/composer.tsx`
  - 多行输入与发送控制
- `src/components/ai-chat/attachment-picker.tsx`
  - 选择文件、前端校验、上传触发
- `src/components/ai-chat/confirm-action-card.tsx`
  - 确认执行消息卡片
- `src/components/ai-chat/use-ai-chat-session.ts`
  - 会话、消息流、附件状态的前端状态协调

### Test files

- `src/lib/services/ai-conversation.service.test.ts`
- `src/lib/services/ai-message.service.test.ts`
- `src/lib/services/ai-attachment.service.test.ts`
- `src/lib/ai-agent/stream-events.test.ts`
- `src/lib/ai-agent/context-window.test.ts`
- `src/lib/attachments/extract-text.test.ts`
- `src/components/ai-chat/message-markdown.test.tsx`
- `src/components/ai-chat/use-ai-chat-session.test.tsx`
- `src/app/api/ai/conversations/route.test.ts`
- `src/app/api/ai/conversations/[id]/messages/route.test.ts`

---

## Chunk 1: Foundation and Persistence

### Task 1: Read platform constraints and lock dependency changes

**Files:**
- Modify: `package.json`
- Check: `node_modules/next/dist/docs/`
- Check: `docs/superpowers/specs/2026-03-30-ai-chat-upgrade-design.md`

- [ ] **Step 1: Read the relevant Next.js 16 docs before coding**

Run: `rg -n "route handlers|stream|request|server components|client components" "node_modules/next/dist/docs"`
Expected: 找到与 Route Handlers、流式响应、客户端边界相关的官方说明。

- [ ] **Step 2: Decide exact new dependencies**

Add minimal packages only:
- `streamdown`
- 如附件解析确需额外包，再限定到本轮支持类型最少集合

- [ ] **Step 3: Install dependencies and verify lockfile**

Run: `npm install`
Expected: `package-lock.json` 更新且无依赖冲突。

- [ ] **Step 4: Run a smoke check**

Run: `npm run lint`
Expected: 不因依赖变更引入新的全局 lint 失败。

### Task 2: Add Prisma models for conversations, messages, and attachments

**Files:**
- Modify: `prisma/schema.prisma`
- Check: `src/generated/prisma/`

- [ ] **Step 1: Write the schema changes**

Add models:
- `AiConversation`
- `AiMessage`
- `AiAttachment`
- `AiMessageAttachment`

Include:
- conversation/message/attachment statuses
- `runtime` and `metadata` minimal extension fields
- proper relations to `User`

- [ ] **Step 2: Format and validate Prisma schema**

Run: `npx prisma format`
Expected: schema 格式化成功。

- [ ] **Step 3: Generate Prisma client**

Run: `npx prisma generate`
Expected: Prisma client 生成成功，无 schema error。

- [ ] **Step 4: Create and review migration**

Run: `npx prisma migrate dev --name add_ai_chat_persistence`
Expected: 生成包含新表与索引的迁移文件。

### Task 3: Add backend types and validation schemas

**Files:**
- Modify: `src/validators/ai-agent.ts`
- Modify: `src/lib/ai-agent/types.ts`
- Test: `src/lib/ai-agent/stream-events.test.ts`

- [ ] **Step 1: Extend shared types**

Add:
- conversation summary type
- persisted message type
- attachment type
- stream event union
- message status enum-compatible string unions

- [ ] **Step 2: Extend Zod schemas**

Add schemas for:
- create conversation
- rename conversation
- create message with attachment IDs
- attachment upload response payload

- [ ] **Step 3: Add failing tests for event encode/decode**

Test cases:
- `text-delta` event payload shape
- `confirm-required` event payload shape
- invalid event rejected

- [ ] **Step 4: Implement minimal event helpers**

Create `src/lib/ai-agent/stream-events.ts` with:
- event type guards
- SSE line encoder
- helper to serialize typed events

- [ ] **Step 5: Run targeted tests**

Run: `npm run test:run -- src/lib/ai-agent/stream-events.test.ts`
Expected: PASS

### Task 4: Build persistence services for conversations and messages

**Files:**
- Create: `src/lib/services/ai-conversation.service.ts`
- Create: `src/lib/services/ai-message.service.ts`
- Test: `src/lib/services/ai-conversation.service.test.ts`
- Test: `src/lib/services/ai-message.service.test.ts`

- [ ] **Step 1: Write failing tests for conversation CRUD**

Cover:
- create conversation with optional `initialTableId`
- list conversations ordered by `lastMessageAt desc`
- rename conversation
- delete conversation owned by current user only

- [ ] **Step 2: Implement minimal conversation service**

Methods:
- `createConversation`
- `listConversationsByUser`
- `renameConversation`
- `deleteConversation`
- `maybeGenerateConversationTitle`

- [ ] **Step 3: Write failing tests for message persistence**

Cover:
- create user message
- create streaming assistant placeholder
- finalize assistant message
- mark message failed
- get conversation history with attachments

- [ ] **Step 4: Implement minimal message service**

Methods:
- `createUserMessage`
- `createAssistantPlaceholder`
- `appendAssistantContent` if needed
- `completeAssistantMessage`
- `failAssistantMessage`
- `listMessagesByConversation`

- [ ] **Step 5: Run service tests**

Run: `npm run test:run -- src/lib/services/ai-conversation.service.test.ts src/lib/services/ai-message.service.test.ts`
Expected: PASS

### Task 5: Implement attachment storage and text extraction foundation

**Files:**
- Create: `src/lib/services/ai-attachment.service.ts`
- Create: `src/lib/attachments/extract-text.ts`
- Test: `src/lib/services/ai-attachment.service.test.ts`
- Test: `src/lib/attachments/extract-text.test.ts`
- Check: `src/lib/constants/upload.ts`

- [ ] **Step 1: Define supported file and size policy**

Use current upload conventions from `src/lib/constants/upload.ts` where possible.
Support only:
- `txt`
- `md`
- `csv`
- `pdf`
- `docx`
- `xlsx`

- [ ] **Step 2: Write failing extraction tests**

Cover:
- plain text extraction
- markdown extraction
- CSV flattening to text
- unsupported file type failure

- [ ] **Step 3: Implement minimal extraction pipeline**

Keep implementation simple:
- pure text formats first
- document formats only to text
- no semantic chunking

- [ ] **Step 4: Implement attachment service**

Methods:
- `saveAttachment`
- `markAttachmentProcessing`
- `completeAttachmentExtraction`
- `failAttachmentExtraction`
- `listAttachmentsByMessage`

- [ ] **Step 5: Run attachment tests**

Run: `npm run test:run -- src/lib/attachments/extract-text.test.ts src/lib/services/ai-attachment.service.test.ts`
Expected: PASS

---

## Chunk 2: AI Runtime and APIs

### Task 6: Introduce runtime adapter and context windowing

**Files:**
- Create: `src/lib/ai-agent/runtime-adapter.ts`
- Create: `src/lib/ai-agent/context-window.ts`
- Modify: `src/lib/ai-agent/service.ts`
- Test: `src/lib/ai-agent/context-window.test.ts`

- [ ] **Step 1: Write failing tests for context trimming**

Cover:
- recent N messages retained
- attachment summaries truncated
- empty history handled

- [ ] **Step 2: Implement context window helper**

Functions:
- `selectRecentMessages`
- `summarizeAttachmentContext`
- `buildConversationContext`

- [ ] **Step 3: Wrap current ai-agent service behind adapter**

Adapter output must emit typed events:
- `message-created`
- `text-delta`
- `message-completed`
- `confirm-required`
- `error`

- [ ] **Step 4: Refactor service to support incremental text events**

Avoid returning only final `text`.
If the current SDK path cannot emit deltas immediately, isolate the limitation inside adapter and keep external protocol stable.

- [ ] **Step 5: Run adapter and context tests**

Run: `npm run test:run -- src/lib/ai-agent/context-window.test.ts`
Expected: PASS

### Task 7: Add conversation and message APIs

**Files:**
- Create: `src/app/api/ai/conversations/route.ts`
- Create: `src/app/api/ai/conversations/[id]/route.ts`
- Create: `src/app/api/ai/conversations/[id]/messages/route.ts`
- Modify: `src/app/api/ai-agent/chat/route.ts`
- Test: `src/app/api/ai/conversations/route.test.ts`
- Test: `src/app/api/ai/conversations/[id]/messages/route.test.ts`

- [ ] **Step 1: Write failing tests for conversation routes**

Cover:
- auth required
- create conversation
- list current user conversations only
- rename conversation
- delete conversation

- [ ] **Step 2: Implement conversation route handlers**

Reuse project auth pattern from existing API routes.

- [ ] **Step 3: Write failing tests for message streaming route**

Cover:
- user message persisted first
- assistant placeholder created
- SSE headers correct
- confirm event serialized correctly
- runtime error marks assistant message failed

- [ ] **Step 4: Implement message route handlers**

Behavior:
- `GET` returns persisted history
- `POST` persists user message, starts runtime stream, updates assistant status

- [ ] **Step 5: Reduce old `/api/ai-agent/chat` to compatibility wrapper or deprecate safely**

Do not break existing callers until frontend migration lands.

- [ ] **Step 6: Run route tests**

Run: `npm run test:run -- src/app/api/ai/conversations/route.test.ts src/app/api/ai/conversations/[id]/messages/route.test.ts`
Expected: PASS

### Task 8: Add attachment upload API

**Files:**
- Create: `src/app/api/ai/attachments/route.ts`
- Modify: `src/lib/services/ai-attachment.service.ts`
- Test: `src/lib/services/ai-attachment.service.test.ts`

- [ ] **Step 1: Write failing tests for upload validation**

Cover:
- unsupported mime rejected
- oversize file rejected
- valid file stored and metadata returned

- [ ] **Step 2: Implement upload route**

Behavior:
- authenticate user
- accept multipart upload
- save file and metadata
- trigger extraction
- return attachment record

- [ ] **Step 3: Add extraction status transitions**

Return or expose:
- `pending`
- `processing`
- `completed`
- `failed`

- [ ] **Step 4: Run targeted tests**

Run: `npm run test:run -- src/lib/services/ai-attachment.service.test.ts`
Expected: PASS

---

## Chunk 3: Frontend Chat Experience

### Task 9: Replace single chat client with structured shell and state hook

**Files:**
- Create: `src/components/ai-chat/ai-chat-shell.tsx`
- Create: `src/components/ai-chat/use-ai-chat-session.ts`
- Modify: `src/app/(dashboard)/ai-agent/page.tsx`
- Test: `src/components/ai-chat/use-ai-chat-session.test.tsx`

- [ ] **Step 1: Write failing tests for session state flow**

Cover:
- initial conversation load
- send message inserts optimistic user message
- stream updates assistant content incrementally
- switching conversation loads history

- [ ] **Step 2: Implement session hook**

Responsibilities:
- list/create/select conversations
- load history
- send message
- consume SSE events
- track pending attachments

- [ ] **Step 3: Implement shell component**

Structure:
- sidebar region
- main conversation region
- responsive collapse behavior

- [ ] **Step 4: Wire the page entry**

`src/app/(dashboard)/ai-agent/page.tsx` should parse `tableId` from search params and pass initial context to shell.

- [ ] **Step 5: Run frontend session tests**

Run: `npm run test:run -- src/components/ai-chat/use-ai-chat-session.test.tsx`
Expected: PASS

### Task 10: Implement conversation sidebar and header

**Files:**
- Create: `src/components/ai-chat/conversation-sidebar.tsx`
- Create: `src/components/ai-chat/conversation-header.tsx`
- Modify: `src/components/ai-chat/ai-chat-shell.tsx`

- [ ] **Step 1: Build sidebar UI**

Features:
- new conversation
- list recent conversations
- highlight current conversation
- rename
- delete

- [ ] **Step 2: Build header UI**

Features:
- title
- bound table context indicator
- status badges if useful

- [ ] **Step 3: Integrate with shell**

Ensure shell remains layout-only; avoid moving business logic into presentational components.

- [ ] **Step 4: Run lint on touched frontend files**

Run: `npm run lint`
Expected: 新组件无 lint 问题。

### Task 11: Implement message thread, Markdown rendering, and confirm card

**Files:**
- Create: `src/components/ai-chat/message-thread.tsx`
- Create: `src/components/ai-chat/message-bubble.tsx`
- Create: `src/components/ai-chat/message-markdown.tsx`
- Create: `src/components/ai-chat/confirm-action-card.tsx`
- Test: `src/components/ai-chat/message-markdown.test.tsx`

- [ ] **Step 1: Write failing tests for Markdown rendering**

Cover:
- heading/list/code block render
- incremental text growth does not crash
- plain text fallback

- [ ] **Step 2: Implement `message-markdown.tsx` using `streamdown`**

Keep renderer focused on content only.

- [ ] **Step 3: Implement message bubble and thread**

Support:
- user / assistant / system roles
- streaming state
- auto-scroll on new deltas

- [ ] **Step 4: Implement confirm action card**

Render inside message flow and call existing confirm API.

- [ ] **Step 5: Run Markdown tests**

Run: `npm run test:run -- src/components/ai-chat/message-markdown.test.tsx`
Expected: PASS

### Task 12: Implement composer and attachment picker

**Files:**
- Create: `src/components/ai-chat/composer.tsx`
- Create: `src/components/ai-chat/attachment-picker.tsx`
- Create: `src/components/ai-chat/message-attachments.tsx`
- Modify: `src/components/ai-chat/use-ai-chat-session.ts`

- [ ] **Step 1: Build multi-line composer**

Features:
- textarea input
- send button
- disabled/loading states

- [ ] **Step 2: Build attachment picker**

Features:
- choose files
- validate type and size
- upload before send
- show pending status

- [ ] **Step 3: Render message attachments**

Show:
- file name
- type / size
- extract status
- extraction error if any

- [ ] **Step 4: Integrate composer with session hook**

Do not let upload state leak into layout components.

- [ ] **Step 5: Run lint and relevant tests**

Run: `npm run lint`
Expected: 通过或仅剩与本任务无关的既有问题。

### Task 13: Migrate table detail AI entry to route navigation

**Files:**
- Modify: `src/components/data/table-detail-content.tsx`

- [ ] **Step 1: Remove in-place sheet-based chat entry**

Delete only the AI drawer wiring; avoid unrelated table page refactors.

- [ ] **Step 2: Add route-based entry**

Use link or router navigation to:
- `/ai-agent?tableId=<tableId>`

- [ ] **Step 3: Verify table-context bootstrap manually**

Run: `npm run dev`
Expected: 在数据表详情页点击 AI 按钮后跳转到聊天页，并显示当前表上下文。

---

## Chunk 4: End-to-End Verification and Cleanup

### Task 14: Backfill compatibility, regression tests, and cleanup

**Files:**
- Modify: `src/components/ai-chat/ai-chat-client.tsx`
- Modify: `src/components/ai-chat/message-list.tsx`
- Modify: `src/components/ai-chat/chat-input.tsx`
- Modify: `src/components/ai-chat/confirm-action.tsx`
- Check: all new AI chat files

- [ ] **Step 1: Remove or slim obsolete components**

Choice:
- keep thin compatibility exports, or
- delete dead code if no imports remain

- [ ] **Step 2: Verify old imports are gone**

Run: `rg -n "AIChatClient|MessageList|ChatInput|ConfirmAction" "src"`
Expected: 仅保留新结构需要的兼容引用，或完全无旧引用。

- [ ] **Step 3: Run focused regression suite**

Run: `npm run test:run -- src/lib/ai-agent src/lib/services src/components/ai-chat`
Expected: 新旧相关测试通过。

- [ ] **Step 4: Run full lint and targeted app smoke test**

Run: `npm run lint`
Expected: 无新增 lint 问题。

### Task 15: Manual verification checklist

**Files:**
- Check: running app

- [ ] **Step 1: Verify conversation management**

Manual checks:
- create conversation
- rename conversation
- delete conversation
- switch conversation and restore history

- [ ] **Step 2: Verify streaming and Markdown**

Manual checks:
- assistant text appears incrementally
- code block renders correctly
- long response remains scrollable

- [ ] **Step 3: Verify attachments**

Manual checks:
- upload supported file
- processing status visible
- completed summary participates in subsequent response

- [ ] **Step 4: Verify confirm flow**

Manual checks:
- trigger edit action
- confirm card appears in message flow
- confirm succeeds or fails with visible system message

- [ ] **Step 5: Verify table-entry flow**

Manual checks:
- open table detail
- click AI button
- land on `/ai-agent?tableId=...`
- first conversation shows current table context

---

## Notes for the Implementer

- 优先遵循 spec：`docs/superpowers/specs/2026-03-30-ai-chat-upgrade-design.md`
- 不要在第一阶段引入 LangGraph 或向量检索逻辑
- 不要把所有前端状态重新堆回单个 `AIChatClient`
- 任何附件解析实现都应坚持“基础文本抽取”边界
- 若 `Vercel AI SDK` 当前用法无法直接提供理想的 token 级流，优先保证外部协议稳定，再局部替换运行层实现
- 如需改动 Next.js 16 路由或流式响应写法，先查 `node_modules/next/dist/docs/` 官方文档

Plan complete and saved to `docs/superpowers/plans/2026-03-30-ai-chat-upgrade.md`. Ready to execute?
