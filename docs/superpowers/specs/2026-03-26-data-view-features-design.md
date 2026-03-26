# 主数据视图功能设计规范

## 概述

为主数据表格实现 Airtable 风格的视图功能，包括筛选、排序、显示字段控制和视图保存。

## 设计决策

- **交互风格**: 方案 B - 视图选择器 + 列头筛选（类 Airtable）
- **功能范围**: 全部实现（筛选、排序、显示字段、保存视图）

## 数据模型

### 新增 DataView 表

```prisma
model DataView {
  id          String   @id @default(cuid())
  tableId     String
  name        String
  isDefault   Boolean  @default(false)

  // 视图配置（JSON）
  filters     Json?    // FilterCondition[]
  sortBy      Json?    // SortConfig
  visibleFields Json?  // string[]
  fieldOrder  Json?    // string[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  table       DataTable @relation(fields: [tableId], references: [id], onDelete: Cascade)

  @@unique([tableId, name])
}

// 更新 DataTable 模型，添加关系
model DataTable {
  // ... 现有字段
  views       DataView[]
}
```

### 类型定义

```typescript
// src/types/data-table.ts

interface FilterCondition {
  fieldKey: string;
  op: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'isempty' | 'isnotempty';
  value: string | number;
}

interface SortConfig {
  fieldKey: string;
  order: 'asc' | 'desc';
}

interface DataViewConfig {
  filters: FilterCondition[];
  sortBy: SortConfig | null;
  visibleFields: string[];
  fieldOrder: string[];
}

interface DataViewItem {
  id: string;
  tableId: string;
  name: string;
  isDefault: boolean;
  filters: FilterCondition[];
  sortBy: SortConfig | null;
  visibleFields: string[];
  fieldOrder: string[];
  createdAt: Date;
  updatedAt: Date;
}
```

## API 设计

### 视图管理 API

#### GET /api/data-tables/[id]/views

获取数据表的所有视图列表。

**响应:**
```json
{
  "success": true,
  "data": [
    {
      "id": "cmxxx",
      "name": "默认视图",
      "isDefault": true,
      "filters": [],
      "sortBy": null,
      "visibleFields": ["project_name", "leader", "status"],
      "fieldOrder": ["project_name", "leader", "status"]
    }
  ]
}
```

#### POST /api/data-tables/[id]/views

创建新视图。

**请求体:**
```json
{
  "name": "进行中项目",
  "isDefault": false,
  "filters": [
    { "fieldKey": "status", "op": "eq", "value": "进行中" }
  ],
  "sortBy": { "fieldKey": "project_name", "order": "asc" },
  "visibleFields": ["project_name", "leader", "status", "budget"],
  "fieldOrder": ["project_name", "leader", "status", "budget"]
}
```

#### PUT /api/data-tables/[id]/views/[viewId]

更新视图配置。

#### DELETE /api/data-tables/[id]/views/[viewId]

删除视图。

### 记录查询 API 扩展

#### GET /api/data-tables/[id]/records

扩展现有接口支持视图参数：

**查询参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| `viewId` | string | 使用已保存视图的配置 |
| `filters` | JSON string | 临时筛选条件（覆盖视图配置） |
| `sortBy` | JSON string | 临时排序（覆盖视图配置） |
| `fields` | JSON string | 临时显示字段（覆盖视图配置） |

**示例:**
```
# 使用已保存视图
GET /api/data-tables/cm123/records?viewId=cm456

# 临时筛选（不保存）
GET /api/data-tables/cm123/records?filters=[{"fieldKey":"status","op":"eq","value":"进行中"}]

# 临时排序
GET /api/data-tables/cm123/records?sortBy={"fieldKey":"budget","order":"desc"}
```

## 组件设计

### 1. ViewSelector 组件

**文件:** `src/components/data/view-selector.tsx`

视图下拉选择器，显示在工具栏左侧。

**功能:**
- 下拉列表显示所有已保存视图
- 当前视图高亮
- "+ 新建视图"选项
- 视图名称旁显示筛选/排序状态指示

**Props:**
```typescript
interface ViewSelectorProps {
  tableId: string;
  currentViewId: string | null;
  onViewChange: (viewId: string | null) => void;
  onSaveNewView: () => void;
}
```

### 2. ColumnHeader 组件

**文件:** `src/components/data/column-header.tsx`

表格列头，支持点击筛选和排序。

**交互:**
- 单击列头 → 弹出筛选/排序菜单
- 显示排序指示器（↑/↓）
- 显示筛选条件简化表达（如 `=="进行中"`）
- 菜单包含：排序选项、筛选条件输入、清除按钮

**Props:**
```typescript
interface ColumnHeaderProps {
  field: DataFieldItem;
  filter: FilterCondition | null;
  sort: SortConfig | null;
  onFilterChange: (filter: FilterCondition | null) => void;
  onSortChange: (sort: SortConfig | null) => void;
}
```

**筛选菜单 UI:**
```
┌─────────────────┐
│ ↑ 升序排列      │
│ ↓ 降序排列      │
│ ─────────────── │
│ 筛选:           │
│ [等于    ▼]     │
│ [输入值...]     │
│ ─────────────── │
│ [清除] [应用]   │
└─────────────────┘
```

**操作符映射:**

| 字段类型 | 可用操作符 |
|---------|-----------|
| TEXT, TEXTAREA | eq, ne, contains, isempty, isnotempty |
| NUMBER | eq, ne, gt, lt, gte, lte, isempty |
| DATE | eq, gt, lt, gte, lte, isempty |
| SELECT | eq, ne, isempty |
| MULTISELECT | contains, isempty |
| EMAIL, PHONE | eq, contains, isempty |
| RELATION | eq, isempty |

### 3. FieldConfigPopover 组件

**文件:** `src/components/data/field-config-popover.tsx`

字段显示配置弹窗。

**功能:**
- 显示所有字段列表（带复选框）
- 支持拖拽调整字段顺序
- 全选/取消全选
- 应用后更新表格列

**Props:**
```typescript
interface FieldConfigPopoverProps {
  fields: DataFieldItem[];
  visibleFields: string[];
  fieldOrder: string[];
  onChange: (visibleFields: string[], fieldOrder: string[]) => void;
}
```

### 4. SaveViewDialog 组件

**文件:** `src/components/data/save-view-dialog.tsx`

保存视图弹窗。

**功能:**
- 输入视图名称
- 显示当前配置摘要
- 保存后自动切换到新视图

**Props:**
```typescript
interface SaveViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableId: string;
  currentConfig: DataViewConfig;
  onSaved: (viewId: string) => void;
}
```

### 5. RecordTable 组件重构

**文件:** `src/components/data/record-table.tsx`

重构现有组件以支持视图功能。

**主要变更:**
- 添加视图选择器
- 使用 ColumnHeader 替换简单 th
- 添加字段配置按钮
- 支持动态列显示和顺序
- URL 参数同步视图状态

**状态管理:**
```typescript
// 组件状态
const [viewId, setViewId] = useState<string | null>(null);
const [filters, setFilters] = useState<FilterCondition[]>([]);
const [sortBy, setSortBy] = useState<SortConfig | null>(null);
const [visibleFields, setVisibleFields] = useState<string[]>([]);
const [fieldOrder, setFieldOrder] = useState<string[]>([]);
```

## 服务层设计

### DataViewService

**文件:** `src/lib/services/data-view.service.ts`

```typescript
// 获取表的所有视图
export async function listViews(tableId: string): Promise<ServiceResult<DataViewItem[]>>

// 获取单个视图
export async function getView(viewId: string): Promise<ServiceResult<DataViewItem>>

// 创建视图
export async function createView(
  tableId: string,
  data: { name: string; isDefault?: boolean; ...config }
): Promise<ServiceResult<DataViewItem>>

// 更新视图
export async function updateView(
  viewId: string,
  data: Partial<{ name: string; isDefault: boolean; ...config }>
): Promise<ServiceResult<DataViewItem>>

// 删除视图
export async function deleteView(viewId: string): Promise<ServiceResult<null>>

// 设置默认视图
export async function setDefaultView(
  tableId: string,
  viewId: string
): Promise<ServiceResult<DataViewItem>>
```

### DataRecordService 扩展

**文件:** `src/lib/services/data-record.service.ts`

扩展现有 `listRecords` 函数：

```typescript
export async function listRecords(
  tableId: string,
  filters: {
    page: number;
    pageSize: number;
    search?: string;
    fieldFilters?: FieldFilters;
    // 新增排序参数
    sortBy?: SortConfig;
  }
): Promise<ServiceResult<PaginatedRecords>>
```

## 用户流程

### 日常使用流程

```
1. 进入主数据表页面
   └─> 自动加载默认视图（或上次的视图）

2. 点击列头添加筛选
   └─> 选择操作符 + 输入值
   └─> 应用后表格实时更新
   └─> 列头显示筛选条件

3. 点击列头切换排序
   └─> 升序/降序循环

4. 点击"字段"按钮
   └─> 勾选/取消勾选控制显示
   └─> 拖拽调整顺序
   └─> 应用后表格列更新

5. 配置完成后
   └─> 点击视图下拉 → "+ 新建视图"
   └─> 输入名称保存
   └─> 下次可直接选择使用
```

### 视图切换流程

```
1. 点击视图下拉
   └─> 显示所有已保存视图列表

2. 选择视图
   └─> 加载视图配置
   └─> 应用筛选/排序/字段设置
   └─> URL 更新为 ?viewId=xxx

3. 分享视图
   └─> 复制 URL 发送给他人
   └─> 打开链接自动应用视图配置
```

## 文件清单

| 文件 | 类型 | 说明 |
|------|------|------|
| `prisma/schema.prisma` | 修改 | 新增 DataView 模型 |
| `src/types/data-table.ts` | 修改 | 添加视图相关类型 |
| `src/app/api/data-tables/[id]/views/route.ts` | 新建 | 视图列表/创建 API |
| `src/app/api/data-tables/[id]/views/[viewId]/route.ts` | 新建 | 视图更新/删除 API |
| `src/app/api/data-tables/[id]/records/route.ts` | 修改 | 扩展支持排序和视图参数 |
| `src/lib/services/data-view.service.ts` | 新建 | 视图服务层 |
| `src/lib/services/data-record.service.ts` | 修改 | 扩展排序功能 |
| `src/components/data/record-table.tsx` | 重构 | 支持视图功能 |
| `src/components/data/column-header.tsx` | 新建 | 列头筛选/排序组件 |
| `src/components/data/field-config-popover.tsx` | 新建 | 字段配置弹窗 |
| `src/components/data/view-selector.tsx` | 新建 | 视图选择器 |
| `src/components/data/save-view-dialog.tsx` | 新建 | 保存视图弹窗 |

## 实施顺序

1. **数据模型** - 添加 DataView 模型，运行 prisma db push
2. **后端服务** - 创建 data-view.service.ts，扩展 data-record.service.ts
3. **API 端点** - 创建视图 CRUD API，扩展记录查询 API
4. **基础组件** - ColumnHeader、FieldConfigPopover
5. **容器组件** - ViewSelector、SaveViewDialog
6. **页面集成** - 重构 RecordTable，整合所有组件
7. **测试验证** - Playwright 端到端测试

## 技术注意事项

1. **URL 状态同步**: 视图配置应同步到 URL 参数，支持分享链接
2. **性能优化**: 筛选条件变化时使用 debounce 避免频繁请求
3. **默认行为**: 无保存视图时显示所有字段，按创建时间降序
4. **权限**: 所有用户可查看/使用视图，仅管理员可创建/编辑/删除视图
5. **兼容性**: 保留临时查询能力（不依赖视图）
