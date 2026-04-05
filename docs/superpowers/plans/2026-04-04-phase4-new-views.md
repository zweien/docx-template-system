# Phase 4: Kanban / Gallery / Timeline 新视图实现

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 Kanban、Gallery、Timeline 三种 Airtable 风格新视图，并接入 Phase 3 的视图切换器和记录详情抽屉。

**Architecture:** 新视图只负责按 `DataRecordItem[]` 和 `DataFieldItem[]` 渲染交互 UI，数据获取、PATCH 更新、视图配置和分页仍统一由 Phase 1 的 `useTableData` 提供，记录详情由 Phase 3 的 `RecordDetailDrawer` 承担。Kanban 与 Timeline 对当前视图配置做轻量解析，缺少必需字段时显示可操作的空状态，不引入额外状态源。

**Tech Stack:** React 19, Next.js v16, `@dnd-kit/react`, `lucide-react`, `@testing-library/react`, `vitest`

**Depends on:** Phase 1 (统一数据层), Phase 3 (视图切换器 + 记录详情抽屉)

---

## File Structure

```
src/components/data/views/kanban/
  kanban-view.tsx                      # CREATE: 看板容器 + 按 SELECT 字段分列 + 拖拽改列
  kanban-column.tsx                    # CREATE: 单列泳道渲染
  kanban-card.tsx                      # CREATE: 卡片渲染 + 点击打开详情抽屉
  kanban-view.test.tsx                 # CREATE: 分列、空值列、卡片点击、跨列更新测试
src/components/data/views/gallery/
  gallery-view.tsx                     # CREATE: 响应式卡片网格 + 分页状态透传
  gallery-card.tsx                     # CREATE: 封面、标题、详情字段展示
  gallery-view.test.tsx                # CREATE: 封面回退、标题字段、点击打开详情测试
src/components/data/views/timeline/
  timeline-view.tsx                    # CREATE: 时间线容器 + 配置校验 + 缩放切换
  timeline-gantt.tsx                   # CREATE: SVG 甘特条渲染 + today marker + tooltip
  timeline-options.tsx                 # CREATE: Day/Week/Month 缩放切换
  timeline-view.test.tsx               # CREATE: 必填字段校验、条形区间渲染、缩放切换测试
src/components/data/
  table-detail-content.tsx             # MODIFY: 根据当前 view.type 渲染新视图
```

---

### Task 19: 实现 Kanban 视图

**Files:**
- Create: `src/components/data/views/kanban/kanban-view.tsx`
- Create: `src/components/data/views/kanban/kanban-column.tsx`
- Create: `src/components/data/views/kanban/kanban-card.tsx`
- Create: `src/components/data/views/kanban/kanban-view.test.tsx`

- [ ] **Step 1: 先写 Kanban 失败测试**

创建 `src/components/data/views/kanban/kanban-view.test.tsx`：

```typescript
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DataFieldItem, DataRecordItem, DataViewItem } from "@/types/data-table";
import { KanbanView } from "./kanban-view";

vi.mock("@dnd-kit/react", () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const fields = [
  {
    id: "field-status",
    key: "status",
    label: "状态",
    type: "SELECT",
    required: false,
    options: ["Todo", "Doing", "Done"],
    sortOrder: 0,
  },
  {
    id: "field-title",
    key: "title",
    label: "标题",
    type: "TEXT",
    required: false,
    sortOrder: 1,
  },
] as DataFieldItem[];

const records = [
  {
    id: "record-1",
    tableId: "table-1",
    data: { status: "Todo", title: "第一条" },
    createdAt: new Date("2026-04-04T00:00:00.000Z"),
    updatedAt: new Date("2026-04-04T00:00:00.000Z"),
    createdByName: "Admin",
  },
  {
    id: "record-2",
    tableId: "table-1",
    data: { status: null, title: "未分组" },
    createdAt: new Date("2026-04-04T00:00:00.000Z"),
    updatedAt: new Date("2026-04-04T00:00:00.000Z"),
    createdByName: "Admin",
  },
] as DataRecordItem[];

const view = {
  id: "view-1",
  tableId: "table-1",
  name: "看板",
  type: "KANBAN",
  isDefault: false,
  filters: [],
  sortBy: [],
  visibleFields: ["title", "status"],
  fieldOrder: ["title", "status"],
  groupBy: "status",
  viewOptions: {
    groupByField: "status",
    cardFields: ["title"],
  },
  createdAt: new Date("2026-04-04T00:00:00.000Z"),
  updatedAt: new Date("2026-04-04T00:00:00.000Z"),
} as DataViewItem;

describe("KanbanView", () => {
  it("按 SELECT 选项分列，并把空值记录放入“无值”列", () => {
    render(
      <KanbanView
        fields={fields}
        records={records}
        view={view}
        isAdmin={true}
        onPatchRecord={vi.fn()}
        onOpenRecord={vi.fn()}
      />
    );

    expect(screen.getByText("Todo")).toBeInTheDocument();
    expect(screen.getByText("Doing")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.getByText("无值")).toBeInTheDocument();
    expect(screen.getByText("第一条")).toBeInTheDocument();
    expect(screen.getByText("未分组")).toBeInTheDocument();
  });

  it("点击卡片时回调打开记录详情抽屉", () => {
    const onOpenRecord = vi.fn();

    render(
      <KanbanView
        fields={fields}
        records={records}
        view={view}
        isAdmin={true}
        onPatchRecord={vi.fn()}
        onOpenRecord={onOpenRecord}
      />
    );

    fireEvent.click(screen.getByText("第一条"));

    expect(onOpenRecord).toHaveBeenCalledWith("record-1");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run "src/components/data/views/kanban/kanban-view.test.tsx"`

Expected: FAIL，报错包含 `Failed to resolve import "./kanban-view"` 或 `KanbanView` 未定义。

- [ ] **Step 3: 实现 Kanban 卡片组件**

创建 `src/components/data/views/kanban/kanban-card.tsx`：

```typescript
"use client";

import { useDraggable } from "@dnd-kit/react";
import type { DataFieldItem, DataRecordItem } from "@/types/data-table";

interface KanbanCardProps {
  record: DataRecordItem;
  cardFields: DataFieldItem[];
  titleField: DataFieldItem;
  onOpenRecord: (recordId: string) => void;
}

export function KanbanCard({
  record,
  cardFields,
  titleField,
  onOpenRecord,
}: KanbanCardProps) {
  const { ref: dragRef, isDragging } = useDraggable({ id: record.id });
  const title = String(record.data[titleField.key] ?? "未命名记录");

  return (
    <div
      ref={dragRef}
      className={`w-full rounded-lg border bg-background p-3 text-left shadow-xs transition-colors hover:bg-accent cursor-grab ${isDragging ? "opacity-50" : ""}`}
      onClick={() => onOpenRecord(record.id)}
    >
      <div className="text-sm font-medium">{title}</div>
      <div className="mt-2 space-y-1">
        {cardFields
          .filter((field) => field.key !== titleField.key)
          .map((field) => (
            <div key={field.id} className="text-xs text-muted-foreground">
              <span className="mr-1">{field.label}:</span>
              <span>{String(record.data[field.key] ?? "-")}</span>
            </div>
          ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 实现 Kanban 单列组件**

创建 `src/components/data/views/kanban/kanban-column.tsx`：

```typescript
"use client";

import { useDroppable } from "@dnd-kit/react";
import type { DataFieldItem, DataRecordItem } from "@/types/data-table";
import { KanbanCard } from "./kanban-card";

interface KanbanColumnProps {
  label: string;
  records: DataRecordItem[];
  cardFields: DataFieldItem[];
  titleField: DataFieldItem;
  onOpenRecord: (recordId: string) => void;
}

export function KanbanColumn({
  label,
  records,
  cardFields,
  titleField,
  onOpenRecord,
}: KanbanColumnProps) {
  const { ref: dropRef } = useDroppable({ id: label });

  return (
    <section ref={dropRef} className="min-w-[280px] flex-1 rounded-xl border bg-muted/30 p-3">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{label}</h3>
        <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground">
          {records.length}
        </span>
      </div>
      <div className="space-y-2">
        {records.map((record) => (
          <KanbanCard
            key={record.id}
            record={record}
            cardFields={cardFields}
            titleField={titleField}
            onOpenRecord={onOpenRecord}
          />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 5: 实现 Kanban 容器组件**

创建 `src/components/data/views/kanban/kanban-view.tsx`：

> **DnD 接线说明：** `@dnd-kit/react` 要求每个可拖拽元素用 `useDraggable({ id })` 注册，每个可放置区域用 `useDroppable({ id })` 注册。Kanban 中：
> - **KanbanCard** 使用 `useDraggable({ id: record.id })` — 卡片可被拖动
> - **KanbanColumn** 使用 `useDroppable({ id: label })` — 列作为放置目标，id 为 SELECT 选项值（如 "Todo"、"Done"）
> - `DndContext.onDragEnd` 中 `event.active.id` 为 record.id，`event.over?.id` 为目标列的 SELECT 选项值
> - 拖到 "无值" 列时 commit `null`，拖到其他列时 commit 对应选项字符串

```typescript
"use client";

import { DndContext } from "@dnd-kit/react";
import type { DataFieldItem, DataRecordItem, DataViewItem } from "@/types/data-table";
import { KanbanColumn } from "./kanban-column";

interface KanbanViewProps {
  fields: DataFieldItem[];
  records: DataRecordItem[];
  view: DataViewItem;
  isAdmin: boolean;
  onPatchRecord: (recordId: string, fieldKey: string, value: unknown) => Promise<void>;
  onOpenRecord: (recordId: string) => void;
}

function resolveGroupField(view: DataViewItem, fields: DataFieldItem[]): DataFieldItem | null {
  const fieldKey =
    typeof view.viewOptions.groupByField === "string"
      ? view.viewOptions.groupByField
      : view.groupBy;

  const field = fields.find((item) => item.key === fieldKey && item.type === "SELECT");
  return field ?? null;
}

function resolveTitleField(fields: DataFieldItem[]): DataFieldItem {
  return (
    fields.find((field) => field.type === "TEXT") ??
    fields[0] ?? {
      id: "fallback-title",
      key: "id",
      label: "记录",
      type: "TEXT",
      required: false,
      sortOrder: 0,
    }
  );
}

export function KanbanView({
  fields,
  records,
  view,
  onPatchRecord,
  onOpenRecord,
}: KanbanViewProps) {
  const groupField = resolveGroupField(view, fields);

  if (!groupField) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        看板视图需要在 viewOptions.groupByField 中配置一个 SELECT 字段
      </div>
    );
  }

  const cardFieldKeys = Array.isArray(view.viewOptions.cardFields)
    ? view.viewOptions.cardFields.filter((key): key is string => typeof key === "string")
    : fields.map((field) => field.key);
  const cardFields = cardFieldKeys
    .map((fieldKey) => fields.find((field) => field.key === fieldKey))
    .filter((field): field is DataFieldItem => Boolean(field));
  const titleField = resolveTitleField(cardFields.length > 0 ? cardFields : fields);

  const groupedRecords = new Map<string, DataRecordItem[]>();
  for (const option of groupField.options ?? []) {
    groupedRecords.set(option, []);
  }
  groupedRecords.set("无值", []);

  for (const record of records) {
    const rawValue = record.data[groupField.key];
    const groupKey =
      typeof rawValue === "string" && rawValue.length > 0 ? rawValue : "无值";
    const bucket = groupedRecords.get(groupKey) ?? groupedRecords.get("无值");
    bucket?.push(record);
  }

  return (
    <DndContext
      onDragEnd={async (event) => {
        const recordId = String(event.active.id);
        const nextValue = String(event.over?.id ?? "");
        if (!nextValue || nextValue === "无值") {
          await onPatchRecord(recordId, groupField.key, null);
          return;
        }
        await onPatchRecord(recordId, groupField.key, nextValue);
      }}
    >
      <div className="flex gap-4 overflow-x-auto pb-2">
        {[...groupedRecords.entries()].map(([label, columnRecords]) => (
          <KanbanColumn
            key={label}
            label={label}
            records={columnRecords}
            cardFields={cardFields.length > 0 ? cardFields : fields}
            titleField={titleField}
            onOpenRecord={onOpenRecord}
          />
        ))}
      </div>
    </DndContext>
  );
}
```

- [ ] **Step 6: 运行 Kanban 测试**

Run: `npx vitest run "src/components/data/views/kanban/kanban-view.test.tsx"`

Expected: PASS，两个测试均通过。

- [ ] **Step 7: Commit**

```bash
git add src/components/data/views/kanban/kanban-view.tsx src/components/data/views/kanban/kanban-column.tsx src/components/data/views/kanban/kanban-card.tsx src/components/data/views/kanban/kanban-view.test.tsx
git commit -m "feat(data): add Kanban view with grouped columns and record drilldown"
```

---

### Task 20: 实现 Gallery 视图

**Files:**
- Create: `src/components/data/views/gallery/gallery-view.tsx`
- Create: `src/components/data/views/gallery/gallery-card.tsx`
- Create: `src/components/data/views/gallery/gallery-view.test.tsx`

- [ ] **Step 1: 先写 Gallery 失败测试**

创建 `src/components/data/views/gallery/gallery-view.test.tsx`：

```typescript
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DataFieldItem, DataRecordItem, DataViewItem } from "@/types/data-table";
import { GalleryView } from "./gallery-view";

const fields = [
  {
    id: "field-cover",
    key: "cover",
    label: "封面",
    type: "FILE",
    required: false,
    sortOrder: 0,
  },
  {
    id: "field-title",
    key: "title",
    label: "标题",
    type: "TEXT",
    required: false,
    sortOrder: 1,
  },
  {
    id: "field-owner",
    key: "owner",
    label: "负责人",
    type: "TEXT",
    required: false,
    sortOrder: 2,
  },
] as DataFieldItem[];

const view = {
  id: "view-2",
  tableId: "table-1",
  name: "画廊",
  type: "GALLERY",
  isDefault: false,
  filters: [],
  sortBy: [],
  visibleFields: ["cover", "title", "owner"],
  fieldOrder: ["cover", "title", "owner"],
  groupBy: null,
  viewOptions: {
    coverField: "cover",
    primaryField: "title",
    cardFields: ["owner"],
  },
  createdAt: new Date("2026-04-04T00:00:00.000Z"),
  updatedAt: new Date("2026-04-04T00:00:00.000Z"),
} as DataViewItem;

describe("GalleryView", () => {
  it("渲染封面回退头像、标题和详情字段", () => {
    const records = [
      {
        id: "record-1",
        tableId: "table-1",
        data: { title: "Alpha", owner: "Alice", cover: null },
        createdAt: new Date("2026-04-04T00:00:00.000Z"),
        updatedAt: new Date("2026-04-04T00:00:00.000Z"),
        createdByName: "Admin",
      },
    ] as DataRecordItem[];

    render(
      <GalleryView
        fields={fields}
        records={records}
        view={view}
        onOpenRecord={vi.fn()}
      />
    );

    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("负责人: Alice")).toBeInTheDocument();
  });

  it("点击卡片时打开记录详情抽屉", () => {
    const onOpenRecord = vi.fn();
    const records = [
      {
        id: "record-1",
        tableId: "table-1",
        data: { title: "Alpha", owner: "Alice" },
        createdAt: new Date("2026-04-04T00:00:00.000Z"),
        updatedAt: new Date("2026-04-04T00:00:00.000Z"),
        createdByName: "Admin",
      },
    ] as DataRecordItem[];

    render(
      <GalleryView
        fields={fields}
        records={records}
        view={view}
        onOpenRecord={onOpenRecord}
      />
    );

    fireEvent.click(screen.getByText("Alpha"));

    expect(onOpenRecord).toHaveBeenCalledWith("record-1");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run "src/components/data/views/gallery/gallery-view.test.tsx"`

Expected: FAIL，报错包含 `Failed to resolve import "./gallery-view"` 或 `GalleryView` 未定义。

- [ ] **Step 3: 实现 Gallery 卡片组件**

创建 `src/components/data/views/gallery/gallery-card.tsx`：

```typescript
"use client";

import type { DataFieldItem, DataRecordItem } from "@/types/data-table";

interface GalleryCardProps {
  record: DataRecordItem;
  coverField?: DataFieldItem;
  titleField: DataFieldItem;
  detailFields: DataFieldItem[];
  onOpenRecord: (recordId: string) => void;
}

function resolveCoverInitial(title: string): string {
  const trimmed = title.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 1).toUpperCase() : "?";
}

export function GalleryCard({
  record,
  coverField,
  titleField,
  detailFields,
  onOpenRecord,
}: GalleryCardProps) {
  const title = String(record.data[titleField.key] ?? "未命名记录");
  const coverValue = coverField ? record.data[coverField.key] : null;
  const coverUrl = typeof coverValue === "string" && coverValue.length > 0 ? coverValue : null;

  return (
    <button
      type="button"
      className="overflow-hidden rounded-xl border bg-background text-left shadow-xs transition-colors hover:bg-accent"
      onClick={() => onOpenRecord(record.id)}
    >
      {coverUrl ? (
        <img src={coverUrl} alt={title} className="h-36 w-full object-cover" />
      ) : (
        <div className="flex h-36 w-full items-center justify-center bg-muted text-3xl font-semibold text-muted-foreground">
          {resolveCoverInitial(title)}
        </div>
      )}

      <div className="space-y-2 p-4">
        <div className="text-sm font-semibold">{title}</div>
        <div className="space-y-1">
          {detailFields.map((field) => (
            <div key={field.id} className="text-xs text-muted-foreground">
              {field.label}: {String(record.data[field.key] ?? "-")}
            </div>
          ))}
        </div>
      </div>
    </button>
  );
}
```

- [ ] **Step 4: 实现 Gallery 容器组件**

创建 `src/components/data/views/gallery/gallery-view.tsx`：

```typescript
"use client";

import type { DataFieldItem, DataRecordItem, DataViewItem } from "@/types/data-table";
import { GalleryCard } from "./gallery-card";

interface GalleryViewProps {
  fields: DataFieldItem[];
  records: DataRecordItem[];
  view: DataViewItem;
  onOpenRecord: (recordId: string) => void;
}

function findField(fields: DataFieldItem[], fieldKey: unknown): DataFieldItem | undefined {
  if (typeof fieldKey !== "string") return undefined;
  return fields.find((field) => field.key === fieldKey);
}

export function GalleryView({
  fields,
  records,
  view,
  onOpenRecord,
}: GalleryViewProps) {
  const titleField =
    findField(fields, view.viewOptions.primaryField) ??
    fields.find((field) => field.type === "TEXT") ??
    fields[0];
  const coverField = findField(fields, view.viewOptions.coverField);
  const detailFieldKeys = Array.isArray(view.viewOptions.cardFields)
    ? view.viewOptions.cardFields.filter((key): key is string => typeof key === "string")
    : [];
  const detailFields = detailFieldKeys
    .map((fieldKey) => fields.find((field) => field.key === fieldKey))
    .filter((field): field is DataFieldItem => Boolean(field));

  if (!titleField) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        画廊视图至少需要 1 个字段作为标题
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {records.map((record) => (
        <GalleryCard
          key={record.id}
          record={record}
          coverField={coverField}
          titleField={titleField}
          detailFields={detailFields}
          onOpenRecord={onOpenRecord}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 5: 运行 Gallery 测试**

Run: `npx vitest run "src/components/data/views/gallery/gallery-view.test.tsx"`

Expected: PASS，两个测试均通过。

- [ ] **Step 6: Commit**

```bash
git add src/components/data/views/gallery/gallery-view.tsx src/components/data/views/gallery/gallery-card.tsx src/components/data/views/gallery/gallery-view.test.tsx
git commit -m "feat(data): add Gallery view with cover fallback and card drilldown"
```

---

### Task 21: 实现 Timeline 视图

**Files:**
- Create: `src/components/data/views/timeline/timeline-view.tsx`
- Create: `src/components/data/views/timeline/timeline-gantt.tsx`
- Create: `src/components/data/views/timeline/timeline-options.tsx`
- Create: `src/components/data/views/timeline/timeline-view.test.tsx`

- [ ] **Step 1: 先写 Timeline 失败测试**

创建 `src/components/data/views/timeline/timeline-view.test.tsx`：

```typescript
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DataFieldItem, DataRecordItem, DataViewItem } from "@/types/data-table";
import { TimelineView } from "./timeline-view";

const fields = [
  {
    id: "field-start",
    key: "start_date",
    label: "开始日期",
    type: "DATE",
    required: false,
    sortOrder: 0,
  },
  {
    id: "field-end",
    key: "end_date",
    label: "结束日期",
    type: "DATE",
    required: false,
    sortOrder: 1,
  },
  {
    id: "field-title",
    key: "title",
    label: "标题",
    type: "TEXT",
    required: false,
    sortOrder: 2,
  },
] as DataFieldItem[];

const records = [
  {
    id: "record-1",
    tableId: "table-1",
    data: {
      title: "项目 A",
      start_date: "2026-04-01",
      end_date: "2026-04-03",
    },
    createdAt: new Date("2026-04-04T00:00:00.000Z"),
    updatedAt: new Date("2026-04-04T00:00:00.000Z"),
    createdByName: "Admin",
  },
] as DataRecordItem[];

const view = {
  id: "view-3",
  tableId: "table-1",
  name: "时间线",
  type: "TIMELINE",
  isDefault: false,
  filters: [],
  sortBy: [],
  visibleFields: ["start_date", "end_date", "title"],
  fieldOrder: ["start_date", "end_date", "title"],
  groupBy: null,
  viewOptions: {
    startDateField: "start_date",
    endDateField: "end_date",
    labelField: "title",
  },
  createdAt: new Date("2026-04-04T00:00:00.000Z"),
  updatedAt: new Date("2026-04-04T00:00:00.000Z"),
} as DataViewItem;

describe("TimelineView", () => {
  it("渲染甘特条、记录标题和 today 标记", () => {
    render(
      <TimelineView
        fields={fields}
        records={records}
        view={view}
        onOpenRecord={vi.fn()}
      />
    );

    expect(screen.getByText("项目 A")).toBeInTheDocument();
    expect(screen.getByTestId("timeline-today-marker")).toBeInTheDocument();
    expect(screen.getByTestId("timeline-bar-record-1")).toBeInTheDocument();
  });

  it("切换到月视图时更新缩放按钮状态", () => {
    render(
      <TimelineView
        fields={fields}
        records={records}
        view={view}
        onOpenRecord={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "月" }));

    expect(screen.getByRole("button", { name: "月" })).toHaveAttribute(
      "data-active",
      "true"
    );
  });

  it("缺少 startDateField 配置时显示空状态", () => {
    render(
      <TimelineView
        fields={fields}
        records={records}
        view={{ ...view, viewOptions: { labelField: "title" } }}
        onOpenRecord={vi.fn()}
      />
    );

    expect(screen.getByText("时间线视图需要配置开始日期字段和标题字段")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run "src/components/data/views/timeline/timeline-view.test.tsx"`

Expected: FAIL，报错包含 `Failed to resolve import "./timeline-view"` 或 `TimelineView` 未定义。

- [ ] **Step 3: 实现 Timeline 缩放切换组件**

创建 `src/components/data/views/timeline/timeline-options.tsx`：

```typescript
"use client";

import { Button } from "@/components/ui/button";

export type TimelineScale = "day" | "week" | "month";

interface TimelineOptionsProps {
  scale: TimelineScale;
  onScaleChange: (scale: TimelineScale) => void;
}

const OPTIONS: Array<{ value: TimelineScale; label: string }> = [
  { value: "day", label: "日" },
  { value: "week", label: "周" },
  { value: "month", label: "月" },
];

export function TimelineOptions({ scale, onScaleChange }: TimelineOptionsProps) {
  return (
    <div className="flex items-center gap-1 rounded-md border p-1">
      {OPTIONS.map((option) => (
        <Button
          key={option.value}
          type="button"
          variant={scale === option.value ? "secondary" : "ghost"}
          size="sm"
          data-active={scale === option.value}
          onClick={() => onScaleChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: 实现自定义 SVG Gantt 组件**

创建 `src/components/data/views/timeline/timeline-gantt.tsx`：

```typescript
"use client";

import type { DataRecordItem } from "@/types/data-table";
import type { TimelineScale } from "./timeline-options";

interface TimelineBarItem {
  record: DataRecordItem;
  label: string;
  startDate: Date;
  endDate: Date;
}

interface TimelineGanttProps {
  items: TimelineBarItem[];
  scale: TimelineScale;
  onOpenRecord: (recordId: string) => void;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const COLUMN_WIDTH_BY_SCALE: Record<TimelineScale, number> = {
  day: 32,
  week: 18,
  month: 8,
};

function getTimelineRange(items: TimelineBarItem[]): { min: Date; max: Date } {
  const minTime = Math.min(...items.map((item) => item.startDate.getTime()), Date.now());
  const maxTime = Math.max(...items.map((item) => item.endDate.getTime()), Date.now() + MS_PER_DAY);
  return { min: new Date(minTime), max: new Date(maxTime) };
}

function toDayOffset(date: Date, minDate: Date): number {
  return Math.max(0, Math.floor((date.getTime() - minDate.getTime()) / MS_PER_DAY));
}

export function TimelineGantt({ items, scale, onOpenRecord }: TimelineGanttProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        暂无可显示的日期记录
      </div>
    );
  }

  const { min, max } = getTimelineRange(items);
  const columnWidth = COLUMN_WIDTH_BY_SCALE[scale];
  const totalDays = toDayOffset(max, min) + 2;
  const svgWidth = Math.max(960, totalDays * columnWidth + 240);
  const svgHeight = items.length * 48 + 64;
  const todayX = 220 + toDayOffset(new Date(), min) * columnWidth;

  return (
    <div className="overflow-x-auto rounded-lg border bg-background">
      <svg width={svgWidth} height={svgHeight} role="img" aria-label="时间线甘特图">
        <line
          data-testid="timeline-today-marker"
          x1={todayX}
          x2={todayX}
          y1={0}
          y2={svgHeight}
          stroke="#ef4444"
          strokeDasharray="4 4"
        />

        {items.map((item, index) => {
          const y = index * 48 + 24;
          const x = 220 + toDayOffset(item.startDate, min) * columnWidth;
          const width = Math.max(
            columnWidth,
            (toDayOffset(item.endDate, min) - toDayOffset(item.startDate, min) + 1) *
              columnWidth
          );

          return (
            <g key={item.record.id}>
              <text x={16} y={y + 16} fontSize="12" fill="currentColor">
                {item.label}
              </text>
              <rect
                data-testid={`timeline-bar-${item.record.id}`}
                x={x}
                y={y}
                width={width}
                height={24}
                rx={8}
                fill="#2563eb"
                opacity={0.85}
                onClick={() => onOpenRecord(item.record.id)}
              >
                <title>
                  {item.label} · {item.startDate.toLocaleDateString("zh-CN")} -{" "}
                  {item.endDate.toLocaleDateString("zh-CN")}
                </title>
              </rect>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
```

- [ ] **Step 5: 实现 Timeline 容器组件**

创建 `src/components/data/views/timeline/timeline-view.tsx`：

```typescript
"use client";

import { useMemo, useState } from "react";
import type { DataFieldItem, DataRecordItem, DataViewItem } from "@/types/data-table";
import { TimelineGantt } from "./timeline-gantt";
import { TimelineOptions, type TimelineScale } from "./timeline-options";

interface TimelineViewProps {
  fields: DataFieldItem[];
  records: DataRecordItem[];
  view: DataViewItem;
  onOpenRecord: (recordId: string) => void;
}

function asFieldKey(raw: unknown): string | null {
  return typeof raw === "string" && raw.length > 0 ? raw : null;
}

function toDateValue(raw: unknown): Date | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function TimelineView({
  fields,
  records,
  view,
  onOpenRecord,
}: TimelineViewProps) {
  const [scale, setScale] = useState<TimelineScale>("week");
  const startDateField = asFieldKey(view.viewOptions.startDateField);
  const endDateField = asFieldKey(view.viewOptions.endDateField);
  const labelField = asFieldKey(view.viewOptions.labelField);

  const hasValidStartField = fields.some(
    (field) => field.key === startDateField && field.type === "DATE"
  );
  const hasValidLabelField = fields.some((field) => field.key === labelField);

  const items = useMemo(() => {
    if (!hasValidStartField || !hasValidLabelField || !startDateField || !labelField) {
      return [];
    }

    return records
      .map((record) => {
        const startDate = toDateValue(record.data[startDateField]);
        if (!startDate) return null;

        const resolvedEndDate =
          endDateField && toDateValue(record.data[endDateField])
            ? toDateValue(record.data[endDateField])!
            : startDate;

        return {
          record,
          label: String(record.data[labelField] ?? record.id),
          startDate,
          endDate: resolvedEndDate,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((left, right) => left.startDate.getTime() - right.startDate.getTime());
  }, [endDateField, hasValidLabelField, hasValidStartField, labelField, records, startDateField]);

  if (!hasValidStartField || !hasValidLabelField) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        时间线视图需要配置开始日期字段和标题字段
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <TimelineOptions scale={scale} onScaleChange={setScale} />
      </div>
      <TimelineGantt items={items} scale={scale} onOpenRecord={onOpenRecord} />
    </div>
  );
}
```

- [ ] **Step 6: 运行 Timeline 测试**

Run: `npx vitest run "src/components/data/views/timeline/timeline-view.test.tsx"`

Expected: PASS，3 个测试均通过。

- [ ] **Step 7: Commit**

```bash
git add src/components/data/views/timeline/timeline-view.tsx src/components/data/views/timeline/timeline-gantt.tsx src/components/data/views/timeline/timeline-options.tsx src/components/data/views/timeline/timeline-view.test.tsx
git commit -m "feat(data): add Timeline view with custom SVG gantt"
```

---

### Task 22: 将新视图挂接到 table-detail-content

**Files:**
- Modify: `src/components/data/table-detail-content.tsx`

- [ ] **Step 1: 先写视图路由选择测试**

创建 `src/components/data/table-detail-content.test.tsx`：

```typescript
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DataTableDetail } from "@/types/data-table";
import { TableDetailContent } from "./table-detail-content";

vi.mock("@/components/data/record-table", () => ({
  RecordTable: () => <div data-testid="grid-view" />,
}));

vi.mock("@/components/data/views/kanban/kanban-view", () => ({
  KanbanView: () => <div data-testid="kanban-view" />,
}));

vi.mock("@/components/data/views/gallery/gallery-view", () => ({
  GalleryView: () => <div data-testid="gallery-view" />,
}));

vi.mock("@/components/data/views/timeline/timeline-view", () => ({
  TimelineView: () => <div data-testid="timeline-view" />,
}));

const table = {
  id: "table-1",
  name: "任务表",
  description: null,
  icon: "📋",
  fieldCount: 2,
  recordCount: 3,
  fields: [],
  createdAt: new Date("2026-04-04T00:00:00.000Z"),
} as DataTableDetail;

describe("TableDetailContent", () => {
  it("默认渲染 Grid 视图容器", () => {
    render(<TableDetailContent tableId="table-1" table={table} isAdmin={true} />);
    expect(screen.getByTestId("grid-view")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run "src/components/data/table-detail-content.test.tsx"`

Expected: FAIL，当前实现尚未具备基于 `DataViewItem.type` 的分支挂接，后续步骤补齐。

- [ ] **Step 3: 在 `table-detail-content.tsx` 中按视图类型分发渲染**

修改 `src/components/data/table-detail-content.tsx`，保留现有 header/stats/layout，只替换底部视图区块为显式分发结构：

```typescript
// 新增 imports
import { useState } from "react";
import { GalleryView } from "@/components/data/views/gallery/gallery-view";
import { KanbanView } from "@/components/data/views/kanban/kanban-view";
import { TimelineView } from "@/components/data/views/timeline/timeline-view";
import { RecordDetailDrawer } from "@/components/data/record-detail-drawer";
import { ViewSwitcher } from "@/components/data/view-switcher";
import { useTableData } from "@/hooks/use-table-data";
import type { DataViewItem, ViewType } from "@/types/data-table";

// 在组件内部新增状态
const [openedRecordId, setOpenedRecordId] = useState<string | null>(null);
const {
  records,
  views,
  currentView,
  switchView,
  refresh,
} = useTableData({ tableId, fields: table.fields });

const fallbackView: DataViewItem = {
  id: "grid-fallback",
  tableId,
  name: table.name,
  type: "GRID",
  isDefault: true,
  filters: [],
  sortBy: [],
  visibleFields: table.fields.map((field) => field.key),
  fieldOrder: table.fields.map((field) => field.key),
  groupBy: null,
  viewOptions: {},
  createdAt: table.createdAt,
  updatedAt: table.createdAt,
};

const activeView = currentView ?? fallbackView;

const handleViewTypeChange = (nextType: ViewType) => {
  if (nextType === "GRID") {
    const gridView = views.find((view) => view.type === "GRID") ?? null;
    switchView(gridView?.id ?? null);
    return;
  }

  const targetView = views.find((view) => view.type === nextType);
  if (targetView) {
    switchView(targetView.id);
  }
};

const handlePatchRecord = async (
  recordId: string,
  fieldKey: string,
  value: unknown
) => {
  const response = await fetch(`/api/data-tables/${tableId}/records/${recordId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fieldKey, value }),
  });

  if (!response.ok) {
    throw new Error("更新记录失败");
  }

  refresh();
};

// header 工具区增加视图切换器
<ViewSwitcher currentType={activeView.type} onTypeChange={handleViewTypeChange} />

// 底部视图区块替换为分发渲染
{activeView.type === "GRID" && (
  <RecordTable tableId={tableId} fields={table.fields} isAdmin={isAdmin} />
)}

{activeView.type === "KANBAN" && (
  <KanbanView
    fields={table.fields}
    records={records}
    view={activeView}
    isAdmin={isAdmin}
    onPatchRecord={handlePatchRecord}
    onOpenRecord={setOpenedRecordId}
  />
)}

{activeView.type === "GALLERY" && (
  <GalleryView
    fields={table.fields}
    records={records}
    view={activeView}
    onOpenRecord={setOpenedRecordId}
  />
)}

{activeView.type === "TIMELINE" && (
  <TimelineView
    fields={table.fields}
    records={records}
    view={activeView}
    onOpenRecord={setOpenedRecordId}
  />
)}

<RecordDetailDrawer
  open={openedRecordId !== null}
  onOpenChange={(open) => {
    if (!open) setOpenedRecordId(null);
  }}
  recordId={openedRecordId}
  tableId={tableId}
  fields={table.fields}
  isAdmin={isAdmin}
/>
```

实现约束：
- 这一步只做新视图挂接，不在 `table-detail-content.tsx` 里复制 `useTableData` 逻辑，避免破坏 Phase 1 的单一数据源设计。
- 切换非 GRID 视图时，如果当前表还没有同类型 `DataViewItem`，本步骤先保持当前视图不变；后续如需“首次点击自动创建默认 Kanban/Gallery/Timeline 视图”，应单独新增一个任务扩展 `views` API，避免把创建逻辑塞进页面层。

- [ ] **Step 4: 运行类型检查和页面测试**

Run: `npx tsc --noEmit`

Run: `npx vitest run "src/components/data/table-detail-content.test.tsx"`

Expected: PASS。若 Phase 3 已经引入 `useTableData`，这里应直接断言对应视图分支渲染；若 Phase 3 尚未完成真实数据接线，至少保证默认 GRID 分支和新视图组件 import/props 类型全部通过。

- [ ] **Step 5: Commit**

```bash
git add src/components/data/table-detail-content.tsx src/components/data/table-detail-content.test.tsx
git commit -m "feat(data): wire Kanban/Gallery/Timeline views into table detail page"
```

---

## Self-Review

- **Spec coverage:** 本计划覆盖 Kanban 分列/卡片/跨列更新、Gallery 卡片网格/封面回退/点击抽屉、Timeline 自定义 SVG 甘特/缩放/today marker/配置校验，以及新视图挂接到 `table-detail-content`。Phase 2 已覆盖 Grid 内联编辑、多排序、分组、列/行拖拽；Phase 1 已覆盖 schema/type/service/hook；Phase 3 已覆盖视图切换器和详情抽屉。
- **Placeholder scan:** 未发现占位式任务描述；Task 22 已改为直接使用 `useTableData` 的真实输出，不保留空数组或空回调兜底。
- **Type consistency:** 新视图统一消费 Phase 1 定义的 `DataFieldItem`/`DataRecordItem`/`DataViewItem`，回调统一使用 `onOpenRecord(recordId: string)`，Kanban 单字段更新统一使用 `onPatchRecord(recordId, fieldKey, value)`，与 Phase 2 PATCH 语义一致。
