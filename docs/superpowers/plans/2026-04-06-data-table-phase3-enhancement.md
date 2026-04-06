# Data Table Phase 3 Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add new field types, bottom summary bar, session-level undo/redo, and formula field engine to close the gap with Airtable.

**Architecture:** Four independent phases, each deployable. P1-A extends Prisma schema and adds cell editors. P1-B adds a server-side aggregate API + summary row hook. P2 uses a Command Pattern with an undo/redo stack in a custom hook. P3 implements a custom formula parser (tokenizer → AST → evaluator).

**Tech Stack:** Next.js 16, Prisma v7 (PostgreSQL), shadcn/ui v4, TypeScript, Vitest

**Spec:** `docs/superpowers/specs/2026-04-06-data-table-phase3-enhancement-design.md`

---

## File Structure

### New Files

```
src/components/data/cell-editors/url-cell-editor.tsx       — URL text input with validation
src/components/data/cell-editors/boolean-cell-editor.tsx    — Toggle checkbox
src/hooks/use-summary-row.ts                                — Fetches & manages summary data
src/app/api/data-tables/[id]/summary/route.ts              — SQL aggregate endpoint
src/hooks/use-undo-manager.ts                               — Undo/redo stack management
src/lib/formula/tokenizer.ts                                — Formula string → tokens
src/lib/formula/ast.ts                                      — Token array → AST nodes
src/lib/formula/evaluator.ts                               — AST → computed value
src/lib/formula/dependency-graph.ts                         — Circular reference detection
src/lib/formula/index.ts                                    — Public API barrel export
src/components/data/formula-editor.tsx                      — Formula input with field picker
src/components/data/cell-editors/formula-cell-editor.tsx     — Read-only formula display
src/hooks/use-formula.ts                                    — Compute formula values for records
```

### Modified Files

```
prisma/schema.prisma                                         — Add FieldType enum values, updatedById
src/types/data-table.ts                                      — Add FieldOptions type, AggregateType
src/lib/format-cell.tsx                                      — Add URL, BOOLEAN, AUTO_NUMBER, SYSTEM formatters
src/lib/services/data-record.service.ts                      — Auto-number injection, system field skip, updatedById
src/lib/services/data-record.service.test.ts                 — Add tests for new validation + auto-number
src/components/data/cell-editors/text-cell-editor.tsx        — (no change, reference pattern)
src/components/data/field-config-form.tsx                    — Add new types to FIELD_TYPES list
src/components/data/column-header.tsx                        — Add filter operators for new types
src/components/data/views/grid-view.tsx                      — Integrate summary row, undo/redo, formula
src/hooks/use-table-data.ts                                  — Add summary state, undo manager integration
src/hooks/use-keyboard-nav.ts                                — Add Ctrl+Z / Ctrl+Shift+Z
```

---

## Task 1: Schema & Type Foundation

**Files:**
- Modify: `prisma/schema.prisma:268-279` (FieldType enum)
- Modify: `prisma/schema.prisma:340-356` (DataRecord model)
- Modify: `src/types/data-table.ts`
- Run: `npx prisma db push && npx prisma generate`

- [ ] **Step 1: Add new FieldType enum values**

In `prisma/schema.prisma`, add 5 new values to the FieldType enum:

```prisma
enum FieldType {
  TEXT
  NUMBER
  DATE
  SELECT
  MULTISELECT
  EMAIL
  PHONE
  FILE
  RELATION
  RELATION_SUBTABLE
  URL
  BOOLEAN
  AUTO_NUMBER
  SYSTEM_TIMESTAMP
  SYSTEM_USER
}
```

Also add `FORMULA` for P3 (add it now so schema migration happens once):

```prisma
  FORMULA
```

- [ ] **Step 2: Add updatedById to DataRecord model and User relation**

In `prisma/schema.prisma`, add to DataRecord model after `createdById`:

Also add the reverse relation to the User model (find `dataRecords   DataRecord[]` and add below it):
```prisma
  updatedDataRecords DataRecord[]  @relation("UpdatedByUser")
```

```prisma
model DataRecord {
  id               String            @id @default(cuid())
  tableId          String
  table            DataTable         @relation(fields: [tableId], references: [id], onDelete: Cascade)
  data             Json
  relationRowsFrom DataRelationRow[] @relation("RelationRowsAsSource")
  relationRowsTo   DataRelationRow[] @relation("RelationRowsAsTarget")
  records          Record[]
  createdBy        User              @relation(fields: [createdById], references: [id])
  createdById      String
  updatedBy        User?             @relation("UpdatedByUser", fields: [updatedById], references: [id])
  updatedById      String?
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt
  @@index([tableId])
  @@index([createdById])
  @@index([updatedById])             // ← new index
  @@index([tableId, createdAt(sort: Desc)])
  @@index([tableId, createdById])
}
```

- [ ] **Step 3: Push schema and regenerate**

Run:
```bash
npx prisma db push
npx prisma generate
```

- [ ] **Step 4: Add FieldOptions type to data-table.ts**

Add to `src/types/data-table.ts` after the `RelationSchemaConfig` interface:

```typescript
// ========== Field Options (stored in DataField.options JSON) ==========

export interface FieldOptions {
  /** AUTO_NUMBER: next auto-increment value */
  nextValue?: number;
  /** SYSTEM_TIMESTAMP / SYSTEM_USER: "created" or "updated" */
  kind?: "created" | "updated";
  /** FORMULA: formula expression string */
  formula?: string;
}

export function parseFieldOptions(raw: unknown): FieldOptions {
  if (!raw || typeof raw !== "object") return {};
  return raw as FieldOptions;
}
```

- [ ] **Step 5: Add AggregateType**

Add to `src/types/data-table.ts`:

```typescript
export type AggregateType =
  | "count"
  | "sum"
  | "avg"
  | "min"
  | "max"
  | "earliest"
  | "latest"
  | "checked"
  | "unchecked";

export interface SummaryRowData {
  [fieldKey: string]: {
    value: number | string;
    type: AggregateType;
  };
}
```

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma src/types/data-table.ts
git commit -m "feat(data): add new FieldType enum values and FieldOptions type"
```

---

## Task 2: Service Layer — Auto Number & System Fields

**Files:**
- Modify: `src/lib/services/data-record.service.ts`
- Modify: `src/lib/services/data-record.service.test.ts`
- Run: `npx vitest run src/lib/services/data-record.service.test.ts`

- [ ] **Step 1: Write tests for validateRecordData changes**

Add to `src/lib/services/data-record.service.test.ts` (add import at the top if not already present):

```typescript
import { validateRecordData } from "@/lib/services/data-record.service";

describe("validateRecordData", () => {
  // System fields should be skipped in validation
  it("should skip SYSTEM_TIMESTAMP and SYSTEM_USER fields", () => {
    // These fields are not user-editable, so validation should not require them
    // even if they have `required: true`
    const fields = [
      { key: "created_at", type: "SYSTEM_TIMESTAMP" as const, required: true, label: "创建时间" },
      { key: "text", type: "TEXT" as const, required: true, label: "文本" },
    ];
    const data = { text: "hello" };
    const result = validateRecordData(data, fields as any);
    expect(result.success).toBe(true);
  });

  // URL validation
  it("should validate URL format", () => {
    const fields = [
      { key: "url", type: "URL" as const, required: false, label: "链接" },
    ];
    const validResult = validateRecordData({ url: "https://example.com" }, fields as any);
    expect(validResult.success).toBe(true);

    const invalidResult = validateRecordData({ url: "not-a-url" }, fields as any);
    expect(invalidResult.success).toBe(false);
    expect(invalidResult.error.message).toContain("URL");
  });

  // BOOLEAN validation
  it("should validate BOOLEAN type", () => {
    const fields = [
      { key: "active", type: "BOOLEAN" as const, required: false, label: "激活" },
    ];
    const boolResult = validateRecordData({ active: true }, fields as any);
    expect(boolResult.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/services/data-record.service.test.ts`
Expected: tests referencing SYSTEM_TIMESTAMP, URL, BOOLEAN fail (types don't exist in switch)

- [ ] **Step 3: Export validateRecordData and update it to skip system fields**

In `src/lib/services/data-record.service.ts`, change the function signature from `function validateRecordData` to `export function validateRecordData` so tests can import it. Then at the top of the for loop, add:

```typescript
export function validateRecordData(
  data: Record<string, unknown>,
  fields: DataFieldItem[]
): ServiceResult<boolean> {
  for (const field of fields) {
    // Skip system-managed fields — not user-editable
    if (
      field.type === "AUTO_NUMBER" ||
      field.type === "SYSTEM_TIMESTAMP" ||
      field.type === "SYSTEM_USER" ||
      field.type === "FORMULA"
    ) {
      continue;
    }

    const value = data[field.key];
    // ... rest of existing validation
```

- [ ] **Step 4: Add URL and BOOLEAN validation cases**

In `validateRecordData`, within the type validation switch, add after the MULTISELECT case:

```typescript
      case "URL":
        if (typeof value === "string" && value !== "" && !/^https?:\/\/.+/.test(value)) {
          return {
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: `字段 "${field.label}" 必须是有效的 URL（以 http:// 或 https:// 开头）`,
            },
          };
        }
        break;

      case "BOOLEAN":
        if (typeof value !== "boolean" && value !== "true" && value !== "false" && value !== 1 && value !== 0) {
          return {
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: `字段 "${field.label}" 必须是布尔值`,
            },
          };
        }
        break;
```

- [ ] **Step 5: Add auto-number injection in createRecord (inside transaction)**

In `src/lib/services/data-record.service.ts`, in the `createRecord` function, move the auto-number logic **inside** the existing `db.$transaction` callback. The auto-number assignment and the `nextValue` increment must be atomic.

Find the transaction block (around line 425) and restructure:

```typescript
    const record = await db.$transaction(async (tx) => {
      // ── Auto-number injection (inside transaction for atomicity) ──
      const autoNumberFields = tableResult.data.fields.filter(
        (f) => f.type === "AUTO_NUMBER"
      );
      for (const field of autoNumberFields) {
        // Lock the DataField row to prevent concurrent number assignment
        const lockedField = await tx.dataField.findUniqueOrThrow({
          where: { id: field.id },
        });
        const opts = parseFieldOptions(lockedField.options);
        const nextVal = (opts.nextValue ?? 0) + 1;
        data[field.key] = nextVal;
        await tx.dataField.update({
          where: { id: field.id },
          data: { options: toJsonInput({ ...opts, nextValue: nextVal }) },
        });
      }

      // Re-split after auto-number injection (data has been mutated)
      const { scalarData, relationData } = splitRecordDataByFieldType(
        data,
        tableResult.data.fields
      );

      const createdRecord = await tx.dataRecord.create({
        data: {
          tableId,
          data: toJsonInput(scalarData),
          createdById: userId,
        },
        include: {
          createdBy: { select: { name: true } },
        },
      });

      // ... rest of existing relation sync and return logic
    });
```

Note: remove the old `splitRecordDataByFieldType` call that was before the transaction, since we now do it inside after auto-number injection.

- [ ] **Step 6: Set updatedById in patchField and updateRecord**

In `patchField` (around line 621), add `updatedById` to the update:

```typescript
    await db.dataRecord.update({
      where: { id: recordId },
      data: {
        data: toJsonInput(updatedData),
        updatedById: existingRecord.createdById, // default to creator if not available
      },
    });
```

In `updateRecord` / `doUpdateRecord`, find the record update call and add `updatedById`:

```typescript
    await tx.dataRecord.update({
      where: { id },
      data: {
        data: toJsonInput(scalarData),
        updatedById: existingRecord.createdById,
      },
    });
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run src/lib/services/data-record.service.test.ts`
Expected: all tests PASS

- [ ] **Step 8: Commit**

```bash
git add src/lib/services/data-record.service.ts src/lib/services/data-record.service.test.ts
git commit -m "feat(data): add auto-number injection, system field skip, URL/BOOLEAN validation"
```

---

## Task 3: Cell Editors — URL & BOOLEAN

**Files:**
- Create: `src/components/data/cell-editors/url-cell-editor.tsx`
- Create: `src/components/data/cell-editors/boolean-cell-editor.tsx`

- [ ] **Step 1: Create URL cell editor**

Create `src/components/data/cell-editors/url-cell-editor.tsx`:

```tsx
"use client";

import { useRef, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

interface UrlCellEditorProps {
  initialValue: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}

export function UrlCellEditor({ initialValue, onCommit, onCancel }: UrlCellEditorProps) {
  const [draft, setDraft] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleCommit = (value: string) => {
    if (value === "" || value === initialValue) {
      onCommit(value);
      return;
    }
    if (!/^https?:\/\/.+/.test(value)) {
      setError("请输入有效的 URL");
      return;
    }
    onCommit(value);
  };

  return (
    <div className="px-1">
      <Input
        ref={inputRef}
        value={draft}
        onChange={(e) => { setDraft(e.target.value); setError(null); }}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); handleCommit(draft); }
          if (e.key === "Escape") { e.preventDefault(); onCancel(); }
          if (e.key === "Tab") { e.preventDefault(); handleCommit(draft); }
        }}
        onBlur={() => handleCommit(draft)}
        placeholder="https://..."
        className={`h-8 text-sm ${error ? "border-red-500" : "border-primary"}`}
      />
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Create BOOLEAN cell editor**

Create `src/components/data/cell-editors/boolean-cell-editor.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";

interface BooleanCellEditorProps {
  initialValue: boolean;
  onCommit: (value: boolean) => void;
}

export function BooleanCellEditor({ initialValue, onCommit }: BooleanCellEditorProps) {
  const newValue = !initialValue;
  const committed = useRef(false);

  useEffect(() => {
    if (!committed.current) {
      committed.current = true;
      onCommit(newValue);
    }
  }, [newValue, onCommit]);

  return (
    <div className="flex items-center justify-center h-8">
      <div
        className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
          newValue
            ? "bg-green-500 border-green-500"
            : "bg-white border-zinc-300"
        }`}
      >
        {newValue && (
          <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
            <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/data/cell-editors/url-cell-editor.tsx src/components/data/cell-editors/boolean-cell-editor.tsx
git commit -m "feat(data): add URL and BOOLEAN cell editors"
```

---

## Task 4: Format Cell & Grid Integration

**Files:**
- Modify: `src/lib/format-cell.tsx`
- Modify: `src/components/data/views/grid-view.tsx` (renderEditor, renderCell)
- Modify: `src/components/data/column-header.tsx`
- Modify: `src/components/data/field-config-form.tsx`

- [ ] **Step 1: Add formatters to format-cell.tsx**

Add cases to the switch in `formatCellValue` (before `default`). Use `FieldType.URL` etc. (already imported at the top of the file):

```typescript
    case FieldType.URL:
      return (
        <a
          href={String(value)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline truncate block max-w-[200px]"
          onClick={(e) => e.stopPropagation()}
        >
          {String(value)}
        </a>
      );
    case FieldType.BOOLEAN:
      return value === true || value === 1 ? (
        <div className="w-4 h-4 rounded border-2 bg-green-500 border-green-500 flex items-center justify-center">
          <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
            <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      ) : (
        <div className="w-4 h-4 rounded border-2 bg-white border-zinc-300" />
      );
    case FieldType.AUTO_NUMBER:
      return <span className="text-muted-foreground font-mono">{String(value)}</span>;
    case FieldType.SYSTEM_TIMESTAMP:
      return <span className="text-muted-foreground text-xs">{formatDateValue(value)}</span>;
    case FieldType.SYSTEM_USER:
      return <span className="text-muted-foreground text-xs">{String(value)}</span>;
    case FieldType.FORMULA:
      if (value === null || value === undefined) return <span className="text-zinc-400">-</span>;
      if (typeof value === "number") return value.toLocaleString();
      return String(value);
```

Also add to `formatCellText`:

```typescript
    case "URL":
    case "BOOLEAN":
    case "AUTO_NUMBER":
    case "SYSTEM_TIMESTAMP":
    case "SYSTEM_USER":
    case "FORMULA":
      return String(value ?? "");
```

- [ ] **Step 2: Add filter operators for new types in column-header.tsx**

Add to the `getOperatorsForType` switch (before the `default` case). Use `FieldType.URL` etc. (already imported):

```typescript
    case FieldType.URL:
      return ["eq", "ne", "contains", "isempty", "isnotempty"];
    case FieldType.BOOLEAN:
      return ["eq", "isempty"];
    case FieldType.AUTO_NUMBER:
      return ["eq", "ne", "gt", "lt", "gte", "lte", "isempty"];
    case FieldType.SYSTEM_TIMESTAMP:
      return ["eq", "gt", "lt", "gte", "lte", "isempty"];
    case FieldType.FORMULA:
      return ["eq", "ne", "gt", "lt", "gte", "lte", "isempty", "isnotempty"];
```

- [ ] **Step 3: Add new types to field-config-form.tsx**

Add to the `FIELD_TYPES` array (after FILE):

```typescript
  { value: FieldType.URL, label: "URL" },
  { value: FieldType.BOOLEAN, label: "勾选框" },
  { value: FieldType.AUTO_NUMBER, label: "自动编号" },
  { value: FieldType.SYSTEM_TIMESTAMP, label: "创建/修改时间" },
  { value: FieldType.SYSTEM_USER, label: "创建/修改人" },
  { value: FieldType.FORMULA, label: "公式" },
```

Also add condition to show system-specific options (kind selector) when type is SYSTEM_TIMESTAMP or SYSTEM_USER, and formula editor when type is FORMULA. Add auto-number start value input when type is AUTO_NUMBER.

**Note:** SYSTEM_TIMESTAMP, SYSTEM_USER, and AUTO_NUMBER are system-managed fields. They should be available in the type selector but clearly labeled as read-only. When creating these fields, the form should show a notice: "此字段由系统自动管理，不可手动编辑".

- [ ] **Step 4: Integrate editors into grid-view.tsx renderEditor**

In grid-view.tsx's `renderEditor` callback, add cases before `default`. Use `FieldType.URL` etc. (already imported):

```typescript
        case FieldType.URL:
          return (
            <UrlCellEditor
              initialValue={String(originalValue ?? "")}
              onCommit={(v) => void commitEdit(v)}
              onCancel={cancelEdit}
            />
          );
        case FieldType.BOOLEAN:
          return (
            <BooleanCellEditor
              initialValue={!!originalValue && originalValue !== "false" && originalValue !== 0}
              onCommit={(v) => void commitEdit(v)}
            />
          );
        case FieldType.AUTO_NUMBER:
        case FieldType.SYSTEM_TIMESTAMP:
        case FieldType.SYSTEM_USER:
        case FieldType.FORMULA:
          // Not editable inline
          return null;
```

Add imports at the top:
```typescript
import { UrlCellEditor } from "@/components/data/cell-editors/url-cell-editor";
import { BooleanCellEditor } from "@/components/data/cell-editors/boolean-cell-editor";
```

- [ ] **Step 5: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/lib/format-cell.tsx src/components/data/column-header.tsx src/components/data/field-config-form.tsx src/components/data/views/grid-view.tsx
git commit -m "feat(data): integrate URL, BOOLEAN, system field formatters and editors into grid"
```

---

## Task 5: Bottom Summary Bar — API

**Files:**
- Create: `src/app/api/data-tables/[id]/summary/route.ts`
- Modify: `src/lib/services/data-record.service.ts` (add computeSummary function)

- [ ] **Step 1: Add computeSummary to data-record.service.ts**

Add new function that uses Prisma aggregate + raw SQL where needed. The function reuses the existing `listRecords` filter construction pattern (see `listRecords` lines 159-214 in `data-record.service.ts`). Do NOT create a separate `buildWhereConditions` — instead, refactor `listRecords` to extract its where-clause construction into a shared `buildRecordWhereClause` helper first.

```typescript
export interface SummaryResult {
  success: true;
  data: Record<string, { value: number | string; type: AggregateType }>;
}

export interface SummaryError {
  success: false;
  error: { code: string; message: string };
}

export async function computeSummary(
  tableId: string,
  filterConditions?: FilterGroup[],
  search?: string,
  aggregations?: Record<string, AggregateType>,
  fields?: DataFieldItem[]
): Promise<SummaryResult | SummaryError> {
  try {
    const tableResult = await getTable(tableId);
    if (!tableResult.success) return tableResult as SummaryError;

    const resolvedFields = fields ?? tableResult.data.fields;
    if (!aggregations || Object.keys(aggregations).length === 0) {
      return { success: true, data: {} };
    }

    // Reuse the existing filter/where construction from listRecords
    // by extracting it into a shared helper (buildRecordWhereClause)
    const where = buildRecordWhereClause(tableId, filterConditions, search, resolvedFields);

    // Use Prisma count for the total (efficient)
    const count = await db.dataRecord.count({ where });

    // For field-specific aggregates, use findMany with select on JSONB data
    // Since Prisma aggregate doesn't support JSONB path extraction,
    // we use a lightweight findMany that only selects the data column
    const records = await db.dataRecord.findMany({
      where,
      select: { data: true },
    });

    const data: Record<string, { value: number | string; type: AggregateType }> = {};

    for (const [fieldKey, aggType] of Object.entries(aggregations)) {
      const values = records
        .map((r) => (r.data as Record<string, unknown>)[fieldKey])
        .filter((v) => v !== null && v !== undefined && v !== "");

      let value: number | string = 0;

      switch (aggType) {
        case "count":
          value = count;
          break;
        case "sum":
          value = values.reduce((sum, v) => sum + Number(v), 0);
          break;
        case "avg":
          value = values.length > 0
            ? values.reduce((sum, v) => sum + Number(v), 0) / values.length
            : 0;
          break;
        case "min":
          value = values.length > 0 ? Math.min(...values.map(Number)) : 0;
          break;
        case "max":
          value = values.length > 0 ? Math.max(...values.map(Number)) : 0;
          break;
        case "earliest":
          value = values.length > 0
            ? String(new Date(Math.min(...values.map(v => new Date(String(v)).getTime()))))
            : "-";
          break;
        case "latest":
          value = values.length > 0
            ? String(new Date(Math.max(...values.map(v => new Date(String(v)).getTime()))))
            : "-";
          break;
        case "checked":
          value = values.filter((v) => v === true || v === 1 || v === "true").length;
          break;
        case "unchecked":
          value = values.filter((v) => v !== true && v !== 1 && v !== "true").length;
          break;
      }

      data[fieldKey] = { value, type: aggType };
    }

    return { success: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : "汇总计算失败";
    return { success: false, error: { code: "SUMMARY_FAILED", message } };
  }
}
```

Also extract a shared helper from `listRecords` (refactor the where-clause construction at lines 159-214):

```typescript
/**
 * Build Prisma where clause for records. Shared by listRecords and computeSummary.
 * Extract the filter/search logic from listRecords into this helper.
 */
export function buildRecordWhereClause(
  tableId: string,
  filterConditions?: FilterGroup[],
  search?: string,
  fields?: DataFieldItem[]
): Record<string, unknown> {
  const conditions: Record<string, unknown>[] = [{ tableId }];
  const resolvedFields = fields ?? [];

  // Filter conditions (AND between groups, operator within each group)
  if (filterConditions && filterConditions.length > 0) {
    const normalized = normalizeFilters(filterConditions);
    for (const group of normalized) {
      const groupConds = group.conditions
        .map((cond) => buildConditionFromFilter(cond, resolvedFields))
        .filter(Boolean);
      if (groupConds.length > 0) {
        if (group.operator === "OR") {
          conditions.push({ OR: groupConds });
        } else {
          conditions.push(...groupConds);
        }
      }
    }
  }

  // Search (OR across all fields — not AND)
  if (search) {
    conditions.push({
      OR: resolvedFields.map((f) => ({
        data: { path: [f.key], string_contains: search },
      })),
    });
  }

  return conditions.length > 1 ? { AND: conditions } : conditions[0];
}
```

Then refactor `listRecords` to call `buildRecordWhereClause` instead of duplicating the logic.

Also extract and export the existing `buildWhereConditions` logic from `listRecords` into a shared function. The key is to extract the part that builds `{ tableId, ...(filter conditions) }` into a reusable helper. Look at `listRecords` lines 159-378 — the `where` object construction from `buildConditionFromFilter` calls. Extract it:

```typescript
function buildWhereConditions(
  tableId: string,
  filterConditions?: FilterGroup[],
  search?: string,
  fields?: DataFieldItem[]
): Record<string, unknown> {
  const conditions: Record<string, unknown>[] = [{ tableId }];

  if (filterConditions && filterConditions.length > 0) {
    const normalized = normalizeFilters(filterConditions);
    for (const group of normalized) {
      const groupConds = group.conditions.map((cond) =>
        buildConditionFromFilter(cond, fields ?? [])
      ).filter(Boolean);
      if (groupConds.length > 0) {
        if (group.operator === "OR") {
          conditions.push({ OR: groupConds });
        } else {
          conditions.push(...groupConds);
        }
      }
    }
  }

  if (search) {
    conditions.push({
      OR: (fields ?? []).map((f) => ({
        data: { path: [f.key], string_contains: search },
      })),
    });
  }

  return conditions.length > 1 ? { AND: conditions } : conditions[0];
}
```

Then refactor `listRecords` to use this helper instead of duplicating the logic.

- [ ] **Step 2: Create summary API route**

Create `src/app/api/data-tables/[id]/summary/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getRouteSessionUser } from "@/lib/auth";
import { computeSummary } from "@/lib/services/data-record.service";
import type { AggregateType, FilterGroup } from "@/types/data-table";
import { normalizeFilters } from "@/types/data-table";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await getRouteSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { id } = await params;
  const aggregationsParam = request.nextUrl.searchParams.get("aggregations");
  const filterConditionsParam = request.nextUrl.searchParams.get("filterConditions");
  const search = request.nextUrl.searchParams.get("search") || undefined;

  let aggregations: Record<string, AggregateType> = {};
  try {
    aggregations = aggregationsParam ? JSON.parse(aggregationsParam) : {};
  } catch { /* ignore */ }

  let filterConditions: FilterGroup[] | undefined;
  if (filterConditionsParam) {
    try {
      filterConditions = normalizeFilters(JSON.parse(filterConditionsParam));
    } catch { /* ignore */ }
  }

  const result = await computeSummary(id, filterConditions, search, aggregations);

  if (!result.success) {
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }

  return NextResponse.json(result.data);
}
```

- [ ] **Step 3: Verify API compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/lib/services/data-record.service.ts src/app/api/data-tables/[id]/summary/route.ts
git commit -m "feat(data): add summary API endpoint with aggregate computation"
```

---

## Task 6: Bottom Summary Bar — Hook & UI

**Files:**
- Create: `src/hooks/use-summary-row.ts`
- Modify: `src/hooks/use-table-data.ts` (add summary state)
- Modify: `src/components/data/views/grid-view.tsx` (render summary row)

- [ ] **Step 1: Create use-summary-row hook**

Create `src/hooks/use-summary-row.ts`:

```typescript
"use client";

import { useCallback, useEffect, useState } from "react";
import type { AggregateType, SummaryRowData } from "@/types/data-table";

interface UseSummaryRowOptions {
  tableId: string;
  filters: string | null;      // serialized FilterGroup[]
  search: string;
  aggregations: Record<string, AggregateType>;
  enabled?: boolean;
}

export function useSummaryRow({
  tableId,
  filters,
  search,
  aggregations,
  enabled = true,
}: UseSummaryRowOptions) {
  const [summaryData, setSummaryData] = useState<SummaryRowData>({});
  const [isLoading, setIsLoading] = useState(false);

  const fetchSummary = useCallback(async () => {
    if (!enabled || Object.keys(aggregations).length === 0) {
      setSummaryData({});
      return;
    }

    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("aggregations", JSON.stringify(aggregations));
      if (filters) params.set("filterConditions", filters);
      if (search) params.set("search", search);

      const res = await fetch(`/api/data-tables/${tableId}/summary?${params}`);
      if (res.ok) {
        const data = await res.json();
        setSummaryData(data);
      }
    } catch {
      // Silently fail — summary is non-critical
    } finally {
      setIsLoading(false);
    }
  }, [tableId, filters, search, aggregations, enabled]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return { summaryData, isLoading, refetch: fetchSummary };
}
```

- [ ] **Step 2: Add summary state to use-table-data.ts**

In `UseTableDataReturn` interface, add:

```typescript
  columnAggregations: Record<string, AggregateType>;
  setColumnAggregations: (aggregations: Record<string, AggregateType>) => void;
```

In the hook body, add state:

```typescript
  const [columnAggregations, setColumnAggregationsState] = useState<Record<string, AggregateType>>({});

  const setColumnAggregations = useCallback((aggregations: Record<string, AggregateType>) => {
    setColumnAggregationsState(aggregations);
    // Auto-save to view options
    setViewOptions({ ...currentConfig.viewOptions, columnAggregations: aggregations });
  }, [setViewOptions, currentConfig.viewOptions]);
```

On view switch, restore from viewOptions:

```typescript
  // In switchView, after loading view config:
  setColumnAggregationsState(viewResult.data.viewOptions.columnAggregations ?? {});
```

- [ ] **Step 3: Render summary row in grid-view.tsx**

Add props to `GridViewProps`:

```typescript
  columnAggregations?: Record<string, AggregateType>;
  onColumnAggregationsChange?: (aggregations: Record<string, AggregateType>) => void;
```

In the component body, add hook:

```typescript
  const { summaryData } = useSummaryRow({
    tableId,
    filters: filters.length > 0 ? JSON.stringify(filters) : null,
    search,
    aggregations: columnAggregations ?? {},
  });
```

Add the `<tfoot>` **inside** the `<table>` element, right after `</tbody>` (line ~1165 in current code). The `<tfoot>` with `sticky bottom-0` will stick to the bottom of the scroll container (`<div className="overflow-auto ...">` wrapping the table):

```tsx
{Object.keys(columnAggregations ?? {}).length > 0 && (
  <tfoot>
    <tr className="border-t bg-muted/30 sticky bottom-0 z-[5]">
      <td className="p-2 text-xs text-muted-foreground font-medium w-10" /> {/* checkbox col */}
      {orderedVisibleFields.map((field) => {
        const agg = columnAggregations?.[field.key];
        if (!agg) return <td key={field.key} className="p-2" />;
        const summary = summaryData[field.key];
        return (
          <td
            key={field.key}
            className="p-2 text-xs text-muted-foreground cursor-pointer hover:bg-muted/50"
            style={{ width: columnWidths[field.key] ?? DEFAULT_COL_WIDTH }}
            onClick={() => {
              // Cycle aggregation type
              const cycle: AggregateType[] = getAvailableAggTypes(field.type);
              const currentIndex = cycle.indexOf(agg);
              const next = cycle[(currentIndex + 1) % cycle.length];
              onColumnAggregationsChange?.({
                ...columnAggregations,
                [field.key]: next,
              });
            }}
          >
            <span className="font-medium">{getAggLabel(agg)}</span>
            {summary && (
              <span className="ml-1 font-mono">{formatSummaryValue(summary.value, agg)}</span>
            )}
          </td>
        );
      })}
    </tr>
  </tfoot>
)}
```

Add helper functions (at top of file or in a utils section):

```typescript
function getAvailableAggTypes(fieldType: string): AggregateType[] {
  switch (fieldType) {
    case "NUMBER": case "FORMULA": return ["sum", "avg", "min", "max", "count"];
    case "BOOLEAN": return ["checked", "unchecked", "count"];
    case "DATE": case "SYSTEM_TIMESTAMP": return ["earliest", "latest", "count"];
    default: return ["count"];
  }
}

function getAggLabel(type: AggregateType): string {
  const labels: Record<AggregateType, string> = {
    count: "计数", sum: "求和", avg: "平均",
    min: "最小", max: "最大", earliest: "最早", latest: "最新",
    checked: "已选", unchecked: "未选",
  };
  return labels[type];
}

function formatSummaryValue(value: number | string, type: AggregateType): string {
  if (type === "earliest" || type === "latest") {
    try {
      return new Date(value).toLocaleDateString("zh-CN");
    } catch {
      return String(value);
    }
  }
  if (typeof value === "number") {
    return type === "count" || type === "checked" || type === "unchecked"
      ? String(value)
      : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return String(value);
}
```

- [ ] **Step 4: Wire up in the page component**

Find the page that renders `<GridView>` (likely `src/app/(dashboard)/data-tables/[id]/page.tsx`), and pass the new props:

```tsx
<GridView
  // ... existing props
  columnAggregations={columnAggregations}
  onColumnAggregationsChange={setColumnAggregations}
/>
```

- [ ] **Step 5: Verify types compile**

Run: `npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add src/hooks/use-summary-row.ts src/hooks/use-table-data.ts src/components/data/views/grid-view.tsx
git commit -m "feat(data): add bottom summary bar with aggregate cycling"
```

---

## Task 7: Undo/Redo — Core Hook

**Files:**
- Create: `src/hooks/use-undo-manager.ts`

- [ ] **Step 1: Create Command interface and UndoManager hook**

Create `src/hooks/use-undo-manager.ts`:

```typescript
"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

// ── Types ──

export type CommandType =
  | "UPDATE_CELL"
  | "ADD_RECORD"
  | "DELETE_RECORD"
  | "BATCH_UPDATE"
  | "ADD_FIELD"
  | "DELETE_FIELD";

export interface Command {
  type: CommandType;
  execute: () => Promise<void>;
  undo: () => Promise<void>;
  description: string;
}

interface UndoManagerState {
  canUndo: boolean;
  canRedo: boolean;
  isExecuting: boolean;
  lastDescription: string | null;  // tooltip text
}

// ── Hook ──

const MAX_STACK_SIZE = 50;

export function useUndoManager() {
  const undoStackRef = useRef<Command[]>([]);
  const redoStackRef = useRef<Command[]>([]);
  const [state, setState] = useState<UndoManagerState>({
    canUndo: false,
    canRedo: false,
    isExecuting: false,
    lastDescription: null,
  });

  const updateState = useCallback(() => {
    setState({
      canUndo: undoStackRef.current.length > 0,
      canRedo: redoStackRef.current.length > 0,
      isExecuting: false,
      lastDescription:
        undoStackRef.current.length > 0
          ? undoStackRef.current[undoStackRef.current.length - 1].description
          : null,
    });
  }, []);

  const execute = useCallback(async (command: Command) => {
    try {
      setState((s) => ({ ...s, isExecuting: true }));
      await command.execute();
      undoStackRef.current.push(command);
      if (undoStackRef.current.length > MAX_STACK_SIZE) {
        undoStackRef.current.shift();
      }
      redoStackRef.current = []; // clear redo on new action
      updateState();
    } catch (error) {
      // Don't push to stack if execute fails
      setState((s) => ({ ...s, isExecuting: false }));
      throw error;
    }
  }, [updateState]);

  const undo = useCallback(async () => {
    const command = undoStackRef.current[undoStackRef.current.length - 1];
    if (!command) return;

    setState((s) => ({ ...s, isExecuting: true }));
    try {
      await command.undo();
      undoStackRef.current.pop();
      redoStackRef.current.push(command);
      updateState();
      toast.info(`已撤销：${command.description}`);
    } catch {
      // Keep command in stack on failure
      updateState();
      toast.error("撤销失败");
    }
  }, [updateState]);

  const redo = useCallback(async () => {
    const command = redoStackRef.current[redoStackRef.current.length - 1];
    if (!command) return;

    setState((s) => ({ ...s, isExecuting: true }));
    try {
      await command.execute();
      redoStackRef.current.pop();
      undoStackRef.current.push(command);
      updateState();
      toast.info(`已重做：${command.description}`);
    } catch {
      updateState();
      toast.error("重做失败");
    }
  }, [updateState]);

  const clear = useCallback(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    setState({ canUndo: false, canRedo: false, isExecuting: false, lastDescription: null });
  }, []);

  return {
    ...state,
    execute,
    undo,
    redo,
    clear,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/use-undo-manager.ts
git commit -m "feat(data): add useUndoManager hook with async error handling"
```

---

## Task 8: Undo/Redo — Keyboard Shortcuts & Toolbar

**Files:**
- Modify: `src/hooks/use-keyboard-nav.ts`
- Modify: `src/components/data/views/grid-view.tsx`
- Modify: `src/hooks/use-table-data.ts`

- [ ] **Step 1: Add Ctrl+Z / Ctrl+Shift+Z to use-keyboard-nav.ts**

Add optional callbacks to `UseKeyboardNavOptions`:

```typescript
  onUndo?: () => void;
  onRedo?: () => void;
```

In the keydown handler (around line 30), add before the switch or at the end:

```typescript
    if (e.ctrlKey || e.metaKey) {
      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        options.onUndo?.();
        return;
      }
      if ((e.key === "z" && e.shiftKey) || e.key === "y") {
        e.preventDefault();
        options.onRedo?.();
        return;
      }
    }
```

- [ ] **Step 2: Integrate undo manager in grid-view.tsx**

In `GridView` component body:

```typescript
  const undoManager = useUndoManager();

  // Wrap handleCommit to push to undo stack
  const handleCommitWithUndo = useCallback(
    async (recordId: string, fieldKey: string, value: unknown) => {
      const record = records.find((r) => r.id === recordId);
      const oldValue = record?.data[fieldKey] ?? null;
      const field = fields.find((f) => f.key === fieldKey);
      const label = field?.label ?? fieldKey;

      await undoManager.execute({
        type: "UPDATE_CELL",
        description: `编辑了${label}`,
        execute: () => handleCommit(recordId, fieldKey, value),
        undo: () => handleCommit(recordId, fieldKey, oldValue),
      });
    },
    [handleCommit, records, fields, undoManager]
  );
```

Pass to `useKeyboardNav`:

```typescript
  const { handleKeyDown, setActiveCell: setActiveCellRef } = useKeyboardNav({
    // ... existing props
    onUndo: undoManager.undo,
    onRedo: undoManager.redo,
  });
```

- [ ] **Step 3: Add undo/redo toolbar buttons to grid-view**

Add to the grid toolbar area (above the table, before `<div className="overflow-auto ...">`) or in the parent page. If the page component has a toolbar, add buttons there instead.

Minimal approach — add buttons in grid-view.tsx header area:

```tsx
import { Undo2, Redo2 } from "lucide-react";

// In the toolbar / header section:
<div className="flex items-center gap-1">
  <Button
    variant="ghost"
    size="icon"
    className="h-8 w-8"
    disabled={!undoManager.canUndo || undoManager.isExecuting}
    onClick={() => void undoManager.undo()}
    title={undoManager.lastDescription ? `撤销: ${undoManager.lastDescription}` : "撤销"}
  >
    <Undo2 className="h-4 w-4" />
  </Button>
  <Button
    variant="ghost"
    size="icon"
    className="h-8 w-8"
    disabled={!undoManager.canRedo || undoManager.isExecuting}
    onClick={() => void undoManager.redo()}
    title="重做"
  >
    <Redo2 className="h-4 w-4" />
  </Button>
</div>
```

- [ ] **Step 4: Wrap record operations with undo commands**

In grid-view.tsx, wrap `handleDeleteRecord`, `handleDuplicateRecord`, and `handleInsertRow` to push undo commands. Example for delete:

```typescript
  const handleDeleteWithUndo = useCallback(async (recordId: string) => {
    const record = records.find((r) => r.id === recordId);
    if (!record) return;
    await undoManager.execute({
      type: "DELETE_RECORD",
      description: "删除了记录",
      execute: async () => { onDeleteRecord(recordId); },
      undo: async () => {
        // Re-create the record via API
        const res = await fetch(`/api/data-tables/${tableId}/records`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: record.data }),
        });
        if (res.ok) onRefresh();
      },
    });
  }, [records, tableId, onDeleteRecord, onRefresh, undoManager]);
```

- [ ] **Step 5: Clear undo on view/table switch**

In `use-table-data.ts`, expose a clear callback. In the parent page, call `undoManager.clear()` when `tableId` or `viewId` changes.

- [ ] **Step 6: Verify types compile**

Run: `npx tsc --noEmit`

- [ ] **Step 7: Commit**

```bash
git add src/hooks/use-keyboard-nav.ts src/hooks/use-undo-manager.ts src/components/data/views/grid-view.tsx
git commit -m "feat(data): integrate undo/redo into grid view with keyboard shortcuts"
```

---

## Task 9: Formula Engine — Tokenizer

**Files:**
- Create: `src/lib/formula/tokenizer.ts`

- [ ] **Step 1: Write tokenizer tests**

Create `src/lib/formula/tokenizer.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { tokenize, TokenType } from "./tokenizer";

describe("tokenize", () => {
  it("should tokenize a simple field reference", () => {
    const tokens = tokenize("{ price }");
    expect(tokens).toEqual([
      { type: "FIELD_REF", value: "price" },
    ]);
  });

  it("should tokenize arithmetic expression", () => {
    const tokens = tokenize("{ price } * { quantity }");
    expect(tokens).toEqual([
      { type: "FIELD_REF", value: "price" },
      { type: "OPERATOR", value: "*" },
      { type: "FIELD_REF", value: "quantity" },
    ]);
  });

  it("should tokenize function call", () => {
    const tokens = tokenize("SUM({ a }, { b })");
    expect(tokens).toEqual([
      { type: "FUNCTION", value: "SUM" },
      { type: "LPAREN", value: "(" },
      { type: "FIELD_REF", value: "a" },
      { type: "COMMA", value: "," },
      { type: "FIELD_REF", value: "b" },
      { type: "RPAREN", value: ")" },
    ]);
  });

  it("should tokenize IF expression", () => {
    const tokens = tokenize('IF({ status } = "完成", 100, 0)');
    const fieldRef = expect.arrayContaining([
      { type: "FIELD_REF", value: "status" },
    ]);
    expect(tokens).toContainEqual({ type: "FUNCTION", value: "IF" });
    expect(tokens).toContainEqual({ type: "STRING", value: "完成" });
  });

  it("should tokenize Chinese field names", () => {
    const tokens = tokenize("{ 单价 } * { 数量 }");
    expect(tokens).toContainEqual({ type: "FIELD_REF", value: "单价" });
    expect(tokens).toContainEqual({ type: "FIELD_REF", value: "数量" });
  });

  it("should throw on unrecognized character", () => {
    expect(() => tokenize("{ a } @ { b }")).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/formula/tokenizer.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement tokenizer**

Create `src/lib/formula/tokenizer.ts`:

```typescript
export type TokenType =
  | "NUMBER"
  | "STRING"
  | "FIELD_REF"
  | "FUNCTION"
  | "OPERATOR"
  | "COMPARISON"
  | "LPAREN"
  | "RPAREN"
  | "COMMA"
  | "AMPERSAND";

export interface Token {
  type: TokenType;
  value: string;
}

const OPERATORS = new Set(["+", "-", "*", "/", "%"]);
const COMPARISONS = new Set(["=", "!=", ">", "<", ">=", "<="]);
const FUNCTIONS = new Set([
  "SUM", "AVERAGE", "MIN", "MAX", "ROUND", "ABS", "CEILING", "FLOOR",
  "IF", "AND", "OR", "NOT",
  "CONCAT", "LEN", "LEFT", "RIGHT", "MID", "UPPER", "LOWER", "TRIM",
  "DATE_DIFF", "NOW", "YEAR", "MONTH", "DAY",
  "NUMBER", "TEXT",
]);

export function tokenize(formula: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < formula.length) {
    const ch = formula[i];

    // Skip whitespace
    if (/\s/.test(ch)) { i++; continue; }

    // String literal
    if (ch === '"') {
      let value = "";
      i++; // skip opening quote
      while (i < formula.length && formula[i] !== '"') {
        value += formula[i];
        i++;
      }
      i++; // skip closing quote
      tokens.push({ type: "STRING", value });
      continue;
    }

    // Field reference { ... }
    if (ch === "{") {
      let value = "";
      i++; // skip opening {
      while (i < formula.length && formula[i] !== "}") {
        value += formula[i];
        i++;
      }
      i++; // skip closing }
      tokens.push({ type: "FIELD_REF", value: value.trim() });
      continue;
    }

    // Parentheses
    if (ch === "(") { tokens.push({ type: "LPAREN", value: "(" }); i++; continue; }
    if (ch === ")") { tokens.push({ type: "RPAREN", value: ")" }); i++; continue; }

    // Comma
    if (ch === ",") { tokens.push({ type: "COMMA", value: "," }); i++; continue; }

    // Ampersand (string concat)
    if (ch === "&") { tokens.push({ type: "AMPERSAND", value: "&" }); i++; continue; }

    // Comparison operators (multi-char first)
    const twoChar = formula.slice(i, i + 2);
    if (twoChar === "!=" || twoChar === ">=" || twoChar === "<=") {
      tokens.push({ type: "COMPARISON", value: twoChar });
      i += 2;
      continue;
    }
    if (COMPARISONS.has(ch)) {
      tokens.push({ type: "COMPARISON", value: ch });
      i++;
      continue;
    }

    // Arithmetic operators
    if (OPERATORS.has(ch)) {
      tokens.push({ type: "OPERATOR", value: ch });
      i++;
      continue;
    }

    // Number (including negative)
    if (/[0-9]/.test(ch) || (ch === "." && i + 1 < formula.length && /[0-9]/.test(formula[i + 1]))) {
      let value = "";
      while (i < formula.length && /[0-9.]/.test(formula[i])) {
        value += formula[i];
        i++;
      }
      tokens.push({ type: "NUMBER", value });
      continue;
    }

    // Identifier (function name)
    if (/[a-zA-Z_\u4e00-\u9fff]/.test(ch)) {
      let value = "";
      while (i < formula.length && /[a-zA-Z0-9_\u4e00-\u9fff]/.test(formula[i])) {
        value += formula[i];
        i++;
      }
      // Check if followed by ( — then it's a function
      const nextNonSpace = formula.slice(i).trimStart();
      if (nextNonSpace.startsWith("(") && FUNCTIONS.has(value.toUpperCase())) {
        tokens.push({ type: "FUNCTION", value: value.toUpperCase() });
      } else {
        // Treat as identifier — could be part of a field reference without braces
        tokens.push({ type: "FIELD_REF", value });
      }
      continue;
    }

    throw new Error(`公式解析错误：无法识别的字符 "${ch}" (位置 ${i})`);
  }

  return tokens;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/formula/tokenizer.test.ts`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/formula/tokenizer.ts src/lib/formula/tokenizer.test.ts
git commit -m "feat(formula): add tokenizer with field references, functions, and operators"
```

---

## Task 10: Formula Engine — AST Builder

**Files:**
- Create: `src/lib/formula/ast.ts`

- [ ] **Step 1: Write AST builder tests**

Create `src/lib/formula/ast.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { parseFormula } from "./ast";

describe("parseFormula", () => {
  it("should parse simple field reference", () => {
    const ast = parseFormula("{ price }");
    expect(ast).toEqual({ type: "fieldRef", key: "price" });
  });

  it("should parse binary expression", () => {
    const ast = parseFormula("{ price } * { quantity }");
    expect(ast.type).toBe("binaryOp");
    expect(ast).toMatchObject({
      op: "*",
      left: { type: "fieldRef", key: "price" },
      right: { type: "fieldRef", key: "quantity" },
    });
  });

  it("should parse function call", () => {
    const ast = parseFormula("SUM({ a }, { b })");
    expect(ast).toMatchObject({
      type: "functionCall",
      name: "SUM",
      args: [
        { type: "fieldRef", key: "a" },
        { type: "fieldRef", key: "b" },
      ],
    });
  });

  it("should parse nested IF", () => {
    const ast = parseFormula('IF({ status } = "done", 1, 0)');
    expect(ast.type).toBe("functionCall");
    expect(ast.name).toBe("IF");
    expect(ast.args).toHaveLength(3);
  });

  it("should parse operator precedence (multiply before add)", () => {
    const ast = parseFormula("{ a } + { b } * { c }");
    // a + (b * c), not (a + b) * c
    expect(ast.type).toBe("binaryOp");
    expect(ast.op).toBe("+");
    expect((ast as any).right.op).toBe("*");
  });

  it("should throw on empty formula", () => {
    expect(() => parseFormula("")).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/formula/ast.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement AST builder**

Create `src/lib/formula/ast.ts`:

```typescript
import { tokenize, type Token } from "./tokenizer";

// ── AST Node Types ──

export type AstNode =
  | { type: "numberLiteral"; value: number }
  | { type: "stringLiteral"; value: string }
  | { type: "fieldRef"; key: string }
  | { type: "binaryOp"; op: string; left: AstNode; right: AstNode }
  | { type: "functionCall"; name: string; args: AstNode[] }
  | { type: "unaryOp"; op: string; operand: AstNode };

// ── Parser ──

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseError";
  }
}

export function parseFormula(formula: string): AstNode {
  const tokens = tokenize(formula);
  if (tokens.length === 0) throw new ParseError("公式不能为空");

  let pos = 0;

  function peek(): Token | undefined {
    return tokens[pos];
  }

  function advance(): Token {
    return tokens[pos++];
  }

  function expect(type: string, value?: string): Token {
    const token = peek();
    if (!token) throw new ParseError(`期望 ${type}，但公式已结束`);
    if (token.type !== type || (value !== undefined && token.value !== value)) {
      throw new ParseError(`期望 ${value ?? type}，实际为 "${token.value}"`);
    }
    return advance();
  }

  // ── Expression grammar (recursive descent) ──

  // comparison → additive (("=" | "!=" | ">" | "<" | ">=" | "<=") additive)?
  function parseComparison(): AstNode {
    let left = parseAdditive();
    const token = peek();
    if (token?.type === "COMPARISON") {
      advance();
      const right = parseAdditive();
      return { type: "binaryOp", op: token.value, left, right };
    }
    return left;
  }

  // additive → multiplicative (("+" | "-") multiplicative)*
  function parseAdditive(): AstNode {
    let left = parseMultiplicative();
    while (peek()?.type === "OPERATOR" && (peek()?.value === "+" || peek()?.value === "-")) {
      const op = advance().value;
      const right = parseMultiplicative();
      left = { type: "binaryOp", op, left, right };
    }
    return left;
  }

  // multiplicative → unary (("*" | "/" | "%") unary)*
  // Also handles & (string concat)
  function parseMultiplicative(): AstNode {
    let left = parseUnary();
    while (
      (peek()?.type === "OPERATOR" && ["*", "/", "%"].includes(peek()?.value)) ||
      peek()?.type === "AMPERSAND"
    ) {
      const op = advance().value;
      const right = parseUnary();
      left = { type: "binaryOp", op, left, right };
    }
    return left;
  }

  // unary → ("-" unary) | primary
  function parseUnary(): AstNode {
    if (peek()?.type === "OPERATOR" && peek()?.value === "-") {
      advance();
      const operand = parseUnary();
      return { type: "unaryOp", op: "-", operand };
    }
    return parsePrimary();
  }

  // primary → NUMBER | STRING | FIELD_REF | FUNCTION(...) | "(" expression ")"
  function parsePrimary(): AstNode {
    const token = peek();
    if (!token) throw new ParseError("公式意外结束");

    switch (token.type) {
      case "NUMBER": {
        advance();
        return { type: "numberLiteral", value: Number(token.value) };
      }
      case "STRING": {
        advance();
        return { type: "stringLiteral", value: token.value };
      }
      case "FIELD_REF": {
        advance();
        return { type: "fieldRef", key: token.value };
      }
      case "FUNCTION": {
        const name = advance().value;
        expect("LPAREN");
        const args: AstNode[] = [];
        if (peek()?.type !== "RPAREN") {
          args.push(parseComparison());
          while (peek()?.type === "COMMA") {
            advance();
            args.push(parseComparison());
          }
        }
        expect("RPAREN");
        return { type: "functionCall", name, args };
      }
      case "LPAREN": {
        advance();
        const expr = parseComparison();
        expect("RPAREN");
        return expr;
      }
      default:
        throw new ParseError(`无法解析的 token: "${token.value}"`);
    }
  }

  const result = parseComparison();
  if (pos < tokens.length) {
    throw new ParseError(`公式末尾有多余内容: "${tokens[pos].value}"`);
  }
  return result;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/formula/ast.test.ts`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/formula/ast.ts src/lib/formula/ast.test.ts
git commit -m "feat(formula): add recursive-descent AST parser"
```

---

## Task 11: Formula Engine — Evaluator & Dependency Graph

**Files:**
- Create: `src/lib/formula/evaluator.ts`
- Create: `src/lib/formula/dependency-graph.ts`
- Create: `src/lib/formula/index.ts`

- [ ] **Step 1: Write evaluator tests**

Create `src/lib/formula/evaluator.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { evaluateFormula } from "./evaluator";

describe("evaluateFormula", () => {
  const data = { price: 10, quantity: 3, name: "Test", score: 85 };

  it("should evaluate field reference", () => {
    expect(evaluateFormula("{ price }", data)).toBe(10);
  });

  it("should evaluate arithmetic", () => {
    expect(evaluateFormula("{ price } * { quantity }", data)).toBe(30);
  });

  it("should evaluate SUM function", () => {
    expect(evaluateFormula("SUM({ price }, { quantity }, 5)", data)).toBe(18);
  });

  it("should evaluate AVERAGE function", () => {
    expect(evaluateFormula("AVERAGE({ price }, { quantity })", data)).toBe(6.5);
  });

  it("should evaluate IF function (true branch)", () => {
    expect(evaluateFormula('IF({ score } > 60, "通过", "不通过")', data)).toBe("通过");
  });

  it("should evaluate IF function (false branch)", () => {
    const data2 = { ...data, score: 50 };
    expect(evaluateFormula('IF({ score } > 60, "通过", "不通过")', data2)).toBe("不通过");
  });

  it("should evaluate CONCAT", () => {
    expect(evaluateFormula('CONCAT({ name }, "!", "OK")', data)).toBe("Test!OK");
  });

  it("should evaluate ROUND", () => {
    expect(evaluateFormula("ROUND({ price } / 3, 2)", data)).toBe(3.33);
  });

  it("should return #REF for missing field", () => {
    expect(evaluateFormula("{ nonexistent }", data)).toBe("#REF");
  });

  it("should return #DIV/0 for division by zero", () => {
    expect(evaluateFormula("{ price } / 0", data)).toBe("#DIV/0");
  });

  it("should evaluate string concat with &", () => {
    expect(evaluateFormula('{ name } & " OK"', data)).toBe("Test OK");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/formula/evaluator.test.ts`

- [ ] **Step 3: Implement evaluator**

Create `src/lib/formula/evaluator.ts`:

```typescript
import { parseFormula, type AstNode } from "./ast";

type FormulaValue = number | string | boolean | null;

export function evaluateFormula(
  formula: string,
  recordData: Record<string, unknown>
): FormulaValue {
  try {
    const ast = parseFormula(formula);
    return evaluateNode(ast, recordData);
  } catch {
    return "#ERROR";
  }
}

function evaluateNode(node: AstNode, data: Record<string, unknown>): FormulaValue {
  switch (node.type) {
    case "numberLiteral":
      return node.value;

    case "stringLiteral":
      return node.value;

    case "fieldRef": {
      if (node.key in data) {
        return data[node.key] as FormulaValue;
      }
      return "#REF";
    }

    case "unaryOp": {
      const val = evaluateNode(node.operand, data);
      if (typeof val === "string" && val.startsWith("#")) return val;
      if (node.op === "-") return -(Number(val) || 0);
      return val;
    }

    case "binaryOp": {
      return evaluateBinaryOp(node.op, node.left, node.right, data);
    }

    case "functionCall":
      return evaluateFunction(node.name, node.args, data);
  }
}

function evaluateBinaryOp(
  op: string,
  leftNode: AstNode,
  rightNode: AstNode,
  data: Record<string, unknown>
): FormulaValue {
  if (op === "&") {
    return String(evaluateNode(leftNode, data) ?? "") + String(evaluateNode(rightNode, data) ?? "");
  }

  const left = evaluateNode(leftNode, data);
  const right = evaluateNode(rightNode, data);

  if (typeof left === "string" && left.startsWith("#")) return left;
  if (typeof right === "string" && right.startsWith("#")) return right;

  const l = Number(left) || 0;
  const r = Number(right) || 0;

  switch (op) {
    case "+": return l + r;
    case "-": return l - r;
    case "*": return l * r;
    case "/": return r === 0 ? "#DIV/0" : l / r;
    case "%": return r === 0 ? "#DIV/0" : l % r;
    case "=": return left === right;
    case "!=": return left !== right;
    case ">": return l > r;
    case "<": return l < r;
    case ">=": return l >= r;
    case "<=": return l <= r;
    default: return "#ERROR";
  }
}

function toNumber(v: FormulaValue): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "boolean") return v ? 1 : 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function toString(v: FormulaValue): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

function evaluateFunction(
  name: string,
  argNodes: AstNode[],
  data: Record<string, unknown>
): FormulaValue {
  switch (name) {
    // Math
    case "SUM": {
      return argNodes.reduce((sum, n) => sum + toNumber(evaluateNode(n, data)), 0);
    }
    case "AVERAGE": {
      const values = argNodes.map((n) => toNumber(evaluateNode(n, data)));
      return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    }
    case "MIN": {
      return Math.min(...argNodes.map((n) => toNumber(evaluateNode(n, data))));
    }
    case "MAX": {
      return Math.max(...argNodes.map((n) => toNumber(evaluateNode(n, data))));
    }
    case "ROUND": {
      const val = toNumber(evaluateNode(argNodes[0], data));
      const decimals = argNodes[1] ? toNumber(evaluateNode(argNodes[1], data)) : 0;
      const factor = Math.pow(10, decimals);
      return Math.round(val * factor) / factor;
    }
    case "ABS": return Math.abs(toNumber(evaluateNode(argNodes[0], data)));
    case "CEILING": return Math.ceil(toNumber(evaluateNode(argNodes[0], data)));
    case "FLOOR": return Math.floor(toNumber(evaluateNode(argNodes[0], data)));

    // Logic
    case "IF": {
      const condition = evaluateNode(argNodes[0], data);
      return condition ? evaluateNode(argNodes[1], data) : (argNodes[2] ? evaluateNode(argNodes[2], data) : null);
    }
    case "AND": return argNodes.every((n) => !!evaluateNode(n, data));
    case "OR": return argNodes.some((n) => !!evaluateNode(n, data));
    case "NOT": return !evaluateNode(argNodes[0], data);

    // Text
    case "CONCAT": return argNodes.map((n) => toString(evaluateNode(n, data))).join("");
    case "LEN": return toString(evaluateNode(argNodes[0], data)).length;
    case "LEFT": {
      const s = toString(evaluateNode(argNodes[0], data));
      const n = toNumber(evaluateNode(argNodes[1], data));
      return s.slice(0, n);
    }
    case "RIGHT": {
      const s = toString(evaluateNode(argNodes[0], data));
      const n = toNumber(evaluateNode(argNodes[1], data));
      return s.slice(-n);
    }
    case "MID": {
      const s = toString(evaluateNode(argNodes[0], data));
      const start = toNumber(evaluateNode(argNodes[1], data)) - 1;
      const length = toNumber(evaluateNode(argNodes[2], data));
      return s.slice(start, start + length);
    }
    case "UPPER": return toString(evaluateNode(argNodes[0], data)).toUpperCase();
    case "LOWER": return toString(evaluateNode(argNodes[0], data)).toLowerCase();
    case "TRIM": return toString(evaluateNode(argNodes[0], data)).trim();

    // Date
    case "NOW": return new Date().toISOString();
    case "YEAR": return new Date(toString(evaluateNode(argNodes[0], data))).getFullYear();
    case "MONTH": return new Date(toString(evaluateNode(argNodes[0], data))).getMonth() + 1;
    case "DAY": return new Date(toString(evaluateNode(argNodes[0], data))).getDate();
    case "DATE_DIFF": {
      const a = new Date(toString(evaluateNode(argNodes[0], data))).getTime();
      const b = new Date(toString(evaluateNode(argNodes[1], data))).getTime();
      const unit = argNodes[2] ? toString(evaluateNode(argNodes[2], data)) : "day";
      const diff = Math.abs(a - b);
      switch (unit) {
        case "day": return Math.floor(diff / (1000 * 60 * 60 * 24));
        case "month": return Math.floor(diff / (1000 * 60 * 60 * 24 * 30));
        case "year": return Math.floor(diff / (1000 * 60 * 60 * 24 * 365));
        default: return diff;
      }
    }

    // Conversion
    case "NUMBER": return toNumber(evaluateNode(argNodes[0], data));
    case "TEXT": return toString(evaluateNode(argNodes[0], data));

    default: return "#ERROR";
  }
}
```

- [ ] **Step 4: Create dependency graph**

Create `src/lib/formula/dependency-graph.ts`:

```typescript
import { parseFormula } from "./ast";

/**
 * Extract field references from a formula string.
 */
export function extractFieldRefs(formula: string): string[] {
  try {
    const ast = parseFormula(formula);
    const refs = new Set<string>();
    collectFieldRefs(ast, refs);
    return Array.from(refs);
  } catch {
    return [];
  }
}

function collectFieldRefs(node: ReturnType<typeof parseFormula>, refs: Set<string>): void {
  if (node.type === "fieldRef") {
    refs.add(node.key);
  } else if (node.type === "binaryOp") {
    collectFieldRefs(node.left, refs);
    collectFieldRefs(node.right, refs);
  } else if (node.type === "functionCall") {
    for (const arg of node.args) {
      collectFieldRefs(arg, refs);
    }
  } else if (node.type === "unaryOp") {
    collectFieldRefs(node.operand, refs);
  }
}

/**
 * Check for circular references among formula fields.
 * @param fields Map of fieldKey -> formula string for all FORMULA type fields
 * @returns null if no cycle, or a string describing the cycle
 */
export function detectCircularRefs(
  fields: Record<string, string>
): string | null {
  const visited = new Set<string>();
  const stack = new Set<string>();

  function dfs(fieldKey: string): boolean {
    if (stack.has(fieldKey)) return true; // cycle found
    if (visited.has(fieldKey)) return false;

    visited.add(fieldKey);
    stack.add(fieldKey);

    const formula = fields[fieldKey];
    if (formula) {
      const refs = extractFieldRefs(formula);
      for (const ref of refs) {
        if (ref in fields && dfs(ref)) return true;
      }
    }

    stack.delete(fieldKey);
    return false;
  }

  for (const fieldKey of Object.keys(fields)) {
    if (dfs(fieldKey)) return `检测到循环引用，涉及字段: ${fieldKey}`;
    // Reset for next root
    visited.clear();
    stack.clear();
  }

  return null;
}
```

- [ ] **Step 5: Create barrel export**

Create `src/lib/formula/index.ts`:

```typescript
export { tokenize, type Token, type TokenType } from "./tokenizer";
export { parseFormula, type AstNode, ParseError } from "./ast";
export { evaluateFormula } from "./evaluator";
export { extractFieldRefs, detectCircularRefs } from "./dependency-graph";
```

- [ ] **Step 6: Run all formula tests**

Run: `npx vitest run src/lib/formula/`
Expected: all PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/formula/
git commit -m "feat(formula): add evaluator, dependency graph, and barrel export"
```

---

## Task 12: Formula — Field Integration & UI

**Files:**
- Create: `src/components/data/cell-editors/formula-cell-editor.tsx`
- Create: `src/components/data/formula-editor.tsx`
- Create: `src/hooks/use-formula.ts`
- Modify: `src/components/data/field-config-form.tsx` (formula editor in field config)
- Modify: `src/lib/services/data-record.service.ts` (server-side formula evaluation)

- [ ] **Step 1: Create use-formula hook**

Create `src/hooks/use-formula.ts`:

```typescript
"use client";

import { useCallback, useMemo } from "react";
import { evaluateFormula, extractFieldRefs, detectCircularRefs, parseFormula } from "@/lib/formula";
import type { DataFieldItem } from "@/types/data-table";
import { parseFieldOptions } from "@/types/data-table";

interface UseFormulaOptions {
  fields: DataFieldItem[];
  records: DataRecordItem[];
}

export function useFormula({ fields, records }: UseFormulaOptions) {
  // Get all formula fields
  const formulaFields = useMemo(
    () => fields.filter((f) => f.type === "FORMULA"),
    [fields]
  );

  // Check for circular references
  const circularRefError = useMemo(() => {
    const formulaMap: Record<string, string> = {};
    for (const field of formulaFields) {
      const opts = parseFieldOptions(field.options);
      if (opts.formula) formulaMap[field.key] = opts.formula;
    }
    return formulaMap && Object.keys(formulaMap).length > 0
      ? detectCircularRefs(formulaMap)
      : null;
  }, [formulaFields]);

  // Compute formula values for all records
  const computedValues = useMemo(() => {
    if (circularRefError) return {};
    const result: Record<string, Record<string, unknown>> = {};

    for (const field of formulaFields) {
      const opts = parseFieldOptions(field.options);
      if (!opts.formula) continue;

      const refs = extractFieldRefs(opts.formula);

      for (const record of records) {
        // Check if all referenced fields have values
        const missingRef = refs.find(
          (ref) => record.data[ref] === undefined && record.data[ref] === null
        );

        const value = evaluateFormula(opts.formula, record.data);
        if (!result[record.id]) result[record.id] = {};
        result[record.id][field.key] = value;
      }
    }

    return result;
  }, [formulaFields, records, circularRefError]);

  // Validate a formula before saving
  const validateFormula = useCallback(
    (formula: string, fieldKey: string): string | null => {
      if (!formula.trim()) return null;
      try {
        parseFormula(formula);
      } catch (e) {
        return e instanceof Error ? e.message : "公式语法错误";
      }

      // Check circular refs with proposed formula
      const formulaMap: Record<string, string> = {};
      for (const f of formulaFields) {
        const opts = parseFieldOptions(f.options);
        if (opts.formula) formulaMap[f.key] = opts.formula;
      }
      formulaMap[fieldKey] = formula;
      return detectCircularRefs(formulaMap);
    },
    [formulaFields]
  );

  return { computedValues, circularRefError, validateFormula };
}
```

- [ ] **Step 2: Create formula-cell-editor (read-only display)**

Create `src/components/data/cell-editors/formula-cell-editor.tsx`:

```tsx
"use client";

interface FormulaCellEditorProps {
  value: unknown; // computed formula value
}

export function FormulaCellEditor({ value }: FormulaCellEditorProps) {
  // This is read-only — just display the value
  // The actual display is handled by formatCellValue
  return (
    <span className="text-sm text-muted-foreground italic">
      {value === null || value === undefined ? "-" : String(value)}
    </span>
  );
}
```

- [ ] **Step 3: Create formula-editor (config-time input with field picker)**

Create `src/components/data/formula-editor.tsx`:

```tsx
"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import type { DataFieldItem } from "@/types/data-table";

interface FormulaEditorProps {
  initialValue: string;
  fields: DataFieldItem[];
  onChange: (formula: string) => void;
  error?: string | null;
  livePreview?: unknown; // computed value from first record
}

export function FormulaEditor({
  initialValue,
  fields,
  onChange,
  error,
  livePreview,
}: FormulaEditorProps) {
  const [draft, setDraft] = useState(initialValue);
  const [showFieldPicker, setShowFieldPicker] = useState(false);
  const [pickerFilter, setPickerFilter] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const editableFields = fields.filter(
    (f) => f.type !== "FORMULA" && f.type !== "RELATION_SUBTABLE"
  );

  const filteredFields = pickerFilter
    ? editableFields.filter(
        (f) =>
          f.key.toLowerCase().includes(pickerFilter.toLowerCase()) ||
          f.label.toLowerCase().includes(pickerFilter.toLowerCase())
      )
    : editableFields;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "{") {
        e.preventDefault();
        setShowFieldPicker(true);
        setPickerFilter("");
      }
      if (e.key === "Escape") {
        setShowFieldPicker(false);
      }
    },
    []
  );

  const insertField = useCallback(
    (field: DataFieldItem) => {
      const input = inputRef.current;
      if (!input) return;
      const cursorPos = input.selectionStart ?? draft.length;
      const newDraft =
        draft.slice(0, cursorPos) +
        `{ ${field.key} }` +
        draft.slice(cursorPos);
      setDraft(newDraft);
      onChange(newDraft);
      setShowFieldPicker(false);
      // Move cursor after inserted field
      const newPos = cursorPos + field.key.length + 4;
      setTimeout(() => {
        input.setSelectionRange(newPos, newPos);
        input.focus();
      }, 0);
    },
    [draft, onChange]
  );

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            onChange(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          placeholder='例: { price } * { quantity }'
          className={`font-mono text-sm ${error ? "border-red-500" : ""}`}
        />
        {showFieldPicker && (
          <div className="absolute z-50 top-full mt-1 w-64 max-h-48 overflow-auto border rounded-md bg-background shadow-md">
            <div className="p-1">
              <Input
                placeholder="搜索字段..."
                value={pickerFilter}
                onChange={(e) => setPickerFilter(e.target.value)}
                className="h-7 text-xs"
                autoFocus
              />
            </div>
            {filteredFields.map((field) => (
              <button
                key={field.key}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted/50 flex items-center gap-2"
                onClick={() => insertField(field)}
              >
                <span className="font-mono text-xs text-muted-foreground">{field.key}</span>
                <span>{field.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      {livePreview !== undefined && !error && (
        <p className="text-xs text-muted-foreground">
          预览结果: {String(livePreview)}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Add server-side formula evaluation in data-record.service.ts**

In `createRecord` and `updateRecord`, after saving scalar data but before returning, evaluate all formula fields and merge into the data:

```typescript
import { evaluateFormula, extractFieldRefs } from "@/lib/formula";
import { parseFieldOptions } from "@/types/data-table";

async function computeFormulaValues(
  recordData: Record<string, unknown>,
  fields: DataFieldItem[]
): Promise<Record<string, unknown>> {
  const formulaFields = fields.filter((f) => f.type === "FORMULA");
  if (formulaFields.length === 0) return recordData;

  const enriched = { ...recordData };
  for (const field of formulaFields) {
    const opts = parseFieldOptions(field.options);
    if (!opts.formula) continue;
    enriched[field.key] = evaluateFormula(opts.formula, enriched);
  }
  return enriched;
}
```

Call this in `createRecord` after `splitRecordDataByFieldType`:

```typescript
    const enrichedScalarData = await computeFormulaValues(scalarData, tableResult.data.fields);
    // Use enrichedScalarData instead of scalarData in the create call
```

And in `patchField` after building `updatedData`:

```typescript
    const enrichedData = await computeFormulaValues(updatedData, tableResult.data.fields);
    await db.dataRecord.update({
      where: { id: recordId },
      data: { data: toJsonInput(enrichedData) },
    });
```

- [ ] **Step 5: Wire formula editor into field-config-form.tsx**

When `FieldType.FORMULA` is selected, show `<FormulaEditor>` instead of the regular field config. Add conditional rendering:

```tsx
{selectedType === FieldType.FORMULA && (
  <FormulaEditor
    initialValue={formulaDraft}
    fields={availableTables.flatMap((t) => t.fields)}
    onChange={setFormulaDraft}
    error={formulaError}
    livePreview={formulaPreview}
  />
)}
```

- [ ] **Step 6: Verify types compile**

Run: `npx tsc --noEmit`

- [ ] **Step 7: Commit**

```bash
git add src/hooks/use-formula.ts src/components/data/cell-editors/formula-cell-editor.tsx src/components/data/formula-editor.tsx src/lib/services/data-record.service.ts src/components/data/field-config-form.tsx
git commit -m "feat(formula): integrate formula engine with field config and record CRUD"
```

---

## Task 13: Final Integration & Verification

**Files:**
- Run: `npx tsc --noEmit`, `npx vitest run`, `npm run lint`

- [ ] **Step 1: Run full type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: all PASS

- [ ] **Step 3: Run linter**

Run: `npm run lint`
Expected: 0 errors (fix any warnings)

- [ ] **Step 4: Manual smoke test**

Run dev server: `npm run dev`

Test checklist:
- [ ] Create a new table with URL, BOOLEAN, AUTO_NUMBER, SYSTEM_TIMESTAMP fields
- [ ] Add a record — verify AUTO_NUMBER auto-increments
- [ ] Edit a URL cell — verify link is clickable
- [ ] Click a BOOLEAN cell — verify it toggles
- [ ] Verify SYSTEM_TIMESTAMP shows correct time
- [ ] Enable summary bar for a NUMBER column — verify Sum/Count/Min/Max cycling
- [ ] Edit a cell, then Ctrl+Z to undo
- [ ] Create a FORMULA field with `{ price } * { quantity }` — verify computed value
- [ ] Try circular formula reference — verify error message

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: final integration cleanup for phase 3 enhancements"
```
