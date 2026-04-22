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
            latestRun: {
              id: "run_1",
              status: "FAILED",
              triggerSource: "MANUAL",
              createdAt: "2026-04-22T01:00:00.000Z",
              finishedAt: "2026-04-22T01:00:01.200Z",
              durationMs: 1200,
              errorMessage: "Webhook 500",
            },
          },
        ]}
      />
    );

    expect(screen.getByText("Record Created Webhook")).toBeInTheDocument();
    expect(screen.getByText("记录创建时")).toBeInTheDocument();
    expect(screen.getByText("最近失败")).toBeInTheDocument();
    expect(screen.getByText(/手动触发/)).toBeInTheDocument();
    expect(screen.getByText(/Webhook 500/)).toBeInTheDocument();
  });

  it("renders empty latest run state when no run exists", () => {
    render(
      <AutomationList
        items={[
          {
            id: "aut_2",
            name: "Nightly Summary",
            description: "每日定时汇总",
            tableId: "tbl_2",
            tableName: "Reports",
            enabled: false,
            triggerType: "schedule",
            definitionVersion: 1,
            createdById: "usr_1",
            updatedById: "usr_1",
            createdAt: "2026-04-22T00:00:00.000Z",
            updatedAt: "2026-04-22T00:00:00.000Z",
            latestRun: null,
          },
        ]}
      />
    );

    expect(screen.getByText("暂无运行记录，保存并触发后这里会显示最近一次执行结果。")).toBeInTheDocument();
  });
});
