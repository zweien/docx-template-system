# AI 助手对话页面设计规格

**日期**: 2026-03-30
**主题**: AI 对话交互页面
**状态**: 已批准

## 1. 概述

为文档模板系统添加 AI 助手功能，允许用户通过自然语言查询和编辑数据库记录。

## 2. 用户场景

- 用户希望用自然语言查询数据表记录
- 用户希望创建、更新、删除数据记录（需管理员确认）
- 用户在数据表页面可快速调用 AI 助手

## 3. 方案概述

采用独立页面 + 可复用抽屉组件的混合方案：

| 入口 | 路由/位置 | 展示形式 |
|------|-----------|----------|
| 独立页面 | `/ai-agent` | 全屏页面 |
| 数据表内嵌 | `/data/[tableId]` | 右侧抽屉 |

## 4. 架构设计

### 4.1 路由结构

```
/ai-agent                    → 独立 AI 助手页面 (全屏)
/data/[tableId]              → 数据表页面 + AI 按钮入口
```

### 4.2 组件层级

```
AIChatPage (独立页面)
└── AIChatWindow (对话核心)
    ├── MessageList (消息列表)
    ├── ChatInput (输入框)
    └── ConfirmAction (确认执行按钮)

AIChatDrawer (抽屉容器)
└── AIChatWindow (复用上述组件)
```

## 5. 组件规格

### 5.1 AIChatWindow 核心组件

**Props:**
```typescript
interface AIChatWindowProps {
  initialTableId?: string;  // 初始选中的表ID
  onClose?: () => void;     // 关闭回调 (抽屉模式用)
  className?: string;
}
```

**内部状态:**
```typescript
interface ChatState {
  messages: ChatMessage[];     // 消息列表
  input: string;               // 输入框内容
  isLoading: boolean;          // AI 响应中
  pendingConfirm: {            // 待确认操作
    confirmToken: string;
    preview: EditPreview;
  } | null;
}
```

### 5.2 消息展示

- **用户消息**: 右侧对齐，背景色 `#e8f4fc`
- **AI 消息**: 左侧对齐，背景色 `#f5f5f5`
- **系统提示**: 黄色背景 `#fff8e1`
- 支持 Markdown 渲染
- 代码块使用等宽字体

### 5.3 确认执行按钮

**触发条件:** AI 响应包含 `confirmToken` 字段

**位置:** 消息列表底部，固定

**样式:**
```css
.confirm-btn {
  background: #22c55e;
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
}
```

**点击行为:**
1. 显示加载状态
2. 调用 `/api/ai-agent/confirm` 接口
3. 成功：显示成功消息，刷新数据
4. 失败：显示错误消息

### 5.4 数据表页面入口

**位置:** `/data/[tableId]` 页面顶部

**按钮样式:** 右侧带图标 "AI 助手"

**点击行为:** 打开右侧抽屉，并自动带入当前 `tableId`

## 6. API 接口

### 6.1 发送消息

**Endpoint:** `POST /api/ai-agent/chat`

**Request:**
```typescript
{
  message: string;           // 用户消息
  tableId?: string;          // 可选，指定表
  history?: ChatHistory[];   // 可选，历史记录
}
```

**Response:** SSE 流式响应
```typescript
// Text chunk
{ "type": "text", "content": "..." }

// Error chunk
{ "type": "error", "content": "错误信息" }

// Confirm chunk (编辑操作)
{
  "type": "confirm",
  "content": "预览信息",
  "preview": { ... },
  "confirmToken": "uuid"
}
```

### 6.2 确认执行

**Endpoint:** `POST /api/ai-agent/confirm`

**Request:**
```typescript
{
  confirmToken: string;  // 确认码
}
```

**Response:**
```typescript
// 成功
{
  "success": true,
  "result": { /* 创建/更新的记录 */ }
}

// 失败
{
  "error": {
    "code": "INVALID_TOKEN",
    "message": "确认令牌无效或已过期"
  }
}
```

## 7. 状态流转

```
                    ┌──────────────┐
                    │   Idle       │
                    └──────┬───────┘
                           │ 用户发送消息
                           ▼
                    ┌──────────────┐
         ┌─────────→│  Loading     │←────────┐
         │          └──────┬───────┘         │
         │                 │                 │
    AI 返回文本        AI 返回确认      网络错误
         │                 │                 │
         ▼                 ▼                 ▼
   ┌──────────┐     ┌──────────────┐  ┌──────────┐
   │ 显示消息 │     │ 显示消息 +    │  │ 显示错误 │
   └──────────┘     │ 确认按钮     │  └──────────┘
                    └──────┬───────┘
                           │ 用户点击确认
                           ▼
                    ┌──────────────┐
                    │  Confirming  │
                    └──────┬───────┘
                           │
                    ┌──────┴──────┐
                    │             │
               成功            失败
                    │             │
                    ▼             ▼
              ┌──────────┐  ┌──────────┐
              │ 显示成功 │  │ 显示错误 │
              └──────────┘  └──────────┘
```

## 8. 错误处理

| 错误类型 | 用户提示 |
|----------|----------|
| UNAUTHORIZED | 请先登录 |
| FORBIDDEN | 仅管理员可执行此操作 |
| INVALID_TOKEN | 确认码已过期，请重新发起操作 |
| EXECUTE_FAILED | 操作失败: {具体错误} |
| LLM_ERROR | AI 响应失败，请重试 |
| NETWORK_ERROR | 网络错误，请检查连接 |

## 9. 安全考虑

- 确认操作需要 ADMIN 权限
- 确认码有效期 30 分钟
- 确认码一次性使用
- 操作日志记录

## 10. 验收标准

1. ✅ 独立页面 `/ai-agent` 可正常访问
2. ✅ 可发送消息并接收 AI 流式响应
3. ✅ 编辑操作显示"确认执行"按钮
4. ✅ 点击确认按钮可成功执行操作
5. ✅ 数据表页面有 AI 助手入口
6. ✅ 右侧抽屉模式正常工作
7. ✅ 错误情况有友好提示

## 11. 待开发文件

```
src/app/(dashboard)/ai-agent/
├── page.tsx              # 独立页面

src/components/ai-chat/
├── ai-chat-window.tsx    # 对话核心组件
├── message-list.tsx      # 消息列表
├── chat-input.tsx        # 输入框
└── confirm-action.tsx    # 确认按钮

src/components/layout/
└── sidebar.tsx           # 添加 AI 助手导航 (可选)
```