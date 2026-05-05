# 加载体验与错误边界优化设计

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 统一所有 dashboard 页面的加载状态和错误处理体验，消除白屏等待，提供一致的操作反馈。

**Architecture:** 4 种骨架屏模板覆盖 35+ 路由，全局 + 路由级错误边界，统一 Toast 通知规范。

**Tech Stack:** Next.js 16 Suspense, React Error Boundary, Tailwind CSS skeleton animations, Sonner toast.

**GitHub Issue:** #152

---

## 1. 骨架屏模板

创建 4 种可复用的骨架屏组件，放在 `src/components/shared/skeletons/` 目录。

### 1.1 组件结构

```
src/components/shared/skeletons/
├── list-page-skeleton.tsx      # 列表页（表格 + 筛选）
├── detail-page-skeleton.tsx    # 详情页（面包屑 + 卡片）
├── form-page-skeleton.tsx      # 表单页（标题 + 字段组）
├── special-skeleton.tsx        # 特殊页面（数据表、报告编辑器、AI 助手）
└── index.ts                    # barrel export
```

### 1.2 通用 Skeleton 基础组件

在 `src/components/ui/skeleton.tsx` 中创建基础骨架块（如果不存在），使用 Tailwind animate-pulse：

```tsx
// 灰色脉冲背景块
<div className="animate-pulse rounded-md bg-muted/40" />
```

### 1.3 ListPageSkeleton

适用于：`/templates`, `/records`, `/drafts`, `/collections`, `/automations`, `/admin/users`, `/admin/audit-logs`, `/reports/drafts`, `/reports/templates`, `/data`, `/generate`

布局：
- PageHeader 区域（标题行 + 描述行）
- 筛选栏（2-3 个圆角矩形标签占位）
- 表格/卡片区域（5 行高度 48px 的横条，间距 8px）

### 1.4 DetailPageSkeleton

适用于：`/templates/[id]`, `/records/[id]`, `/collections/[id]`, `/automations/[id]`, `/data/[tableId]/fields`, `/budget`

布局：
- Breadcrumbs 区域（2 个短条）
- 大卡片区域（高度约 200px）
- 内容区域（3-4 个横条，宽窄交替）

### 1.5 FormPageSkeleton

适用于：`/templates/[id]/fill`, `/templates/[id]/edit`, `/templates/new`, `/collections/new`, `/automations/new`, `/data/[tableId]/new`, `/data/[tableId]/[recordId]/edit`, `/data/[tableId]/import`, `/templates/[id]/batch`

布局：
- PageHeader 区域
- 4 组表单字段（每组：标签行 80px 宽 + 输入框 100% 宽 40px 高）

### 1.6 SpecialSkeleton

三个特殊变体：

**DataTableSkeleton**（`/data/[tableId]`）：
- 工具栏（按钮组占位）
- 表格头（8 列）
- 5 行数据行

**ReportEditorSkeleton**（`/reports/drafts/[id]`）：
- 左侧章节面板（窄条）
- 中间编辑区域（大面积）
- 右侧 AI 面板折叠态

**AiAgentSkeleton**（`/ai-agent2`）：
- 左侧对话列表（窄条 x 10）
- 右侧对话区域（气泡占位 + 输入框）

---

## 2. loading.tsx 部署

### 2.1 部署策略

使用 Next.js 的 Suspense + `loading.tsx` 机制。在每个路由目录放置 `loading.tsx`，引用对应的骨架屏组件。

### 2.2 路由级 loading.tsx 映射

| 路由 | 骨架屏类型 |
|------|-----------|
| `(dashboard)/loading.tsx` | ListPageSkeleton（首页工作台） |
| `(dashboard)/about/loading.tsx` | DetailPageSkeleton |
| `(dashboard)/generate/loading.tsx` | ListPageSkeleton |
| `(dashboard)/templates/loading.tsx` | ListPageSkeleton |
| `(dashboard)/templates/new/loading.tsx` | FormPageSkeleton |
| `(dashboard)/templates/[id]/loading.tsx` | DetailPageSkeleton |
| `(dashboard)/templates/[id]/edit/loading.tsx` | FormPageSkeleton |
| `(dashboard)/templates/[id]/fill/loading.tsx` | FormPageSkeleton |
| `(dashboard)/templates/[id]/batch/loading.tsx` | FormPageSkeleton |
| `(dashboard)/records/loading.tsx` | ListPageSkeleton |
| `(dashboard)/records/[id]/loading.tsx` | DetailPageSkeleton |
| `(dashboard)/drafts/loading.tsx` | ListPageSkeleton |
| `(dashboard)/data/loading.tsx` | ListPageSkeleton |
| `(dashboard)/data/[tableId]/loading.tsx` | SpecialSkeleton(DataTable) |
| `(dashboard)/data/[tableId]/fields/loading.tsx` | FormPageSkeleton |
| `(dashboard)/data/[tableId]/new/loading.tsx` | FormPageSkeleton |
| `(dashboard)/data/[tableId]/import/loading.tsx` | FormPageSkeleton |
| `(dashboard)/data/[tableId]/[recordId]/edit/loading.tsx` | FormPageSkeleton |
| `(dashboard)/reports/drafts/loading.tsx` | ListPageSkeleton |
| `(dashboard)/reports/drafts/[id]/loading.tsx` | SpecialSkeleton(ReportEditor) |
| `(dashboard)/reports/templates/loading.tsx` | ListPageSkeleton |
| `(dashboard)/budget/loading.tsx` | DetailPageSkeleton |
| `(dashboard)/collections/loading.tsx` | ListPageSkeleton |
| `(dashboard)/collections/new/loading.tsx` | FormPageSkeleton |
| `(dashboard)/collections/[id]/loading.tsx` | DetailPageSkeleton |
| `(dashboard)/automations/loading.tsx` | ListPageSkeleton |
| `(dashboard)/automations/new/loading.tsx` | FormPageSkeleton |
| `(dashboard)/automations/[id]/loading.tsx` | DetailPageSkeleton |
| `(dashboard)/ai-agent2/loading.tsx` | SpecialSkeleton(AiAgent) |
| `(dashboard)/admin/users/loading.tsx` | ListPageSkeleton |
| `(dashboard)/admin/settings/loading.tsx` | DetailPageSkeleton |
| `(dashboard)/admin/editor-ai/loading.tsx` | DetailPageSkeleton |
| `(dashboard)/admin/audit-logs/loading.tsx` | ListPageSkeleton |

总计 32 个 `loading.tsx` 文件。每个文件仅 3-5 行，引用对应骨架屏组件。

---

## 3. 错误边界

### 3.1 根级错误页面

**`src/app/error.tsx`** — 全局错误边界（必须是客户端组件）

- 显示错误图标 + "页面加载出错" 标题
- 错误消息摘要（不暴露堆栈）
- 两个按钮："重试"（调用 reset()）、"返回首页"
- 样式与 EmptyState 组件一致，居中布局

**`src/app/not-found.tsx`** — 全局 404 页面

- 显示 404 图标 + "页面未找到" 标题
- 搜索框（调用全局搜索对话框）
- "返回首页" 按钮

### 3.2 路由级错误边界

仅在关键操作页面添加 `error.tsx`，提供更具体的恢复建议：

| 路由 | 错误提示 | 恢复动作 |
|------|---------|---------|
| `(dashboard)/error.tsx` | 通用 dashboard 错误 | 重试 + 返回首页 |
| `(dashboard)/templates/[id]/fill/error.tsx` | "表单加载失败" | 重试 + 返回模板列表 |
| `(dashboard)/data/[tableId]/error.tsx` | "数据表加载失败" | 重试 + 返回数据表列表 |
| `(dashboard)/reports/drafts/[id]/error.tsx` | "报告加载失败" | 重试 + 返回报告列表 |

---

## 4. Toast 通知统一规范

### 4.1 Toast 配置

在 `src/components/providers/toast-provider.tsx`（或现有的 Toaster 配置）中统一设置：

```
位置：底部右侧（bottom-right）
成功：duration 3000ms，绿色图标
错误：duration 5000ms，红色图标，带"查看详情"展开
加载中：duration Infinity（手动 dismiss），蓝色图标
```

### 4.2 Toast 使用规范

| 操作类型 | Toast 样式 | 示例 |
|---------|-----------|------|
| 创建成功 | success, 3s | "模板创建成功" |
| 更新成功 | success, 3s | "设置已保存" |
| 删除成功 | success, 3s | "模板已删除" |
| 操作失败 | error, 5s | "生成失败：网络错误" |
| 权限不足 | error, 5s | "无权限执行此操作" |
| 后台任务 | loading → success/error | "正在生成文档..." → "文档生成成功" |

### 4.3 实施方式

创建 `src/lib/toast-helpers.ts` 工具函数，封装常用 toast 调用：

```ts
toastSuccess(message: string)      // 成功，3s
toastError(message: string)        // 错误，5s
toastLoading(message: string)      // 加载中，返回 id
toastDismiss(id: string | number)  // 关闭指定 toast
```

逐步将现有散落的 `toast.success()` / `toast.error()` 调用替换为统一函数（可在后续迭代中完成，不必本次全部替换）。

---

## 5. 不做的事

- 不做移动端专属优化（单独子项目）
- 不做性能优化（虚拟滚动、懒加载 → 子项目 2）
- 不做功能增强（搜索、快捷键 → 子项目 3）
- 不改动现有页面逻辑和 UI 布局
- 不引入新的 UI 库
