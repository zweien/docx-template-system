import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeUpdateRelatedRecordsAction } from "@/lib/services/automation-action-executors/update-related-records";

const { getTableMock, updateRecordMock } = vi.hoisted(() => ({
  getTableMock: vi.fn(),
  updateRecordMock: vi.fn(),
}));

vi.mock("@/lib/services/data-table.service", () => ({
  getTable: getTableMock,
}));

vi.mock("@/lib/services/data-record.service", () => ({
  updateRecord: updateRecordMock,
}));

describe("executeUpdateRelatedRecordsAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails when current record context is missing", async () => {
    const result = await executeUpdateRelatedRecordsAction({
      action: {
        id: "a1",
        type: "update_related_records",
        relationFieldKey: "authors",
        targetScope: "all",
        values: { status: "active" },
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
    expect(updateRecordMock).not.toHaveBeenCalled();
  });

  it("updates the first related record when targetScope is first", async () => {
    getTableMock.mockResolvedValue({
      success: true,
      data: {
        fields: [
          {
            key: "owner",
            label: "负责人",
            type: "RELATION",
            relationTo: "tbl_users",
          },
        ],
      },
    });
    updateRecordMock.mockResolvedValue({
      success: true,
      data: { id: "user-1", data: { status: "active" } },
    });

    const result = await executeUpdateRelatedRecordsAction({
      action: {
        id: "a1",
        type: "update_related_records",
        relationFieldKey: "owner",
        targetScope: "first",
        values: { status: "active" },
      },
      context: {
        automationId: "aut_1",
        tableId: "tbl_1",
        recordId: "rec-1",
        record: { owner: "user-1" },
        previousRecord: null,
        changedFields: [],
        triggerSource: "MANUAL",
        triggeredAt: "2026-04-22T00:00:00.000Z",
        actor: { id: "usr_1" },
      },
      runId: "run_1",
    });

    expect(result.success).toBe(true);
    expect(updateRecordMock).toHaveBeenCalledTimes(1);
    expect(updateRecordMock).toHaveBeenCalledWith("user-1", { status: "active" }, "usr_1");
    if (!result.success) {
      throw new Error("Expected success");
    }
    expect(result.data).toMatchObject({
      relatedTableId: "tbl_users",
      updatedCount: 1,
      updatedRecordIds: ["user-1"],
    });
  });

  it("updates every related subtable record when targetScope is all", async () => {
    getTableMock.mockResolvedValue({
      success: true,
      data: {
        fields: [
          {
            key: "authors",
            label: "作者",
            type: "RELATION_SUBTABLE",
            relationTo: "tbl_authors",
          },
        ],
      },
    });
    updateRecordMock.mockResolvedValue({
      success: true,
      data: { id: "author-1", data: { reviewed: true } },
    });

    const result = await executeUpdateRelatedRecordsAction({
      action: {
        id: "a1",
        type: "update_related_records",
        relationFieldKey: "authors",
        targetScope: "all",
        values: { reviewed: true },
      },
      context: {
        automationId: "aut_1",
        tableId: "tbl_1",
        recordId: "paper-1",
        record: {
          authors: [
            { targetRecordId: "author-1", attributes: {}, sortOrder: 0 },
            { targetRecordId: "author-2", attributes: {}, sortOrder: 1 },
          ],
        },
        previousRecord: null,
        changedFields: [],
        triggerSource: "MANUAL",
        triggeredAt: "2026-04-22T00:00:00.000Z",
        actor: { id: "usr_1" },
      },
      runId: "run_1",
    });

    expect(result.success).toBe(true);
    expect(updateRecordMock).toHaveBeenCalledTimes(2);
    expect(updateRecordMock).toHaveBeenNthCalledWith(
      1,
      "author-1",
      { reviewed: true },
      "usr_1"
    );
    expect(updateRecordMock).toHaveBeenNthCalledWith(
      2,
      "author-2",
      { reviewed: true },
      "usr_1"
    );
    if (!result.success) {
      throw new Error("Expected success");
    }
    expect(result.data.updatedCount).toBe(2);
    expect(result.data.updatedRecordIds).toEqual(["author-1", "author-2"]);
  });

  it("returns a tracked no-op when relation field has no linked records", async () => {
    getTableMock.mockResolvedValue({
      success: true,
      data: {
        fields: [
          {
            key: "authors",
            label: "作者",
            type: "RELATION_SUBTABLE",
            relationTo: "tbl_authors",
          },
        ],
      },
    });

    const result = await executeUpdateRelatedRecordsAction({
      action: {
        id: "a1",
        type: "update_related_records",
        relationFieldKey: "authors",
        targetScope: "all",
        values: { reviewed: true },
      },
      context: {
        automationId: "aut_1",
        tableId: "tbl_1",
        recordId: "paper-1",
        record: { authors: [] },
        previousRecord: null,
        changedFields: [],
        triggerSource: "MANUAL",
        triggeredAt: "2026-04-22T00:00:00.000Z",
        actor: { id: "usr_1" },
      },
      runId: "run_1",
    });

    expect(result.success).toBe(true);
    expect(updateRecordMock).not.toHaveBeenCalled();
    if (!result.success) {
      throw new Error("Expected success");
    }
    expect(result.data).toMatchObject({
      updatedCount: 0,
      updatedRecordIds: [],
      noop: true,
    });
  });
});
