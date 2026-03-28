# 仪表盘链接、字段备注、实时搜索、版本显示 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 4 个独立的 UI 改进：仪表盘卡片链接、占位符备注功能、生成页客户端实时筛选、模板版本号显示。

**Architecture:** 按功能独立拆分为 4 个 Task，每个 Task 可独立验证。功能 2（字段备注）改动链路最长（schema -> types -> validators -> service -> snapshot -> API -> config-table -> fill-page -> dynamic-form），需要严格按照依赖顺序实施。功能 3 将生成页从服务端筛选改为客户端组件。功能 4 为纯查询+展示变更。

**Tech Stack:** Next.js 16 (App Router, `searchParams`/`params` 为 Promise), Prisma 7 (`prisma db push`), shadcn/ui v4 (Base UI, `render` prop), Zod, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-28-dashboard-field-remarks-search-version-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `prisma/schema.prisma` | Placeholder 模型增加 `description` 字段 |
| Modify | `src/types/placeholder.ts` | 三个接口增加 `description` 属性 |
| Modify | `src/validators/placeholder.ts` | Zod schemas 增加 `description` |
| Modify | `src/lib/services/placeholder.service.ts` | `mapPlaceholderItem`、`updatePlaceholder`、`UpdatePlaceholderInput` 增加 `description` |
| Modify | `src/lib/services/template-version.service.ts` | `toSnapshotItem` 增加 `description` 映射 |
| Modify | `src/app/api/placeholders/[id]/route.ts` | PATCH 路由识别 `description` 为 general field |
| Modify | `src/components/templates/placeholder-config-table.tsx` | 表格增加备注列，内联编辑保存 |
| Modify | `src/components/forms/dynamic-form.tsx` | 表单字段显示备注说明文字 |
| Modify | `src/app/(dashboard)/templates/[id]/fill/page.tsx` | 传递 `description` 到 DynamicForm |
| Modify | `src/app/(dashboard)/page.tsx` | 仪表盘卡片标题改为链接 |
| Modify | `src/app/(dashboard)/generate/page.tsx` | 服务端简化为只查数据，去掉 searchParams |
| Create | `src/app/(dashboard)/generate/generate-page-client.tsx` | 客户端实时筛选组件 |
| Modify | `src/app/(dashboard)/templates/page.tsx` | 文件名列改为版本列 |

---

### Task 1: 仪表盘卡片超链接

**Files:**
- Modify: `src/app/(dashboard)/page.tsx`

- [ ] **Step 1: 给 stats 数组增加 href 属性**

在 `src/app/(dashboard)/page.tsx` 中，给 stats 数组的每个对象增加 `href?: string` 属性：

```typescript
  const stats = isAdmin
    ? [
        { label: "可用模板", value: publishedTemplates, icon: CheckCircle, iconColor: "text-green-500", href: "/generate" },
        { label: "模板总数", value: totalTemplates, icon: FileText, iconColor: "text-blue-500", href: "/templates" },
        { label: "总用户数", value: totalUsers, icon: Users, iconColor: "text-indigo-500", href: "/admin/users" },
        { label: "今日生成", value: todayRecords, icon: History, iconColor: "text-orange-500", href: "/records" },
      ]
    : [
        { label: "可用模板", value: publishedTemplates, icon: CheckCircle, iconColor: "text-green-500", href: "/generate" },
        { label: "本月生成", value: monthlyRecords, icon: History, iconColor: "text-orange-500", href: "/records" },
        { label: "我的草稿", value: drafts, icon: PenLine, iconColor: "text-purple-500", href: "/drafts" },
      ];
```

- [ ] **Step 2: CardTitle 用 Link 包裹**

将 CardTitle 部分从：

```tsx
<CardTitle className="text-sm font-medium text-muted-foreground">
  {stat.label}
</CardTitle>
```

改为：

```tsx
<CardTitle className="text-sm font-medium text-muted-foreground">
  {stat.href ? (
    <Link href={stat.href} className="hover:underline">
      {stat.label}
    </Link>
  ) : (
    stat.label
  )}
</CardTitle>
```

- [ ] **Step 3: 验证构建**

Run: `cd /home/z/test-hub/docx-template-system && npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 4: 提交**

```bash
git add src/app/\(dashboard\)/page.tsx
git commit -m "feat: add clickable links to dashboard stat card titles"
```

---

### Task 2: 字段备注 — 数据层（Schema + Types + Validators + Services）

**Files:**
- Modify: `prisma/schema.prisma` (Placeholder model, line ~124)
- Modify: `src/types/placeholder.ts`
- Modify: `src/validators/placeholder.ts`
- Modify: `src/lib/services/placeholder.service.ts`
- Modify: `src/lib/services/template-version.service.ts`

- [ ] **Step 1: Prisma schema 增加 description 字段**

在 `prisma/schema.prisma` 的 Placeholder 模型中，`columns Json?` 行之后、`createdAt` 行之前，增加：

```prisma
  description String?   // 字段备注/说明
```

- [ ] **Step 2: 推送 schema 到数据库并重新生成客户端**

Run: `cd /home/z/test-hub/docx-template-system && npx prisma db push && npx prisma generate`
Expected: 成功，无错误

- [ ] **Step 3: 更新 TypeScript 类型**

在 `src/types/placeholder.ts` 中：

(a) `PlaceholderItem` 接口，`columns` 之后增加：
```typescript
  description: string | null;
```

(b) `PlaceholderWithSource` 接口，`columns` 之后增加：
```typescript
  description: string | null;
```

(c) `PlaceholderSnapshotItem` 接口，`sourceField` 之后、`snapshotVersion` 之前增加：
```typescript
  description: string | null;
```

- [ ] **Step 4: 更新 Zod validators**

在 `src/validators/placeholder.ts` 中：

(a) `placeholderItemSchema` 中 `columns` 之后增加：
```typescript
  description: z.string().nullable().default(null),
```

(b) `updatePlaceholderSchema` 中 `columns` 之后增加：
```typescript
  description: z.string().nullable().optional(),
```

- [ ] **Step 5: 更新 placeholder.service.ts**

(a) `mapPlaceholderItem` 函数的参数类型增加 `description: string | null`，返回值增加 `description: row.description`

修改函数签名为：
```typescript
function mapPlaceholderItem(row: {
  id: string;
  key: string;
  label: string;
  inputType: string;
  required: boolean;
  defaultValue: string | null;
  sortOrder: number;
  sourceTableId: string | null;
  sourceField: string | null;
  enablePicker: boolean;
  columns: unknown;
  description: string | null;
}): PlaceholderItem {
```

在返回对象中增加 `description: row.description`。

(b) `UpdatePlaceholderInput` 接口增加 `description`：
```typescript
export interface UpdatePlaceholderInput {
  key: string;
  label: string;
  inputType: string;
  required: boolean;
  defaultValue: string | null;
  sortOrder: number;
  enablePicker?: boolean;
  sourceTableId?: string | null;
  sourceField?: string | null;
  columns?: { key: string; label: string }[];
  description: string | null;
}
```

(c) `updatePlaceholders` 中的 `createMany` data 映射增加：
```typescript
description: item.description,
```

(d) `updatePlaceholder` 的 data 参数类型增加 `description?: string | null`，并在 `updateData` 构建中增加：
```typescript
if (data.description !== undefined) updateData.description = data.description;
```

- [ ] **Step 6: 更新 template-version.service.ts 的 toSnapshotItem**

(a) `toSnapshotItem` 参数类型增加 `description: string | null`

(b) 返回值中增加 `description: row.description`

修改后的 `toSnapshotItem`：
```typescript
function toSnapshotItem(row: {
  key: string;
  label: string;
  inputType: string;
  required: boolean;
  defaultValue: string | null;
  sortOrder: number;
  enablePicker: boolean;
  sourceTableId: string | null;
  sourceField: string | null;
  description: string | null;
}): PlaceholderSnapshotItem {
  return {
    key: row.key,
    label: row.label,
    inputType: row.inputType as "TEXT" | "TEXTAREA",
    required: row.required,
    defaultValue: row.defaultValue,
    sortOrder: row.sortOrder,
    enablePicker: row.enablePicker,
    sourceTableId: row.sourceTableId,
    sourceField: row.sourceField,
    description: row.description,
    snapshotVersion: 1,
  };
}
```

- [ ] **Step 7: 更新 PATCH 路由的 general fields 判断**

在 `src/app/api/placeholders/[id]/route.ts` 中，`hasGeneralFields` 判断增加 `description`：

```typescript
    const hasGeneralFields =
      body.label !== undefined ||
      body.inputType !== undefined ||
      body.required !== undefined ||
      body.defaultValue !== undefined ||
      body.sortOrder !== undefined ||
      body.description !== undefined;
```

- [ ] **Step 8: 验证构建**

Run: `cd /home/z/test-hub/docx-template-system && npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 9: 提交**

```bash
git add prisma/schema.prisma src/types/placeholder.ts src/validators/placeholder.ts src/lib/services/placeholder.service.ts src/lib/services/template-version.service.ts src/app/api/placeholders/\[id\]/route.ts
git commit -m "feat: add description field to Placeholder model and propagate through types, services, validators"
```

---

### Task 3: 字段备注 — 配置表格 UI

**Files:**
- Modify: `src/components/templates/placeholder-config-table.tsx`

- [ ] **Step 1: PlaceholderRow 接口增加 description**

在 `src/components/templates/placeholder-config-table.tsx` 的 `PlaceholderRow` 接口中，`columns` 之后增加：

```typescript
  description?: string;
```

- [ ] **Step 2: fetchPlaceholders 映射增加 description**

在 `fetchPlaceholders` 回调中，映射对象增加：

```typescript
description: (ph.description as string) ?? "",
```

同样在 `handleParse` 中重新加载数据的映射也增加 `description: (ph.description as string) ?? ""`。同时补上已有映射中缺失的 `columns: ph.columns as TableColumn[] | undefined`。

- [ ] **Step 3: 表格表头增加备注列**

在 `<TableHeader>` 中，`<TableHead>标签</TableHead>` 之后增加：

```tsx
<TableHead className="min-w-[160px]">备注</TableHead>
```

- [ ] **Step 4: 表格数据行增加备注列**

在每行的标签 `<TableCell>` 之后、输入类型 `<TableCell>` 之前，增加备注列：

```tsx
{/* Description - editable */}
<TableCell>
  <Input
    value={row.description ?? ""}
    onChange={(e) =>
      updateRow(index, "description", e.target.value)
    }
    onBlur={() => {
      if (row.id && row.description !== undefined) {
        fetch(`/api/placeholders/${row.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: row.description || null }),
        }).catch(() => {});
      }
    }}
    onKeyDown={(e) => {
      if (e.key === "Enter" && row.id) {
        fetch(`/api/placeholders/${row.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: row.description || null }),
        }).catch(() => {});
      }
    }}
    placeholder="备注说明"
    className="h-7 text-sm"
  />
</TableCell>
```

注意：TABLE 类型的行使用 `colSpan={3}` 覆盖了默认值/排序/数据源三列，增加备注列后需要改为 `colSpan={4}`。

- [ ] **Step 5: 验证构建**

Run: `cd /home/z/test-hub/docx-template-system && npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 6: 提交**

```bash
git add src/components/templates/placeholder-config-table.tsx
git commit -m "feat: add description column to placeholder config table"
```

---

### Task 4: 字段备注 — 填写表单展示

**Files:**
- Modify: `src/components/forms/dynamic-form.tsx`
- Modify: `src/app/(dashboard)/templates/[id]/fill/page.tsx`

- [ ] **Step 1: DynamicForm 的 Placeholder 接口增加 description**

在 `src/components/forms/dynamic-form.tsx` 的 `Placeholder` 接口中，`columns` 之后增加：

```typescript
  description?: string | null;
```

- [ ] **Step 2: DynamicForm 在 label 和 input 之间渲染 description**

在 `{ph.inputType === "TABLE" ? (` 之前，增加 description 渲染：

```tsx
{ph.description && (
  <p className="text-xs text-muted-foreground">{ph.description}</p>
)}
```

这段代码应位于 `<Label>` 组件闭合标签之后、`{ph.inputType === "TABLE" ?` 之前。

- [ ] **Step 3: FillPage 映射传递 description**

在 `src/app/(dashboard)/templates/[id]/fill/page.tsx` 中，`template.placeholders.map` 的返回对象增加：

```typescript
description: p.description,
```

- [ ] **Step 4: 验证构建**

Run: `cd /home/z/test-hub/docx-template-system && npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 5: 提交**

```bash
git add src/components/forms/dynamic-form.tsx src/app/\(dashboard\)/templates/\[id\]/fill/page.tsx
git commit -m "feat: show placeholder description in dynamic form"
```

---

### Task 5: 生成文档页客户端实时筛选

**Files:**
- Modify: `src/app/(dashboard)/generate/page.tsx`
- Create: `src/app/(dashboard)/generate/generate-page-client.tsx`

- [ ] **Step 1: 创建客户端组件 generate-page-client.tsx**

创建 `src/app/(dashboard)/generate/generate-page-client.tsx`。注意：当前服务端查询没有 select `categoryId`，只有 `category: { name }`，客户端筛选需要精确匹配 categoryId，所以 TemplateItem 接口和筛选逻辑都使用 `categoryId` 直接匹配：

```tsx
"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, FileOutput, Search } from "lucide-react";

interface TemplateItem {
  id: string;
  name: string;
  categoryId: string | null;
  createdAt: string;
  category: { name: string } | null;
  tags: { tag: { id: string; name: string } }[];
  currentVersion: { version: number } | null;
}

interface GeneratePageClientProps {
  templates: TemplateItem[];
  categories: { id: string; name: string }[];
  allTags: { id: string; name: string }[];
}

export function GeneratePageClient({ templates, categories, allTags }: GeneratePageClientProps) {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [tagIds, setTagIds] = useState<string[]>([]);

  const filtered = useMemo(() => {
    return templates.filter((t) => {
      if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (categoryId && t.categoryId !== categoryId) return false;
      if (tagIds.length > 0 && !tagIds.some((tid) => t.tags.some((tTag) => tTag.tag.id === tid)))
        return false;
      return true;
    });
  }, [templates, search, categoryId, tagIds]);

  const toggleTag = (tagId: string) => {
    setTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const hasActiveFilters = search || categoryId || tagIds.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">生成文档</h1>
        <p className="text-muted-foreground">
          选择一个模板，填写内容后即可生成文档
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索模板..."
          className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
        />
      </div>

      {/* Category tabs */}
      {categories.length > 0 && (
        <div className="flex gap-1 overflow-x-auto">
          <button
            onClick={() => setCategoryId(null)}
            className={`shrink-0 px-3 py-1.5 text-sm rounded-md border transition-colors ${
              !categoryId
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
            }`}
          >
            全部
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryId(cat.id === categoryId ? null : cat.id)}
              className={`shrink-0 px-3 py-1.5 text-sm rounded-md border transition-colors ${
                categoryId === cat.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Tag filter bar */}
      {allTags.length > 0 && (
        <div className="flex gap-1 overflow-x-auto">
          {allTags.map((tag) => {
            const isSelected = tagIds.includes(tag.id);
            return (
              <button
                key={tag.id}
                onClick={() => toggleTag(tag.id)}
                className={`shrink-0 px-2.5 py-1 text-xs rounded-full border transition-colors ${
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                }`}
              >
                {tag.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Empty state: no templates at all (no filters active) */}
      {templates.length === 0 && !hasActiveFilters ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <FileOutput className="h-12 w-12 text-muted-foreground/50" />
          <h2 className="mt-4 text-lg font-semibold">暂无可用模板</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            需要先上传并配置模板后才能生成文档
          </p>
          <Link
            href="/templates"
            className="mt-4 text-sm font-medium text-primary hover:underline"
          >
            前往模板管理
          </Link>
        </div>
      ) : filtered.length === 0 ? null : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((t) => (
            <Link key={t.id} href={`/templates/${t.id}/fill`}>
              <Card className="h-full transition-colors hover:bg-accent cursor-pointer">
                <CardContent className="flex flex-col gap-3 p-5">
                  <div className="flex items-start gap-3">
                    <FileText className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <h3 className="font-semibold leading-tight truncate">
                        {t.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        {t.currentVersion && (
                          <Badge variant="secondary" className="text-xs">
                            v{t.currentVersion.version}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {new Date(t.createdAt).toLocaleDateString("zh-CN")}
                        </span>
                      </div>
                    </div>
                  </div>
                  {t.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {t.tags.slice(0, 3).map((tt) => (
                        <Badge key={tt.tag.id} variant="secondary" className="text-xs">
                          {tt.tag.name}
                        </Badge>
                      ))}
                      {t.tags.length > 3 && (
                        <span className="text-xs text-muted-foreground">+{t.tags.length - 3}</span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Empty results with active filters */}
      {hasActiveFilters && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <Search className="h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">没有找到匹配的模板</p>
          <button
            onClick={() => { setSearch(""); setCategoryId(null); setTagIds([]); }}
            className="mt-2 text-sm font-medium text-primary hover:underline"
          >
            清除筛选条件
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 简化服务端 generate/page.tsx**

修改 `src/app/(dashboard)/generate/page.tsx`：移除所有 `searchParams` 处理、`buildUrl` 函数、`where` 条件构建、`form` 标签。简化为纯数据查询 + 传递给客户端组件：

```tsx
import { db } from "@/lib/db";
import { GeneratePageClient } from "./generate-page-client";

export default async function GeneratePage() {
  const [categories, allTags, templates] = await Promise.all([
    db.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    db.tag.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.template.findMany({
      where: { status: "PUBLISHED" },
      select: {
        id: true,
        name: true,
        categoryId: true,
        createdAt: true,
        category: { select: { name: true } },
        tags: { select: { tag: { select: { id: true, name: true } } } },
        currentVersion: { select: { version: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <GeneratePageClient
      templates={templates.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() }))}
      categories={categories}
      allTags={allTags}
    />
  );
}
```

- [ ] **Step 3: 验证构建**

Run: `cd /home/z/test-hub/docx-template-system && npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 4: 提交**

```bash
git add src/app/\(dashboard\)/generate/page.tsx src/app/\(dashboard\)/generate/generate-page-client.tsx
git commit -m "feat: convert generate page to client-side real-time filtering"
```

---

### Task 6: 模板管理页版本号替换文件名

**Files:**
- Modify: `src/app/(dashboard)/templates/page.tsx`

- [ ] **Step 1: 在查询 select 中增加 currentVersion**

在 `src/app/(dashboard)/templates/page.tsx` 的 `db.template.findMany` 的 `select` 对象中，`tags` 之后增加：

```typescript
        currentVersion: { select: { version: true } },
```

- [ ] **Step 2: 修改表头**

将 `<TableHead>文件名</TableHead>` 改为 `<TableHead>版本</TableHead>`。

- [ ] **Step 3: 修改表格数据单元**

将文件名列的渲染：

```tsx
<TableCell className="text-muted-foreground max-w-[200px] truncate" title={template.originalFileName}>
  {template.originalFileName || template.fileName}
</TableCell>
```

替换为：

```tsx
<TableCell className="text-muted-foreground">
  {template.currentVersion ? `v${template.currentVersion.version}` : "—"}
</TableCell>
```

- [ ] **Step 4: 验证构建**

Run: `cd /home/z/test-hub/docx-template-system && npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 5: 提交**

```bash
git add src/app/\(dashboard\)/templates/page.tsx
git commit -m "feat: replace filename column with version number in templates list"
```

---

## Verification Checklist

完成所有 Task 后执行端到端验证：

- [ ] `npx tsc --noEmit` — 零类型错误
- [ ] `npm run build` — 构建成功
- [ ] 启动 dev server (`npm run dev`)，用 Playwright 验证：
  - 仪表盘卡片标题可点击并跳转到正确页面
  - 占位符配置表格有备注列，可编辑并保存
  - 填写表单中显示备注说明文字
  - 生成文档页搜索框实时过滤，无需刷新
  - 模板管理页显示版本号而非文件名
  - 生成文档页卡片显示版本 Badge
