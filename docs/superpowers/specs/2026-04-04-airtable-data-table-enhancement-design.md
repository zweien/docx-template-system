# Airtable-Style Data Table Enhancement Design

**Date:** 2026-04-04
**Status:** Draft
**Approach:** Full refactoring with unified data layer (Approach C)

## Goal

Enhance the master data table system to match Airtable's core interaction experience. This covers six first-tier feature gaps: inline cell editing, multiple view modes, drag-and-drop record sorting, column drag reorder, multi-field sorting, and single-level grouping.

## Architecture: Unified Data Layer

All views share a common data layer via React hooks, ensuring consistent CRUD, caching, optimistic updates, and view configuration management across grid, kanban, gallery, and timeline views.

```
┌─────────────────────────────────────────────┐
│  View Switcher (Grid/Kanban/Gallery/Timeline)│
├─────────────────────────────────────────────┤
│  useTableData() — Unified Data Hook          │
│  ├─ Data fetching (pagination/sort/filter)   │
│  ├─ CRUD operations (optimistic updates)     │
│  ├─ View config management                   │
│  └─ Inline editing state                     │
├─────────────────────────────────────────────┤
│  API Layer (existing APIs, minor changes)    │
├─────────────────────────────────────────────┤
│  Service Layer (existing services)           │
└─────────────────────────────────────────────┘
```

### Core Hook Interface

```typescript
interface UseTableDataOptions {
  tableId: string;
  viewId?: string;
  pageSize?: number;
}

interface UseTableDataReturn {
  // Data
  table: DataTableDetail;
  records: DataRecordItem[];
  totalCount: number;
  fields: DataFieldItem[];
  isLoading: boolean;

  // CRUD
  createRecord: (data: Record<string, unknown>) => Promise<void>;
  updateRecord: (id: string, data: Record<string, unknown>) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;

  // Inline editing
  editingCell: { recordId: string; fieldKey: string } | null;
  startEditing: (recordId: string, fieldKey: string) => void;
  commitEdit: (value: unknown) => Promise<void>;
  cancelEdit: () => void;

  // View control
  currentView: DataViewConfig;
  saveView: (name: string) => Promise<void>;
  switchView: (viewId: string) => void;

  // Sort/filter/group
  setSorts: (sorts: SortConfig[]) => void;
  setFilters: (filters: FilterCondition[]) => void;
  setGroupBy: (fieldKey: string | null) => void;

  // Pagination
  page: number;
  setPage: (p: number) => void;
}
```

### Hook Files

```
src/hooks/                              # Use existing hooks directory
  ├─ use-table-data.ts                  # Main hook
  ├─ use-inline-edit.ts                 # Inline editing logic
  ├─ use-view-config.ts                 # View config management
  └─ use-optimistic-mutation.ts         # Optimistic update wrapper
```

**Internal organization:**
- `use-table-data.ts` calls fetch wrappers for records, views, and record CRUD; owns URL sync (`searchParams` ↔ state) and search debounce (`useDebouncedCallback`)
- `use-optimistic-mutation.ts` provides a generic `useOptimisticMutation<T>` that wraps any async mutation with rollback, replacing the current ad-hoc `deletingIds` pattern in `record-table.tsx`
- `formatCellValue` utility extracted to `src/lib/format-cell.ts` (shared across views)

## Data Model Changes

### Prisma Schema

**New enum:**

```prisma
enum ViewType {
  GRID
  KANBAN
  GALLERY
  TIMELINE
}
```

**DataView model changes:**

```prisma
model DataView {
  id            String   @id @default(cuid())
  tableId       String
  name          String
  type          ViewType @default(GRID)       // NEW
  isDefault     Boolean  @default(false)
  filters       Json?
  sortBy        Json?                           // Changed: SortConfig[] (was SortConfig)
  visibleFields Json?
  fieldOrder    Json?
  groupBy       String?                         // NEW: field key for grouping
  viewOptions   Json?                           // NEW: view-specific config
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  table         DataTable @relation(fields: [tableId], onDelete: Cascade)

  @@unique([tableId, name])
}
```

**No changes to DataRecord model.** Manual sort order is stored per-view (see below).

### Manual Sort Design

Manual sort order is **per-view**, not per-record. The `manualSortOrder` for records within a specific view is stored in `DataView.viewOptions`:

```typescript
// Inside viewOptions for grid/kanban views
interface ManualSortConfig {
  enabled: boolean;
  // Sparse order map: recordId -> position (uses gap algorithm: 0, 1000, 2000...)
  orders: Record<string, number>;
}
```

**Trade-off:** This means manual sort is isolated per view and not shared across views. If manual sort is needed globally, consider migrating to `DataRecord` field in a future iteration. For now, per-view is correct because Airtable also stores manual sort per-view.

### View Options Per Type

```typescript
// Kanban
interface KanbanViewOptions {
  groupByField: string;       // SELECT field key
  cardFields: string[];       // Fields shown on cards
  coverField?: string;        // Cover image field (FILE type)
}

// Gallery
interface GalleryViewOptions {
  cardFields: string[];
  coverField?: string;
  primaryField: string;       // Title field
}

// Timeline
interface TimelineViewOptions {
  startDateField: string;     // Start date field
  endDateField?: string;      // End date field (optional)
  labelField: string;         // Label field for bars
  colorField?: string;        // Color grouping field
}

// Grid (includes manual sort config)
interface GridViewOptions {
  manualSort?: ManualSortConfig;
}
```

### Sort Config Change

```typescript
// Before: single field
// sortBy: { fieldKey: string; order: "asc" | "desc" }

// After: multi-field (priority high to low)
// sortBy: Array<{ fieldKey: string; order: "asc" | "desc" }>
```

**Migration strategy:** Existing `DataView` rows store `sortBy` as `SortConfig` (single object). After schema migration, the `mapViewItem` function in `data-view.service.ts` will normalize legacy data:

```typescript
function normalizeSortBy(raw: unknown): SortConfig[] | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw;
  // Legacy format: single SortConfig object → wrap in array
  return [raw as SortConfig];
}
```

This is applied at read time in `mapViewItem`, so no one-time data migration script is needed.

### Type Changes in `src/types/data-table.ts`

```typescript
// Updated DataViewConfig
interface DataViewConfig {
  filters: FilterCondition[];
  sortBy: SortConfig[];       // Changed: was SortConfig | null
  visibleFields: string[];
  fieldOrder: string[];
  groupBy: string | null;     // NEW
  viewOptions: Record<string, unknown>; // NEW
}

// Updated DataViewItem
interface DataViewItem {
  id: string;
  tableId: string;
  name: string;
  type: ViewType;             // NEW
  isDefault: boolean;
  config: DataViewConfig;
  createdAt: string;
  updatedAt: string;
}
```

### Validator Changes in `src/validators/data-table.ts`

```typescript
// New: partial field update schema
const patchFieldSchema = z.object({
  fieldKey: z.string().regex(/^[a-z][a-z0-9_]*$/),
  value: z.unknown(),
});

// Updated: view create/update schema now includes type, viewOptions, groupBy
const viewConfigSchema = z.object({
  filters: z.array(filterConditionSchema).optional(),
  sortBy: z.array(sortConfigSchema).optional(),   // Changed: array
  visibleFields: z.array(z.string()).optional(),
  fieldOrder: z.array(z.string()).optional(),
  groupBy: z.string().nullable().optional(),       // NEW
  viewOptions: z.record(z.unknown()).optional(),   // NEW
});

// New: reorder schema
const reorderSchema = z.object({
  recordIds: z.array(z.string()).min(1).max(200),
});
```

## Grid View Enhancements

### 1. Inline Cell Editing

**Interaction:**
- Single click on cell → enters edit mode with field-type-specific editor
- Enter / Tab → save and move to next cell
- Esc → cancel, restore original value
- Click another cell → auto-save current edit

**Field Type Editor Mapping:**

| Field Type | Editor Component | Width |
|-----------|-----------------|-------|
| TEXT | `<input type="text">` | Auto |
| NUMBER | `<input type="number">` | 120px |
| DATE | Date picker popover | 150px |
| SELECT | Dropdown select | Auto |
| MULTISELECT | Tag input | Auto |
| EMAIL | `<input type="email">` | Auto |
| PHONE | `<input type="tel">` | 150px |
| FILE | File upload button | 100px |
| RELATION | Relation select dropdown | Auto |

**RELATION_SUBTABLE:** Not editable inline; requires opening the subtable editor (preserves current behavior).

**Implementation:**
- `useInlineEdit` hook manages editing state (active cell, original value, dirty state)
- Each `CellEditor` component handles specific field type editing UI
- Save calls `PATCH /records/[id]` API with optimistic UI update via `useOptimisticMutation`

**New API: `PATCH /api/data-tables/[id]/records/[recordId]`**

Route file: `src/app/api/data-tables/[id]/records/[recordId]/route.ts` (add PATCH handler)

```typescript
// Request body (validated by patchFieldSchema)
{ fieldKey: string; value: unknown }

// Response: updated record
```

Server-side validation:
1. `fieldKey` must exist in table's field definitions
2. If field is `required` and value is null/empty, reject
3. Type-specific validation (email format, number coercion, SELECT option membership)
4. Validation uses existing `validateRecordData` logic in `data-record.service.ts`

### 2. Multi-Field Sorting

**UI:** Sort configuration panel (from column header popover) with ability to add multiple sort conditions and drag to reorder priority.

**Backend:** `sortBy` in DataView changes from `SortConfig` to `SortConfig[]`. Service layer applies sorts in priority order. For JSONB fields, memory-based sorting applies all criteria in sequence.

**Unsupported for grouping/sorting:** RELATION and RELATION_SUBTABLE fields show a disabled "Group by" / "Sort by" option with tooltip explaining they don't support these operations. RELATION fields support sorting by display value only.

### 3. Grouping (Group By)

**UI:**
- Column header menu adds "Group by this field" option
- Group header rows display field value and record count
- Group headers are collapsible (expand/collapse toggle)
- Within groups, records sorted by current sort rules

**Backend:** Grouping is a client-side operation (data already fetched). Records rendered in groups based on `groupBy` field value. Ungrouped records (null/empty values) go into a "No value" group.

**Supported group field types:** TEXT, NUMBER, DATE, SELECT, EMAIL, PHONE.

**RELATION/RELATION_SUBTABLE fields:** Show disabled "Group by" option with tooltip. These complex types don't have meaningful group values.

### 4. Column Drag Reorder

- Uses `@dnd-kit/react` for column header drag-and-drop
- On drop, updates `DataView.fieldOrder`
- Grid view only

### 5. Record Drag-and-Drop Sort

- Row drag updates manual sort order in view's `viewOptions.manualSort.orders`
- Only active when no sort conditions are set (manual sort mode)
- Uses `@dnd-kit/react` for smooth reordering
- Visual feedback during drag with drop indicator
- Gap algorithm for order values (0, 1000, 2000...) to minimize reorder operations

**New API: `POST /api/data-tables/[id]/records/reorder`**

Route file: `src/app/api/data-tables/[id]/records/reorder/route.ts` (new file)

```typescript
// Request body (validated by reorderSchema)
{ recordIds: string[] }

// Server assigns manualSortOrder using gap algorithm and updates view config
```

Server computes actual sort values from the ordered ID list, then updates `DataView.viewOptions` with the new order map. This is idempotent — same input always produces same order.

## Kanban View

### Layout

Columns (swimlanes) = each option of the configured SELECT field. Cards = records, displaying configured `cardFields`.

### Core Features

1. **Columns** map to SELECT field options; "No value" column for records with null/empty
2. **Cards** show configured fields; primary field as card title
3. **Drag between columns** updates the SELECT field value automatically (via PATCH)
4. **Drag within column** reorders records (updates manual sort in view config)
5. **Add record button** per column pre-sets the SELECT field value

### Data Loading

- Full fetch (no pagination) for kanban; group client-side by SELECT field value
- Warning when record count > 500 suggesting grid view
- Future optimization: server-side grouping API for large datasets (not in this iteration)

### Components

```
src/components/data/views/
  ├─ kanban-view.tsx         # Main container
  ├─ kanban-column.tsx       # Single swimlane
  ├─ kanban-card.tsx         # Card component
  └─ kanban-card-editor.tsx  # Inline card editing
```

## Gallery View

### Layout

Responsive CSS Grid with 3-4 cards per row. Each card shows cover image, title field, and configured detail fields.

### Core Features

1. **Card grid**: Responsive CSS Grid layout (3-4 cards per row)
2. **Cover image**: Optional FILE field as cover; first-letter avatar when no image
3. **Title field**: Configurable (defaults to first TEXT field)
4. **Detail fields**: Configurable list of fields to display
5. **Click card** → opens record detail drawer (shared across views)
6. **Pagination** supported

### Components

```
src/components/data/views/
  ├─ gallery-view.tsx         # Main container
  ├─ gallery-card.tsx         # Single card
  └─ record-detail-drawer.tsx # Shared record detail drawer
```

## Timeline View

### Layout

Gantt-chart style: left panel shows record labels, right panel shows horizontal bars spanning date ranges.

### Core Features

1. **Gantt bars**: Horizontal bars from start date to end date
2. **Required config**: Start date field (DATE type) and label field
3. **Optional config**: End date field (defaults to 1 day if missing), color grouping field
4. **Time zoom**: Day / Week / Month view toggle
5. **Today marker**: Vertical red dashed line
6. **Click bar** → opens record detail drawer
7. **Hover tooltip**: Shows record summary

### Technical Choice

**Custom SVG Gantt component** (recommended over `frappe-gantt`):

Rationale:
- `frappe-gantt` has low maintenance (last commit Feb 2025), no official React wrapper, no TypeScript types
- Project already uses `@xyflow/react` (SVG-based), team is familiar with SVG rendering patterns
- A lightweight custom SVG gantt (~200 lines) gives full control over interactions and styling
- No additional dependency needed

Implementation approach:
- React component renders SVG directly
- `useRef` + `useEffect` for scroll/resize handling
- Standard React event handlers for click/hover
- View mode (day/week/month) changes SVG scale

### Data Loading

- Full fetch, client-side filter for records with date values
- Sort by start date

### Components

```
src/components/data/views/
  ├─ timeline-view.tsx         # Main container
  ├─ timeline-gantt.tsx        # Gantt chart renderer (custom SVG)
  └─ timeline-options.tsx      # Timeline config panel
```

## API Changes Summary

### Modified Endpoints

| Endpoint | File | Change |
|----------|------|--------|
| `POST/PUT /views` | `views/route.ts` | Add `type` (ViewType), `viewOptions` (JSON), `groupBy` (string?) fields |
| `GET /records` | `records/route.ts` | Support `manualSortOrder` sorting from view config |
| `PUT /records/[id]` | `[recordId]/route.ts` | No change (PATCH handles inline editing) |

### New Endpoints

| Endpoint | File | Purpose |
|----------|------|---------|
| `PATCH /records/[id]` | `[recordId]/route.ts` (add handler) | Single-field partial update (inline editing) |
| `POST /records/reorder` | `reorder/route.ts` (new file) | Batch update manual sort order |

## New Dependencies

| Package | Purpose |
|---------|---------|
| `@dnd-kit/react` | Drag-and-drop for React 19 (kanban, column reorder, row reorder) |

Note: No gantt chart library needed — using custom SVG implementation.

## File Structure Summary

```
src/
├─ hooks/                              # EXISTING directory, add new hooks
│   ├─ use-debounce.ts                 # EXISTING
│   ├─ use-table-data.ts               # NEW: main hook
│   ├─ use-inline-edit.ts              # NEW: inline editing logic
│   ├─ use-view-config.ts              # NEW: view config management
│   └─ use-optimistic-mutation.ts      # NEW: optimistic update wrapper
├─ lib/
│   ├─ format-cell.ts                  # NEW: shared cell formatting utility
│   └─ services/                       # EXISTING, minor changes
│       ├─ data-record.service.ts      # + patchField, reorderRecords (view-based)
│       └─ data-view.service.ts        # + viewOptions, multi-sort, groupBy, mapViewItem updates
├─ components/
│   └─ data/
│       ├─ view-switcher.tsx           # NEW: view type switcher
│       ├─ record-detail-drawer.tsx    # NEW: shared record detail drawer
│       ├─ record-table.tsx            # REFACTOR: extract hooks, keep URL sync + layout
│       ├─ cell-editors/               # NEW: field-type editors
│       │   ├─ text-cell-editor.tsx
│       │   ├─ number-cell-editor.tsx
│       │   ├─ date-cell-editor.tsx
│       │   ├─ select-cell-editor.tsx
│       │   ├─ multiselect-cell-editor.tsx
│       │   ├─ email-cell-editor.tsx
│       │   ├─ phone-cell-editor.tsx
│       │   ├─ file-cell-editor.tsx
│       │   └─ relation-cell-editor.tsx
│       └─ views/                      # NEW: view components
│           ├─ grid-view.tsx
│           ├─ kanban/
│           │   ├─ kanban-view.tsx
│           │   ├─ kanban-column.tsx
│           │   └─ kanban-card.tsx
│           ├─ gallery/
│           │   ├─ gallery-view.tsx
│           │   └─ gallery-card.tsx
│           └─ timeline/
│               ├─ timeline-view.tsx
│               ├─ timeline-gantt.tsx
│               └─ timeline-options.tsx
├─ types/
│   └─ data-table.ts                   # EXTEND: ViewType, updated DataViewConfig/DataViewItem
└─ validators/
    └─ data-table.ts                   # EXTEND: patchFieldSchema, reorderSchema, updated view schemas
```

### Refactoring Path for `record-table.tsx`

The existing `record-table.tsx` (575 lines) will be refactored as follows:

**Move to hooks:**
- Data fetching + URL sync → `use-table-data.ts`
- Search debounce → `use-table-data.ts`
- CRUD + optimistic updates → `use-optimistic-mutation.ts` + `use-table-data.ts`

**Move to shared utils:**
- `formatCellValue` → `src/lib/format-cell.ts`

**Keep in component:**
- Grid layout/rendering logic
- Column header interactions (sort/filter popovers)
- Row action buttons

## Migration Plan

1. Add `ViewType` enum and new `DataView` columns (`type`, `groupBy`, `viewOptions`) via `prisma db push`
2. PostgreSQL `@default(GRID)` automatically applies to existing rows — all existing views become GRID type
3. `sortBy` normalization handled at read time in `mapViewItem` (no data migration needed)
4. Existing `DataViewItem` and `DataViewConfig` types updated with new fields
5. Backward compatible: old clients that don't send `type` default to GRID

## Out of Scope

These items are intentionally excluded from this iteration:

- Calendar view
- Formula/calculated fields
- Conditional formatting
- Column freeze
- Record comments/collaboration
- Webhook/automation
- Real-time collaboration
- Revision history
- Checkbox, URL, Auto Number field types
