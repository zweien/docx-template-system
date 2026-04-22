import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeAddCommentAction } from "@/lib/services/automation-action-executors/add-comment";

const { createCommentMock } = vi.hoisted(() => ({
  createCommentMock: vi.fn(),
}));

vi.mock("@/lib/services/data-record-comment.service", () => ({
  createComment: createCommentMock,
}));

describe("executeAddCommentAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails when record context is missing", async () => {
    const result = await executeAddCommentAction({
      action: {
        id: "a1",
        type: "add_comment",
        target: "current_record",
        content: "审批已完成",
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

    expect(result.success).toBe(false);
    expect(createCommentMock).not.toHaveBeenCalled();
  });

  it("creates a record comment for current record", async () => {
    createCommentMock.mockResolvedValue({
      success: true,
      data: { id: "cmt-1" },
    });

    const result = await executeAddCommentAction({
      action: {
        id: "a1",
        type: "add_comment",
        target: "current_record",
        content: "审批已完成",
      },
      context: {
        automationId: "aut_1",
        tableId: "tbl_1",
        recordId: "rec-1",
        record: { status: "done" },
        previousRecord: null,
        changedFields: [],
        triggerSource: "MANUAL",
        triggeredAt: "2026-04-22T00:00:00.000Z",
        actor: { id: "usr_1" },
      },
      runId: "run_1",
    });

    expect(result.success).toBe(true);
    expect(createCommentMock).toHaveBeenCalledWith("usr_1", {
      recordId: "rec-1",
      content: "审批已完成",
    });
  });
});
