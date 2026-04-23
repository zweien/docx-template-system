import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CalendarView } from "@/components/data/views/calendar/calendar-view";
import { FieldType, ViewType } from "@/generated/prisma/enums";
import type { DataFieldItem, DataViewItem } from "@/types/data-table";

vi.mock("@dnd-kit/react", () => ({
  DragDropProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DragOverlay: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useDraggable: () => ({ ref: vi.fn(), isDragging: false }),
  useDroppable: () => ({ ref: vi.fn(), isDropTarget: false }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

const fields: DataFieldItem[] = [
  {
    id: "field-date",
    key: "dueDate",
    label: "日期",
    type: FieldType.DATE,
    required: false,
    sortOrder: 0,
  },
  {
    id: "field-title",
    key: "title",
    label: "标题",
    type: FieldType.TEXT,
    required: false,
    sortOrder: 1,
  },
];

const view: DataViewItem = {
  id: "view-1",
  tableId: "table-1",
  name: "日历",
  type: ViewType.CALENDAR,
  isDefault: false,
  filters: [],
  sortBy: [],
  visibleFields: [],
  fieldOrder: [],
  groupBy: null,
  viewOptions: {
    startDateField: "dueDate",
    labelField: "title",
  },
  createdAt: new Date("2026-04-01T00:00:00.000Z"),
  updatedAt: new Date("2026-04-01T00:00:00.000Z"),
};

describe("CalendarView", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("点击空白日期创建记录后应以编辑态打开新记录", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: "record-new" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      })
    );
    const onOpenRecord = vi.fn();
    const onOpenCreatedRecord = vi.fn();
    const onRecordCreated = vi.fn();
    const now = new Date();
    const expectedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-15`;

    render(
      <CalendarView
        fields={fields}
        records={[]}
        view={view}
        tableId="table-1"
        isAdmin
        onPatchRecord={vi.fn()}
        onOpenRecord={onOpenRecord}
        onOpenCreatedRecord={onOpenCreatedRecord}
        onRecordCreated={onRecordCreated}
      />
    );

    fireEvent.click(screen.getByText("15"));

    await waitFor(() => {
      expect(onOpenCreatedRecord).toHaveBeenCalledWith("record-new");
    });
    expect(onOpenRecord).not.toHaveBeenCalled();
    expect(onRecordCreated).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/data-tables/table-1/records",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ data: { dueDate: expectedDate } }),
      })
    );
  });
});
