import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeUpdateFieldAction } from "@/lib/services/automation-action-executors/update-field";

const { updateRecordMock } = vi.hoisted(() => ({
  updateRecordMock: vi.fn(),
}));

vi.mock("@/lib/services/data-record.service", () => ({
  updateRecord: updateRecordMock,
}));

describe("executeUpdateFieldAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails when current record is missing", async () => {
    const result = await executeUpdateFieldAction({
      action: { id: "a1", type: "update_field", fieldKey: "status", value: "done" },
      context: {
        automationId: "aut_1",
        tableId: "tbl_1",
        record: null,
        previousRecord: null,
        changedFields: [],
        triggerSource: "MANUAL",
        triggeredAt: "2026-04-22T00:00:00.000Z",
        actor: { id: "usr_1" },
      },
      runId: "run_1",
    });

    expect(result.success).toBe(false);
    expect(updateRecordMock).not.toHaveBeenCalled();
  });

  it("updates the target field on current record", async () => {
    updateRecordMock.mockResolvedValue({
      success: true,
      data: { id: "rec-1", data: { status: "done" } },
    });

    const result = await executeUpdateFieldAction({
      action: { id: "a1", type: "update_field", fieldKey: "status", value: "done" },
      context: {
        automationId: "aut_1",
        tableId: "tbl_1",
        recordId: "rec-1",
        record: { status: "draft" },
        previousRecord: null,
        changedFields: [],
        triggerSource: "MANUAL",
        triggeredAt: "2026-04-22T00:00:00.000Z",
        actor: { id: "usr_1" },
      },
      runId: "run_1",
    });

    expect(result.success).toBe(true);
    expect(updateRecordMock).toHaveBeenCalledWith(
      "rec-1",
      { status: "done" },
      "usr_1"
    );
  });
});
