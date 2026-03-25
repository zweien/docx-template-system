# Phase 2b P2 增强功能设计规范

## 概述

本设计文档定义 Phase 2b 的 P2 增强功能，包括模板关联主数据表和高级搜索/筛选功能。

## 功能范围

1. **模板关联主数据表** - 在模板详情页配置关联的数据表和字段映射
2. **高级搜索/筛选** - 批量生成时支持多条件筛选数据记录

## 功能 1：模板关联主数据表

### 数据模型

Prisma Schema 已包含必要字段，无需修改：

```prisma
model Template {
  // ... 现有字段
  dataTableId   String?
  dataTable     DataTable?   @relation(fields: [dataTableId], references: [id])
  fieldMapping  Json?        // { placeholderKey: dataFieldKey }
}
```

### API 设计

#### PUT /api/templates/[id]

扩展更新接口，支持关联配置：

```typescript
// 请求体
{
  "name": "模板名称",
  "dataTableId": "cmn4xxx",  // 可选，null 表示取消关联
  "fieldMapping": {          // 可选
    "project_name": "project_name",
    "person_name": "leader_name"
  }
}
```

### UI 组件

#### 新建：DataTableLink 组件

**文件：** `src/components/template/data-table-link.tsx`

**Props：**
```typescript
interface DataTableLinkProps {
  templateId: string;
  dataTableId: string | null;
  fieldMapping: FieldMapping | null;
  onUpdate: () => void;
}
```

**状态：**
- 未关联：显示「选择数据表」下拉框
- 已关联：显示关联的数据表名称、字段映射状态、操作按钮

**操作：**
- 选择/更换数据表
- 配置字段映射（跳转到字段映射弹窗）
- 取消关联

#### 修改：模板详情页

**文件：** `src/app/(dashboard)/templates/[id]/page.tsx`

在「文件信息」和「占位符列表」之间添加「主数据关联」区块。

#### 修改：Step1SelectData 组件

**文件：** `src/components/batch/step1-select-data.tsx`

当模板有关联数据表时：
1. 自动选中关联的数据表
2. 显示提示：「已自动选择模板关联的数据表」

### 用户流程

```
┌─────────────────────────────────────────────────────────────┐
│ 模板详情页                                                   │
├─────────────────────────────────────────────────────────────┤
│ [主数据关联]                                    [编辑]       │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 关联数据表：[请选择数据表 ▼]                             │ │
│ │                                                          │ │
│ │ 选择后显示：                                              │ │
│ │ 关联数据表：项目表                                        │ │
│ │ 字段映射：2/3 已配置  [配置字段映射]                      │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

点击 [配置字段映射] 弹出映射配置弹窗：
┌─────────────────────────────────────────────────────────────┐
│ 字段映射配置                                          [×]   │
├─────────────────────────────────────────────────────────────┤
│ 模板占位符          →    数据表字段                         │
├─────────────────────────────────────────────────────────────┤
│ project_name (必填)  →   [project_name ▼]  ✓ 自动匹配       │
│ person_name          →   [leader_name ▼]                    │
│ contract_date        →   [不映射 ▼]                          │
├─────────────────────────────────────────────────────────────┤
│                               [取消]  [保存映射]             │
└─────────────────────────────────────────────────────────────┘
```

## 功能 2：高级搜索/筛选

### API 设计

#### GET /api/data-tables/[id]/records

扩展现有接口，支持多字段筛选：

```
GET /api/data-tables/[id]/records?page=1&pageSize=20&search=关键词&filters[field_key]=value
```

**查询参数：**
- `search`: 全文搜索（现有）
- `filters[field_key]`: 按字段精确匹配
- `filters[field_key][op]`: 操作符（eq, ne, gt, lt, gte, lte, contains）

**示例：**
```
GET /api/data-tables/[id]/records?filters[status]=active&filters[budget][gte]=10000
```

### 服务层扩展

**文件：** `src/lib/services/data-record.service.ts`

```typescript
interface RecordFilters {
  search?: string;
  fieldFilters?: {
    [fieldKey: string]: {
      op?: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains';
      value: string | number;
    };
  };
}

function buildFilterWhereClause(filters: RecordFilters, fields: DataField[]): Prisma.WhereInput
```

### UI 组件

#### 新建：RecordFilter 组件

**文件：** `src/components/data/record-filter.tsx`

**Props：**
```typescript
interface RecordFilterProps {
  fields: DataField[];
  filters: ActiveFilter[];
  onFiltersChange: (filters: ActiveFilter[]) => void;
}

interface ActiveFilter {
  fieldKey: string;
  operator: FilterOperator;
  value: string;
}

type FilterOperator = 'eq' | 'ne' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte';
```

**UI 结构：**
```
┌─────────────────────────────────────────────────────────────┐
│ [🔍 搜索记录...                    ]  [+ 添加筛选]         │
├─────────────────────────────────────────────────────────────┤
│ 活动筛选：                                                   │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [项目状态 ▼] [等于 ▼] [进行中    ]               [×]    │ │
│ │ [预算金额 ▼] [大于 ▼] [10000     ]               [×]    │ │
│ └─────────────────────────────────────────────────────────┘ │
│ [清除全部筛选]                                               │
└─────────────────────────────────────────────────────────────┘
```

#### 修改：Step1SelectData 组件

集成 RecordFilter 组件，筛选结果实时更新记录表格。

### 筛选操作符映射

| 字段类型 | 可用操作符 |
|---------|-----------|
| TEXT | 等于、不等于、包含 |
| NUMBER | 等于、不等于、大于、小于、大于等于、小于等于 |
| DATE | 等于、大于、小于、大于等于、小于等于 |
| SELECT | 等于、不等于 |
| MULTISELECT | 包含、不包含 |
| EMAIL | 等于、包含 |
| PHONE | 等于、包含 |

## 文件清单

| 文件路径 | 描述 | 类型 |
|---------|------|------|
| `src/components/template/data-table-link.tsx` | 数据表关联组件 | 新建 |
| `src/components/data/record-filter.tsx` | 记录筛选组件 | 新建 |
| `src/app/(dashboard)/templates/[id]/page.tsx` | 模板详情页 | 修改 |
| `src/app/api/templates/[id]/route.ts` | 模板 API | 修改 |
| `src/app/api/data-tables/[id]/records/route.ts` | 记录列表 API | 修改 |
| `src/lib/services/data-record.service.ts` | 记录服务 | 修改 |
| `src/lib/services/template.service.ts` | 模板服务 | 修改 |
| `src/components/batch/step1-select-data.tsx` | 批量生成步骤1 | 修改 |
| `src/validators/data-table.ts` | 验证器 | 修改 |
| `src/types/data-table.ts` | 类型定义 | 修改 |

## 实施优先级

1. **模板关联主数据表**
   - 修改 template.service 支持更新 dataTableId
   - 创建 DataTableLink 组件
   - 修改模板详情页
   - 修改 Step1SelectData 自动选择

2. **高级搜索/筛选**
   - 扩展 data-record.service 支持筛选
   - 创建 RecordFilter 组件
   - 集成到 Step1SelectData

## 测试要点

- [ ] 模板关联数据表后，批量生成自动选中
- [ ] 字段映射配置保存和加载
- [ ] 多条件筛选正确过滤记录
- [ ] 不同字段类型的筛选操作符正确
- [ ] 清除筛选恢复正常列表
