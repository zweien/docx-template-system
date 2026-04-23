import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  enqueueAutomationRun,
  executeQueuedAutomationRun,
} from "@/lib/services/automation-dispatcher.service";
import {
  createAutomationRun,
  getAutomationRunDetail,
  listAutomationRuns,
  markAutomationRunStarted,
  markAutomationRunStepFailed,
  markAutomationRunSucceeded,
} from "@/lib/services/automation-run.service";

const { dbMock, publishAutomationRealtimeEventMock } = vi.hoisted(() => ({
  dbMock: {
    automation: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    automationRun: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    automationRunStep: {
      create: vi.fn(),
      update: vi.fn(),
    },
  },
  publishAutomationRealtimeEventMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

vi.mock("@/lib/services/automation-realtime.service", () => ({
  publishAutomationRealtimeEvent: publishAutomationRealtimeEventMock,
}));

describe("automation-run.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("creates a pending automation run", async () => {
    dbMock.automationRun.create.mockResolvedValue({
      id: "run-1",
      automationId: "aut-1",
      status: "PENDING",
      triggerSource: "MANUAL",
      triggerPayload: { source: "manual" },
      contextSnapshot: {
        tableId: "tbl-1",
      },
      startedAt: null,
      finishedAt: null,
      durationMs: null,
      errorCode: null,
      errorMessage: null,
      createdAt: new Date("2026-04-22T00:00:00.000Z"),
    });

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
      select: expect.any(Object),
    });
    expect(publishAutomationRealtimeEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "automation_run_created",
        automationId: "aut-1",
      })
    );
  });

  it("marks a run started and then succeeded", async () => {
    dbMock.automationRun.update
      .mockResolvedValueOnce({
        id: "run-1",
        automationId: "aut-1",
        status: "RUNNING",
        triggerSource: "MANUAL",
        triggerPayload: {},
        contextSnapshot: {},
        startedAt: new Date("2026-04-22T00:00:00.000Z"),
        finishedAt: null,
        durationMs: null,
        errorCode: null,
        errorMessage: null,
        createdAt: new Date("2026-04-22T00:00:00.000Z"),
      })
      .mockResolvedValueOnce({
        id: "run-1",
        automationId: "aut-1",
        status: "SUCCEEDED",
        triggerSource: "MANUAL",
        triggerPayload: {},
        contextSnapshot: {},
        startedAt: new Date("2026-04-22T00:00:00.000Z"),
        finishedAt: new Date("2026-04-22T00:00:01.000Z"),
        durationMs: 1000,
        errorCode: null,
        errorMessage: null,
        createdAt: new Date("2026-04-22T00:00:00.000Z"),
      });
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
      select: expect.any(Object),
    });
    expect(dbMock.automationRun.update).toHaveBeenNthCalledWith(2, {
      where: { id: "run-1" },
      data: {
        status: "SUCCEEDED",
        finishedAt: expect.any(Date),
        durationMs: expect.any(Number),
      },
      select: expect.any(Object),
    });
    expect(publishAutomationRealtimeEventMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        type: "automation_run_updated",
        automationId: "aut-1",
        run: expect.objectContaining({ id: "run-1", status: "RUNNING" }),
      })
    );
    expect(publishAutomationRealtimeEventMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        type: "automation_run_updated",
        automationId: "aut-1",
        run: expect.objectContaining({ id: "run-1", status: "SUCCEEDED" }),
      })
    );
  });

  it("publishes a step update after marking a step failed", async () => {
    dbMock.automationRunStep.update.mockResolvedValue({
      id: "step-1",
      runId: "run-1",
      status: "FAILED",
      run: {
        automationId: "aut-1",
      },
    });

    const result = await markAutomationRunStepFailed("step-1", {
      code: "ACTION_EXECUTION_FAILED",
      message: "Webhook returned 500",
    });

    expect(result.success).toBe(true);
    expect(publishAutomationRealtimeEventMock).toHaveBeenCalledWith({
      type: "automation_run_step_updated",
      automationId: "aut-1",
      runId: "run-1",
      stepId: "step-1",
      status: "FAILED",
    });
  });

  it("lists runs for an owned automation", async () => {
    dbMock.automation.findFirst.mockResolvedValue({ id: "aut-1" });
    dbMock.automationRun.findMany.mockResolvedValue([
      {
        id: "run-1",
        automationId: "aut-1",
        status: "SUCCEEDED",
        triggerSource: "MANUAL",
        triggerPayload: { source: "manual" },
        contextSnapshot: { tableId: "tbl-1" },
        startedAt: new Date("2026-04-22T00:00:00.000Z"),
        finishedAt: new Date("2026-04-22T00:00:01.000Z"),
        durationMs: 1000,
        errorCode: null,
        errorMessage: null,
        createdAt: new Date("2026-04-22T00:00:00.000Z"),
      },
    ]);

    const result = await listAutomationRuns("aut-1", "user-1");

    expect(result.success).toBe(true);
    expect(dbMock.automation.findFirst).toHaveBeenCalledWith({
      where: {
        id: "aut-1",
        createdById: "user-1",
      },
      select: { id: true },
    });
    expect(dbMock.automationRun.findMany).toHaveBeenCalledWith({
      where: { automationId: "aut-1" },
      orderBy: { createdAt: "desc" },
    });
  });

  it("returns run detail with steps", async () => {
    dbMock.automationRun.findFirst.mockResolvedValue({
      id: "run-1",
      automationId: "aut-1",
      status: "FAILED",
      triggerSource: "MANUAL",
      triggerPayload: { source: "manual" },
      contextSnapshot: { tableId: "tbl-1" },
      startedAt: new Date("2026-04-22T00:00:00.000Z"),
      finishedAt: new Date("2026-04-22T00:00:01.000Z"),
      durationMs: 1000,
      errorCode: "WEBHOOK_FAILED",
      errorMessage: "Webhook returned 500",
      createdAt: new Date("2026-04-22T00:00:00.000Z"),
      steps: [
        {
          id: "step-1",
          runId: "run-1",
          nodeId: "a1",
          stepType: "call_webhook",
          branch: "THEN",
          status: "FAILED",
          input: { id: "a1" },
          output: null,
          errorCode: "WEBHOOK_FAILED",
          errorMessage: "Webhook returned 500",
          startedAt: new Date("2026-04-22T00:00:00.000Z"),
          finishedAt: new Date("2026-04-22T00:00:01.000Z"),
          durationMs: 1000,
        },
      ],
    });

    const result = await getAutomationRunDetail("run-1", "user-1");

    expect(result.success).toBe(true);
    expect(dbMock.automationRun.findFirst).toHaveBeenCalledWith({
      where: {
        id: "run-1",
        automation: {
          createdById: "user-1",
        },
      },
      include: {
        steps: {
          orderBy: { startedAt: "asc" },
        },
      },
    });
  });
});

describe("automation-dispatcher.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("creates a pending run before execution", async () => {
    dbMock.automationRun.create.mockResolvedValue({
      id: "run-1",
      automationId: "aut-1",
      status: "PENDING",
      triggerSource: "MANUAL",
      triggerPayload: { source: "manual" },
      contextSnapshot: {
        tableId: "tbl-1",
      },
      startedAt: null,
      finishedAt: null,
      durationMs: null,
      errorCode: null,
      errorMessage: null,
      createdAt: new Date("2026-04-22T00:00:00.000Z"),
    });
    dbMock.automationRun.update
      .mockResolvedValueOnce({
        id: "run-1",
        automationId: "aut-1",
        status: "RUNNING",
        triggerSource: "MANUAL",
        triggerPayload: { source: "manual" },
        contextSnapshot: {
          tableId: "tbl-1",
        },
        startedAt: new Date("2026-04-22T00:00:00.000Z"),
        finishedAt: null,
        durationMs: null,
        errorCode: null,
        errorMessage: null,
        createdAt: new Date("2026-04-22T00:00:00.000Z"),
      })
      .mockResolvedValueOnce({
        id: "run-1",
        automationId: "aut-1",
        status: "SUCCEEDED",
        triggerSource: "MANUAL",
        triggerPayload: { source: "manual" },
        contextSnapshot: {
          tableId: "tbl-1",
        },
        startedAt: new Date("2026-04-22T00:00:00.000Z"),
        finishedAt: new Date("2026-04-22T00:00:01.000Z"),
        durationMs: 1000,
        errorCode: null,
        errorMessage: null,
        createdAt: new Date("2026-04-22T00:00:00.000Z"),
      });
    dbMock.automationRun.findUnique.mockResolvedValue({
      startedAt: new Date("2026-04-22T00:00:00.000Z"),
    });

    const result = await enqueueAutomationRun({
      automationId: "aut-1",
      automation: {
        id: "aut-1",
        tableId: "tbl-1",
        definition: {
          version: 1,
          canvas: { nodes: [], edges: [] },
          trigger: { type: "manual" },
          condition: null,
          thenActions: [],
          elseActions: [],
        },
      },
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
      select: expect.any(Object),
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(dbMock.automationRun.update).toHaveBeenCalledTimes(2);
    expect(dbMock.automationRun.update).toHaveBeenNthCalledWith(1, {
      where: { id: "run-1" },
      data: {
        status: "RUNNING",
        startedAt: expect.any(Date),
      },
      select: expect.any(Object),
    });
    expect(dbMock.automationRun.update).toHaveBeenNthCalledWith(2, {
      where: { id: "run-1" },
      data: {
        status: "SUCCEEDED",
        finishedAt: expect.any(Date),
        durationMs: expect.any(Number),
      },
      select: expect.any(Object),
    });
  });

  it("marks later actions skipped when one action fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      })
    );
    dbMock.automationRun.update
      .mockResolvedValueOnce({
        id: "run-1",
        automationId: "aut-1",
        status: "RUNNING",
        triggerSource: "MANUAL",
        triggerPayload: {},
        contextSnapshot: {},
        startedAt: new Date("2026-04-22T00:00:00.000Z"),
        finishedAt: null,
        durationMs: null,
        errorCode: null,
        errorMessage: null,
        createdAt: new Date("2026-04-22T00:00:00.000Z"),
      })
      .mockResolvedValueOnce({
        id: "run-1",
        automationId: "aut-1",
        status: "FAILED",
        triggerSource: "MANUAL",
        triggerPayload: {},
        contextSnapshot: {},
        startedAt: new Date("2026-04-22T00:00:00.000Z"),
        finishedAt: new Date("2026-04-22T00:00:01.000Z"),
        durationMs: 1000,
        errorCode: "WEBHOOK_FAILED",
        errorMessage: "Webhook returned 500",
        createdAt: new Date("2026-04-22T00:00:00.000Z"),
      });
    dbMock.automationRun.findUnique.mockResolvedValue({
      startedAt: new Date("2026-04-22T00:00:00.000Z"),
    });
    dbMock.automationRunStep.create
      .mockResolvedValueOnce({ id: "step-1" })
      .mockResolvedValueOnce({ id: "step-2" });
    dbMock.automationRunStep.update.mockResolvedValue({
      id: "step-1",
      runId: "run-1",
      status: "FAILED",
      run: {
        automationId: "aut-1",
      },
    });

    const result = await executeQueuedAutomationRun({
      runId: "run-1",
      automation: {
        id: "aut-1",
        tableId: "tbl-1",
        definition: {
          version: 1,
          canvas: { nodes: [], edges: [] },
          trigger: { type: "manual" },
          condition: null,
          thenActions: [
            {
              id: "a1",
              type: "call_webhook",
              url: "https://example.invalid",
              method: "POST",
            },
            {
              id: "a2",
              type: "add_comment",
              target: "current_record",
              content: "later",
            },
          ],
          elseActions: [],
        },
      },
      context: {
        automationId: "aut-1",
        tableId: "tbl-1",
        recordId: "rec-1",
        record: { id: "rec-1", status: "draft" },
        previousRecord: null,
        changedFields: [],
        triggerSource: "MANUAL",
        triggeredAt: "2026-04-22T00:00:00.000Z",
        actor: { id: "usr-1" },
      },
    });

    expect(result.success).toBe(false);
    expect(dbMock.automationRunStep.create).toHaveBeenNthCalledWith(1, {
      data: {
        runId: "run-1",
        nodeId: "a1",
        stepType: "call_webhook",
        branch: "THEN",
        status: "RUNNING",
        input: {
          id: "a1",
          type: "call_webhook",
          url: "https://example.invalid",
          method: "POST",
        },
        startedAt: expect.any(Date),
      },
      select: { id: true },
    });
    expect(dbMock.automationRunStep.update).toHaveBeenCalledWith({
      where: { id: "step-1" },
      data: {
        status: "FAILED",
        errorCode: "WEBHOOK_FAILED",
        errorMessage: "Webhook returned 500",
        finishedAt: expect.any(Date),
      },
      select: expect.any(Object),
    });
    expect(dbMock.automationRunStep.create).toHaveBeenNthCalledWith(2, {
      data: {
        runId: "run-1",
        nodeId: "a2",
        stepType: "add_comment",
        branch: "THEN",
        status: "SKIPPED",
        input: {
          id: "a2",
          type: "add_comment",
          target: "current_record",
          content: "later",
        },
      },
    });
    expect(dbMock.automationRun.update).toHaveBeenNthCalledWith(2, {
      where: { id: "run-1" },
      data: {
        status: "FAILED",
        finishedAt: expect.any(Date),
        durationMs: expect.any(Number),
        errorCode: "WEBHOOK_FAILED",
        errorMessage: "Webhook returned 500",
      },
      select: expect.any(Object),
    });
  });
});
