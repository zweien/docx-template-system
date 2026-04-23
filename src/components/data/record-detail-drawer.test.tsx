import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RecordDetailDrawer } from "@/components/data/record-detail-drawer";
import { FieldType } from "@/generated/prisma/enums";
import type { DataFieldItem, DataRecordItem } from "@/types/data-table";

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div>{children}</div> : null,
  SheetContent: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    back: vi.fn(),
  }),
}));

const fields: DataFieldItem[] = [
  {
    id: "field-title",
    key: "title",
    label: "标题",
    type: FieldType.TEXT,
    required: false,
    sortOrder: 0,
  },
];

const record: DataRecordItem = {
  id: "record-new",
  tableId: "table-1",
  data: { title: "" },
  createdAt: new Date("2026-04-23T00:00:00.000Z"),
  updatedAt: new Date("2026-04-23T00:00:00.000Z"),
  createdByName: "管理员",
  updatedByName: null,
};

describe("RecordDetailDrawer", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("初始编辑态保存后应停留在抽屉内并通知外层刷新", async () => {
    const updatedRecord: DataRecordItem = {
      ...record,
      data: { title: "补填标题" },
    };
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify(record), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(updatedRecord), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    const onRecordSaved = vi.fn();

    render(
      <RecordDetailDrawer
        open
        onOpenChange={vi.fn()}
        recordId="record-new"
        tableId="table-1"
        fields={fields}
        isAdmin
        initialMode="edit"
        onRecordSaved={onRecordSaved}
      />
    );

    fireEvent.change(await screen.findByPlaceholderText("输入标题"), {
      target: { value: "补填标题" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存修改" }));

    await waitFor(() => {
      expect(onRecordSaved).toHaveBeenCalledOnce();
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/data-tables/table-1/records/record-new",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ data: { title: "补填标题" } }),
      })
    );
    expect(screen.getByText("记录详情")).toBeInTheDocument();
    expect(screen.getByText("补填标题")).toBeInTheDocument();
  });
});
