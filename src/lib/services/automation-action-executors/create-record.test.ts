import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeCreateRecordAction } from "@/lib/services/automation-action-executors/create-record";

const { createRecordMock } = vi.hoisted(() => ({
  createRecordMock: vi.fn(),
}));

vi.mock("@/lib/services/data-record.service", () => ({
  createRecord: createRecordMock,
}));

describe("executeCreateRecordAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a record with the actor as creator", async () => {
    createRecordMock.mockResolvedValue({
      success: true,
      data: { id: "rec-1" },
    });

    const result = await executeCreateRecordAction({
      action: {
        id: "a1",
        type: "create_record",
        tableId: "tbl-2",
        values: { title: "新记录" },
      },
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

    expect(result.success).toBe(true);
    expect(createRecordMock).toHaveBeenCalledWith(
      "usr_1",
      "tbl-2",
      { title: "新记录" }
    );
  });
});
