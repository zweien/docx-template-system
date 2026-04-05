# Grid 交互体验增强 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 GridView 增加列宽调整、列冻结、行拖拽排序、批量选择与操作、键盘快捷操作，缩小与 Airtable 的交互体验差距。

**Architecture:** 在现有 GridView 上增量扩展，使用 `table-layout: fixed` + `<colgroup>` 管理列宽，`position: sticky` 实现列冻结，`@dnd-kit/react` 实现行拖拽，自建 checkbox 列 + 批量操作栏实现批量操作，`onKeyDown` + activeCell 状态实现键盘导航。所有宽度/冻结配置存入 `viewOptions` JSON 字段。

**Tech Stack:** React 19, Next.js v16, @dnd-kit/react ^0.3.2 (useSortable from @dnd-kit/react/sortable), lucide-react, @base-ui/react Checkbox, Tailwind CSS v4

**Spec:** `docs/superpowers/specs/2026-04-05-grid-interaction-enhancement-design.md`

**Branch:** `feat/grid-interaction-enhancement`

---

## 文件结构

```
新建文件:
  src/components/data/column-resizer.tsx     — 列宽拖拽手柄
  src/components/data/batch-action-bar.tsx   — 批量操作栏
  src/components/data/batch-edit-dialog.tsx  — 批量编辑弹窗
  src/hooks/use-keyboard-nav.ts              — 键盘导航 hook

修改文件:
  src/components/data/views/grid-view.tsx    — 主文件：colgroup、冻结样式、行拖拽、checkbox、键盘
  src/components/data/column-header.tsx      — Popover 增加冻结菜单项
  src/components/data/record-table.tsx       — 传递 viewId 给 GridView

不修改:
  src/hooks/use-table-data.ts                — 通过 setViewOptions 间接使用
  src/hooks/use-inline-edit.ts               — commitEdit 已支持 unknown
  src/types/data-table.ts                    — viewOptions 是 Record<string, unknown>
  Prisma schema / API routes                 — 无需 migration，reorder API 已存在
```

---

## 第一阶段：基础交互

### Task 1: 列宽调整 — colgroup + ColumnResizer

**Files:**
- Create: `src/components/data/column-resizer.tsx`
- Modify: `src/components/data/views/grid-view.tsx:1-30` (imports), `:54-108` (DraggableColumnHeader), `:149-163` (orderedVisibleFields), `:313-345` (renderCell — remove max-w), `:348-396` (renderRecordRow — remove max-w), `:402-484` (render section)

- [ ] **Step 1: 创建 ColumnResizer 组件**

创建 `src/components/data/column-resizer.tsx`：

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MIN_WIDTH = 60;
const MAX_WIDTH = 600;

interface ColumnResizerProps {
  fieldKey: string;
  currentWidth: number;
  onWidthChange: (fieldKey: string, newWidth: number) => void;
  onDoubleClick: (fieldKey: string) => void;
}

export function ColumnResizer({
  fieldKey,
  currentWidth,
  onWidthChange,
  onDoubleClick,
}: ColumnResizerProps) {
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isResizing.current = true;
      startX.current = e.clientX;
      startWidth.current = currentWidth;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isResizing.current) return;
        const delta = moveEvent.clientX - startX.current;
        const newWidth = Math.max(
          MIN_WIDTH,
          Math.min(MAX_WIDTH, startWidth.current + delta)
        );
        onWidthChange(fieldKey, newWidth);
      };

      const handleMouseUp = () => {
        isResizing.current = false;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [currentWidth, fieldKey, onWidthChange]
  );

  return (
    <div
      className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 active:bg-primary/70 z-10"
      onMouseDown={handleMouseDown}
      onDoubleClick={() => onDoubleClick(fieldKey)}
    />
  );
}
```

- [ ] **Step 2: 修改 GridView — 添加列宽状态和常量**

在 `grid-view.tsx` 顶部添加常量：

```typescript
const DEFAULT_COL_WIDTH = 160;
```

在 GridView 组件内，`currentConfig` 相关位置添加列宽计算：

```typescript
// 在 orderedVisibleFields useMemo 之后
const columnWidths = useMemo(
  () => (currentConfig.viewOptions.columnWidths as Record<string, number>) ?? {},
  [currentConfig.viewOptions.columnWidths]
);
```

需要新增 props `viewOptions`、`onViewOptionsChange`，或者直接接收 `columnWidths` + `onColumnWidthsChange`。考虑到现有 props 结构，最简洁的方式是新增：

```typescript
// GridViewProps 中新增
columnWidths: Record<string, number>;
onColumnWidthsChange: (widths: Record<string, number>) => void;
frozenFieldCount?: number;
onFrozenFieldCountChange?: (count: number) => void;
viewId?: string | null;
```

- [ ] **Step 3: 修改 GridView — 切换到 table-layout: fixed + colgroup**

在 `<table>` 标签上添加 `style={{ tableLayout: "fixed" }}`，在 `<thead>` 之前插入 `<colgroup>`：

```tsx
<table className="w-full caption-bottom text-sm" style={{ tableLayout: "fixed" }}>
  <colgroup>
    {orderedVisibleFields.map((field) => (
      <col
        key={field.key}
        style={{ width: columnWidths[field.key] ?? DEFAULT_COL_WIDTH }}
      />
    ))}
    <col style={{ width: 80 }} />
  </colgroup>
  <DragDropProvider onDragEnd={handleColumnDragEnd}>
    <thead className="[&_tr]:border-b">
      {/* ... */}
    </thead>
  </DragDropProvider>
```

- [ ] **Step 4: 修改 GridView — 移除两处 max-w-[200px]**

1. `renderCell` 中 `<span>` 的 `max-w-[200px]` → 改为 `truncate` (已有)，移除 `max-w-[200px]`
2. `renderRecordRow` 中 `<td>` 的 `max-w-[200px]` → 移除

- [ ] **Step 5: 修改 DraggableColumnHeader — 添加 resizer**

在 `DraggableColumnHeader` 的 `<th>` 中包裹 ColumnResizer。`<th>` 需要改为 `position: relative`：

```tsx
function DraggableColumnHeader({
  id,
  index,
  children,
  columnWidth,
  fieldKey,
  onWidthChange,
  onAutoFit,
}: {
  id: string;
  index: number;
  children: React.ReactNode;
  columnWidth: number;
  fieldKey: string;
  onWidthChange: (fieldKey: string, width: number) => void;
  onAutoFit: (fieldKey: string) => void;
}) {
  const { ref, isDragging } = useSortable({ id, index });
  return (
    <th
      ref={ref}
      className={`h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0 relative ${
        isDragging ? "opacity-50 bg-muted" : "cursor-grab active:cursor-grabbing"
      }`}
      style={{ width: columnWidth }}
    >
      {children}
      <ColumnResizer
        fieldKey={fieldKey}
        currentWidth={columnWidth}
        onWidthChange={onWidthChange}
        onDoubleClick={onAutoFit}
      />
    </th>
  );
}
```

- [ ] **Step 6: 修改 GridView — 实现宽度变更回调**

```typescript
const handleWidthChange = useCallback(
  (fieldKey: string, newWidth: number) => {
    const next = { ...columnWidths, [fieldKey]: newWidth };
    onColumnWidthsChange(next);
  },
  [columnWidths, onColumnWidthsChange]
);

const handleAutoFit = useCallback(
  (fieldKey: string) => {
    // 扫描表格中该列所有单元格，取最大 offsetWidth + padding
    const table = tableRef.current;
    if (!table) return;
    const colIndex = orderedVisibleFields.findIndex((f) => f.key === fieldKey);
    if (colIndex === -1) return;
    let maxContentWidth = 80; // minimum
    const rows = table.querySelectorAll("tbody tr");
    rows.forEach((row) => {
      const cell = row.children[colIndex] as HTMLElement | undefined;
      if (cell) {
        maxContentWidth = Math.max(maxContentWidth, cell.scrollWidth);
      }
    });
    const headerCell = table.querySelector(
      `thead th:nth-child(${colIndex + 1})`
    ) as HTMLElement | undefined;
    if (headerCell) {
      maxContentWidth = Math.max(maxContentWidth, headerCell.scrollWidth);
    }
    handleWidthChange(fieldKey, Math.min(MAX_WIDTH, maxContentWidth));
  },
  [orderedVisibleFields, handleWidthChange]
);
```

需要添加 `tableRef`（`useRef<HTMLTableElement>(null)`）并在 `<table>` 上绑定 `ref={tableRef}`。

- [ ] **Step 7: 修改 record-table.tsx — 传递 columnWidths props**

在 `RecordTable` 中从 `currentConfig.viewOptions` 提取 `columnWidths` 传给 `GridView`：

```typescript
const columnWidths = useMemo(
  () => (currentConfig.viewOptions.columnWidths as Record<string, number>) ?? {},
  [currentConfig.viewOptions.columnWidths]
);

const handleColumnWidthsChange = useCallback(
  (next: Record<string, number>) => {
    setViewOptions({ ...currentConfig.viewOptions, columnWidths: next });
  },
  [currentConfig.viewOptions, setViewOptions]
);
```

传入 `<GridView columnWidths={columnWidths} onColumnWidthsChange={handleColumnWidthsChange} ... />`

同时在 `record-table.tsx` 中传递 `page={page}` prop 给 GridView（Task 4/5 需要此 prop 来清空选中/activeCell）。

- [ ] **Step 8: 验证列宽调整**

Run: `npm run dev`

手动验证：
- [ ] 拖拽列头右边缘可以调整列宽
- [ ] 宽度实时跟随鼠标
- [ ] 最小 60px，最大 600px
- [ ] 双击右边缘自动适应内容
- [ ] 保存视图后刷新页面，列宽保持
- [ ] 分组模式下列宽正常工作
- [ ] 列拖拽排序后列宽跟随移动

- [ ] **Step 9: Commit**

```bash
git add src/components/data/column-resizer.tsx src/components/data/views/grid-view.tsx src/components/data/record-table.tsx
git commit -m "feat(data): add column resizing with drag handle and auto-fit"
```

---

### Task 2: 列冻结

**Files:**
- Modify: `src/components/data/column-header.tsx:28-36` (props), `:211-237` (冻结菜单)
- Modify: `src/components/data/views/grid-view.tsx` (冻结样式计算、DraggableColumnHeader sticky、<td> sticky)

- [ ] **Step 1: 修改 ColumnHeader — 新增冻结 props 和菜单**

在 `ColumnHeaderProps` 中新增：

```typescript
frozenFieldCount?: number;
index?: number;
onFrozenFieldCountChange?: (count: number) => void;
```

在 Popover 内容中（分组区域之后，筛选区域之前）添加冻结按钮：

```tsx
{onFrozenFieldCountChange && typeof index === "number" && (
  <>
    <Separator />
    <div className="flex flex-col gap-1">
      <Label className="text-xs text-muted-foreground mb-1">冻结</Label>
      <Button
        variant={(frozenFieldCount ?? 0) > index ? "secondary" : "ghost"}
        size="sm"
        className="text-xs"
        onClick={() => {
          onFrozenFieldCountChange((frozenFieldCount ?? 0) === index + 1 ? 0 : index + 1);
          setOpen(false);
        }}
      >
        {(frozenFieldCount ?? 0) > index ? "取消冻结" : "冻结到此列"}
      </Button>
    </div>
  </>
)}
```

- [ ] **Step 2: 修改 GridView — 添加冻结样式计算函数**

在 GridView 内添加：

```typescript
function getFrozenStyle(
  index: number,
  frozenFieldCount: number,
  orderedFields: DataFieldItem[],
  widths: Record<string, number>
): React.CSSProperties | undefined {
  if (frozenFieldCount <= 0 || index >= frozenFieldCount) return undefined;

  let left = 0;
  for (let i = 0; i < index; i++) {
    left += widths[orderedFields[i].key] ?? DEFAULT_COL_WIDTH;
  }

  return {
    position: "sticky",
    left,
    zIndex: index === frozenFieldCount - 1 ? 4 : 3,
    backgroundColor: "hsl(var(--background))",
  };
}

function isFrozenLast(index: number, frozenFieldCount: number): boolean {
  return frozenFieldCount > 0 && index === frozenFieldCount - 1;
}
```

- [ ] **Step 3: 修改 GridView — 在 <th> 和 <td> 上应用冻结样式**

在 `DraggableColumnHeader` 的 `<th>` 中合并冻结 style：

```tsx
const frozenStyle = getFrozenStyle(index, frozenFieldCount, orderedVisibleFields, columnWidths);
// 在 th 上：
style={{ width: columnWidth, ...(frozenStyle ?? {}) }}
className={cn(
  "...",
  frozenStyle && "bg-background",
  isFrozenLast(index, frozenFieldCount) && "frozen-last-col"
)}
```

在 `renderRecordRow` 的 `<td>` 中同样应用冻结样式。需要知道 `fieldIndex`，在 `orderedVisibleFields.map` 中已有 `index`：

```tsx
<td
  key={field.id}
  style={getFrozenStyle(fieldIndex, frozenFieldCount, orderedVisibleFields, columnWidths)}
  className={cn(
    "p-2 align-middle whitespace-nowrap",
    getFrozenStyle(fieldIndex, frozenFieldCount, orderedVisibleFields, columnWidths) && "bg-background",
    isFrozenLast(fieldIndex, frozenFieldCount) && "frozen-last-col"
  )}
>
```

- [ ] **Step 4: 添加冻结分界线 CSS**

在 `src/app/globals.css` 中添加（与项目中其他全局样式保持一致）：

```css
/* 冻结分界线 */
.frozen-last-col::after {
  content: '';
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  box-shadow: inset -4px 0 4px -4px rgba(0, 0, 0, 0.1);
  pointer-events: none;
}
```

可以放在 `grid-view.tsx` 的 Tailwind `@layer` 中或使用内联 `<style>` 标签。最简单的方式是用 Tailwind v4 的 `@utility` 或在组件中加 `<style jsx>`。考虑到项目风格，使用 `globals.css` 或 `<style>` 标签均可。

- [ ] **Step 5: 修改列拖拽 — 冻结区域保护**

在 `handleColumnDragEnd` 中添加冻结区域检查：

```typescript
const frozenCount = frozenFieldCount ?? 0;
const sourceInFrozen = oldIndex < frozenCount;
const targetInFrozen = newIndex < frozenCount;
if (sourceInFrozen !== targetInFrozen) return; // 跨区域拖拽忽略
```

- [ ] **Step 6: 修改 record-table.tsx — 传递冻结 props**

```typescript
const frozenFieldCount = (currentConfig.viewOptions.frozenFieldCount as number) ?? 0;

const handleFrozenFieldCountChange = useCallback(
  (count: number) => {
    setViewOptions({ ...currentConfig.viewOptions, frozenFieldCount: count });
  },
  [currentConfig.viewOptions, setViewOptions]
);
```

传入 `<GridView frozenFieldCount={frozenFieldCount} onFrozenFieldCountChange={handleFrozenFieldCountChange} viewId={viewId} ... />`

- [ ] **Step 7: 验证列冻结**

Run: `npm run dev`

手动验证：
- [ ] ColumnHeader Popover 中显示冻结按钮
- [ ] 点击"冻结到此列"后，该列及左侧列固定不动
- [ ] 水平滚动时冻结列保持可见
- [ ] 冻结分界线阴影正常显示
- [ ] 冻结列区域内的列可以拖拽排序，但不能拖出冻结区
- [ ] 非冻结列不能拖入冻结区
- [ ] 保存视图后刷新，冻结状态保持
- [ ] 分组模式 + 冻结列共存正常

- [ ] **Step 8: Commit**

```bash
git add src/components/data/column-header.tsx src/components/data/views/grid-view.tsx src/components/data/record-table.tsx
git commit -m "feat(data): add column freezing with sticky positioning and zone protection"
```

---

### Task 3: 行拖拽排序

**Files:**
- Modify: `src/components/data/views/grid-view.tsx` (行 DragDropProvider、DragHandleRow、拖拽逻辑)

- [ ] **Step 1: POC — 验证双 DragDropProvider 兼容性**

在 GridView 中临时将 `<tbody>` 也包裹在一个 `DragDropProvider` 中，不添加任何逻辑，验证：
1. 页面正常渲染，无报错
2. 列拖拽仍然正常工作

```tsx
<tbody>
  <DragDropProvider onDragEnd={handleRowDragEnd}>
    {/* 临时：将 records.map 放在这里 */}
  </DragDropProvider>
</tbody>
```

如果报错或列拖拽失效，改用备选方案：将列和行拖拽合并到一个 `DragDropProvider`，通过 `data` 属性区分类型。

- [ ] **Step 2: 实现 DragHandleRow**

在 `grid-view.tsx` 中添加行拖拽组件：

```tsx
import { GripVertical } from "lucide-react";

function DragHandleRow({
  record,
  index,
  children,
  onDragStart,
}: {
  record: DataRecordItem;
  index: number;
  children: React.ReactNode;
  onDragStart?: () => void;
}) {
  const { ref, isDragging } = useSortable({ id: record.id, index });
  return (
    <tr
      ref={ref}
      className={cn(
        "border-b transition-colors hover:bg-muted/50",
        isDragging && "opacity-50 bg-muted"
      )}
    >
      {children}
    </tr>
  );
}
```

注意：由于行拖拽使用独立的 DragDropProvider，id 空间天然隔离，无需前缀。record.id (UUID) 与列 fieldKey 不会冲突。

- [ ] **Step 3: 添加 canDragSort 判断**

```typescript
const canDragSort = useMemo(
  () => sorts.length === 0 && !groupBy && !!viewId && isAdmin,
  [sorts, groupBy, viewId, isAdmin]
);
```

需要在 GridViewProps 中新增 `viewId?: string | null`。

- [ ] **Step 4: 修改 renderRecordRow — 集成 DragHandleRow**

当 `canDragSort` 为 true 时，每行最左侧显示拖拽手柄列（GripVertical 图标）：

```tsx
{canDragSort && (
  <td className="w-8 px-1 text-muted-foreground cursor-grab active:cursor-grabbing">
    <GripVertical className="h-4 w-4" />
  </td>
)}
```

- [ ] **Step 5: 实现 handleRowDragEnd（乐观更新 + rollback）**

注意：records 是从 props 传入的（来自 useTableData），乐观更新需要在 record-table.tsx 层操作 recordsData state。因此在 record-table.tsx 中新增 `reorderRecords` 函数（仿照 deleteRecord 模式），GridView 通过新的 `onReorderRecords` prop 调用。

**在 record-table.tsx 中新增：**
```typescript
const reorderRecords = useCallback(
  (orderedIds: string[]) => {
    if (!recordsData || !viewId) return;
    // 乐观更新：立即重排
    const reordered = orderedIds
      .map((id) => recordsData.records.find((r) => r.id === id))
      .filter((r): r is DataRecordItem => r !== undefined);
    setRecordsData((prev) => prev ? { ...prev, records: reordered } : prev);

    fetch(`/api/data-tables/${tableId}/records/reorder?viewId=${viewId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recordIds: orderedIds }),
    }).then(() => {
      refresh();
    }).catch(() => {
      // rollback
      refresh();
    });
  },
  [recordsData, viewId, tableId, refresh]
);
```

传递给 GridView：`<GridView ... onReorderRecords={reorderRecords} />`

**在 GridView 中的 handleRowDragEnd：**
```typescript
const handleRowDragEnd = useCallback(
  (event: { operation: { source: { id: string | number } | null; target: { id: string | number } | null }; canceled: boolean }) => {
    if (event.canceled || !viewId) return;
    const sourceId = event.operation.source?.id;
    const targetId = event.operation.target?.id;
    if (!sourceId || !targetId || sourceId === targetId) return;

    const orderedIds = records.map((r) => r.id);
    const srcStr = String(sourceId);
    const tgtStr = String(targetId);
    const oldIndex = orderedIds.indexOf(srcStr);
    const newIndex = orderedIds.indexOf(tgtStr);
    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = [...orderedIds];
    const [moved] = newOrder.splice(oldIndex, 1);
    newOrder.splice(newIndex, 0, moved);

    onReorderRecords(newOrder);
  },
  [records, viewId, onReorderRecords]
);
```

- [ ] **Step 6: 用 DragDropProvider 包裹 tbody**

DragDropProvider 是纯 React Context Provider，不产生 DOM 节点，放在 `<tbody>` 内部不会导致无效 HTML。

```tsx
<tbody className="[&_tr:last-child]:border-0">
  <DragDropProvider onDragEnd={canDragSort ? handleRowDragEnd : undefined}>
    {/* records rendering */}
  </DragDropProvider>
</tbody>
```

- [ ] **Step 7: 验证行拖拽排序**

Run: `npm run dev`

手动验证：
- [ ] 无排序、无分组、有 viewId、管理员 → 显示拖拽手柄
- [ ] 有排序时 → 不显示手柄
- [ ] 有分组时 → 不显示手柄
- [ ] 无 viewId（默认视图）→ 不显示手柄
- [ ] 拖拽行可以改变顺序
- [ ] 拖拽后刷新页面顺序保持
- [ ] 拖拽与内联编辑不冲突

- [ ] **Step 8: Commit**

```bash
git add src/components/data/views/grid-view.tsx
git commit -m "feat(data): add row drag sort with grip handle"
```

---

## 第二阶段：高级交互

### Task 4: 批量选择与操作

**Files:**
- Create: `src/components/data/batch-action-bar.tsx`
- Create: `src/components/data/batch-edit-dialog.tsx`
- Modify: `src/components/data/views/grid-view.tsx` (checkbox 列、selectedIds state)

- [ ] **Step 1: 创建 BatchActionBar 组件**

`src/components/data/batch-action-bar.tsx`：

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { Trash2, Edit3, X } from "lucide-react";

interface BatchActionBarProps {
  selectedCount: number;
  onBatchDelete: () => void;
  onBatchEdit: () => void;
  onClearSelection: () => void;
}

export function BatchActionBar({
  selectedCount,
  onBatchDelete,
  onBatchEdit,
  onClearSelection,
}: BatchActionBarProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border rounded-md text-sm">
      <span className="font-medium">已选择 {selectedCount} 条</span>
      <div className="h-4 w-px bg-border" />
      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={onBatchDelete}>
        <Trash2 className="h-3 w-3" />
        批量删除
      </Button>
      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={onBatchEdit}>
        <Edit3 className="h-3 w-3" />
        批量编辑
      </Button>
      <div className="h-4 w-px bg-border" />
      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onClearSelection}>
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: 创建 BatchEditDialog 组件**

注意：base-ui Dialog 的受控模式 API 使用 `open` + `onOpenChange`，与 SaveViewDialog (`src/components/data/save-view-dialog.tsx`) 用法一致，已确认可行。

`src/components/data/batch-edit-dialog.tsx`：

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { FieldType } from "@/generated/prisma/enums";
import type { DataFieldItem } from "@/types/data-table";

interface BatchEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fields: DataFieldItem[];
  onApply: (fieldKey: string, value: unknown) => void;
}

const EDITABLE_TYPES = [
  FieldType.TEXT,
  FieldType.NUMBER,
  FieldType.DATE,
  FieldType.EMAIL,
  FieldType.PHONE,
  FieldType.SELECT,
];

export function BatchEditDialog({
  open,
  onOpenChange,
  fields,
  onApply,
}: BatchEditDialogProps) {
  const [fieldKey, setFieldKey] = useState("");
  const [value, setValue] = useState("");

  const editableFields = fields.filter((f) => EDITABLE_TYPES.includes(f.type));
  const selectedField = editableFields.find((f) => f.key === fieldKey);

  const handleApply = () => {
    if (!fieldKey) return;
    const typedValue = selectedField?.type === FieldType.NUMBER
      ? Number(value) || 0
      : value;
    onApply(fieldKey, typedValue);
    onOpenChange(false);
    setFieldKey("");
    setValue("");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setFieldKey(""); setValue(""); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>批量编辑</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm">字段</Label>
            <Select value={fieldKey} onValueChange={(v) => { if (v) setFieldKey(v); }}>
              <SelectTrigger><SelectValue placeholder="选择要编辑的字段" /></SelectTrigger>
              <SelectContent>
                {editableFields.map((f) => (
                  <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedField?.type === FieldType.SELECT && selectedField.options ? (
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">值</Label>
              <Select value={value} onValueChange={(v) => { if (v) setValue(v); }}>
                <SelectTrigger><SelectValue placeholder="选择值" /></SelectTrigger>
                <SelectContent>
                  {selectedField.options.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">新值</Label>
              <Input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="输入新值"
                type={selectedField?.type === FieldType.NUMBER ? "number" : "text"}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleApply} disabled={!fieldKey}>应用</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: 修改 GridView — 添加 checkbox 列**

在 GridView 中添加状态：

```typescript
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
const [batchEditOpen, setBatchEditOpen] = useState(false);

const toggleAll = useCallback(() => {
  if (selectedIds.size === records.length) {
    setSelectedIds(new Set());
  } else {
    setSelectedIds(new Set(records.map((r) => r.id)));
  }
}, [records, selectedIds]);

const toggleRow = useCallback((recordId: string) => {
  setSelectedIds((prev) => {
    const next = new Set(prev);
    next.has(recordId) ? next.delete(recordId) : next.add(recordId);
    return next;
  });
}, []);

// 翻页时清空选中
useEffect(() => {
  setSelectedIds(new Set());
}, [page]); // page 需要作为 prop 传入
```

在 `<colgroup>` 中最前面添加 checkbox 列宽度：
```tsx
<col style={{ width: 40 }} />
```

在表头添加全选 checkbox：

注意：base-ui Checkbox 的 `onCheckedChange` 签名为 `(checked: boolean, eventDetails) => void`。`toggleAll` 不需要读取参数（自行管理 Set），JS 忽略多余参数，所以直接传 `toggleAll` 即可。

```tsx
<th className="w-10 h-10 sticky left-0 z-[13] bg-background border-r px-1">
  <Checkbox
    checked={records.length > 0 && selectedIds.size === records.length}
    indeterminate={selectedIds.size > 0 && selectedIds.size < records.length}
    onCheckedChange={toggleAll}
  />
</th>
```

在每行添加行 checkbox：
```tsx
<td className="w-10 sticky left-0 z-[5] bg-background border-r px-1">
  <Checkbox
    checked={selectedIds.has(record.id)}
    onCheckedChange={() => toggleRow(record.id)}
  />
</td>
```

需要新增 `colCount` 计算时加 1（checkbox 列）。

- [ ] **Step 4: 修改 GridView — 添加批量操作逻辑**

```typescript
const handleBatchDelete = useCallback(async () => {
  if (!confirm(`确定删除 ${selectedIds.size} 条记录？`)) return;
  const ids = [...selectedIds];
  setSelectedIds(new Set());

  const results = await Promise.allSettled(
    ids.map((id) =>
      fetch(`/api/data-tables/${tableId}/records/${id}`, { method: "DELETE" })
    )
  );
  const failedCount = results.filter((r) => r.status === "rejected").length;
  if (failedCount > 0) {
    alert(`${failedCount} 条记录删除失败，请重试`);
  }
  refresh();
}, [selectedIds, tableId, refresh]);

const handleBatchEdit = useCallback(
  async (fieldKey: string, value: unknown) => {
    const ids = [...selectedIds];
    const BATCH_SIZE = 10;
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map((id) =>
          fetch(`/api/data-tables/${tableId}/records/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fieldKey, value }),
          })
        )
      );
    }
    setSelectedIds(new Set());
    refresh();
  },
  [selectedIds, tableId, refresh]
);
```

- [ ] **Step 5: 修改 GridView — 渲染批量操作栏**

在表格上方（toolbar 和 table 之间）条件渲染：

```tsx
{selectedIds.size > 0 && (
  <BatchActionBar
    selectedCount={selectedIds.size}
    onBatchDelete={handleBatchDelete}
    onBatchEdit={() => setBatchEditOpen(true)}
    onClearSelection={() => setSelectedIds(new Set())}
  />
)}
<BatchEditDialog
  open={batchEditOpen}
  onOpenChange={setBatchEditOpen}
  fields={orderedVisibleFields}
  onApply={handleBatchEdit}
/>
```

- [ ] **Step 6: 修改冻结列偏移 — checkbox 列影响**

当 checkbox 列存在时，冻结列的 `left` 偏移需要加上 `CHECKBOX_COL_WIDTH`。

同时需要更新 Task 1 中的 `handleAutoFit` 函数：在计算 `colIndex` 时加 1（checkbox 列在最前面），即 `row.children[colIndex + 1]` 和 `thead th:nth-child(${colIndex + 2})`。

```typescript
const CHECKBOX_COL_WIDTH = 40;

function getFrozenStyle(
  index: number,
  frozenFieldCount: number,
  orderedFields: DataFieldItem[],
  widths: Record<string, number>,
  hasCheckboxCol: boolean
): React.CSSProperties | undefined {
  if (frozenFieldCount <= 0 || index >= frozenFieldCount) return undefined;

  let left = hasCheckboxCol ? CHECKBOX_COL_WIDTH : 0;
  for (let i = 0; i < index; i++) {
    left += widths[orderedFields[i].key] ?? DEFAULT_COL_WIDTH;
  }

  return {
    position: "sticky",
    left,
    zIndex: index === frozenFieldCount - 1 ? 4 : 3,
    backgroundColor: "hsl(var(--background))",
  };
}
```

- [ ] **Step 7: 验证批量选择与操作**

Run: `npm run dev`

手动验证：
- [ ] 每行左侧显示 checkbox
- [ ] 表头 checkbox 全选/取消全选
- [ ] indeterminate 状态正常显示
- [ ] 选中后出现批量操作栏
- [ ] 批量删除功能正常
- [ ] 批量编辑弹窗正常
- [ ] 批量编辑 TEXT/NUMBER/DATE 字段正常
- [ ] 翻页后选中状态清空
- [ ] checkbox 列 sticky 左侧固定，冻结列在其右侧

- [ ] **Step 8: Commit**

```bash
git add src/components/data/batch-action-bar.tsx src/components/data/batch-edit-dialog.tsx src/components/data/views/grid-view.tsx
git commit -m "feat(data): add batch selection, batch delete and batch edit"
```

---

### Task 5: 键盘快捷操作

**Files:**
- Create: `src/hooks/use-keyboard-nav.ts`
- Modify: `src/components/data/views/grid-view.tsx` (table ref、data 属性、onKeyDown 集成)

- [ ] **Step 1: 创建 useKeyboardNav hook**

`src/hooks/use-keyboard-nav.ts`：

```typescript
"use client";

import { useCallback, useEffect, useRef } from "react";

export interface ActiveCell {
  rowIndex: number;
  colIndex: number;
}

interface UseKeyboardNavOptions {
  rowCount: number;
  colCount: number;
  editingCell: unknown | null;
  onMoveTo: (cell: ActiveCell) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onClearCell: () => void;
  onCopyCell: () => string | null;
  onPasteCell: (text: string) => void;
  /** 返回 true 表示 rowIndex 对应的是分组行（不可聚焦） */
  isGroupRow?: (rowIndex: number) => boolean;
}

export function useKeyboardNav({
  rowCount,
  colCount,
  editingCell,
  onMoveTo,
  onStartEdit,
  onCancelEdit,
  onClearCell,
  onCopyCell,
  onPasteCell,
  isGroupRow,
}: UseKeyboardNavOptions) {
  const activeCellRef = useRef<ActiveCell | null>(null);

  const setActiveCell = useCallback((cell: ActiveCell | null) => {
    activeCellRef.current = cell;
  }, []);

  const getActiveCell = useCallback(() => activeCellRef.current, []);

  const skipGroupRow = useCallback(
    (targetRow: number, direction: 1 | -1): number => {
      let row = targetRow;
      while (row >= 0 && row < rowCount) {
        if (!isGroupRow?.(row)) return row;
        row += direction;
      }
      return targetRow; // fallback
    },
    [rowCount, isGroupRow]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (editingCell) return;

      const active = activeCellRef.current;

      // 方向键初始化 activeCell
      if (!active && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        const startRow = skipGroupRow(0, 1);
        activeCellRef.current = { rowIndex: startRow, colIndex: 0 };
        onMoveTo(activeCellRef.current);
        e.preventDefault();
        return;
      }

      if (!active) return;

      const maxRow = rowCount - 1;
      const maxCol = colCount - 1;

      switch (e.key) {
        case "ArrowUp": {
          const next = skipGroupRow(active.rowIndex - 1, -1);
          if (next >= 0) {
            activeCellRef.current = { ...active, rowIndex: next };
            onMoveTo(activeCellRef.current);
          }
          e.preventDefault();
          break;
        }
        case "ArrowDown": {
          const next = skipGroupRow(active.rowIndex + 1, 1);
          if (next <= maxRow) {
            activeCellRef.current = { ...active, rowIndex: next };
            onMoveTo(activeCellRef.current);
          }
          e.preventDefault();
          break;
        }
        case "ArrowRight":
          if (active.colIndex < maxCol) {
            activeCellRef.current = { ...active, colIndex: active.colIndex + 1 };
          } else if (active.rowIndex < maxRow) {
            const next = skipGroupRow(active.rowIndex + 1, 1);
            activeCellRef.current = { rowIndex: next, colIndex: 0 };
          }
          onMoveTo(activeCellRef.current!);
          e.preventDefault();
          break;
        case "ArrowLeft":
          if (active.colIndex > 0) {
            activeCellRef.current = { ...active, colIndex: active.colIndex - 1 };
          } else if (active.rowIndex > 0) {
            const next = skipGroupRow(active.rowIndex - 1, -1);
            activeCellRef.current = { rowIndex: next, colIndex: maxCol };
          }
          onMoveTo(activeCellRef.current!);
          e.preventDefault();
          break;
        case "Tab":
          if (e.shiftKey) {
            if (active.colIndex > 0) {
              activeCellRef.current = { ...active, colIndex: active.colIndex - 1 };
            } else if (active.rowIndex > 0) {
              const next = skipGroupRow(active.rowIndex - 1, -1);
              activeCellRef.current = { rowIndex: next, colIndex: maxCol };
            }
          } else {
            if (active.colIndex < maxCol) {
              activeCellRef.current = { ...active, colIndex: active.colIndex + 1 };
            } else if (active.rowIndex < maxRow) {
              const next = skipGroupRow(active.rowIndex + 1, 1);
              activeCellRef.current = { rowIndex: next, colIndex: 0 };
            }
          }
          onMoveTo(activeCellRef.current!);
          e.preventDefault();
          break;
        case "Enter":
        case "F2":
          onStartEdit();
          e.preventDefault();
          break;
        case "Escape":
          activeCellRef.current = null;
          onCancelEdit();
          e.preventDefault();
          break;
        case "Delete":
        case "Backspace":
          onClearCell();
          e.preventDefault();
          break;
        default:
          if ((e.ctrlKey || e.metaKey) && e.key === "c") {
            const text = onCopyCell();
            if (text !== null) {
              navigator.clipboard.writeText(text);
            }
            e.preventDefault();
          }
          if ((e.ctrlKey || e.metaKey) && e.key === "v") {
            navigator.clipboard.readText().then((text) => {
              if (text) onPasteCell(text);
            }).catch(() => {});
            e.preventDefault();
          }
      }
    },
    [editingCell, rowCount, colCount, onMoveTo, onStartEdit, onCancelEdit, onClearCell, onCopyCell, onPasteCell, skipGroupRow]
  );

  return { handleKeyDown, setActiveCell, getActiveCell };
}
```

- [ ] **Step 2: 修改 GridView — 集成键盘导航**

在 GridView 中：

1. 给 `<table>` 添加 `tabIndex={0}`、`ref={tableRef}`、`onKeyDown={handleKeyDown}`
2. 给每个 `<td>` 添加 `data-row={flatRowIndex}` 和 `data-col={fieldIndex}`
3. 添加 `ring-2 ring-primary ring-inset` 样式到活跃单元格
4. 实现 `isGroupRow` 函数（基于 `groupedRecords` 扁平化计算）
5. 点击表格时设置 activeCell

- [ ] **Step 3: 实现自动滚动**

```typescript
useEffect(() => {
  const cell = activeCell;
  if (!cell || !tableRef.current) return;
  const el = tableRef.current.querySelector(
    `[data-row="${cell.rowIndex}"][data-col="${cell.colIndex}"]`
  ) as HTMLElement | null;
  el?.scrollIntoView({ block: "nearest", inline: "nearest" });
}, [activeCell]);
```

- [ ] **Step 4: 实现点击设置 activeCell**

```typescript
const handleCellClick = useCallback(
  (rowIndex: number, colIndex: number, e: React.MouseEvent) => {
    // 如果点击的是 checkbox、button 等，不设置 activeCell
    const target = e.target as HTMLElement;
    if (target.closest('button, [role="checkbox"], input, select')) return;
    setActiveCell({ rowIndex, colIndex });
    tableRef.current?.focus();
  },
  [setActiveCell]
);
```

- [ ] **Step 5: 翻页时清空 activeCell**

```typescript
useEffect(() => {
  setActiveCell(null);
}, [page]);
```

- [ ] **Step 6: 验证键盘快捷操作**

Run: `npm run dev`

手动验证：
- [ ] 点击单元格出现 ring 高亮
- [ ] 方向键移动活跃单元格
- [ ] Tab / Shift+Tab 移动（行末跳行）
- [ ] Enter / F2 开始编辑
- [ ] Escape 取消编辑 / 退出活跃模式
- [ ] Delete 清空单元格
- [ ] Ctrl+C 复制到剪贴板
- [ ] Ctrl+V 粘贴（TEXT 字段正常，NUMBER 转换正常，SELECT 校验正常）
- [ ] 分组模式下分组行被跳过
- [ ] 翻页后 activeCell 清空
- [ ] 无 activeCell 时 Tab 不被拦截

- [ ] **Step 7: Commit**

```bash
git add src/hooks/use-keyboard-nav.ts src/components/data/views/grid-view.tsx
git commit -m "feat(data): add keyboard navigation with active cell tracking"
```

---

### Task 6: 类型检查与收尾

- [ ] **Step 1: 运行类型检查**

Run: `npx tsc --noEmit`

修复所有类型错误。

- [ ] **Step 2: 运行 lint**

Run: `npm run lint`

修复所有 lint 警告。

- [ ] **Step 3: 运行构建**

Run: `npm run build`

确保生产构建成功。

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: type check and lint fixes for grid interaction enhancement"
```
