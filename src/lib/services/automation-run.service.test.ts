import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAutomationRun,
  markAutomationRunStarted,
  markAutomationRunSucceeded,
} from "@/lib/services/automation-run.service";
import { enqueueAutomationRun } from "@/lib/services/automation-dispatcher.service";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    automationRun: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

describe("automation-run.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a pending automation run", async () => {
    dbMock.automationRun.create.mockResolvedValue({ id: "run-1" });

    const result = await createAutomationRun({
      automationId: "aut-1",
      triggerSource: "MANUAL",
      triggerPayload: { source: "manual" },
      contextSnapshot: {
        tableId: "tbl-1",
        record: null,
        previousRecord: null,
        changedFields: [],
        triggeredAt: "2026-04-22T00:00:00.000Z",
        actor: { id: "user-1" },
      },
    });

    expect(result).toEqual({ success: true, data: { id: "run-1" } });
    expect(dbMock.automationRun.create).toHaveBeenCalledWith({
      data: {
        automationId: "aut-1",
        status: "PENDING",
        triggerSource: "MANUAL",
        triggerPayload: { source: "manual" },
        contextSnapshot: {
          tableId: "tbl-1",
          record: null,
          previousRecord: null,
          changedFields: [],
          triggeredAt: "2026-04-22T00:00:00.000Z",
          actor: { id: "user-1" },
        },
      },
      select: { id: true },
    });
  });

  it("marks a run started and then succeeded", async () => {
    dbMock.automationRun.update.mockResolvedValue({ id: "run-1" });
    dbMock.automationRun.findUnique.mockResolvedValue({
      startedAt: new Date("2026-04-22T00:00:00.000Z"),
    });

    const started = await markAutomationRunStarted("run-1");
    const succeeded = await markAutomationRunSucceeded("run-1");

    expect(started.success).toBe(true);
    expect(succeeded.success).toBe(true);
    expect(dbMock.automationRun.update).toHaveBeenNthCalledWith(1, {
      where: { id: "run-1" },
      data: {
        status: "RUNNING",
        startedAt: expect.any(Date),
      },
    });
    expect(dbMock.automationRun.update).toHaveBeenNthCalledWith(2, {
      where: { id: "run-1" },
      data: {
        status: "SUCCEEDED",
        finishedAt: expect.any(Date),
        durationMs: expect.any(Number),
      },
    });
  });
});

describe("enqueueAutomationRun", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a pending run before execution", async () => {
    dbMock.automationRun.create.mockResolvedValue({ id: "run-1" });
    dbMock.automationRun.update.mockResolvedValue({ id: "run-1" });
    dbMock.automationRun.findUnique.mockResolvedValue({
      startedAt: new Date("2026-04-22T00:00:00.000Z"),
    });

    const result = await enqueueAutomationRun({
      automationId: "aut-1",
      triggerSource: "MANUAL",
      triggerPayload: { source: "manual" },
      contextSnapshot: {
        tableId: "tbl-1",
        record: null,
        previousRecord: null,
        changedFields: [],
        triggeredAt: "2026-04-22T00:00:00.000Z",
        actor: { id: "user-1" },
      },
    });

    expect(result).toEqual({ success: true, data: { id: "run-1" } });
    expect(dbMock.automationRun.create).toHaveBeenCalledWith({
      data: {
        automationId: "aut-1",
        status: "PENDING",
        triggerSource: "MANUAL",
        triggerPayload: { source: "manual" },
        contextSnapshot: {
          tableId: "tbl-1",
          record: null,
          previousRecord: null,
          changedFields: [],
          triggeredAt: "2026-04-22T00:00:00.000Z",
          actor: { id: "user-1" },
        },
      },
      select: { id: true },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(dbMock.automationRun.update).toHaveBeenCalledTimes(2);
    expect(dbMock.automationRun.update).toHaveBeenNthCalledWith(1, {
      where: { id: "run-1" },
      data: {
        status: "RUNNING",
        startedAt: expect.any(Date),
      },
    });
    expect(dbMock.automationRun.update).toHaveBeenNthCalledWith(2, {
      where: { id: "run-1" },
      data: {
        status: "SUCCEEDED",
        finishedAt: expect.any(Date),
        durationMs: expect.any(Number),
      },
    });
  });
});
