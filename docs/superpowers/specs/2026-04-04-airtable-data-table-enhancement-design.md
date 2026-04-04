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

### New Hook Files

```
src/lib/hooks/
  ├─ use-table-data.ts          # Main hook
  ├─ use-inline-edit.ts         # Inline editing logic
  ├─ use-view-config.ts         # View config management
  └─ use-optimistic-mutation.ts # Optimistic update wrapper
```

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

**DataRecord model change:**

```prisma
model DataRecord {
  // ... existing fields unchanged
  manualSortOrder Int @default(0)  // NEW: manual ordering
}
```

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

// Grid (no extra options)
interface GridViewOptions {}
```

### Sort Config Change

```typescript
// Before: single field
// sortBy: SortConfig

// After: multi-field (priority high to low)
// sortBy: SortConfig[]
type SortConfigs = SortConfig[];
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

**Implementation:**
- `useInlineEdit` hook manages editing state (active cell, original value, dirty state)
- Each `CellEditor` component handles specific field type editing UI
- Save calls `updateRecord` API with optimistic UI update

**New API: `PATCH /api/data-tables/[id]/records/[recordId]`**

Single-field partial update for inline editing (reduces payload):

```typescript
// Request body
{ fieldKey: string; value: unknown }

// Server validates field exists and type matches, updates only that field
```

### 2. Multi-Field Sorting

**UI:** Sort configuration panel (from column header popover) with ability to add multiple sort conditions and drag to reorder priority.

**Backend:** `sortBy` in DataView changes from `SortConfig` to `SortConfig[]`. Service layer applies sorts in priority order. For JSONB fields, memory-based sorting applies all criteria in sequence.

### 3. Grouping (Group By)

**UI:**
- Column header menu adds "Group by this field" option
- Group header rows display field value and record count
- Group headers are collapsible (expand/collapse toggle)
- Within groups, records sorted by current sort rules

**Backend:** Grouping is a client-side operation (data already fetched). Records rendered in groups based on `groupBy` field value. Ungrouped records (null/empty values) go into a "No value" group.

**Supported group field types:** TEXT, NUMBER, DATE, SELECT, EMAIL, PHONE.

### 4. Column Drag Reorder

- Uses `@dnd-kit` for column header drag-and-drop
- On drop, updates `DataView.fieldOrder`
- Grid view only

### 5. Record Drag-and-Drop Sort

- Row drag updates `manualSortOrder`
- Only active when no sort conditions are set (manual sort mode)
- Uses `@dnd-kit/sortable` for smooth reordering
- Visual feedback during drag with drop indicator

**New API: `POST /api/data-tables/[id]/records/reorder`**

```typescript
// Request body
{ orders: Array<{ id: string; manualSortOrder: number }> }

// Batch updates manual sort order in transaction
```

## Kanban View

### Layout

Columns (swimlanes) = each option of the configured SELECT field. Cards = records, displaying configured `cardFields`.

### Core Features

1. **Columns** map to SELECT field options; "No value" column for records with null/empty
2. **Cards** show configured fields; primary field as card title
3. **Drag between columns** updates the SELECT field value automatically
4. **Drag within column** reorders records (updates manualSortOrder)
5. **Add record button** per column pre-sets the SELECT field value

### Data Loading

- Full fetch (no pagination) for kanban; group client-side by SELECT field value
- Warning when record count > 500 suggesting grid view

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

**`frappe-gantt`** (recommended):
- Lightweight (< 10KB)
- SVG rendering
- Good customizability
- Friendly interactions (drag to resize bars, click to view)

### Data Loading

- Full fetch, client-side filter for records with date values
- Sort by start date

### Components

```
src/components/data/views/
  ├─ timeline-view.tsx         # Main container
  ├─ timeline-gantt.tsx        # Gantt chart renderer
  └─ timeline-options.tsx      # Timeline config panel
```

## API Changes Summary

### Modified Endpoints

| Endpoint | Change |
|----------|--------|
| `POST/PUT /views` | Add `type` (ViewType), `viewOptions` (JSON), `groupBy` (string?) fields |
| `GET /records` | Support `manualSortOrder` sorting |
| `PUT /records/[id]` | Support single-field partial update |

### New Endpoints

| Endpoint | Purpose |
|----------|---------|
| `PATCH /records/[id]` | Single-field partial update (inline editing) |
| `POST /records/reorder` | Batch update `manualSortOrder` |

## New Dependencies

| Package | Purpose |
|---------|---------|
| `@dnd-kit/core` + `@dnd-kit/sortable` | Drag-and-drop (kanban, column reorder, row reorder) |
| `frappe-gantt` | Timeline gantt chart |

## File Structure Summary

```
src/
├─ lib/
│   ├─ hooks/                          # NEW: unified data layer
│   │   ├─ use-table-data.ts
│   │   ├─ use-inline-edit.ts
│   │   ├─ use-view-config.ts
│   │   └─ use-optimistic-mutation.ts
│   └─ services/                       # EXISTING, minor changes
│       └─ data-record.service.ts      # + reorderRecords, patchField
│       └─ data-view.service.ts        # + viewOptions, multi-sort, groupBy
├─ components/
│   └─ data/
│       ├─ view-switcher.tsx           # NEW: view type switcher
│       ├─ record-detail-drawer.tsx    # NEW: shared record detail drawer
│       ├─ record-table.tsx            # REFACTOR: use useTableData
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
│           ├─ kanban-view.tsx
│           │   ├─ kanban-column.tsx
│           │   └─ kanban-card.tsx
│           ├─ gallery-view.tsx
│           │   └─ gallery-card.tsx
│           └─ timeline-view.tsx
│               ├─ timeline-gantt.tsx
│               └─ timeline-options.tsx
├─ types/
│   └─ data-table.ts                   # EXTEND: ViewType, viewOptions types
└─ validators/
    └─ data-table.ts                   # EXTEND: new field validation
```

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
