# 数据表页面 AI 助手改为 agent2 右侧抽屉对话

## 概述

将数据表详情页右上角的「AI 助手」按钮从跳转独立页面改为在当前页面右侧 Sheet 抽屉中展开 agent2 对话界面，对话上下文自动关联当前数据表。

## 方案选择

**采用方案 A：直接复用 ChatArea 组件**。最小改动，复用 agent2 完整聊天能力（流式响应、工具确认、附件等），仅通过可选 props 适配嵌入式场景。

## 组件结构

### 改动文件

1. **`src/components/data/table-detail-content.tsx`** — AI 助手按钮改为 Sheet 触发，内嵌 ChatArea
2. **`src/components/agent2/chat-area.tsx`** — `onToggleSidebar` 和 `sidebarCollapsed` 改为可选 props，新增 `tableId` 可选 prop
3. **`src/app/api/agent2/conversations/[id]/chat/route.ts`** — 从 body 中提取 `tableId`，查询数据表信息注入 system prompt

### 交互流程

1. 用户点击「AI 助手」按钮 → 右侧 Sheet 滑出（不离开页面）
2. 首次打开时调用 `POST /api/agent2/conversations` 创建新对话，title 设为 `"数据表: {tableName}"`
3. 创建成功后用返回的 `id` 渲染 `ChatArea`
4. 关闭 Sheet → conversationId 重置为 null，下次打开创建新对话
5. `tableId` 通过 chat API body 传递给后端

### 状态管理

状态全部在 `table-detail-content.tsx` 中管理：

```typescript
const [aiOpen, setAiOpen] = useState(false)
const [conversationId, setConversationId] = useState<string | null>(null)
```

打开时创建对话、关闭时重置，不做跨 session 持久化。

## 数据表上下文传递

1. ChatArea 新增可选 `tableId` prop
2. `useChat` 的 body 中携带 `tableId`
3. Chat API route 从 body 取 `tableId`，查询数据表信息（表名、字段列表、字段类型等）
4. 后端在构建 system prompt 时注入数据表上下文

这样 AI 能感知当前数据表，回答关于字段、记录等问题。

## Sheet 布局

### 桌面端

- Sheet 从右侧滑出，宽度 `sm:max-w-lg`（比默认 sm 更宽，聊天需要更多空间）
- SheetContent 内直接渲染 ChatArea，占满高度
- 不使用 SheetHeader/SheetTitle（ChatArea 自带 header）

### 移动端

- Sheet 全屏宽度（`w-full`），提供完整聊天空间
- ChatArea 已有的移动端菜单按钮隐藏（嵌入式无侧边栏）

### ChatArea header 适配

- 嵌入式模式（`onToggleSidebar` 未提供）时隐藏 sidebar 切换按钮
- Sheet 自带的关闭按钮在右上角

## 验收标准

- [ ] 点击 AI 助手按钮，右侧抽屉滑出，不离开当前页面
- [ ] 抽屉内展示 agent2 对话界面，支持发送消息和接收流式回复
- [ ] AI 能感知当前数据表上下文（表名、字段等）
- [ ] 关闭抽屉后重新打开，创建新对话
- [ ] 移动端适配（全屏 Sheet）
