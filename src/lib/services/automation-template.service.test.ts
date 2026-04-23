import { describe, expect, it } from "vitest";
import { renderAutomationTemplate } from "@/lib/services/automation-template.service";

describe("renderAutomationTemplate", () => {
  const context = {
    automationId: "aut_1",
    tableId: "tbl_1",
    recordId: "rec_1",
    record: {
      title: "论文 A",
      owner: {
        name: "张三",
      },
    },
    previousRecord: {
      status: "draft",
    },
    changedFields: ["title", "status"],
    triggerSource: "EVENT" as const,
    triggeredAt: "2026-04-23T10:00:00.000Z",
    actor: {
      id: "usr_1",
      name: "李四",
      email: "lisi@example.com",
    },
  };

  it("renders nested variables from automation context", () => {
    expect(
      renderAutomationTemplate(
        "记录 {{ record.title }} 由 {{ actor.name }} 在 {{ triggeredAt }} 触发",
        context
      )
    ).toBe("记录 论文 A 由 李四 在 2026-04-23T10:00:00.000Z 触发");
  });

  it("renders arrays and missing values safely", () => {
    expect(
      renderAutomationTemplate(
        "字段 {{ changedFields }} / 缺失 {{ record.unknown }} / 旧值 {{ previousRecord.status }}",
        context
      )
    ).toBe('字段 ["title","status"] / 缺失  / 旧值 draft');
  });
});
