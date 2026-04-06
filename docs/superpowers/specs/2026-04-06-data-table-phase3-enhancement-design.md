# Data Table Phase 3 Enhancement Design

Date: 2026-04-06
Branch: feat/data-table-enhancements

## Overview

Three-phase enhancement plan to close the gap between the current data table implementation and Airtable, focused on: new field types + summary bar, undo/redo, and formula fields.

## P1: New Field Types + Summary Bar

### P1-A: New Field Types

Add 5 new FieldType enum values. Note: the existing `DataField` model has an `options Json?` field — all new type-specific metadata will be stored there (not in a separate `meta` field):

```
DataField.options: {
  // AUTO_NUMBER
  nextValue?: number

  // SYSTEM_TIMESTAMP / SYSTEM_USER
  kind?: "created" | "updated"

  // FORMULA (P3)
  formula?: string
}
```

A TypeScript type `FieldOptions` will be defined to type-narrow the JSON structure.

| Type | Storage | Editable | Display |
|------|---------|----------|---------|
| `URL` | `string` | Yes (text input with URL validation) | Clickable `<a>` link |
| `BOOLEAN` | `boolean` | Yes (single click to toggle) | Green check / gray empty box |
| `AUTO_NUMBER` | `number` | No | Integer text |
| `SYSTEM_TIMESTAMP` | `DateTime string` | No | Formatted datetime |
| `SYSTEM_USER` | `string` (user id) | No | Display name |

#### Auto Number

- `DataField.options.nextValue` tracks the next value (starts at 1)
- Service layer assigns and increments on record creation within a transaction + row lock (`SELECT ... FOR UPDATE` on the DataField row)
- Batch create: must iterate records individually (not `createMany`) to ensure sequential number assignment
- Deleted records do not recycle numbers

#### System Timestamp

- `options.kind`: `"created"` or `"updated"`
- **Do NOT store in DataRecord.data JSONB** — read directly from `DataRecord.createdAt` / `DataRecord.updatedAt`
- CREATED: set once on `createRecord`, never modified
- UPDATED: set on `createRecord`, refreshed on every `updateRecord`

#### System User

- `options.kind`: `"created"` or `"updated"`
- **Do NOT store in DataRecord.data JSONB** — read directly from `DataRecord.createdById` / map `updatedById` (new field, see below)
- CREATED_BY: maps to `DataRecord.createdById`
- UPDATED_BY: requires adding `updatedById String?` to DataRecord model, set on every update
- Display resolves user id to display name via lookup

#### Changes Required

- `prisma/schema.prisma`: add 5 values to `FieldType` enum; add `updatedById String?` to DataRecord
- `src/types/data-table.ts`: update type guards and helpers; define `FieldOptions` type
- `src/components/data/cell-editors/`: add `url-cell-editor.tsx`, `boolean-cell-editor.tsx`
- `src/lib/format-cell.tsx`: add formatters for all 5 types
- `src/lib/services/data-record.service.ts`: inject auto-number; skip SYSTEM fields in `validateRecordData`; set `updatedById` on updates
- `src/components/data/field-config-form.tsx`: add new types to creation options
- `src/components/data/column-header.tsx`: update filter operators per type

### P1-B: Bottom Summary Bar

Fixed row at the bottom of the grid showing per-column aggregate values.

#### Aggregation Rules

| Field Type | Default | Available |
|------------|---------|-----------|
| TEXT / URL / EMAIL / PHONE / SELECT | Count | Count |
| NUMBER | Sum | Sum / Avg / Min / Max / Count |
| BOOLEAN | Checked count | Checked / Unchecked / Count |
| DATE / SYSTEM_TIMESTAMP | Earliest | Earliest / Latest / Count |
| AUTO_NUMBER | Count | Count |
| FORMULA | Depends on result type | Same as NUMBER or TEXT |

#### Interaction

- Click column footer to cycle aggregation type, or use dropdown
- Values recalculate based on currently filtered records (not full table)
- Hidden columns do not show in summary bar
- FORMULA and SYSTEM fields are excluded from summary by default

#### Implementation

- **Server-side computation**: add `GET /api/data-tables/[id]/summary` endpoint that computes aggregates over all filtered records using SQL aggregate functions (`SUM`, `AVG`, `COUNT`, `MIN`, `MAX`). Accepts same filter/sort params as the records endpoint.
- New hook: `use-summary-row.ts`
  - Calls the summary API with current filter state
  - Output: `{ [fieldKey]: { value: number | string, type: AggregateType } }`
  - Refetch when filters change
- Aggregation preference stored in `DataView.viewOptions.columnAggregations`, auto-saved on change
  - Format: `{ [fieldKey]: "sum" | "avg" | "count" | "min" | "max" | "earliest" | "latest" | "checked" | "unchecked" }`
  - Merged with existing viewOptions (conditionalFormatting, etc.) on save
- UI: summary row rendered at bottom of `grid-view.tsx`, sticky position

## P2: Session-Level Undo/Redo

### Command Pattern

```typescript
interface Command {
  type: "UPDATE_CELL" | "ADD_RECORD" | "DELETE_RECORD" | "BATCH_UPDATE" | "ADD_FIELD" | "DELETE_FIELD"
  execute: () => Promise<void>
  undo: () => Promise<void>
  description: string
}
```

### UndoManager Hook

```typescript
// use-undo-manager.ts
{
  undoStack: Command[]       // max 50
  redoStack: Command[]
  canUndo: boolean
  canRedo: boolean
  isExecuting: boolean       // true while async undo/redo is in flight
  execute(command): void     // execute + push to undoStack, clear redoStack
  undo(): void               // pop undoStack, call undo(), push to redoStack
  redo(): void               // pop redoStack, call execute(), push to undoStack
  clear(): void              // reset both stacks
}
```

#### Async Error Handling

- `isExecuting` flag disables undo/redo buttons during async operations
- If `undo()` or `redo()` throws (network error): the command remains in its current stack, show error toast, do NOT modify stack state
- If `execute()` (initial action) throws: do not push to undo stack, let the calling code handle the error naturally

### Covered Operations

| Operation | Undo | Redo |
|-----------|------|------|
| Cell edit | Restore old value | Re-apply new value |
| Add record | Delete the record | Re-create with original data |
| Delete record | Re-insert with original data | Delete again |
| Batch edit | Restore all original values | Re-apply batch values |
| Add field | Delete field | Re-create field |
| Delete field | Restore field + data | Delete again |

### Keyboard Shortcuts

- `Ctrl+Z` → undo
- `Ctrl+Shift+Z` / `Ctrl+Y` → redo

### UI

- Toolbar buttons for undo/redo (disabled state when stack empty)
- Hover tooltip shows operation description (e.g., "撤销: 编辑了姓名")
- Toast notification on undo/redo: "已撤销：编辑了姓名"

### Constraints

- Stack limit: 50 commands
- Cleared on: page refresh, table switch, branch navigation
- No cross-tab synchronization
- No persistence across sessions

## P3: Formula Field Engine

### Field Type

New `FORMULA` FieldType. Value computed from formula, not manually editable.

Formula stored in `DataField.options.formula` as a string.

#### Result Storage

- Formula results are computed client-side and stored in `DataRecord.data[fieldKey]` in JSONB
- On record create/update, the server recalculates formula values and persists them
- Result type is dynamic: `number | string | boolean | null`
- Sorting and filtering on formula fields use the persisted JSONB values

### Reference Syntax

- `{ fieldName }` references another field in the same table
- Supports Chinese field names, matched literally inside braces

### Supported Functions

| Category | Functions |
|----------|-----------|
| Math | `SUM`, `AVERAGE`, `MIN`, `MAX`, `ROUND`, `ABS`, `CEILING`, `FLOOR` |
| Logic | `IF`, `AND`, `OR`, `NOT` |
| Text | `CONCAT`, `LEN`, `LEFT`, `RIGHT`, `MID`, `UPPER`, `LOWER`, `TRIM` |
| Date | `DATE_DIFF`, `NOW`, `YEAR`, `MONTH`, `DAY` |
| Conversion | `NUMBER`, `TEXT` |

### Operators

- Arithmetic: `+`, `-`, `*`, `/`, `%`
- Comparison: `=`, `!=`, `>`, `<`, `>=`, `<=`
- String concatenation: `&`
- Parentheses: `(`, `)`

### Parser Architecture

```
Formula string → Tokenizer → AST Builder → Evaluator
```

1. **Tokenizer**: splits into tokens (number, string literal, function name, operator, field reference)
2. **AST Builder**: builds expression tree, validates syntax, detects circular references
3. **Evaluator**: recursive evaluation, receives field values map of current record

### Circular Reference Detection

On formula save, build a field dependency graph and check for cycles:

```
Field A → Field B → Field C → Field A  ← reject
```

### Error Display

| Error | Display |
|-------|---------|
| Division by zero | `#DIV/0` |
| Type mismatch | `#TYPE` |
| Circular reference | reject save with message |
| Missing field ref | `#REF` |

### Computation

- Client-side evaluation (data < 1K)
- Recalculate when any referenced field changes
- Full table recalculation when formula is created or modified

### Formula Editor

- Formula input in field configuration
- On `{` keypress, show field picker dropdown
- Live preview using first record before saving

### Implementation Files

- `src/lib/formula/tokenizer.ts`
- `src/lib/formula/ast.ts`
- `src/lib/formula/evaluator.ts`
- `src/lib/formula/dependency-graph.ts`
- `src/components/data/cell-editors/formula-cell-editor.tsx` (read-only display)
- `src/components/data/formula-editor.tsx` (config-time editor with field picker)
- `src/hooks/use-formula.ts` (hook for computed values)

## Implementation Order

1. **P1-A**: New field types (URL, BOOLEAN, AUTO_NUMBER, SYSTEM_TIMESTAMP, SYSTEM_USER)
2. **P1-B**: Bottom summary bar
3. **P2**: Session-level undo/redo
4. **P3**: Formula field engine
