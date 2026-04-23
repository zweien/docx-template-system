import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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
});
