import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AutomationList } from "@/components/automations/automation-list";

describe("AutomationList", () => {
  it("renders automation name and trigger label", () => {
    render(
      <AutomationList
        items={[
          {
            id: "aut_1",
            name: "Record Created Webhook",
            description: null,
            tableId: "tbl_1",
            tableName: "Tasks",
            enabled: true,
            triggerType: "record_created",
            definitionVersion: 1,
            createdById: "usr_1",
            updatedById: "usr_1",
            createdAt: "2026-04-22T00:00:00.000Z",
            updatedAt: "2026-04-22T00:00:00.000Z",
          },
        ]}
      />
    );

    expect(screen.getByText("Record Created Webhook")).toBeInTheDocument();
    expect(screen.getByText("记录创建时")).toBeInTheDocument();
  });
});
