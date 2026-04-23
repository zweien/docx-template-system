import { beforeEach, describe, expect, it, vi } from "vitest";

const { poolQueryMock } = vi.hoisted(() => ({
  poolQueryMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  pool: {
    query: poolQueryMock,
  },
}));

describe("automation-realtime.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("publishes an automation run update event through pg_notify", async () => {
    const { publishAutomationRealtimeEvent } = await import(
      "@/lib/services/automation-realtime.service"
    );

    await publishAutomationRealtimeEvent({
      type: "automation_run_updated",
      automationId: "aut-1",
      run: {
        id: "run-1",
        automationId: "aut-1",
        status: "RUNNING",
        triggerSource: "MANUAL",
        triggerPayload: {},
        contextSnapshot: {},
        startedAt: "2026-04-23T00:00:00.000Z",
        finishedAt: null,
        durationMs: null,
        errorCode: null,
        errorMessage: null,
        createdAt: "2026-04-23T00:00:00.000Z",
      },
    });

    expect(poolQueryMock).toHaveBeenCalledWith(expect.stringContaining("pg_notify"), [
      "automation_run_events",
      expect.stringContaining("\"automationId\":\"aut-1\""),
    ]);
  });

  it("subscribes and unsubscribes listeners by automationId", async () => {
    const { broadcastToAutomation, subscribeToAutomation } = await import(
      "@/lib/services/automation-realtime.service"
    );

    const listener = vi.fn();
    const unsubscribe = subscribeToAutomation("aut-1", listener);

    broadcastToAutomation("aut-1", {
      type: "automation_run_created",
      automationId: "aut-1",
      run: {
        id: "run-1",
        automationId: "aut-1",
        status: "PENDING",
        triggerSource: "MANUAL",
        triggerPayload: {},
        contextSnapshot: {},
        startedAt: null,
        finishedAt: null,
        durationMs: null,
        errorCode: null,
        errorMessage: null,
        createdAt: "2026-04-23T00:00:00.000Z",
      },
    });

    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    broadcastToAutomation("aut-1", {
      type: "automation_run_step_updated",
      automationId: "aut-1",
      runId: "run-1",
      stepId: "step-1",
      status: "SUCCEEDED",
    });

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
