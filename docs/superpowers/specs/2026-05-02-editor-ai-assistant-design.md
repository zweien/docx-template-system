# 编辑器 AI 辅助系统设计

> 日期：2026-05-02
> 状态：已批准
> 范围：报告撰写编辑器的 AI 辅助功能扩展

## 背景

当前报告撰写编辑器基于 BlockNote（v0.49），已集成 `@blocknote/xl-ai` 的基础 AI 功能：
- FormattingToolbar 中的 AIToolbarButton（点击进入 xl-ai 内置 AI 对话）
- AIMenuController（处理 AI 响应流和文档操作）
- Slash Menu AI 命令项
- 章节级 AI 生成（独立面板，支持续写/改写）
- Agent2 模型管理（管理员/用户可配置多个 AI 供应商）

**缺失能力**：可配置的预设 AI 操作列表、自由 prompt 输入、侧边栏长对话、选中文本引用、用户自定义模板。

## 方案选择

**选定方案：扩展 xl-ai + 自建侧边栏**

保留 xl-ai 的 AIExtension 和 AIMenuController 处理 AI 响应流，自建 Bubble Menu 操作面板和 AI 侧边栏。渐进式分 4 阶段交付。

未选方案：
- 全自建（工作量大，风险高，需重写 AI 操作流）
- FloatingUI 混合（两套 UI 并存，交互冲突风险）

---

## P1：AI Action 配置系统

### 数据模型

新增 `EditorAIAction` 表：

```prisma
model EditorAIAction {
  id          String   @id @default(cuid())
  name        String                    // 显示名称，如"润色"、"翻译"
  icon        String?                   // 图标（emoji 或 lucide icon key）
  prompt      String                    // Prompt 模板
  category    String   @default("general") // 分组：general/writing/translation/analysis
  scope       String   @default("selection") // 作用域：selection | paragraph | document
  sortOrder   Int      @default(0)      // 排序权重
  isBuiltIn   Boolean  @default(false)  // 系统内置不可删除
  enabled     Boolean  @default(true)

  // 所有权
  userId      String?                   // null = 全局（管理员创建）
  user        User?    @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([userId])
  @@index([category])
}
```

### Prompt 模板变量

`prompt` 字段支持占位符：
- `{{selection}}` — 用户选中的文本
- `{{context}}` — 选中内容的上下文（前后段落）
- `{{instruction}}` — 用户附加指令（自由输入框内容）

服务端渲染时替换为实际值。

### scope 语义

- `selection` — 需用户选中文本才可触发
- `paragraph` — 基于当前光标所在段落
- `document` — 以整篇文档作为上下文

### 种子数据（isBuiltIn = true）

| 名称 | icon | category | scope | prompt 摘要 |
|------|------|----------|-------|------------|
| 润色 | ✨ | writing | selection | 请润色以下文本，改善表达但保持原意 |
| 缩写 | 📝 | writing | selection | 请将以下文本精简缩写，保留核心要点 |
| 扩写 | 📖 | writing | selection | 请扩写以下文本，增加细节和论证 |
| 翻译为英文 | 🌐 | translation | selection | Translate to English |
| 翻译为中文 | 🌐 | translation | selection | 翻译为中文 |
| 纠错 | 🎯 | writing | selection | 请检查以下文本中的语法、拼写、标点错误并修正 |
| 正式语气 | 💼 | writing | selection | 请将以下文本改写为正式语气 |
| 轻松语气 | 😊 | writing | selection | 请将以下文本改写为轻松自然的语气 |

管理员可禁用内置模板，但不可删除。

### API 端点

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/editor-ai/actions` | 获取所有可用 action（全局 + 当前用户） | 登录用户 |
| POST | `/api/editor-ai/actions` | 创建自定义 action | 登录用户 |
| PATCH | `/api/editor-ai/actions/[id]` | 更新 action | 管理员或所有者 |
| DELETE | `/api/editor-ai/actions/[id]` | 删除 action（内置不可删） | 管理员或所有者 |
| POST | `/api/editor-ai/execute` | 执行 AI action | 登录用户 |

### 查询逻辑

```
WHERE (userId IS NULL AND enabled = true)   // 全局启用
   OR (userId = currentUser)                // 用户自建
ORDER BY category, sortOrder
```

全局模板用户可在前端禁用（存入 localStorage 偏好），但不可编辑或删除。

---

## P2：Bubble Menu 增强

### 现有改动

替换 `AIToolbarButtonSafe` 为自建 `AIActionButton`，放在 FormattingToolbar 最右侧。

### AIActionButton

点击后弹出 `AIActionPopover`（基于 shadcn Popover），包含：
1. **顶部**：模型选择器（复用 Agent2 模型列表）
2. **常用操作**：网格布局，渲染全局 action（从 API 获取）
3. **我的模板**：列表布局，渲染用户自建 action，每项可点击 ⚙ 编辑
4. **自由输入**：底部输入框 + 发送按钮，输入自定义指令
5. **底栏**："打开侧边栏进行深度对话 →" 链接

### AIActionExecutor

执行层组件，调用 `/api/editor-ai/execute`：
- 传入 `actionId`（预设操作）或 `prompt`（自由输入）
- 传入选中文本 + 文档上下文
- 复用 `/api/reports/chat` 的 stream 处理模式（injectDocumentStateMessages + toolDefinitions）
- AI 响应直接通过 xl-ai 的文档操作机制应用

### 与 xl-ai 整合策略

| 功能 | 现有方式 | 增强后 |
|------|---------|--------|
| 工具栏 AI 按钮 | AIToolbarButton → AIMenuController | AIActionButton → AIActionPopover |
| Slash Menu AI | getAISlashMenuItems | 保留不变 |
| AI 响应处理 | xl-ai 内部处理文档操作 | 预设操作走自建 executor；自由输入仍走 AIMenuController |
| 章节级 AI 生成 | 独立面板 + /generate API | 保留不变 |

### 组件文件结构

```
src/modules/reports/components/editor/ai/
  AIActionButton.tsx       — 工具栏按钮
  AIActionPopover.tsx      — 弹出操作面板
  AIActionExecutor.tsx     — AI 执行逻辑
  AIActionForm.tsx         — 创建/编辑模板弹窗
  useAIActions.ts          — Hook：获取和管理 AI actions
```

---

## P3：AI 侧边栏面板

### 页面布局

右侧面板改为 **Tab 切换模式**："大纲" | "AI 助手"。避免新增第四栏挤压编辑器空间。

编辑器页面顶部操作栏新增 AI 切换按钮（与"共享"并列）。

### AIChatSidebar 组件

```
┌─────────────────────────┐
│ ✨ AI 助手    [模型▾] [✕] │  ← Header + 模型选择
├─────────────────────────┤
│ 📄 已关联：第三章 市场分析  │  ← 上下文指示器
├─────────────────────────┤
│                         │
│ [系统] 已加载章节上下文     │  ← 对话区域
│                         │
│ [用户] 帮我加入数据支撑    │
│                         │
│ [AI] 建议在以下位置...     │
│  [插入] [替换] [复制]     │  ← 操作按钮
│                         │
├─────────────────────────┤
│ [润色] [扩写] [📌 学术语气]│  ← 快捷操作栏
├─────────────────────────┤
│ 📎 引用卡片区域           │  ← 选中文本附件
│ [输入消息...]      [发送]  │  ← 输入框
└─────────────────────────┘
```

### 上下文感知

- 自动注入当前章节内容作为 AI 上下文
- 切换章节时自动更新上下文并清空对话历史
- 顶部显示关联状态，可手动断开/重新关联

### 选中文本引用为附件

**交互流程**：
1. 用户在编辑器中选中文字
2. 侧边栏自动检测选区变化，输入框上方出现"引用卡片"（蓝色边框，显示文本摘要 + 字数，可关闭）
3. 用户输入指令并发送
4. AI 收到的是：引用文本 + 用户指令的组合 prompt
5. AI 回复下方显示"替换原文"按钮，点击后通过 blockIds 定位并替换编辑器内容

**状态管理**：
```typescript
pinnedSelections: Array<{
  id: string;
  text: string;
  blockIds: string[];
  timestamp: number;
}>
```

**多附件**：支持叠加多个选中文本引用（最多 5 个）。每条消息可携带多个引用。

**"替换原文"操作**：通过 `editorRef` 调用 `editor.replaceBlocks()` 替换原文 block。需要 Markdown → BlockNote block 转换。

### 结果回插

AI 回复下方显示操作按钮：
- **插入到编辑器** — 在当前光标后插入 AI 生成的内容
- **替换选中文本** — 替换当前选中的 block
- **复制** — 复制到剪贴板

### 对话历史

Session 级别（内存中），不持久化到 DB。切换章节时清空。页面刷新时丢失。

### 模型切换

复用 Agent2 的 `resolveModel`。顶部下拉列出可用模型，切换后立即生效。

### API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/editor-ai/chat` | 侧边栏对话（消息历史 + 章节内容上下文 + 模型 ID） |

与 `/api/reports/chat` 的区别：不做文档操作（无 tool calling），纯文本对话 + 上下文注入。更轻量。

**请求体**：
```typescript
{
  messages: Array<{ role: string; content: string }>;
  model: string;              // Agent2 模型 ID
  context?: {                  // 可选上下文
    sectionContent?: string;   // 当前章节内容
    pinnedSelections?: string[]; // 引用的选中文本列表
  };
}
```

**响应**：标准 `streamText` 的 `toTextStreamResponse()`。

---

## P4：用户自定义 Prompt 模板

### 管理员：后台管理页

路径：`/admin/editor-ai`
- CRUD 全局预设模板（userId = null）
- 可禁用/启用内置模板
- 调整排序
- 管理种子数据

### 用户：编辑器内联管理

两处入口：
1. **Bubble Menu** 的"我的模板"区域：点击 ⚙ 编辑，点击"+ 新建模板"打开创建弹窗
2. **侧边栏快捷栏**：标签可右键管理

### 创建/编辑模板弹窗（AIActionForm）

字段：
- **名称**：显示文本（必填）
- **图标**：emoji 选择器（可选）
- **分组**：general / writing / translation / analysis
- **作用域**：selection / paragraph / document
- **Prompt 模板**：文本区域，支持 `{{selection}}` / `{{context}}` / `{{instruction}}` 变量

### 模板共享逻辑

查询：`WHERE (userId IS NULL AND enabled = true) OR userId = currentUser`

用户对全局模板：
- 可见可使用
- 可在前端禁用（localStorage 偏好）
- 不可编辑、删除

用户对个人模板：
- 完全 CRUD

---

## 非功能需求

- **性能**：AI action 列表前端缓存（SWR），避免每次选中文本都请求 API
- **错误处理**：AI 调用失败时显示错误提示，支持重试
- **加载状态**：stream 过程中显示打字动画
- **快捷键**：`Cmd/Ctrl + J` 打开侧边栏，`Cmd/Ctrl + /` 打开 Bubble Menu AI 面板
- **暗色模式**：所有新组件支持 light/dark 主题
