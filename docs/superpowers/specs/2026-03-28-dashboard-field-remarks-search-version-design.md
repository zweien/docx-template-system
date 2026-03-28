# 设计文档：仪表盘链接、字段备注、实时搜索、版本显示

日期：2026-03-28

## 概述

4 个独立的 UI 改进项，提升仪表盘导航、表单填写体验、搜索效率和模板信息展示。

## 1. 仪表盘卡片超链接

**文件**: `src/app/(dashboard)/page.tsx`

将统计卡片标题改为可点击链接，跳转到对应页面：

| 卡片 | 管理员 | 普通用户 |
|------|--------|----------|
| 可用模板 | `/generate` | `/generate` |
| 模板总数 | `/templates` | — |
| 总用户数 | `/users` | — |
| 今日生成数 | `/records` | — |
| 本月生成数 | — | `/records` |
| 我的草稿 | — | `/drafts` |

**实现**: Card 标题用 `<Link>` 包裹，添加 `hover:underline` 样式。不改变卡片布局和统计数据逻辑。

## 2. 字段备注（Placeholder Description）

### 数据层

Prisma `Placeholder` 模型新增字段：

```prisma
model Placeholder {
  // ... 现有字段
  description String?   // 字段备注/说明
}
```

同步更新：
- `src/types/placeholder.ts` — `PlaceholderItem` 增加 `description: string | null`；`PlaceholderWithSource` 增加 `description: string | null`；`PlaceholderSnapshotItem` 增加 `description: string | null`
- `src/lib/services/placeholder.service.ts` — `mapPlaceholderItem` 辅助函数的参数类型和返回值增加 `description`；`updatePlaceholder` 单条更新方法的 data 参数增加 `description?: string | null`；`UpdatePlaceholderInput` 批量更新接口增加 `description: string | null`
- `src/lib/services/template-version.service.ts` — `toSnapshotItem` 辅助函数增加 `description` 映射
- `src/validators/placeholder.ts` — `placeholderItemSchema` 增加 `description: z.string().nullable().default(null)`；`updatePlaceholderSchema` 增加 `description: z.string().nullable().optional()`

### 配置入口

**占位符配置表格** (`src/components/templates/placeholder-config-table.tsx`):
- 本地 `PlaceholderRow` 接口增加 `description?: string` 字段
- `fetchPlaceholders` 回调中的映射逻辑增加 `description` 字段
- 表格新增"备注"列，位于"标签"列之后
- 内联文本输入，失焦或回车保存
- 调用 `PATCH /api/placeholders/[id]` 仅更新 `description` 字段（独立于批量保存）
- 批量保存（`handleSave`）通过 `PUT /api/templates/[id]/placeholders` 时也传递 `description`

### 展示入口

**填写表单** (`src/components/forms/dynamic-form.tsx`):
- 组件内本地 `Placeholder` 接口增加 `description?: string | null`
- 每个字段的 label 和 input 之间，如果 `description` 有值，渲染一行说明文字
- 样式: `<p className="text-xs text-muted-foreground">{ph.description}</p>`
- 仅在 description 非空时渲染，无额外间距变化

**填写页数据传递** (`src/app/(dashboard)/templates/[id]/fill/page.tsx`):
- 将 `template.placeholders` 映射到 `DynamicForm` props 时增加 `description: p.description`

示例效果：
```
模板名称 *
填写甲方全称（劳动者姓名）
[___________________]
```

### API 变更

- `PATCH /api/placeholders/[id]` — 接受 `description` 字段更新（在 `updatePlaceholder` 服务方法中增加 `description` 处理）
- `PUT /api/templates/[id]/placeholders` — 批量更新接口中的 `placeholderItemSchema` 已包含 `description`，确保 `updatePlaceholders` 服务的 `createMany` 写入 `description`

## 3. 生成文档页面实时筛选

**文件**: `src/app/(dashboard)/generate/page.tsx`

### 改动

将页面从服务端 URL 搜索改为客户端实时筛选：

1. **服务端**: 一次性查询所有 `PUBLISHED` 模板（包含 category、tags、currentVersion），传给客户端组件
2. **客户端**: 新建 `generate-page-client.tsx` 或将页面改为客户端组件
3. **搜索框**: `<input>` 的 `onChange` 事件实时过滤，不提交表单
4. **分类/标签筛选**: 同样在客户端完成，点击分类/标签时更新 state，不刷新页面
5. **URL 参数**: 不再使用 URL 参数传递筛选状态（全部在客户端 state 管理）

### 筛选逻辑

```typescript
const filtered = templates.filter(t => {
  if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
  if (categoryId && t.categoryId !== categoryId) return false;
  if (tagIds.length > 0 && !tagIds.some(tid => t.tags.some(tTag => tTag.tag.id === tid))) return false;
  return true;
});
```

### 移除内容

- 移除 `<form action="/generate" method="get">`
- 移除隐藏的 `<input type="hidden">` 字段
- 移除 `searchParams` 处理

## 4. 版本号替换文件名

### 模板管理页

**文件**: `src/app/(dashboard)/templates/page.tsx`

- 表格"文件名"列 → 改为"版本"列
- 显示 `v{version}`（有 currentVersion 时），无版本显示 `—`
- 查询时在 select 中增加 `currentVersion: { select: { version: true } }`（当前使用 select 模式，非 include）

### 生成文档页

**文件**: `src/app/(dashboard)/generate/page.tsx`（或新的客户端组件）

- 模板卡片中去掉原始文件名显示
- 改为版本号（如 `v3`），无版本时不显示
- 版本号用小号 Badge 展示

### 查询变更

两个页面的模板查询都需要获取 `currentVersion`：

- **模板管理页** (`templates/page.tsx`): 当前使用 `select` 模式，在现有 select 对象中增加 `currentVersion: { select: { version: true } }`
- **生成文档页** (`generate/page.tsx`): 当前使用 `select` 模式，在现有 select 对象中增加 `currentVersion: { select: { version: true } }`

## 影响范围

| 功能 | 新增文件 | 修改文件 |
|------|----------|----------|
| 仪表盘链接 | 0 | 1 (`src/app/(dashboard)/page.tsx`) |
| 字段备注 | 0 | ~9 (`schema.prisma`, `src/types/placeholder.ts`, `src/validators/placeholder.ts`, `src/lib/services/placeholder.service.ts`, `src/lib/services/template-version.service.ts`, `src/components/templates/placeholder-config-table.tsx`, `src/components/forms/dynamic-form.tsx`, `src/app/(dashboard)/templates/[id]/fill/page.tsx`, `src/app/api/placeholders/[id]/route.ts`) |
| 实时搜索 | 1 (client component) | 1 (`src/app/(dashboard)/generate/page.tsx`) |
| 版本显示 | 0 | 2 (`src/app/(dashboard)/templates/page.tsx`, `src/app/(dashboard)/generate/page.tsx`) |

## 不做的事

- 不改变仪表盘卡片布局和统计逻辑
- 不改变占位符解析逻辑（description 由管理员手动填写）
- 不添加 Markdown/富文本支持（备注为纯文本）
- 不改变 URL 参数路由（生成页筛选完全客户端化）
