# 单条生成数据选择器设计规范

## 概述

本设计定义模板填写表单（单条生成）时的数据选择与自动填充功能，支持多表绑定和级联自动填充。

## 功能需求

1. **多表绑定** — 每个占位符可独立绑定不同数据表的字段
2. **数据选择器** — 填写表单时可通过弹窗从数据表选择记录
3. **级联自动填充** — 选择记录后，同表映射字段自动填充，关联字段级联查询填充

## 数据模型扩展

### Placeholder 模型扩展

```prisma
model Placeholder {
  // ... 现有字段

  // 新增：数据源绑定
  sourceTableId   String?    // 数据来源表 ID（关联 DataTable）
  sourceField     String?    // 数据来源字段 key
  enablePicker    Boolean    @default(false)  // 是否启用数据选择器
}
```

### 字段映射关系

```
占位符绑定：
┌─────────────────┬──────────────────┬─────────────────┐
│ 占位符 key      │ 数据表            │ 数据字段         │
├─────────────────┼──────────────────┼─────────────────┤
│ project_name    │ 项目表           │ project_name    │
│ manager_name    │ 项目表           │ manager_name    │
│ dept_name       │ 项目表.关联人员表 │ dept_name       │
└─────────────────┴──────────────────┴─────────────────┘
```

## API 设计

### GET /api/placeholders/[id]/source-tables

获取占位符可绑定的数据表列表（含字段）。

### PATCH /api/placeholders/[id]

更新占位符的数据源绑定。

```typescript
// 请求体
{
  "sourceTableId": "cmn4o0lun0000dcbmavbo2pjq",
  "sourceField": "project_name",
  "enablePicker": true
}
```

### GET /api/placeholders/[id]/picker-data

获取占位符关联数据表的可选数据，支持搜索和筛选。

**查询参数：**
| 参数 | 说明 |
|------|------|
| search | 搜索关键词 |
| page | 页码 |
| pageSize | 每页数量 |

**返回：**
```typescript
{
  "records": [
    { "id": "xxx", "data": { "project_name": "智慧城市", ... } }
  ],
  "total": 100,
  "page": 1
}
```

### POST /api/fill/resolve-cascade

解析级联数据，返回所有关联字段的值。

```typescript
// 请求体
{
  "templateId": "xxx",
  "sourceTableId": "xxx",
  "recordId": "xxx"
}

// 返回
{
  "project_name": "智慧城市项目",
  "manager_name": "张三",
  "dept_name": "研发部"
}
```

## UI 组件

### 1. 占位符绑定配置扩展

**位置**：模板配置页面 → 占位符编辑表单

**新增字段：**
- 「启用数据选择」开关
- 「数据来源表」下拉框（选择后启用）
- 「数据字段」下拉框（根据选择的表动态加载）

### 2. 数据选择器弹窗 (DataPickerDialog)

**文件**：`src/components/fill/data-picker-dialog.tsx`

**Props：**
```typescript
interface DataPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableId: string;
  displayField: string;  // 列表显示的主字段
  searchPlaceholder?: string;
  onSelect: (record: DataRecordItem) => void;
}
```

**UI 结构：**
```
┌─────────────────────────────────────────────────────────────┐
│ 选择数据                                              [×]   │
├─────────────────────────────────────────────────────────────┤
│ [🔍 搜索...]                                                │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 项目名称          │ 负责人  │ 状态    │ 创建时间      │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ 智慧城市项目      │ 张三    │ 进行中  │ 2026-03-01   │ │
│ │ 数字化转型项目    │ 李四    │ 进行中  │ 2026-02-15   │ │
│ │ ...                                                      │ │
│ └─────────────────────────────────────────────────────────┘ │
│                            [取消]  [确认选择]               │
└─────────────────────────────────────────────────────────────┘
```

### 3. 填写表单扩展 (DynamicFillForm)

**文件**：`src/components/fill/dynamic-fill-form.tsx`（修改现有组件）

**修改点：**
- 对于 `enablePicker=true` 的占位符，渲染数据选择器按钮
- 点击按钮打开 DataPickerDialog
- 选择记录后，调用级联解析 API，自动填充所有关联字段

**表单字段渲染：**
```
┌─────────────────────────────────────────────────────────────┐
│ 项目名称 *                                                  │
│ ┌─────────────────────────────────────┐ [选择数据]        │
│ │ 智慧城市项目                         │                   │
│ └─────────────────────────────────────┘                   │
├─────────────────────────────────────────────────────────────┤
│ 负责人                                                      │
│ ┌─────────────────────────────────────┐                    │
│ │ 张三（自动填充）                     │                   │
│ └─────────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

## 自动填充流程

```
用户点击「选择数据」
    ↓
打开 DataPickerDialog
    ↓
用户搜索/浏览，选择一条记录
    ↓
调用 POST /api/fill/resolve-cascade
    ↓
返回所有关联字段的值
    ↓
自动填充到对应表单字段
    ↓
标记自动填充的字段（可编辑）
```

## 级联解析逻辑

```typescript
async function resolveCascadeData(
  templateId: string,
  sourceTableId: string,
  recordId: string
): Promise<Record<string, unknown>> {
  // 1. 获取模板所有占位符绑定信息
  const placeholders = await getPlaceholderBindings(templateId);

  // 2. 获取选中的记录数据
  const record = await getRecord(recordId);

  // 3. 构建返回数据
  const result: Record<string, unknown> = {};

  for (const ph of placeholders) {
    if (ph.sourceTableId === sourceTableId && ph.sourceField) {
      // 同表直接取值
      result[ph.key] = record.data[ph.sourceField];
    }
  }

  // 4. 处理关联字段（RELATION 类型字段的级联查询）
  // TODO: Phase 2 实现

  return result;
}
```

## 边界情况

1. **占位符未绑定数据表**：正常显示文本输入框
2. **数据表无记录**：选择器显示空状态，提示「暂无数据」
3. **关联字段值为空**：自动填充空字符串，用户可手动填写
4. **用户修改自动填充值**：允许修改，不影响其他字段

## 文件清单

| 文件路径 | 描述 | 类型 |
|---------|------|------|
| `prisma/schema.prisma` | 添加占位符数据源字段 | 修改 |
| `src/types/placeholder.ts` | 添加数据源绑定类型 | 修改 |
| `src/validators/placeholder.ts` | 添加数据源绑定验证 | 修改 |
| `src/lib/services/placeholder.service.ts` | 扩展占位符服务 | 修改 |
| `src/app/api/placeholders/[id]/route.ts` | 支持更新数据源绑定 | 修改 |
| `src/app/api/placeholders/[id]/picker-data/route.ts` | 数据选择器 API | 新建 |
| `src/app/api/fill/resolve-cascade/route.ts` | 级联解析 API | 新建 |
| `src/components/fill/data-picker-dialog.tsx` | 数据选择器弹窗 | 新建 |
| `src/components/fill/dynamic-fill-form.tsx` | 填写表单组件 | 修改 |
| `src/components/template/placeholder-config-form.tsx` | 占位符配置表单 | 修改 |

## 实施优先级

1. **Phase 1（本次实现）**
   - 扩展 Placeholder 模型和服务
   - 实现数据选择器弹窗组件
   - 修改填写表单集成选择器
   - 实现同表自动填充

2. **Phase 2（后续）**
   - 关联字段级联查询
   - 多表联合选择
   - 选择历史记录

## 测试要点

- [ ] 占位符绑定数据表后，填写表单显示选择器按钮
- [ ] 选择器弹窗正确显示数据表记录
- [ ] 搜索和筛选功能正常
- [ ] 选择记录后，同表映射字段自动填充
- [ ] 自动填充值可手动修改
- [ ] 未绑定的占位符正常显示文本输入框
