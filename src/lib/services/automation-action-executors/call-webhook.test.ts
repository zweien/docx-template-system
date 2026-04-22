import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeCallWebhookAction } from "@/lib/services/automation-action-executors/call-webhook";

describe("executeCallWebhookAction", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns success when webhook responds with ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
      })
    );

    const result = await executeCallWebhookAction({
      action: {
        id: "a1",
        type: "call_webhook",
        url: "https://example.com/hook",
        method: "POST",
        body: { hello: "world" },
      },
      context: {
        automationId: "aut_1",
        tableId: "tbl_1",
        record: { id: "rec-1" },
        previousRecord: null,
        changedFields: [],
        triggerSource: "MANUAL",
        triggeredAt: "2026-04-22T00:00:00.000Z",
        actor: { id: "usr_1" },
      },
      runId: "run_1",
    });

    expect(result).toEqual({
      success: true,
      data: { status: 204 },
    });
  });

  it("returns mapped error when webhook fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      })
    );

    const result = await executeCallWebhookAction({
      action: {
        id: "a1",
        type: "call_webhook",
        url: "https://example.com/hook",
        method: "POST",
      },
      context: {
        automationId: "aut_1",
        tableId: "tbl_1",
        record: { id: "rec-1" },
        previousRecord: null,
        changedFields: [],
        triggerSource: "MANUAL",
        triggeredAt: "2026-04-22T00:00:00.000Z",
        actor: { id: "usr_1" },
      },
      runId: "run_1",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("WEBHOOK_FAILED");
    }
  });
});
