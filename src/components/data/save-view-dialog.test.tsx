import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SaveViewDialog } from "@/components/data/save-view-dialog";
import type { DataViewConfig } from "@/types/data-table";

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <section aria-label="保存视图窗口" className={className}>
      {children}
    </section>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => <footer>{children}</footer>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header>,
  DialogTitle: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <h2 className={className}>{children}</h2>,
}));

const config: DataViewConfig = {
  filters: [],
  sortBy: [],
  visibleFields: ["title"],
  fieldOrder: ["title"],
  groupBy: null,
  viewOptions: {},
};

describe("SaveViewDialog", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("应使用主题色，避免浅色主题文字不可见", () => {
    render(
      <SaveViewDialog
        open
        onOpenChange={vi.fn()}
        tableId="table-1"
        currentConfig={config}
        viewType="GRID"
        onSaved={vi.fn()}
      />
    );

    const dialog = screen.getByLabelText("保存视图窗口");
    const title = screen.getByRole("heading", { name: "保存视图" });

    expect(dialog).toHaveClass("bg-card", "text-card-foreground");
    expect(dialog.className).not.toContain("bg-[#191a1b]");
    expect(title).toHaveClass("text-foreground");
    expect(screen.getByText("1 个可见字段")).toHaveClass("text-muted-foreground");
  });

  it("保存日历视图时应提交 CALENDAR 类型", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: { id: "view-calendar" } }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      })
    );
    const onSaved = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <SaveViewDialog
        open
        onOpenChange={onOpenChange}
        tableId="table-1"
        currentConfig={config}
        viewType="CALENDAR"
        onSaved={onSaved}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("输入视图名称"), {
      target: { value: "日历视图" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith("view-calendar");
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/data-tables/table-1/views",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("\"type\":\"CALENDAR\""),
      })
    );
  });
});
