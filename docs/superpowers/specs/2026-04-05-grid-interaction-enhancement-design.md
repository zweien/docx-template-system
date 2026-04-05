# Grid 交互体验增强设计

> 日期: 2026-04-05
> 状态: 已批准
> 范围: GridView 列宽调整、列冻结、行拖拽排序、批量选择与操作、键盘快捷操作

## 背景

当前 GridView 已实现内联编辑、多列排序、筛选、分组、列拖拽排序等核心功能，但在交互体验上与 Airtable 仍有明显差距。本设计聚焦于四个方面的增强，分两阶段交付：

- **第一阶段**（基础交互）：列宽调整、列冻结
- **第二阶段**（高级交互）：批量选择与操作、键盘快捷操作

行拖拽排序作为第一阶段的附加功能，依赖已有的 reorder API。

## 设计决策

**方案选择：自研实现（方案 A）**

在现有 GridView 基础上增量扩展，不引入 TanStack Table 或 AG Grid 等第三方表格库。

理由：
1. 当前 GridView 有成熟的基础（内联编辑、分组、排序），重写成本远大于增量扩展
2. `@dnd-kit/react` 已在项目中，行拖拽可以直接复用
3. 列宽/冻结/sticky 的实现难度不高，且能精确匹配现有样式
4. 不引入新的大型依赖，维护可控

## 第一阶段：基础交互

### 1.1 列宽调整

#### 数据存储

在 `DataView.viewOptions` 中增加：

```typescript
columnWidths?: Record<string, number>  // fieldKey -> width in px
```

由 `useTableData` 的 `setViewOptions` 统一管理，保存视图时自动持久化。

#### 常量

```typescript
const DEFAULT_COL_WIDTH = 160;
const MIN_COL_WIDTH = 60;
const MAX_COL_WIDTH = 600;
```

#### 实现路径

**Step 1 — 切换为 `table-layout: fixed` + `colgroup`**

使用 `<colgroup>` 控制列宽，而非在每个 `<td>`/`<th>` 上设 `width`：

- 单一来源控制宽度，避免 `<td>` 和 `<th>` 宽度不一致
- 与 `position: sticky` 兼容更好（后续列冻结需要）
- 增删列时不会导致布局跳动

**Step 2 — 移除硬编码约束**

删除两处 `max-w-[200px]`：
- `renderCell` 中 `<span>` 的 `max-w-[200px]`（grid-view.tsx:328）
- `renderRecordRow` 中 `<td>` 的 `max-w-[200px]`（grid-view.tsx:352）

改为 `<td>` 由 `colgroup` 控制宽度 + `overflow: hidden; text-overflow: ellipsis` 处理溢出。`<td>` 上的 `max-w` 必须移除，否则会覆盖 `colgroup` 的列宽控制。

**Step 3 — ColumnResizer 组件**

新建 `src/components/data/column-resizer.tsx`。

在 `DraggableColumnHeader` 的 `<th>` 右边缘放一个绝对定位的拖拽条：

- `mousedown` 记录 `startX` 和 `startWidth`
- `mousemove` 计算 `delta = e.clientX - startX`，设置 `width = clamp(startWidth + delta, 60, 600)`
- 实时更新 `colgroup` 的 `<col>` width（不等 mouseup）
- `mouseup` 时将最终宽度写入 `viewOptions.columnWidths`
- 双击右边缘自动适应内容宽度（扫描该列所有 `textContent`，取最大 `offsetWidth`，加上 padding）

**Step 4 — 宽度计算函数**

```typescript
function getColumnWidth(fieldKey: string): number {
  return currentConfig.viewOptions.columnWidths?.[fieldKey] ?? DEFAULT_COL_WIDTH;
}
```

#### 边界情况

| 场景 | 处理方式 |
|------|---------|
| 新增列 | 无 `columnWidths` 记录，使用 `DEFAULT_COL_WIDTH` |
| 隐藏再显示列 | 保留其 `columnWidths` 记录 |
| 保存视图 | `columnWidths` 随 `viewOptions` 一起持久化 |
| 分组模式下 | `colgroup` 不受分组行影响，`<td colSpan>` 自动撑满全宽 |
| 列拖拽排序 | 列宽随列移动，`colgroup` 跟随 `orderedVisibleFields` 顺序 |

### 1.2 列冻结

#### 数据存储

```typescript
frozenFieldCount?: number  // 从左起冻结的列数（0=不冻结）
```

选择 `frozenFieldCount` 而非 `frozenFields: string[]` 的原因：冻结列始终是左侧连续的 N 列，这是所有电子表格工具的通用模型。这样和 `fieldOrder` 自然对齐，无需额外维护排序。

#### 实现路径

**Step 1 — 计算冻结列的 `left` 偏移**

```typescript
function getFrozenStyles(
  index: number,
  orderedFields: DataFieldItem[],
  columnWidths: Record<string, number>,
  frozenFieldCount: number
): { isFrozen: boolean; left?: number; zIndex?: number } {
  if (index >= frozenFieldCount) return { isFrozen: false };

  let left = 0;
  for (let i = 0; i < index; i++) {
    left += columnWidths[orderedFields[i].key] ?? DEFAULT_COL_WIDTH;
  }
  return { isFrozen: true, left, zIndex: index === frozenFieldCount - 1 ? 4 : 3 };
}
```

**Step 2 — 在 `<th>` 和 `<td>` 上应用 sticky**

冻结列设置 `position: sticky; left: Npx; zIndex: Z`，同时添加 `bg-background` 防止滚动时内容穿透。

**Step 3 — 冻结分界线视觉指示**

在最右冻结列的右侧添加 `::after` 伪元素阴影，宽度 4px，`box-shadow: inset -4px 0 4px -4px rgba(0,0,0,0.1)`。

**Step 4 — ColumnHeader 中增加冻结操作**

在 Popover 菜单的分组区域之后增加：

- "冻结到此列" → `onFrozenCountChange(index + 1)`
- "取消冻结"（当该列已冻结时显示）→ `onFrozenCountChange(0)`

需要修改的 props 传递链：
1. `ColumnHeader` 新增 props：`frozenFieldCount?: number`、`index: number`、`onFrozenCountChange?: (count: number) => void`
2. `DraggableColumnHeader` 透传 `frozenFieldCount`、`index`、`onFrozenCountChange` 给内部 `ColumnHeader`
3. `GridView` 在渲染 `DraggableColumnHeader` 时传入这些 props

#### 冻结列 + 列拖拽排序

冻结区域与非冻结区域之间不能交叉拖拽：
- 冻结区域内可排序
- 非冻结区域内可排序
- 不能把冻结列拖到非冻结区

实现方式：在 `handleColumnDragEnd` 中检查 `source` 和 `target` 是否都在同一区域（冻结/非冻结），跨区域时忽略。拖拽过程中提供视觉反馈：当拖拽目标在禁止区域时，在冻结分界线处显示红色指示线，鼠标变为 `not-allowed`。

#### z-index 层级规划

```
分组行 sticky top:     z-5
表头 sticky top:       z-10
表头冻结列:            z-12
内容冻结列:            z-3
内容冻结列(最右+阴影): z-4
拖拽中列:              z-20
```

分组行 `<td colSpan>` 横跨全宽，不受 sticky left 影响。表头冻结列需要高于普通表头和内容冻结列，确保左上角区域不被覆盖。

### 1.3 行拖拽排序

#### 前置条件

行拖拽仅在无排序且无分组时可用。原因：
- 有分组时行属于不同组，拖拽打乱分组无意义
- 有服务端排序时，手动排序与排序逻辑冲突

即：`canDragSort = sorts.length === 0 && !groupBy && !!viewId && isAdmin`

#### 实现路径

**Step 1 — 独立的行 DragDropProvider**

列拖拽的 `DragDropProvider` 仅包裹 `<thead>`，行拖拽用独立的 `DragDropProvider` 包裹 `<tbody>`。不能用同一个，因为列和行的拖拽语义不同。

注意：需要验证 `@dnd-kit/react` v0.3.2 在同一组件树中并列两个 `DragDropProvider` 的兼容性。行拖拽使用 `id` 前缀 `row-` 避免与列拖拽的 `id` 命名空间冲突。如果验证发现不兼容，备选方案是将列和行拖拽统一到同一个 `DragDropProvider`，通过 `data` 属性区分拖拽类型。

**Step 2 — DragHandleRow 组件**

用 `useSortable` 包裹 `<tr>`，在最左侧加拖拽手柄（`GripVertical` 图标）。

仅当 `canDragSort` 为 true 时显示手柄列。

**Step 3 — 拖拽结束处理**

乐观更新记录顺序 + 调用 `POST /api/data-tables/[id]/records/reorder`。API 已存在，使用 gap 算法（0, 1000, 2000...）存储 manualSort。

**Step 4 — API 失败处理**

乐观更新后若 API 失败则 rollback，与现有 `deleteRecord` 模式一致。

#### 边界情况

| 场景 | 处理方式 |
|------|---------|
| 无 viewId 时 | 不可拖拽，reorder API 需要 viewId |
| 非管理员 | 不可拖拽，与现有权限模型一致 |
| 拖拽中单元格正在编辑 | `isDragging` 时隐藏编辑器 |
| 分页 | 拖拽只在当前页内排序，跨页排序第一阶段不做 |
| 排序/分组开启时 | 不显示拖拽手柄 |

## 第二阶段：高级交互

### 2.1 批量选择与操作

#### 数据结构

```typescript
// GridView 内部 state，不需要持久化
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
const CHECKBOX_COL_WIDTH = 40;
```

#### Checkbox 列

始终在 `orderedVisibleFields` 之前，不属于 fieldOrder。

- 表头：全选 checkbox（支持 indeterminate 状态）
- 每行：单个 checkbox
- 位置：`sticky left: 0; z-index: 13（表头）/ 5（内容行）`
- 独立于用户冻结的列。如果 `frozenFieldCount > 0`，冻结列从 checkbox 列之后开始计算偏移

与行拖拽手柄列的协调：checkbox 列始终在最左侧（sticky left:0），行拖拽手柄列在 checkbox 列右侧（sticky left:40px）。两列在功能上互补——先选中再操作是常见工作流。

#### 批量操作栏

选中记录后，表格上方浮现操作栏：

```
┌──────────────────────────────────────────────────┐
│ 已选择 N 条  │  批量删除  │  批量编辑字段值  │  ✕ 取消选择  │
└──────────────────────────────────────────────────┘
```

- 批量删除：乐观更新 + 并发调用 DELETE API
- 批量编辑：弹出对话框选择字段和新值，PATCH 每条记录的同一个字段

批量编辑只处理 TEXT/NUMBER/DATE/SELECT 等简单类型，RELATION 字段第一阶段不支持。

#### 批量编辑 API 策略

使用现有 PATCH 端点 `/api/data-tables/[id]/records/[recordId]` 做并发调用，不新建批量端点。并发上限 10 个请求（`Promise.all` 分批），避免同时发过多请求。如果未来需要更高性能，再考虑新建 `POST /api/data-tables/[id]/records/batch-update`。

#### z-index 协调

```
checkbox 表头:         z-13 (sticky left:0 + sticky top)
冻结列表头:            z-12 (sticky left:N + sticky top)
普通列表头:            z-10 (仅 sticky top)
分组行:                z-6  (sticky top)
checkbox 内容行:       z-5  (sticky left:0)
冻结列内容行:          z-3  (sticky left:N)
```

#### 边界情况

| 场景 | 处理方式 |
|------|---------|
| 翻页 | 切换页面时清空 `selectedIds` |
| 分组模式 | 全选 = 选当前页所有记录（含所有组） |
| 行内编辑中点击 checkbox | 先取消编辑，再切换选中 |
| 删除后 | 已选中的被删记录从 `selectedIds` 移除 |

### 2.2 键盘快捷操作

#### 活跃单元格

```typescript
interface ActiveCell {
  rowIndex: number;
  colIndex: number;
}
const [activeCell, setActiveCell] = useState<ActiveCell | null>(null);
```

#### 键盘映射表

| 按键 | 行为 | 条件 |
|------|------|------|
| `ArrowUp/Down/Left/Right` | 移动活跃单元格 | 无编辑状态 |
| `Tab` | 右移，行末跳下一行行首 | 有 activeCell 时拦截，无 activeCell 时不拦截（保留浏览器原生 Tab 导航） |
| `Shift+Tab` | 左移，行首跳上一行行末 | 有 activeCell 时拦截 |
| `Enter` / `F2` | 开始编辑当前单元格 | 有 activeCell 且非编辑中 |
| `Escape` | 取消编辑（编辑中）/ 退出活跃单元格模式（无编辑） | 任何时候 |
| `Delete` / `Backspace` | 清空当前单元格值 | 有 activeCell 且非编辑中 |
| `Ctrl+C` | 复制当前单元格值到剪贴板 | 有 activeCell 且非编辑中 |
| `Ctrl+V` | 粘贴到当前单元格 | 有 activeCell 且非编辑中 |

#### 实现路径

**Step 1 — 表格容器获取焦点**

`<table tabIndex={0} onKeyDown={handleKeyDown}>`，点击表格任意位置时计算 `activeCell` 并 focus。

**Step 2 — 活跃单元格视觉指示**

用 `ring-2 ring-primary ring-inset` 高亮，不用 `bg` 避免和 hover/编辑状态冲突。

**Step 3 — handleKeyDown**

编辑中的键盘操作由 cell editor 自行处理，`handleKeyDown` 在 `editingCell` 存在时直接 return。

**Step 4 — 自动滚动**

activeCell 变化时，通过 `data-row`/`data-col` 属性找到对应 `<td>`，调用 `scrollIntoView({ block: 'nearest', inline: 'nearest' })`。

#### 边界情况

| 场景 | 处理方式 |
|------|---------|
| 分组模式 | rowIndex 对应扁平化后的行索引，分组行不可聚焦，跳过 |
| 分页切换 | 清空 activeCell |
| 点击表格外部 | 不清空 activeCell（与 Excel 一致） |
| 编辑完成后 | Enter 提交后 activeCell 不变，方向键移动到下一个 |
| Ctrl+V 到 SELECT 字段 | 校验粘贴值是否在 options 中，不在则忽略 |
| Ctrl+V 到 NUMBER 字段 | Number(text) 转换，NaN 则忽略 |
| RELATION_SUBTABLE 字段 | 可聚焦高亮，但 Enter/Delete/Ctrl+V 不触发操作 |

## 修改文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/components/data/views/grid-view.tsx` | 修改 | colgroup、列宽/冻结样式、行拖拽、checkbox 列、键盘导航 |
| `src/components/data/column-header.tsx` | 修改 | Popover 增加冻结选项 |
| `src/components/data/column-resizer.tsx` | 新建 | 列宽拖拽手柄组件 |
| `src/components/data/batch-action-bar.tsx` | 新建 | 批量操作栏 |
| `src/components/data/batch-edit-dialog.tsx` | 新建 | 批量编辑弹窗 |
| `src/hooks/use-keyboard-nav.ts` | 新建 | 键盘导航 hook |
| `src/hooks/use-inline-edit.ts` | 不修改 | `commitEdit` 已支持 `unknown` 类型值，键盘 Delete 清空操作由 `use-keyboard-nav.ts` 直接调用 `handleCommit(id, key, null)` 实现，无需改此文件 |
| `src/types/data-table.ts` | 不修改 | viewOptions 是泛型 JSON，无需改类型 |

## 不修改的部分

- `use-table-data.ts`：仅通过 `setViewOptions` 传递数据
- API 路由：reorder API 已存在，无需新建
- Prisma schema：`viewOptions` 是 JSON 字段，无需 migration
