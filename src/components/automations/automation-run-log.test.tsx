import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AutomationRunLog } from "@/components/automations/automation-run-log";

describe("AutomationRunLog", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads run detail when user expands a run", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            run: {
              id: "run-1",
              automationId: "aut-1",
              status: "FAILED",
              triggerSource: "MANUAL",
              triggerPayload: { source: "manual" },
              contextSnapshot: { tableId: "tbl-1" },
              startedAt: "2026-04-22T00:00:00.000Z",
              finishedAt: "2026-04-22T00:00:01.000Z",
              durationMs: 1000,
              errorCode: "WEBHOOK_FAILED",
              errorMessage: "Webhook returned 500",
              createdAt: "2026-04-22T00:00:00.000Z",
            },
            steps: [
              {
                id: "step-1",
                runId: "run-1",
                nodeId: "a1",
                stepType: "call_webhook",
                branch: "THEN",
                status: "FAILED",
                input: { status: "pending", retry: 0 },
                output: { status: "failed", retry: 1 },
                errorCode: "WEBHOOK_FAILED",
                errorMessage: "Webhook returned 500",
                startedAt: "2026-04-22T00:00:00.000Z",
                finishedAt: "2026-04-22T00:00:01.000Z",
                durationMs: 1000,
              },
            ],
          },
        }),
      })
    );

    render(
      <AutomationRunLog
        items={[
          {
            id: "run-1",
            automationId: "aut-1",
            status: "FAILED",
            triggerSource: "MANUAL",
            triggerPayload: {},
            contextSnapshot: {},
            startedAt: "2026-04-22T00:00:00.000Z",
            finishedAt: "2026-04-22T00:00:01.000Z",
            durationMs: 1000,
            errorCode: "WEBHOOK_FAILED",
            errorMessage: "Webhook returned 500",
            createdAt: "2026-04-22T00:00:00.000Z",
          },
        ]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "详情" }));

    await waitFor(() => {
      expect(screen.getByText("步骤执行")).toBeInTheDocument();
    });
    expect(screen.getByText("Webhook returned 500")).toBeInTheDocument();
    expect(screen.getByText("差异摘要")).toBeInTheDocument();
    expect(screen.getByText("status")).toBeInTheDocument();
    expect(screen.getByText(/pending → failed/)).toBeInTheDocument();
  });

  it("shows helper text and reloads detail when reloadToken changes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
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
          steps: [],
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(
      <AutomationRunLog
        items={[
          {
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
        ]}
        helperText="实时连接已断开"
        detailReloadToken={0}
      />
    );

    expect(screen.getByText("实时连接已断开")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "详情" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    rerender(
      <AutomationRunLog
        items={[
          {
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
        ]}
        helperText="实时连接已断开"
        detailReloadToken={1}
      />
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });
});
