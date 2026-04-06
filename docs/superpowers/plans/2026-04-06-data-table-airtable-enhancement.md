# Data Table Airtable Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add right-click context menu, AND/OR nested filter groups, and conditional formatting to the data table grid view.

**Architecture:** Three independent features implemented sequentially. Context menu is pure frontend (no backend changes). Filter groups refactor the filter data structure from flat array to nested groups with backward compatibility. Conditional formatting reuses the filter condition type and stores rules in the existing DataView.viewOptions JSON field.

**Tech Stack:** React 19, Next.js 16, shadcn/ui v4 (Base UI), @base-ui/react Menu primitives, Prisma v7, TypeScript

**Spec:** `docs/superpowers/specs/2026-04-06-data-table-airtable-enhancement-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/components/ui/context-menu.tsx` | shadcn-style ContextMenu component wrapping @base-ui/react Menu |
| `src/components/data/cell-context-menu.tsx` | Cell/row/col context menu with action handlers |
| `src/components/data/filter-panel.tsx` | Grouped filter UI with AND/OR toggle |
| `src/components/data/conditional-format-dialog.tsx` | Rule management dialog |
| `src/hooks/use-cell-context.ts` | Hook to track right-click target (cell/row/col info) |

### Modified Files
| File | Change |
|------|--------|
| `src/types/data-table.ts` | Add FilterGroup, ConditionalFormatRule types; update DataViewConfig |
| `src/components/data/views/grid-view.tsx` | Wire in context menu, conditional formatting style computation |
| `src/components/data/record-table.tsx` | Add toolbar buttons for filter panel and conditional format |
| `src/components/data/column-header.tsx` | Adapt filter UI to use new FilterGroup structure |
| `src/lib/services/data-record.service.ts` | Refactor buildFilterConditionsFromSpec to handle FilterGroup[] |
| `src/hooks/use-table-data.ts` | Update filter state type from FilterCondition[] to FilterGroup[] |
| `src/lib/services/data-view.service.ts` | Update filter-related type signatures from FilterCondition[] to FilterGroup[] |
| `src/app/api/data-tables/[id]/records/route.ts` | Update filter query param parsing for FilterGroup[] |

---

## Task 1: Add ContextMenu UI Component

**Files:**
- Create: `src/components/ui/context-menu.tsx`

This project uses shadcn/ui v4 built on `@base-ui/react`. Base UI provides a dedicated `@base-ui/react/context-menu` package with `ContextMenu.Root` and `ContextMenu.Trigger` that handle right-click behavior natively.

- [ ] **Step 1: Create context-menu.tsx**

Create `src/components/ui/context-menu.tsx` using `@base-ui/react/context-menu` for root/trigger, and `@base-ui/react/menu` for popup/positioner/item/separator:

```tsx
"use client"

import * as React from "react"
import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"
import { cn } from "@/lib/utils"

function ContextMenu({ ...props }: ContextMenuPrimitive.Root.Props) {
  return <ContextMenuPrimitive.Root data-slot="context-menu" {...props} />
}

function ContextMenuTrigger({ ...props }: ContextMenuPrimitive.Trigger.Props) {
  return <ContextMenuPrimitive.Trigger data-slot="context-menu-trigger" {...props} />
}

function ContextMenuContent({
  className,
  ...props
}: MenuPrimitive.Popup.Props &
  Pick<MenuPrimitive.Positioner.Props, "sideOffset">) {
  return (
    <ContextMenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        className="isolate z-50 outline-none"
        sideOffset={4}
        {...props}
      >
        <MenuPrimitive.Popup
          className={cn(
            "bg-popover text-popover-foreground rounded-md border p-1 shadow-md",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            className
          )}
        />
      </MenuPrimitive.Positioner>
    </ContextMenuPrimitive.Portal>
  )
}

function ContextMenuItem({
  className,
  inset,
  ...props
}: MenuPrimitive.Item.Props & { inset?: boolean }) {
  return (
    <MenuPrimitive.Item
      className={cn(
        "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none",
        "hover:bg-accent hover:text-accent-foreground",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        inset && "pl-8",
        className
      )}
      {...props}
    />
  )
}

function ContextMenuSeparator({
  className,
  ...props
}: MenuPrimitive.Separator.Props) {
  return (
    <MenuPrimitive.Separator
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
}
```

Note: `ContextMenu.Root` + `ContextMenu.Trigger` from `@base-ui/react/context-menu` handle right-click positioning natively. No need for `side`/`align` props — the menu appears at the cursor.

- [ ] **Step 2: Verify component renders without errors**

Run: `npx tsc --noEmit` — expect no type errors in the new file.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/context-menu.tsx
git commit -m "feat(ui): add ContextMenu component based on Base UI Menu"
```

---

## Task 2: Create useCellContext Hook

**Files:**
- Create: `src/hooks/use-cell-context.ts`

This hook tracks what element was right-clicked (cell, row header, or column header) and provides the context data needed by the menu.

- [ ] **Step 1: Create the hook**

Create `src/hooks/use-cell-context.ts`:

```tsx
"use client"

import { useCallback, useState } from "react"

export type ContextTargetType = "cell" | "rowHeader" | "colHeader"

export interface CellContext {
  targetType: ContextTargetType
  recordId: string | null
  fieldKey: string | null
  rowIndex: number | null
  colIndex: number | null
}

const DEFAULT_CONTEXT: CellContext = {
  targetType: "cell",
  recordId: null,
  fieldKey: null,
  rowIndex: null,
  colIndex: null,
}

export function useCellContext() {
  const [context, setContext] = useState<CellContext>(DEFAULT_CONTEXT)

  const captureCell = useCallback(
    (e: React.MouseEvent, recordId: string, fieldKey: string, rowIndex: number, colIndex: number) => {
      e.preventDefault()
      setContext({ targetType: "cell", recordId, fieldKey, rowIndex, colIndex })
    },
    [],
  )

  const captureRowHeader = useCallback(
    (e: React.MouseEvent, recordId: string, rowIndex: number) => {
      e.preventDefault()
      setContext({ targetType: "rowHeader", recordId, fieldKey: null, rowIndex, colIndex: null })
    },
    [],
  )

  const captureColHeader = useCallback(
    (e: React.MouseEvent, fieldKey: string, colIndex: number) => {
      e.preventDefault()
      setContext({ targetType: "colHeader", recordId: null, fieldKey, rowIndex: null, colIndex })
    },
    [],
  )

  return { context, captureCell, captureRowHeader, captureColHeader }
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-cell-context.ts
git commit -m "feat(data): add useCellContext hook for right-click target tracking"
```

---

## Task 3: Create CellContextMenu Component

**Files:**
- Create: `src/components/data/cell-context-menu.tsx`

This component renders different menu items based on what was right-clicked (cell, row header, or column header).

- [ ] **Step 1: Create the component**

Create `src/components/data/cell-context-menu.tsx`. Key aspects:
- Accepts `CellContext` + action callbacks as props
- Renders different menu items per `targetType`
- Uses `ContextMenu` / `ContextMenuItem` / `ContextMenuSeparator` from the new UI component
- Wraps children (the table) — the menu appears on right-click anywhere inside

```tsx
"use client"

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import type { CellContext, ContextTargetType } from "@/hooks/use-cell-context"
import type { DataFieldItem, DataRecordItem } from "@/types/data-table"
import { ReactNode, useCallback } from "react"

interface CellContextMenuProps {
  context: CellContext
  fields: DataFieldItem[]
  records: DataRecordItem[]
  /** Start inline editing the right-clicked cell */
  onEditCell?: (recordId: string, fieldKey: string) => void
  /** Copy cell value to clipboard */
  onCopyCellValue?: (recordId: string, fieldKey: string) => void
  /** Insert a new row at given position relative to recordId */
  onInsertRow?: (referenceRecordId: string, position: "above" | "below") => void
  /** Delete a record */
  onDeleteRecord?: (recordId: string) => void
  /** Duplicate a record */
  onDuplicateRecord?: (recordId: string) => void
  /** Quick filter: show only rows matching this cell's value */
  onFilterByCell?: (fieldKey: string, value: string) => void
  /** Sort by column */
  onSortColumn?: (fieldKey: string, order: "asc" | "desc") => void
  /** Freeze/unfreeze columns */
  /** Toggle freeze column — receives colIndex and current frozenCount */
  onToggleFreeze?: (colIndex: number, frozenCount: number) => void
  /** Current frozen column count — needed to determine freeze/unfreeze label */
  frozenCount?: number
  /** Hide a column */
  onHideColumn?: (fieldKey: string) => void
  /** Auto-fit column width */
  onAutoFitColumn?: (fieldKey: string) => void
  /** Open record detail drawer */
  onOpenDetail?: (recordId: string) => void
  /** Add conditional format rule from this cell */
  onAddConditionalFormat?: (fieldKey: string, value: string) => void
  children: ReactNode
}

export function CellContextMenu({
  context,
  fields,
  records,
  onEditCell,
  onCopyCellValue,
  onInsertRow,
  onDeleteRecord,
  onDuplicateRecord,
  onFilterByCell,
  onSortColumn,
  onToggleFreeze,
  onHideColumn,
  onAutoFitColumn,
  onOpenDetail,
  onAddConditionalFormat,
  children,
}: CellContextMenuProps) {
  const { targetType, recordId, fieldKey, colIndex } = context
  const frozenCount = context.frozenCount ?? 0

  const getCellValue = useCallback(() => {
    if (!recordId || !fieldKey) return ""
    const record = records.find((r) => r.id === recordId)
    return record ? String(record.data[fieldKey] ?? "") : ""
  }, [recordId, fieldKey, records])

  const renderCellMenu = () => {
    if (targetType !== "cell" || !recordId || !fieldKey) return null
    const field = fields.find((f) => f.key === fieldKey)

    return (
      <>
        {field && field.type !== "RELATION_SUBTABLE" && (
          <ContextMenuItem onClick={() => onEditCell?.(recordId, fieldKey)}>
            编辑单元格
          </ContextMenuItem>
        )}
        <ContextMenuItem onClick={() => onCopyCellValue?.(recordId, fieldKey)}>
          复制单元格值
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onInsertRow?.(recordId, "above")}>
          上方插入行
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onInsertRow?.(recordId, "below")}>
          下方插入行
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onDeleteRecord?.(recordId)}>
          删除行
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onFilterByCell?.(fieldKey, getCellValue())}>
          按此单元格筛选
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onSortColumn?.(fieldKey, "asc")}>
          按此列升序排序
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onSortColumn?.(fieldKey, "desc")}>
          按此列降序排序
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onAddConditionalFormat?.(fieldKey, getCellValue())}>
          添加条件格式...
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onOpenDetail?.(recordId)}>
          展开记录详情
        </ContextMenuItem>
      </>
    )
  }

  const renderRowHeaderMenu = () => {
    if (targetType !== "rowHeader" || !recordId) return null

    return (
      <>
        <ContextMenuItem onClick={() => onInsertRow?.(recordId, "above")}>
          上方插入行
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onInsertRow?.(recordId, "below")}>
          下方插入行
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onDuplicateRecord?.(recordId)}>
          复制行
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onDeleteRecord?.(recordId)}>
          删除行
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onOpenDetail?.(recordId)}>
          展开记录详情
        </ContextMenuItem>
      </>
    )
  }

  const renderColHeaderMenu = () => {
    if (targetType !== "colHeader" || !fieldKey || colIndex === null) return null

    return (
      <>
        <ContextMenuItem onClick={() => onSortColumn?.(fieldKey, "asc")}>
          升序排序
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onSortColumn?.(fieldKey, "desc")}>
          降序排序
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onToggleFreeze?.(colIndex, frozenCount ?? 0)}>
          {colIndex < (frozenCount ?? 0) ? "解冻列" : "冻结到此列"}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onHideColumn?.(fieldKey)}>
          隐藏列
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onAutoFitColumn?.(fieldKey)}>
          自动适配宽度
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onFilterByCell?.(fieldKey, "")}>
          筛选此列
        </ContextMenuItem>
      </>
    )
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        {renderCellMenu()}
        {renderRowHeaderMenu()}
        {renderColHeaderMenu()}
      </ContextMenuContent>
    </ContextMenu>
  )
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/components/data/cell-context-menu.tsx
git commit -m "feat(data): add CellContextMenu component with cell/row/col menus"
```

---

## Task 4: Wire Context Menu into GridView

**Files:**
- Modify: `src/components/data/views/grid-view.tsx`
- Modify: `src/components/data/record-table.tsx`

This task integrates the context menu into the grid. We add `onContextMenu` handlers to cells, row headers, and column headers, then wrap the table with `CellContextMenu`.

- [ ] **Step 1: Add onContextMenu handlers to grid-view.tsx**

In `src/components/data/views/grid-view.tsx`:

1. Import `useCellContext` and `CellContextMenu` at the top of the file.
2. Inside `GridView` component, call `useCellContext()` to get `context`, `captureCell`, `captureRowHeader`, `captureColHeader`.
3. On the checkbox `<td>` (line ~725), add `onContextMenu={(e) => captureRowHeader(e, record.id, flatRowIndex)}`.
4. On the data `<td>` (line ~743), add `onContextMenu={(e) => captureCell(e, record.id, field.key, flatRowIndex, fieldIndex)}`.
5. On the `<th>` inside the column header loop (line ~864), add `onContextMenu={(e) => captureColHeader(e, field.key, index)}`.
6. Wrap the existing `<div className="flex-1 min-h-0 overflow-auto">` with `<CellContextMenu>` passing the context and action callbacks.
7. Implement the action callbacks:
   - `onEditCell`: call `startEditing(recordId, fieldKey)`
   - `onCopyCellValue`: use `navigator.clipboard.writeText(String(record.data[fieldKey] ?? ""))`
   - `onInsertRow`: POST to `/api/data-tables/${tableId}/records` with empty data, then call reorder API
   - `onDeleteRecord`: reuse existing `onDeleteRecord` prop
   - `onDuplicateRecord`: POST to `/api/data-tables/${tableId}/records` with the source record's data
   - `onFilterByCell`: call `onFilterChange({ fieldKey, op: "eq", value }, fieldKey)`
   - `onSortColumn`: call `onSortChange({ fieldKey, order })`
   - `onToggleFreeze`: toggle `frozenFieldCount`
   - `onHideColumn`: remove fieldKey from `visibleFields`
   - `onAutoFitColumn`: call existing `handleAutoFit`
   - `onOpenDetail`: reuse existing prop
   - `onAddConditionalFormat`: placeholder for now (implemented in Task 8)

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Manual test — right-click on a cell, verify menu appears with correct items**

Start dev server: `npm run dev`, navigate to a data table, right-click different areas.

- [ ] **Step 4: Commit**

```bash
git add src/components/data/views/grid-view.tsx src/components/data/record-table.tsx
git commit -m "feat(data): integrate right-click context menu into grid view"
```

---

## Task 5: Update Filter Types for AND/OR Groups

**Files:**
- Modify: `src/types/data-table.ts`

- [ ] **Step 1: Add FilterGroup type and update DataViewConfig**

In `src/types/data-table.ts`, after the existing `FilterCondition` interface (line ~125), add:

```typescript
export interface FilterGroup {
  operator: "AND" | "OR"
  conditions: FilterCondition[]
}

/** Normalize legacy flat FilterCondition[] to FilterGroup[] */
export function normalizeFilters(
  filters: FilterCondition[] | FilterGroup[] | null | undefined
): FilterGroup[] {
  if (!filters || filters.length === 0) return []
  // Detect new format: FilterGroup has "conditions" property
  if ("conditions" in filters[0]) {
    return filters as FilterGroup[]
  }
  // Legacy format: flat FilterCondition[] — wrap in single AND group
  return [{ operator: "AND", conditions: filters as FilterCondition[] }]
}
```

Also update `DataViewConfig` (line ~132) and `DataViewItem` (line ~147) to change `filters: FilterCondition[]` to `filters: FilterGroup[]`:

```typescript
export interface DataViewConfig {
  filters: FilterGroup[]
  sortBy: SortConfig[]
  visibleFields: string[]
  fieldOrder: string[]
  groupBy: string | null
  viewOptions: Record<string, unknown>
}

export interface DataViewItem {
  // ... same fields, but:
  filters: FilterGroup[]
  // ... rest unchanged
}
```

- [ ] **Step 2: Fix all compilation errors from the type change**

The type change from `FilterCondition[]` to `FilterGroup[]` will cause errors in:
- `src/components/data/column-header.tsx` — filter prop type and handler
- `src/components/data/views/grid-view.tsx` — filters prop type
- `src/components/data/record-table.tsx` — passing filters
- `src/hooks/use-table-data.ts` — filter state type
- `src/lib/services/data-record.service.ts` — filterConditions param type
- `src/app/api/data-tables/[id]/records/route.ts` — query param parsing

Update each file to use `FilterGroup[]` and call `normalizeFilters()` at API boundaries where old data might come in.

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/types/data-table.ts src/components/data/column-header.tsx src/components/data/views/grid-view.tsx src/components/data/record-table.tsx src/hooks/use-table-data.ts src/lib/services/data-record.service.ts src/lib/services/data-view.service.ts src/app/api/data-tables/[id]/records/route.ts
git commit -m "refactor(data): update filter types from flat array to FilterGroup[]"
```

---

## Task 6: Refactor Backend Filter Query to Support AND/OR Groups

**Files:**
- Modify: `src/lib/services/data-record.service.ts`

- [ ] **Step 1: Rewrite buildFilterConditionsFromSpec to handle FilterGroup[]**

In `src/lib/services/data-record.service.ts`, replace `buildFilterConditionsFromSpec` (lines 861-899) with a new version that handles both `FilterGroup[]` and legacy `FilterCondition[]`:

```typescript
import type { FilterCondition, FilterGroup } from "@/types/data-table"
import { normalizeFilters } from "@/types/data-table"

function buildConditionFromFilter(
  cond: FilterCondition,
  fields: DataFieldItem[]
): Record<string, unknown> | null {
  const field = fields.find((f) => f.key === cond.fieldKey)
  if (!field) return null

  switch (cond.op) {
    case "isempty":
      return { OR: [
        { data: { path: [cond.fieldKey], equals: null } },
        { data: { path: [cond.fieldKey], equals: "" } },
      ]}
    case "isnotempty":
      return { NOT: { OR: [
        { data: { path: [cond.fieldKey], equals: null } },
        { data: { path: [cond.fieldKey], equals: "" } },
      ]}}
    case "eq":
      return { data: { path: [cond.fieldKey], equals: cond.value } }
    case "ne":
      return { NOT: { data: { path: [cond.fieldKey], equals: cond.value } } }
    case "contains":
      return { data: { path: [cond.fieldKey], string_contains: String(cond.value) } }
    case "gt":
    case "gte":
    case "lt":
    case "lte":
      return { data: { path: [cond.fieldKey], string_contains: String(cond.value) } }
    default:
      return null
  }
}

/** Build Prisma where conditions from FilterGroup[] (or legacy FilterCondition[]) */
function buildFilterConditionsFromSpec(
  filterInput: FilterGroup[] | FilterCondition[],
  fields: DataFieldItem[]
): Record<string, unknown>[] {
  const groups = normalizeFilters(filterInput)

  return groups
    .map((group) => {
      const built = group.conditions
        .map((c) => buildConditionFromFilter(c, fields))
        .filter(Boolean) as Record<string, unknown>[]

      if (built.length === 0) return null

      // If group operator is OR, wrap conditions in Prisma OR
      if (group.operator === "OR") {
        return { OR: built }
      }
      // AND: return each condition individually (they'll be AND-combined by caller)
      return built.length === 1 ? built[0] : { AND: built }
    })
    .filter(Boolean) as Record<string, unknown>[]
}
```

The function signature stays the same (accepts array), so existing call sites don't break.

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Manual test — existing filters still work**

Open a data table with saved filters, verify records are filtered correctly. Also test with a view that has no filters.

- [ ] **Step 4: Commit**

```bash
git add src/lib/services/data-record.service.ts
git commit -m "feat(data): support AND/OR nested filter groups in backend query"
```

---

## Task 7: Create Filter Panel UI

**Files:**
- Create: `src/components/data/filter-panel.tsx`
- Modify: `src/components/data/record-table.tsx`
- Modify: `src/components/data/views/grid-view.tsx`

- [ ] **Step 1: Create filter-panel.tsx**

Create `src/components/data/filter-panel.tsx` — a Popover-based panel for managing filter groups:

```tsx
"use client"

import { useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import type { DataFieldItem, FilterCondition, FilterGroup } from "@/types/data-table"
import { Plus, Trash2, ListFilter } from "lucide-react"
import { cn } from "@/lib/utils"

const OPERATOR_OPTIONS = [
  { value: "eq", label: "等于" },
  { value: "ne", label: "不等于" },
  { value: "contains", label: "包含" },
  { value: "not_contains", label: "不包含" },
  { value: "gt", label: "大于" },
  { value: "lt", label: "小于" },
  { value: "gte", label: "大于等于" },
  { value: "lte", label: "小于等于" },
  { value: "isempty", label: "为空" },
  { value: "isnotempty", label: "不为空" },
]

const NO_VALUE_OPS = ["isempty", "isnotempty"]

interface FilterPanelProps {
  fields: DataFieldItem[]
  filters: FilterGroup[]
  onChange: (filters: FilterGroup[]) => void
}

export function FilterPanel({ fields, filters, onChange }: FilterPanelProps) {
  const updateGroup = useCallback(
    (groupIndex: number, updater: (group: FilterGroup) => FilterGroup) => {
      onChange(filters.map((g, i) => (i === groupIndex ? updater(g) : g)))
    },
    [filters, onChange],
  )

  const addGroup = useCallback(() => {
    onChange([...filters, { operator: "AND", conditions: [{ fieldKey: fields[0]?.key ?? "", op: "eq", value: "" }] }])
  }, [filters, fields, onChange])

  const removeGroup = useCallback(
    (groupIndex: number) => {
      onChange(filters.filter((_, i) => i !== groupIndex))
    },
    [filters, onChange],
  )

  const addCondition = useCallback(
    (groupIndex: number) => {
      updateGroup(groupIndex, (g) => ({
        ...g,
        conditions: [...g.conditions, { fieldKey: fields[0]?.key ?? "", op: "eq", value: "" }],
      }))
    },
    [fields, updateGroup],
  )

  const updateCondition = useCallback(
    (groupIndex: number, condIndex: number, patch: Partial<FilterCondition>) => {
      updateGroup(groupIndex, (g) => ({
        ...g,
        conditions: g.conditions.map((c, i) => (i === condIndex ? { ...c, ...patch } : c)),
      }))
    },
    [updateGroup],
  )

  const removeCondition = useCallback(
    (groupIndex: number, condIndex: number) => {
      updateGroup(groupIndex, (g) => ({
        ...g,
        conditions: g.conditions.filter((_, i) => i !== condIndex),
      }))
    },
    [updateGroup],
  )

  const hasFilters = filters.some((g) => g.conditions.length > 0)

  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" size="sm" className={cn(hasFilters && "border-primary")} />}>
        <ListFilter className="h-4 w-4 mr-1" />
        筛选 {hasFilters && `(${filters.reduce((acc, g) => acc + g.conditions.length, 0)})`}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[520px] max-h-[400px] overflow-y-auto p-3 space-y-3">
        {filters.map((group, gi) => (
          <div key={gi} className="border rounded-md p-2 space-y-2">
            {/* Group header: operator toggle + delete */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">条件组 {gi + 1}</span>
                <Select
                  value={group.operator}
                  onValueChange={(v) => updateGroup(gi, (g) => ({ ...g, operator: v as "AND" | "OR" }))}
                >
                  <SelectTrigger className="h-7 w-[80px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AND">AND</SelectItem>
                    <SelectItem value="OR">OR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {filters.length > 1 && (
                <Button variant="ghost" size="sm" className="h-7 px-1" onClick={() => removeGroup(gi)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
            {/* Conditions */}
            {group.conditions.map((cond, ci) => (
              <div key={ci} className="flex items-center gap-1">
                <Select value={cond.fieldKey} onValueChange={(v) => updateCondition(gi, ci, { fieldKey: v })}>
                  <SelectTrigger className="h-7 flex-1 text-xs">
                    <SelectValue placeholder="选择字段" />
                  </SelectTrigger>
                  <SelectContent>
                    {fields.map((f) => (
                      <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={cond.op} onValueChange={(v) => updateCondition(gi, ci, { op: v as FilterCondition["op"] })}>
                  <SelectTrigger className="h-7 w-[100px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATOR_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!NO_VALUE_OPS.includes(cond.op) && (
                  <Input
                    className="h-7 flex-1 text-xs"
                    value={String(cond.value)}
                    onChange={(e) => updateCondition(gi, ci, { value: e.target.value })}
                    placeholder="值"
                  />
                )}
                <Button variant="ghost" size="sm" className="h-7 px-1" onClick={() => removeCondition(gi, ci)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => addCondition(gi)}>
              <Plus className="h-3 w-3 mr-1" /> 添加条件
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" className="w-full text-xs" onClick={addGroup}>
          <Plus className="h-3 w-3 mr-1" /> 添加条件组
        </Button>
      </PopoverContent>
    </Popover>
  )
}
```

- [ ] **Step 2: Wire FilterPanel into record-table.tsx toolbar**

In `src/components/data/record-table.tsx`, add `FilterPanel` to the toolbar area (before or next to existing search input). Pass `filters` from `currentConfig.filters` and `onChange` calling `setFilters`.

- [ ] **Step 3: Update grid-view.tsx onFilterChange handler**

The existing `onFilterChange` in grid-view takes `(filter: FilterCondition | null, fieldKey: string)` for single-column filter toggle from ColumnHeader. This should now update the relevant group's condition. Update the handler in `record-table.tsx` to map single-column changes to the new `FilterGroup[]` structure.

- [ ] **Step 4: Verify compilation and manual test**

Run: `npx tsc --noEmit`, then test in browser — open filter panel, add groups, switch AND/OR, verify filtering works.

- [ ] **Step 5: Commit**

```bash
git add src/components/data/filter-panel.tsx src/components/data/record-table.tsx src/components/data/views/grid-view.tsx
git commit -m "feat(data): add FilterPanel with AND/OR grouped filter UI"
```

---

## Task 8: Add Conditional Formatting Types and Dialog

**Files:**
- Modify: `src/types/data-table.ts`
- Create: `src/components/data/conditional-format-dialog.tsx`

- [ ] **Step 1: Add ConditionalFormatRule type**

In `src/types/data-table.ts`, after `FilterGroup`, add:

```typescript
export interface ConditionalFormatRule {
  id: string
  name?: string
  condition: FilterCondition
  backgroundColor: string
  textColor?: string
  scope: "row" | "cell"
}
```

- [ ] **Step 2: Create conditional-format-dialog.tsx**

Create `src/components/data/conditional-format-dialog.tsx` — a Dialog for managing conditional formatting rules:

```tsx
"use client"

import { useCallback, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Paintbrush, Plus, Trash2 } from "lucide-react"
import type { ConditionalFormatRule, DataFieldItem, FilterCondition } from "@/types/data-table"

const PRESET_COLORS = [
  { bg: "#fef3c7", text: "#92400e", label: "琥珀" },
  { bg: "#dbeafe", text: "#1e40af", label: "蓝色" },
  { bg: "#dcfce7", text: "#166534", label: "绿色" },
  { bg: "#fce7f3", text: "#9d174d", label: "粉色" },
  { bg: "#f3e8ff", text: "#6b21a8", label: "紫色" },
  { bg: "#fed7aa", text: "#9a3412", label: "橙色" },
  { bg: "#e0e7ff", text: "#3730a3", label: "靛蓝" },
  { bg: "#ccfbf1", text: "#115e59", label: "青色" },
  { bg: "#fecaca", text: "#991b1b", label: "红色" },
  { bg: "#f5f5f4", text: "#44403c", label: "灰色" },
  { bg: "#fef08a", text: "#854d0e", label: "黄色" },
  { bg: "#c7d2fe", text: "#4338ca", label: "靛蓝淡" },
]

const OPERATOR_OPTIONS = [
  { value: "eq", label: "等于" },
  { value: "ne", label: "不等于" },
  { value: "contains", label: "包含" },
  { value: "isempty", label: "为空" },
  { value: "isnotempty", label: "不为空" },
  { value: "gt", label: "大于" },
  { value: "lt", label: "小于" },
]

interface ConditionalFormatDialogProps {
  fields: DataFieldItem[]
  rules: ConditionalFormatRule[]
  onChange: (rules: ConditionalFormatRule[]) => void
  /** Quick-create from a cell's value */
  quickCreateField?: string
  quickCreateValue?: string
}

export function ConditionalFormatDialog({
  fields,
  rules,
  onChange,
  quickCreateField,
  quickCreateValue,
}: ConditionalFormatDialogProps) {
  const [open, setOpen] = useState(false)

  const addRule = useCallback(() => {
    if (rules.length >= 20) return // Max 20 rules enforced
    const newRule: ConditionalFormatRule = {
      id: `rule-${Date.now()}`,
      condition: {
        fieldKey: quickCreateField ?? fields[0]?.key ?? "",
        op: "eq",
        value: quickCreateValue ?? "",
      },
      backgroundColor: PRESET_COLORS[0].bg,
      textColor: PRESET_COLORS[0].text,
      scope: "cell",
    }
    onChange([...rules, newRule])
  }, [fields, quickCreateField, quickCreateValue, rules, onChange])

  const removeRule = useCallback(
    (ruleId: string) => {
      onChange(rules.filter((r) => r.id !== ruleId))
    },
    [rules, onChange],
  )

  const updateRule = useCallback(
    (ruleId: string, patch: Partial<ConditionalFormatRule>) => {
      onChange(rules.map((r) => (r.id === ruleId ? { ...r, ...patch } : r)))
    },
    [rules, onChange],
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Paintbrush className="h-4 w-4 mr-1" />
        条件格式 {rules.length > 0 && `(${rules.length})`}
      </DialogTrigger>
      <DialogContent className="max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>条件格式规则</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="border rounded-md p-3 space-y-2"
              style={{ borderLeftColor: rule.backgroundColor, borderLeftWidth: 4 }}
            >
              <div className="flex items-center justify-between">
                <Input
                  className="h-7 text-xs w-[120px]"
                  value={rule.name ?? ""}
                  onChange={(e) => updateRule(rule.id, { name: e.target.value })}
                  placeholder="规则名称"
                />
                <div className="flex items-center gap-2">
                  <Select
                    value={rule.scope}
                    onValueChange={(v) => updateRule(rule.id, { scope: v as "row" | "cell" })}
                  >
                    <SelectTrigger className="h-7 w-[80px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cell">单元格</SelectItem>
                      <SelectItem value="row">整行</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="sm" className="h-7 px-1" onClick={() => removeRule(rule.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              {/* Condition row */}
              <div className="flex items-center gap-1">
                <Select
                  value={rule.condition.fieldKey}
                  onValueChange={(v) =>
                    updateRule(rule.id, { condition: { ...rule.condition, fieldKey: v } })
                  }
                >
                  <SelectTrigger className="h-7 flex-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fields.map((f) => (
                      <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={rule.condition.op}
                  onValueChange={(v) =>
                    updateRule(rule.id, { condition: { ...rule.condition, op: v as FilterCondition["op"] } })
                  }
                >
                  <SelectTrigger className="h-7 w-[90px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATOR_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!["isempty", "isnotempty"].includes(rule.condition.op) && (
                  <Input
                    className="h-7 flex-1 text-xs"
                    value={String(rule.condition.value)}
                    onChange={(e) =>
                      updateRule(rule.id, { condition: { ...rule.condition, value: e.target.value } })
                    }
                  />
                )}
              </div>
              {/* Color palette */}
              <div className="flex flex-wrap gap-1.5">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c.bg}
                    className="w-7 h-7 rounded border-2 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: c.bg,
                      borderColor: rule.backgroundColor === c.bg ? "#333" : "transparent",
                    }}
                    title={c.label}
                    onClick={() => updateRule(rule.id, { backgroundColor: c.bg, textColor: c.text })}
                  />
                ))}
              </div>
            </div>
          ))}
          {rules.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              暂无条件格式规则
            </p>
          )}
          <Button variant="outline" size="sm" className="w-full" onClick={addRule}>
            <Plus className="h-3 w-3 mr-1" /> 添加规则
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/types/data-table.ts src/components/data/conditional-format-dialog.tsx
git commit -m "feat(data): add ConditionalFormatRule type and management dialog"
```

---

## Task 9: Integrate Conditional Formatting into Grid View

**Files:**
- Modify: `src/components/data/record-table.tsx`
- Modify: `src/components/data/views/grid-view.tsx`
- Modify: `src/hooks/use-table-data.ts`

- [ ] **Step 1: Store conditional formatting rules in viewOptions**

In `src/hooks/use-table-data.ts`, add helper methods to get/set conditional formatting rules from `viewOptions`:

```typescript
// Inside useTableData hook, derive conditionalFormatRules from viewOptions
const conditionalFormatRules: ConditionalFormatRule[] = useMemo(
  () => (currentConfig.viewOptions.conditionalFormatting as ConditionalFormatRule[]) ?? [],
  [currentConfig.viewOptions.conditionalFormatting],
)

const setConditionalFormatRules = useCallback(
  (rules: ConditionalFormatRule[]) => {
    setViewOptions({ ...currentConfig.viewOptions, conditionalFormatting: rules })
  },
  [currentConfig.viewOptions, setViewOptions],
)
```

Export these from the hook's return type.

- [ ] **Step 2: Pass rules to GridView and apply styles**

In `src/components/data/views/grid-view.tsx`:

1. Accept `conditionalFormatRules: ConditionalFormatRule[]` as a new prop.
2. Create a `useMemo` that computes styles for each record:
```typescript
const recordStyles = useMemo(() => {
  if (conditionalFormatRules.length === 0) return {}
  const map: Record<string, React.CSSProperties> = {}
  for (const record of records) {
    for (const rule of conditionalFormatRules) {
      const val = record.data[rule.condition.fieldKey]
      let match = false
      switch (rule.condition.op) {
        case "eq": match = String(val ?? "") === String(rule.condition.value); break
        case "ne": match = String(val ?? "") !== String(rule.condition.value); break
        case "contains": match = String(val ?? "").includes(String(rule.condition.value)); break
        case "isempty": match = val === undefined || val === null || val === ""; break
        case "isnotempty": match = val !== undefined && val !== null && val !== ""; break
        case "gt": match = Number(val) > Number(rule.condition.value); break
        case "lt": match = Number(val) < Number(rule.condition.value); break
      }
      if (match) {
        map[record.id] = {
          backgroundColor: rule.backgroundColor,
          color: rule.textColor,
        }
        break // first matching rule wins
      }
    }
  }
  return map
}, [records, conditionalFormatRules])
```
3. In `renderRecordRow`, apply `recordStyles[record.id]` to the `<tr>` element (for row scope) or to individual `<td>` elements (for cell scope).

- [ ] **Step 3: Add ConditionalFormatDialog to record-table.tsx toolbar**

Add `ConditionalFormatDialog` button next to the existing filter panel button, passing `fields`, `conditionalFormatRules`, and `onChange`.

- [ ] **Step 4: Wire the right-click "添加条件格式" to open the dialog**

In `grid-view.tsx`, add state for `quickFormatField`/`quickFormatValue` and pass to `ConditionalFormatDialog`.

- [ ] **Step 5: Verify compilation and manual test**

Run: `npx tsc --noEmit`, then test in browser — add a rule, verify colors appear on matching rows.

- [ ] **Step 6: Commit**

```bash
git add src/components/data/views/grid-view.tsx src/components/data/record-table.tsx src/hooks/use-table-data.ts
git commit -m "feat(data): integrate conditional formatting into grid view rendering"
```

---

## Task 10: Final Integration and Polish

**Files:**
- All modified files

- [ ] **Step 1: Run full type check**

Run: `npx tsc --noEmit`

- [ ] **Step 2: Run linter**

Run: `npm run lint`

- [ ] **Step 3: Build check**

Run: `npm run build`

- [ ] **Step 4: Manual end-to-end test**

1. Right-click a cell — verify Edit, Copy, Insert Row, Delete, Filter, Sort, Expand menu items work
2. Right-click row header — verify Insert, Duplicate, Delete, Expand
3. Right-click column header — verify Sort, Freeze, Hide, Auto-fit
4. Open filter panel — add two groups, set one to AND, one to OR, verify filtering
5. Open conditional format dialog — add a rule, verify row/cell coloring
6. Right-click a cell and use "添加条件格式" — verify quick-create works
7. Verify existing features still work: inline editing, column drag, row drag, keyboard nav

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(data): complete Airtable enhancement — context menu, filter groups, conditional formatting"
```
