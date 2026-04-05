# Grid Scroll & Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix data table scrolling (sticky header, independent body scroll) and add page/total info to pagination bar.

**Architecture:** Use CSS `position: sticky` on `<thead>` rows. The entire page layout chain is converted to flex columns: `<main>` → `TableDetailContent` → `RecordTable` → `GridView` scroll container. GridView fills remaining space via `flex-1 min-h-0`. The shadcn `Table` component's built-in `overflow-x-auto` wrapper is bypassed by using raw `<table>` in GridView to avoid nested scroll container conflicts. Pagination bar always shows with "共 X 条，第 Y/Z 页" text.

**Tech Stack:** React 19, Tailwind CSS, shadcn/ui Table primitives

**Spec:** `docs/superpowers/specs/2026-04-05-grid-scroll-pagination-design.md`

---

## File Structure

| File | Change | Responsibility |
|------|--------|---------------|
| `src/components/data/views/grid-view.tsx` | Modify | Replace `<Table>` with raw `<table>` + sticky header + overflow-auto flex container |
| `src/components/data/record-table.tsx` | Modify | Convert to flex column; always-visible pagination bar with page info |
| `src/components/data/table-detail-content.tsx` | Modify | Convert to flex column for layout chain |
| `src/app/(dashboard)/layout.tsx` | Modify | Add `flex flex-col` to `<main>` for flex chain |

**Not modified:** `src/components/ui/table.tsx` — leave global Table component unchanged.

---

### Task 1: Fix flex layout chain from `<main>` to GridView

The parent containers must all be flex columns for `flex-1 min-h-0` to work. Tracing from `<main>` down, three containers need changes.

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx` — the `<main>` element
- Modify: `src/components/data/table-detail-content.tsx` — outer div

- [ ] **Step 1: Add `flex flex-col` to `<main>` in dashboard layout**

In `src/app/(dashboard)/layout.tsx`, find the `<main>` element (has class `flex-1 overflow-y-auto bg-zinc-50 p-6`). Change it to add `flex flex-col`:

```
flex-1 overflow-y-auto bg-zinc-50 p-6
→ flex-1 flex flex-col overflow-y-auto bg-zinc-50 p-6
```

- [ ] **Step 2: Convert TableDetailContent outer div to flex column**

In `src/components/data/table-detail-content.tsx` line 25, change:

```tsx
<div className="space-y-6">
```

To:

```tsx
<div className="flex flex-col flex-1 min-h-0 gap-6">
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/layout.tsx src/components/data/table-detail-content.tsx
git commit -m "fix(data): convert dashboard layout chain to flex column for table scroll"
```

---

### Task 2: Add sticky header and independent scroll to GridView

**Files:**
- Modify: `src/components/data/views/grid-view.tsx` (lines 410-489)

Critical: The shadcn `<Table>` component wraps `<table>` in a `<div className="overflow-x-auto">`, which becomes a nested scroll container and breaks sticky positioning. We bypass it by using raw `<table>` with the same styling classes.

- [ ] **Step 1: Replace `<Table>` with raw `<table>` and add overflow-auto wrapper**

Change the render return block (lines 410-489). Replace the outer div and `<Table>` usage:

From:
```tsx
    <div className="rounded-md border">
      <Table>
        <DragDropProvider onDragEnd={handleColumnDragEnd}>
          <TableHeader>
            <TableRow>
```

To:
```tsx
    <div className="rounded-md border flex-1 min-h-0 flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0 overflow-auto">
        <table className="w-full caption-bottom text-sm">
          <DragDropProvider onDragEnd={handleColumnDragEnd}>
            <thead className="[&_tr]:border-b">
              <tr className="border-b transition-colors hover:bg-muted/50 sticky top-0 z-10 bg-background">
```

And for the closing tags, replace `</Table>` with `</table></div>`:

From:
```tsx
      </Table>
    </div>
```

To:
```tsx
        </table>
      </div>
    </div>
```

- [ ] **Step 2: Update `<TableHeader>/<TableBody>/<TableRow>/<TableHead>/<TableCell>` to raw HTML**

In the same file, replace all shadcn Table primitives with raw HTML + equivalent Tailwind classes:

**`<TableHeader>` → `<thead className="[&_tr]:border-b">`**

**`</TableHeader>` → `</thead>`**

**`<TableBody>` → `<tbody className="[&_tr:last-child]:border-0">`**

**`</TableBody>` → `</tbody>`**

**`<TableRow>` → `<tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">`**

(except the header row which already has the sticky class from Step 1)

**`</TableRow>` → `</tr>`**

**`<TableHead>` → `<th className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0">`**

**`</TableHead>` → `</th>`**

**`<TableCell>` → `<td className="p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0">`**

**`</TableCell>` → `</td>`**

Note: After this change, the imports of `Table, TableBody, TableCell, TableHead, TableHeader, TableRow` from `@/components/ui/table` are no longer used and should be removed from the import statement.

- [ ] **Step 3: Add sticky to group rows**

In the grouped rendering section (around line 461), add sticky classes to group `<tr>`:

Change:
```tsx
<tr
  className="border-b transition-colors hover:bg-muted/50 bg-muted/50 hover:bg-muted/70 cursor-pointer select-none"
  onClick={() => toggleGroup(group.value)}
>
```

To:
```tsx
<tr
  className="border-b transition-colors bg-muted/50 hover:bg-muted/70 cursor-pointer select-none sticky top-[41px] z-[5]"
  onClick={() => toggleGroup(group.value)}
>
```

- [ ] **Step 4: Clean up unused imports**

Remove the `Table, TableBody, TableCell, TableHead, TableHeader, TableRow` imports from line 5-11 since we now use raw HTML elements.

- [ ] **Step 5: Commit**

```bash
git add src/components/data/views/grid-view.tsx
git commit -m "feat(data): add sticky header and independent scroll to GridView"
```

---

### Task 3: Update RecordTable pagination bar

**Files:**
- Modify: `src/components/data/record-table.tsx` (lines 254-330)

- [ ] **Step 1: Convert RecordTable outer div to flex column**

Change line 255:

```tsx
<div className="space-y-4">
```

To:

```tsx
<div className="flex flex-col flex-1 min-h-0 gap-4">
```

- [ ] **Step 2: Replace pagination section with always-visible bar**

Replace lines 298-319:

```tsx
{totalPages > 1 && (
  <div className="flex items-center justify-between text-sm text-zinc-500">
    <span>共 {totalCount} 条记录</span>
    <div className="flex gap-2">
      {page > 1 && (
        <Link href={buildPageHref(page - 1)}>
          <Button variant="outline" size="sm">上一页</Button>
        </Link>
      )}
      {page < totalPages && (
        <Link href={buildPageHref(page + 1)}>
          <Button variant="outline" size="sm">下一页</Button>
        </Link>
      )}
    </div>
  </div>
)}
```

With:

```tsx
<div className="flex items-center justify-between text-sm text-zinc-500 flex-shrink-0">
  <span>共 {totalCount} 条，第 {page}/{Math.max(totalPages, 1)} 页</span>
  <div className="flex gap-2">
    <Link href={buildPageHref(page - 1)}>
      <Button variant="outline" size="sm" disabled={page <= 1}>上一页</Button>
    </Link>
    <Link href={buildPageHref(page + 1)}>
      <Button variant="outline" size="sm" disabled={page >= totalPages}>下一页</Button>
    </Link>
  </div>
</div>
```

Key changes:
- Always visible (removed `totalPages > 1 &&` guard)
- Text: `共 X 条，第 Y/Z 页` (uses `Math.max(totalPages, 1)` to avoid "1/0 页")
- Buttons always render, `disabled` at boundaries
- `flex-shrink-0` prevents bar from shrinking

- [ ] **Step 3: Commit**

```bash
git add src/components/data/record-table.tsx
git commit -m "feat(data): add page info to always-visible pagination bar"
```
