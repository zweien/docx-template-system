import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AutomationEditor } from "@/components/automations/automation-editor";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("AutomationEditor", () => {
  it("blocks saving when more than one trigger node exists", async () => {
    vi.stubGlobal("fetch", vi.fn());

    render(
      <AutomationEditor
        mode="edit"
        automationId="aut-1"
        initialName="测试自动化"
        initialDescription={null}
        initialEnabled
        initialValue={{
          version: 1,
          canvas: {
            nodes: [
              { id: "trigger-1", type: "trigger", x: 0, y: 0 },
              { id: "trigger-2", type: "trigger", x: 20, y: 20 },
            ],
            edges: [],
          },
          trigger: { type: "record_created" },
          condition: null,
          thenActions: [],
          elseActions: [],
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "保存自动化" }));

    expect(await screen.findByText("必须且只能存在一个触发器节点")).toBeInTheDocument();
  });

  it("shows all available tables in create mode select", async () => {
    vi.stubGlobal("fetch", vi.fn());

    render(
      <AutomationEditor
        mode="create"
        initialTableId="tbl-1"
        availableTables={[
          { id: "tbl-1", name: "论文数据表" },
          { id: "tbl-2", name: "项目归档表" },
        ]}
        initialName="测试自动化"
        initialDescription={null}
        initialEnabled
        initialValue={{
          version: 1,
          canvas: {
            nodes: [{ id: "trigger-1", type: "trigger", x: 0, y: 0 }],
            edges: [],
          },
          trigger: { type: "record_created" },
          condition: null,
          thenActions: [],
          elseActions: [],
        }}
      />
    );

    fireEvent.click(screen.getByTestId("automation-table-select-trigger"));

    expect(await screen.findByText("项目归档表")).toBeInTheDocument();
  });
});
