# Data Table Airtable Enhancement Design

Date: 2026-04-06
Branch: feat/data-table-airtable-enhancement

## Overview

Three incremental improvements to bring the data table closer to Airtable's experience:

1. Right-click context menu
2. AND/OR nested filter groups
3. Conditional formatting

## 1. Right-Click Context Menu

### Menu Items by Click Target

| Target | Menu Items |
|--------|-----------|
| Cell | Edit, Copy cell value, Insert row above, Insert row below, Delete row, Filter by this cell, Sort by this column ↑↓, Expand record detail |
| Row header | Insert row above, Insert row below, Duplicate row, Delete row, Expand record detail |
| Column header | Sort ascending/descending, Freeze/unfreeze column, Hide column, Filter this column, Auto-fit width |

### Implementation

- Wrap `<table>` in grid-view with shadcn/ui `ContextMenu`
- New hook `use-context-menu.ts` tracks: targetType (cell/rowHeader/colHeader), targetRowId, targetFieldKey
- Menu actions reuse existing APIs (batch delete, sort, filter, reorder)
- "Insert row above/below" calls create record API + reorder

### Data Changes

None. Pure frontend.

## 2. AND/OR Nested Filter Groups

### Data Structure

```typescript
interface FilterGroup {
  operator: 'AND' | 'OR'
  conditions: FilterCondition[]
}

interface FilterCondition {
  fieldKey: string
  operator: 'eq' | 'ne' | 'contains' | 'not_contains' | 'gt' | 'lt' | 'gte' | 'lte' | 'isempty' | 'isnotempty'
  value: string
}
```

`DataView.filters` stores `FilterGroup[]`. Outer groups are AND-combined; each group's internal conditions use the group's operator. Semantics: `group1.conditions AND group2.conditions AND ...` where each group applies its own AND/OR.

### Backward Compatibility

Old format `FilterCondition[]` is auto-wrapped as `[{ operator: 'AND', conditions: oldFilters }]`.

### Frontend

- New `filter-panel.tsx` component with grouped filter UI
- Each group has an AND/OR toggle, add condition button, and delete button
- "Add group" button creates a new filter group
- Empty groups are ignored during query

### Backend

- `data-record.service.ts` `buildWhereClause` refactored to support nested Prisma `AND`/`OR`
- `DataView.filters` Json field stores the new structure (no schema migration)
- Updated types in `src/types/data-table.ts`

### Affected Files

- `src/types/data-table.ts`
- `src/lib/services/data-record.service.ts`
- `src/components/data/column-header.tsx`
- New: `src/components/data/filter-panel.tsx`

## 3. Conditional Formatting

### Data Structure

```typescript
interface ConditionalFormatRule {
  id: string
  name?: string
  condition: FilterCondition  // reused from filter system
  backgroundColor: string     // e.g. '#fef3c7'
  textColor?: string
  scope: 'row' | 'cell'
}
```

Stored in `DataView.viewOptions.conditionalFormatting` as `ConditionalFormatRule[]`. No schema migration needed.

### Implementation

- New `conditional-format-dialog.tsx` for rule management (add/edit/delete/reorder)
- Color selection via preset palette (10-15 colors)
- Rule evaluation at render time in grid-view, using `useMemo` for per-row caching
- First matching rule wins; rule order is adjustable via drag-and-drop
- Max 20 rules enforced client-side

### UI Entry Points

- Toolbar "Conditional Format" button opens rule dialog
- Right-click menu "Add conditional format from this cell" quick-creates a rule

### Performance

- Client-side rule evaluation only
- useMemo caches per-row style computation
- 20 rule limit prevents degredation

## Implementation Order

1. Right-click context menu (standalone, no dependencies)
2. AND/OR filter groups (data structure change, affects filtering)
3. Conditional formatting (reuses FilterCondition type from step 2)

## Architecture Constraints

- No schema migrations; all new data stored in existing Json fields
- No new npm dependencies
- Reuse existing APIs and service layer patterns
- Follow existing ServiceResult<T> pattern for any new backend logic
