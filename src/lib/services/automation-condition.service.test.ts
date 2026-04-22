import { describe, expect, it } from "vitest";
import {
  evaluateAutomationCondition,
  readAutomationContextField,
} from "@/lib/services/automation-condition.service";

describe("evaluateAutomationCondition", () => {
  it("evaluates nested AND/OR groups", () => {
    const result = evaluateAutomationCondition(
      {
        kind: "group",
        operator: "AND",
        conditions: [
          { kind: "leaf", field: "record.status", op: "eq", value: "done" },
          {
            kind: "group",
            operator: "OR",
            conditions: [
              { kind: "leaf", field: "record.score", op: "gt", value: 80 },
              { kind: "leaf", field: "record.priority", op: "eq", value: "high" },
            ],
          },
        ],
      },
      {
        tableId: "tbl-1",
        record: { status: "done", score: 70, priority: "high" },
        previousRecord: null,
        changedFields: [],
        triggerSource: "EVENT",
        triggeredAt: "2026-04-22T00:00:00.000Z",
        actor: { id: "user-1" },
      }
    );

    expect(result).toBe(true);
  });

  it("supports changed field checks through explicit context", () => {
    const result = evaluateAutomationCondition(
      { kind: "leaf", field: "changedFields", op: "contains", value: "status" },
      {
        tableId: "tbl-1",
        record: { status: "done" },
        previousRecord: { status: "draft" },
        changedFields: ["status"],
        triggerSource: "EVENT",
        triggeredAt: "2026-04-22T00:00:00.000Z",
        actor: { id: "user-1" },
      }
    );

    expect(result).toBe(true);
  });

  it("reads previous record nested values", () => {
    const value = readAutomationContextField("previousRecord.meta.owner", {
      tableId: "tbl-1",
      record: { meta: { owner: "new-owner" } },
      previousRecord: { meta: { owner: "old-owner" } },
      changedFields: ["meta.owner"],
      triggerSource: "EVENT",
      triggeredAt: "2026-04-22T00:00:00.000Z",
      actor: { id: "user-1" },
    });

    expect(value).toBe("old-owner");
  });

  it("treats null condition as pass-through", () => {
    const result = evaluateAutomationCondition(null, {
      tableId: "tbl-1",
      record: null,
      previousRecord: null,
      changedFields: [],
      triggerSource: "MANUAL",
      triggeredAt: "2026-04-22T00:00:00.000Z",
      actor: { id: "user-1" },
    });

    expect(result).toBe(true);
  });
});
