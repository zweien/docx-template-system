# 模板分类与标签 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为模板增加分类（Category）和标签（Tag）功能，模板管理页支持分类/标签管理，生成文档页支持搜索和筛选。

**Architecture:** 新增 Category、Tag、TagOnTemplate 三个 Prisma 模型，Template 通过 categoryId 关联分类、通过 TagOnTemplate 多对多关联标签。遵循现有三层后端模式（types → validators → services → API routes）。前端新增分类标签管理 Dialog、分类选择器和标签多选组件，修改模板管理页和生成文档页。

**Tech Stack:** Next.js 16 App Router, Prisma 7, PostgreSQL, shadcn/ui v4 (Base UI), Zod, TypeScript

---

### Task 1: Prisma Schema — 新增 Category、Tag、TagOnTemplate 模型

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: 在 Prisma schema 中添加三个新模型**

在 `Template` 模型之前添加 `Category`、`Tag`、`TagOnTemplate` 模型：

```prisma
model Category {
  id        String     @id @default(cuid())
  name      String     @unique
  sortOrder Int        @default(0)
  createdAt DateTime   @default(now())
  templates Template[]

  @@map("categories")
}

model Tag {
  id        String          @id @default(cuid())
  name      String          @unique
  templates TagOnTemplate[]

  @@map("tags")
}

model TagOnTemplate {
  templateId String
  tagId      String
  template   Template @relation(fields: [templateId], references: [id], onDelete: Cascade)
  tag        Tag      @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([templateId, tagId])
  @@map("tag_on_template")
}
```

- [ ] **Step 2: 修改 Template 模型，添加关联字段**

在 `Template` 模型中添加 `categoryId` 和 `tags` 字段：

```prisma
  categoryId    String?
  category      Category?     @relation(fields: [categoryId], references: [id], ondelete: SetNull)
  tags          TagOnTemplate[]
```

在 `Template` 模型的 `@@index` 区域添加：

```prisma
  @@index([categoryId])
```

- [ ] **Step 3: 推送 schema 到数据库并生成 Prisma Client**

```bash
npx prisma db push
npx prisma generate
```

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add Category, Tag, TagOnTemplate models to Prisma schema"
```

---

### Task 2: TypeScript Types + Zod Validators

**Files:**
- Modify: `src/types/template.ts`
- Create: `src/validators/category.ts`
- Create: `src/validators/tag.ts`

- [ ] **Step 1: 在 `src/types/template.ts` 中添加类型**

在文件末尾添加：

```typescript
// ========== Category & Tag Types ==========

export interface CategoryItem {
  id: string;
  name: string;
  sortOrder: number;
  _count: { templates: number };
}

export interface TagItem {
  id: string;
  name: string;
  _count: { templates: number };
}

export interface TemplateListItemWithCategory extends TemplateListItem {
  categoryName: string | null;
  tags: { id: string; name: string }[];
}
```

- [ ] **Step 2: 创建 `src/validators/category.ts`**

```typescript
import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().min(1, "分类名称不能为空").max(50, "分类名称最长50字符"),
  sortOrder: z.number().int().min(0).default(0),
});

export const updateCategorySchema = createCategorySchema.partial();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
```

- [ ] **Step 3: 创建 `src/validators/tag.ts`**

```typescript
import { z } from "zod";

export const createTagSchema = z.object({
  name: z.string().min(1, "标签名称不能为空").max(30, "标签名称最长30字符"),
});

export type CreateTagInput = z.infer<typeof createTagSchema>;
```

- [ ] **Step 4: Commit**

```bash
git add src/types/template.ts src/validators/category.ts src/validators/tag.ts
git commit -m "feat: add category and tag types and validators"
```

---

### Task 3: Category Service + API Routes

**Files:**
- Create: `src/lib/services/category.service.ts`
- Create: `src/app/api/categories/route.ts`
- Create: `src/app/api/categories/[id]/route.ts`

- [ ] **Step 1: 创建 `src/lib/services/category.service.ts`**

遵循 `data-table.service.ts` 的模式，实现 CRUD：

```typescript
import { db } from "@/lib/db";

type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

export async function listCategories() {
  try {
    const categories = await db.category.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { templates: true } } },
    });
    return { success: true, data: categories };
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取分类列表失败";
    return { success: false, error: { code: "LIST_FAILED", message } };
  }
}

export async function createCategory(data: { name: string; sortOrder: number }) {
  try {
    const category = await db.category.create({ data });
    return { success: true, data: category };
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return { success: false, error: { code: "DUPLICATE_NAME", message: "分类名称已存在" } };
    }
    const message = error instanceof Error ? error.message : "创建分类失败";
    return { success: false, error: { code: "CREATE_FAILED", message } };
  }
}

export async function updateCategory(id: string, data: { name?: string; sortOrder?: number }) {
  try {
    const category = await db.category.update({ where: { id }, data });
    return { success: true, data: category };
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return { success: false, error: { code: "DUPLICATE_NAME", message: "分类名称已存在" } };
    }
    const message = error instanceof Error ? error.message : "更新分类失败";
    return { success: false, error: { code: "UPDATE_FAILED", message } };
  }
}

export async function deleteCategory(id: string) {
  try {
    const count = await db.template.count({ where: { categoryId: id } });
    if (count > 0) {
      return { success: false, error: { code: "HAS_TEMPLATES", message: `该分类下有 ${count} 个模板，请先迁移` } };
    }
    await db.category.delete({ where: { id } });
    return { success: true, data: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除分类失败";
    return { success: false, error: { code: "DELETE_FAILED", message } };
  }
}
```

- [ ] **Step 2: 创建 `src/app/api/categories/route.ts`**

GET（ALL 认证）+ POST（ADMIN 认证），遵循 `data-tables/route.ts` 模式。

- [ ] **Step 3: 创建 `src/app/api/categories/[id]/route.ts`**

PATCH + DELETE（ADMIN 认证），遵循 `data-tables/[id]/route.ts` 模式。DELETE 在 `HAS_TEMPLATES` 错误码时返回 409。

- [ ] **Step 4: Commit**

```bash
git add src/lib/services/category.service.ts src/app/api/categories/route.ts src/app/api/categories/\[id\]/route.ts
git commit -m "feat: add category CRUD service and API routes"
```

---

### Task 4: Tag Service + API Routes

**Files:**
- Create: `src/lib/services/tag.service.ts`
- Create: `src/app/api/tags/route.ts`
- Create: `src/app/api/tags/[id]/route.ts`

- [ ] **Step 1: 创建 `src/lib/services/tag.service.ts`**

实现 `listTags`、`createTag`、`deleteTag`（删除时自动解除模板关联）。`deleteTag` 通过 `db.tagOnTemplate.deleteMany` 先清中间表，再删 Tag。

- [ ] **Step 2: 创建 `src/app/api/tags/route.ts`**

GET（ALL 认证）+ POST（ADMIN 认证）。

- [ ] **Step 3: 创建 `src/app/api/tags/[id]/route.ts`**

DELETE（ADMIN 认证）。

- [ ] **Step 4: Commit**

```bash
git add src/lib/services/tag.service.ts src/app/api/tags/route.ts src/app/api/tags/\[id\]/route.ts
git commit -m "feat: add tag CRUD service and API routes"
```

---

### Task 5: Template Service — 支持分类/标签/搜索筛选

**Files:**
- Modify: `src/lib/services/template.service.ts`
- Modify: `src/app/(dashboard)/templates/page.tsx`（需要配合使用，但主要改动在 service 层）

- [ ] **Step 1: 修改 `listTemplates` 函数，增加筛选参数**

将 `filters` 参数类型从 `{ page; pageSize; status? }` 扩展为 `{ page; pageSize; status?; categoryId?; tagIds?: string[]; search? }`。

在 `where` 条件中加入：
- `categoryId` 筛选
- `tagIds` 筛选（当 tagIds 有值时，`where.tags = { some: { tagId: { in: tagIds } } }`）
- `search` 筛选（`name: { contains: search, mode: "insensitive" }`）

查询的 `select`/`include` 中加入 `category: { select: { name: true } }` 和 `tags: { include: { tag: { select: { id: true; name: true } } } }`。

返回类型中的 item 增加 `categoryName` 和 `tags` 字段。

- [ ] **Step 2: 修改 `createTemplate` 和 `updateTemplate`，支持 categoryId 和 tagIds**

- `createTemplate` 增加 `categoryId?: string` 和 `tagIds?: string[]` 参数
- `updateTemplate` 增加 `categoryId?: string | null` 和 `tagIds?: string[]` 参数
- 创建时先建模板再通过 `db.tagOnTemplate.createMany` 关联标签
- 更新时先 `db.tagOnTemplate.deleteMany` 清旧再关联新标签

- [ ] **Step 3: 修改 `getTemplate`，include category 和 tags**

- [ ] **Step 4: Commit**

```bash
git add src/lib/services/template.service.ts
git commit -m "feat: support category, tag, and search filters in template service"
```

---

### Task 6: 分类标签管理 Dialog 组件

**Files:**
- Create: `src/components/templates/category-tag-manager.tsx`

- [ ] **Step 1: 创建 `category-tag-manager.tsx`**

一个 Dialog 组件，内含两个 Tab：「分类管理」和「标签管理」。

**分类管理 Tab：**
- 列表：每行显示名称、排序号、删除按钮（`_count.templates > 0` 时 disabled）
- 底部：输入框（名称）+ 输入框（排序号）+ 添加按钮
- 支持内联编辑（双击名称变成 Input）—— 或者简化为仅列表+新增+删除，不做内联编辑

**标签管理 Tab：**
- 列表：每行显示名称、关联模板数量（`_count.templates`）、删除按钮
- 底部：输入框 + 添加按钮

使用 `useCallback` + `useState` 管理本地列表状态，操作成功后 `router.refresh()` 或 `toast.success()`。

- [ ] **Step 2: Commit**

```bash
git add src/components/templates/category-tag-manager.tsx
git commit -m "feat: add category and tag manager dialog component"
```

---

### Task 7: 模板管理页改动

**Files:**
- Modify: `src/app/(dashboard)/templates/page.tsx`

- [ ] **Step 1: 在页面 Server Component 中加载分类列表和 tagIds searchParams**

修改 `searchParams` 类型为 `Promise<{ page?: string; status?: string; categoryId?: string; tagIds?: string; search?: string }>`。

查询分类列表用于渲染分类 Tab：`db.category.findMany({ orderBy: { sortOrder: "asc" } })`。

查询模板时传入 `categoryId`、`tagIds`（逗号分隔转数组）、`search` 到 `where` 条件。

查询模板时 `include: { category: { select: { name: true } }, tags: { include: { tag: { select: { id: true; name: true } } } } }`。

- [ ] **Step 2: 添加分类管理 Dialog 按钮**

在标题行「上传模板」按钮旁边增加「分类管理」按钮，渲染 `<CategoryTagManager />`。

- [ ] **Step 3: 在状态 Tab 下方添加分类 Tab 行**

```tsx
<div className="flex gap-1 overflow-x-auto">
  <Link href={buildUrl(1, status, undefined)} className={...}>
    全部
  </Link>
  {categories.map((cat) => (
    <Link key={cat.id} href={buildUrl(1, status, cat.id)} className={...}>
      {cat.name}
    </Link>
  ))}
</div>
```

- [ ] **Step 4: 在表格中添加分类列和标签列**

在 `<TableHeader>` 中「名称」前添加「分类」列，在「文件名」后添加「标签」列。

分类列：显示 `template.category?.name` Badge。
标签列：显示 `template.tags.map(t => t.tag.name)`，最多 3 个 Badge + "+N"。

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/templates/page.tsx
git commit -m "feat: add category tags, filter tabs, and columns to templates page"
```

---

### Task 8: 模板编辑向导 — Step 1 增加分类和标签选择

**Files:**
- Create: `src/components/templates/category-select.tsx`
- Create: `src/components/templates/tag-multi-select.tsx`
- Modify: `src/components/templates/template-wizard.tsx`

- [ ] **Step 1: 创建 `src/components/templates/category-select.tsx`**

一个简单的 Select 组件，props：`value: string | null`、`onChange: (id: string | null) => void`。

内部 `useEffect` 从 `/api/categories` 加载分类列表，渲染为 Select 下拉选项。

- [ ] **Step 2: 创建 `src/components/templates/tag-multi-select.tsx`**

一个 Popover 触发的多选组件。props：`value: string[]`、`onChange: (ids: string[]) => void`。

内部从 `/api/tags` 加载标签列表，显示为可点击的 Badge 列表（选中高亮）。底部有新建标签输入框。

- [ ] **Step 3: 修改 `template-wizard.tsx`**

在 Step 1 的「描述」输入框之后添加：
- CategorySelect（必填，提交时验证）
- TagMultiSelect（选填）

新增 state：`categoryId: string | null`、`tagIds: string[]`。

在 `handleStep1Submit` 中将 `categoryId` 和 `tagIds` 发送到后端。创建模式发送 POST 时包含在 FormData 或 JSON body 中（如果用 FormData 则需要在 API route 支持）；编辑模式发送 PUT 时包含在 JSON body 中。

加载编辑模式时从 `fetchTemplateInfo` 返回的数据中回填 `categoryId` 和 `tagIds`。

- [ ] **Step 4: Commit**

```bash
git add src/components/templates/category-select.tsx src/components/templates/tag-multi-select.tsx src/components/templates/template-wizard.tsx
git commit -m "feat: add category and tag selection to template wizard step 1"
```

---

### Task 9: 生成文档页改动 — 搜索、分类筛选、标签筛选

**Files:**
- Modify: `src/app/(dashboard)/generate/page.tsx`

- [ ] **Step 1: 修改 `searchParams` 类型和查询逻辑**

```typescript
const { page: _, ...params } = await searchParams;
const { categoryId, tagIds, search } = params;
```

查询分类列表（用于渲染分类 Tab）：
```typescript
const categories = await db.category.findMany({
  orderBy: { sortOrder: "asc" },
});
```

查询标签列表（用于渲染标签筛选条）：
```typescript
const allTags = await db.tag.findMany({
  orderBy: { name: "asc" },
});
```

构建 `where` 条件：
- `status: "PUBLISHED"`
- `categoryId` 筛选
- `tagIds` 筛选
- `search` 模糊匹配 name

查询模板 `include` category 和 tags。

- [ ] **Step 2: 渲染搜索框**

在标题下方添加一个 Input 组件（type="search"），使用 URL 参数 `search`。由于是 Server Component，搜索框需要是一个 `<form>` 包裹的 `<input name="search">`，提交时跳转到当前页 URL + query string。或者用一个简单的 `<form>` 提交即可。

- [ ] **Step 3: 渲染分类 Tab**

与模板管理页类似，使用 Link 组件切换 `categoryId` 参数。

- [ ] **Step 4: 渲染标签筛选条**

横向可滚动的标签列表，每个标签是一个 Link，点击 toggle 选中/取消。选中态用 URL 参数 `tagIds`（逗号分隔多个 tagId）。当已有选中的 tagIds 时，再点击某个标签会从列表中移除。

- [ ] **Step 5: 模板卡片增加标签显示**

在卡片底部（或原有内容下方）添加标签 Badge 列表。

- [ ] **Step 6: Commit**

```bash
git add src/app/\(dashboard\)/generate/page.tsx
git commit -m "feat: add search, category filter, and tag filter to generate page"
```

---

### Task 10: 浏览器端到端验证

- [ ] **Step 1: 打开模板管理页，点击「分类管理」Dialog**

验证 Dialog 打开，能看到分类 Tab 和标签 Tab。

- [ ] **Step 2: 创建几个分类和标签**

在 Dialog 中创建分类（如「合同类」「人事类」）和标签（如「合同」「入职」「保密」）。

- [ ] **Step 3: 编辑一个已发布模板，选择分类和标签**

进入模板编辑，验证 Step 1 中出现了分类选择器和标签多选器。

- [ ] **Step 4: 验证模板管理页**

回到模板管理页，确认列表中显示了分类列和标签列，分类 Tab 可用。

- [ ] **Step 5: 验证生成文档页**

打开生成文档页，确认搜索框、分类 Tab、标签筛选条可用。搜索和筛选能正确过滤模板。卡片上显示标签。

- [ ] **Step 6: Commit**

如果发现 bug 并修复，创建一个单独的 fix commit。
