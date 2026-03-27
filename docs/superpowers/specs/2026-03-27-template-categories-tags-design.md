# 模板分类与标签 设计规格

## 目标

为模板增加分类和标签功能，让用户能快速找到所需模板。模板管理页增加分类/标签管理，生成文档页增加搜索、分类筛选和标签筛选。

## 数据模型

### 新增模型

```
Category
├── id          String   @id @default(cuid())
├── name        String   @unique
├── sortOrder   Int      @default(0)
├── createdAt   DateTime @default(now())
└── templates   Template[]
```

```
Tag
├── id          String   @id @default(cuid())
├── name        String   @unique
└── templates   Template[]  (多对多)
```

```
TagOnTemplate (中间表)
├── templateId  String
├── tagId       String
└── @@id([templateId, tagId])
```

### Template 模型变更

```diff
 model Template {
+  categoryId    String?
+  category      Category?     @relation(fields: [categoryId], references: [id], ondelete: SetNull)
+  tags          TagOnTemplate[]
   // ...existing fields...
+  @@index([categoryId])
 }
```

- `categoryId` 可为 null（兼容已有数据），业务层要求创建模板时必选
- 删除分类时 `onDelete: SetNull`，模板的 categoryId 自动置空

## API 设计

### 分类 API

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/categories` | 获取分类列表（按 sortOrder 排序） | ALL |
| POST | `/api/categories` | 创建分类 `{ name, sortOrder }` | ADMIN |
| PATCH | `/api/categories/[id]` | 编辑分类 `{ name?, sortOrder? }` | ADMIN |
| DELETE | `/api/categories/[id]` | 删除分类（有模板引用时返回 409） | ADMIN |

### 标签 API

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/tags` | 获取标签列表（按 name 排序） | ALL |
| POST | `/api/tags` | 创建标签 `{ name }` | ADMIN |
| DELETE | `/api/tags/[id]` | 删除标签（自动解除模板关联） | ADMIN |

### 模板列表 API 变更

`GET /api/templates` 和 `GET /api/templates?status=PUBLISHED` 增加 query 参数：

- `categoryId` — 按分类筛选
- `tagId` — 按标签筛选（可传多个，逗号分隔或数组）
- `search` — 按名称模糊搜索

返回数据增加 `categoryName` 和 `tags` 字段。

## 分类与标签管理 UI

### 入口

模板管理页标题右侧「分类管理」按钮，点击打开 Dialog。

### 分类管理 Dialog

- 列表形式：名称 + 排序号，可内联编辑
- 底部「新增分类」输入框 + 添加按钮
- 每行有删除按钮（有模板引用时 disabled + tooltip 提示）

### 标签管理

同一 Dialog 中增加 Tab 切换到标签管理：
- 标签列表，每个标签显示名称 + 关联模板数量 + 删除按钮
- 底部「新建标签」输入框 + 添加按钮

## 模板管理页改动

### 列表增加列

在「名称」和「文件名」之间增加「分类」列，在「文件名」后增加「标签」列：

```
| 分类 | 名称 | 文件名 | 标签 | 状态 | 创建者 | 创建时间 | 操作 |
```

- 分类：Badge 样式
- 标签：小尺寸 Badge，最多显示 3 个 + "+N"

### 分类 Tab 筛选

状态 Tab（全部/草稿/已发布/已归档）下方增加分类 Tab：

```
[全部] [合同类] [人事类] [财务类] ...
```

点击分类 Tab 时 URL 增加 `?categoryId=xxx` 参数。

### 编辑模板 Step 1

在名称和描述表单下方增加：
- **分类** Select（必填）— 从已有分类中选择
- **标签** 多选组件 — 从已有标签中选择（支持在组件内新建标签）

## 生成文档页改动

### 布局

```
┌─────────────────────────────────────────┐
│ 生成文档                                 │
│ 选择一个模板，填写内容后即可生成文档       │
├─────────────────────────────────────────┤
│ [🔍 搜索模板...]                        │
├─────────────────────────────────────────┤
│ [全部] [合同类] [人事类] [财务类]         │
├─────────────────────────────────────────┤
│ 标签: [合同] [入职] [保密] [+]           │
├─────────────────────────────────────────┤
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │
│ │模板A  │ │模板B  │ │模板C  │ │模板D  │   │
│ │标签...│ │标签...│ │      │ │标签...│   │
│ └──────┘ └──────┘ └──────┘ └──────┘   │
└─────────────────────────────────────────┘
```

- **搜索框**：按模板名称模糊搜索（URL 参数 `search`）
- **分类 Tab**：点击切换，URL 参数 `categoryId`
- **标签筛选条**：横向可滚动，点击 toggle 选中/取消，多选 AND 逻辑，URL 参数 `tagId`（多个逗号分隔）
- **模板卡片**：保持现有 Card 样式，底部增加标签 Badge 显示

### 数据加载

Server Component 通过 `searchParams` 获取筛选条件，一次查询返回结果（无需客户端分页，模板数量通常不多）。

## 涉及文件

| 文件 | 操作 |
|------|------|
| `prisma/schema.prisma` | 新增 Category、Tag、TagOnTemplate 模型，Template 增加字段 |
| `src/types/template.ts` | 新增 CategoryItem、TagItem 类型 |
| `src/lib/services/category.service.ts` | 新建：分类 CRUD |
| `src/lib/services/tag.service.ts` | 新建：标签 CRUD |
| `src/lib/services/template.service.ts` | 修改：列表查询支持分类/标签/搜索筛选 |
| `src/validators/category.ts` | 新建：Zod schemas |
| `src/validators/tag.ts` | 新建：Zod schemas |
| `src/app/api/categories/route.ts` | 新建：GET + POST |
| `src/app/api/categories/[id]/route.ts` | 新建：PATCH + DELETE |
| `src/app/api/tags/route.ts` | 新建：GET + POST |
| `src/app/api/tags/[id]/route.ts` | 新建：DELETE |
| `src/components/templates/category-tag-manager.tsx` | 新建：分类+标签管理 Dialog |
| `src/components/templates/category-select.tsx` | 新建：分类 Select（支持在模板编辑中使用） |
| `src/components/templates/tag-multi-select.tsx` | 新建：标签多选组件（支持新建标签） |
| `src/app/(dashboard)/templates/page.tsx` | 修改：增加分类列、标签列、分类 Tab、管理入口 |
| `src/app/(dashboard)/templates/new/page.tsx` | 修改：Step 1 增加分类和标签选择 |
| `src/app/(dashboard)/templates/[id]/edit/page.tsx` | 修改：Step 1 增加分类和标签选择 |
| `src/app/(dashboard)/generate/page.tsx` | 修改：搜索框、分类 Tab、标签筛选、卡片标签 |

## 不修改的文件

- 模板详情页（`templates/[id]/page.tsx`）— 仅在列表展示分类标签即可
- 填写表单页（`templates/[id]/fill/page.tsx`）— 无需改动
- Python 文档生成服务 — 与分类标签无关
